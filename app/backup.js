/* ═══════════════════════════════════════════════════════════════════
   RESPALDO EN LA NUBE — ASSIS
   - Respaldar: sube TODOS los datos locales a un repo PRIVADO de
     GitHub del usuario (archivo respaldo.json), solo cuando él pulsa.
   - Restaurar: baja la última copia y la deja en el almacenamiento
     local (IndexedDB), reemplazando lo que haya en esta computadora.
   El token de GitHub se guarda SOLO en esta app (localStorage) y se
   usa únicamente contra api.github.com.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const LS_TOKEN = 'assis-gh-token';
  const LS_REPO = 'assis-gh-repo';
  const LS_OWNER = 'assis-gh-owner';
  const DEFAULT_REPO = 'assis-respaldo';
  const FILE_NAME = 'respaldo.json';

  function bStatus(msg) {
    const el = document.getElementById('fb-status');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(el._bt);
    el._bt = setTimeout(() => { el.textContent = ''; }, 5000);
  }
  const getToken = () => (localStorage.getItem(LS_TOKEN) || '').trim();
  const getRepo = () => (localStorage.getItem(LS_REPO) || DEFAULT_REPO).trim();

  async function gh(path, opts = {}) {
    const token = getToken();
    const res = await fetch('https://api.github.com' + path, {
      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': opts.accept || 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    return res;
  }

  async function getOwner() {
    const cached = localStorage.getItem(LS_OWNER);
    if (cached) return cached;
    const res = await gh('/user');
    if (!res.ok) throw new Error('El token de GitHub no es válido (revisa Configurar respaldo).');
    const u = await res.json();
    localStorage.setItem(LS_OWNER, u.login);
    return u.login;
  }

  async function ensureRepo(owner, repo) {
    const res = await gh(`/repos/${owner}/${repo}`);
    if (res.status === 404) {
      const created = await gh('/user/repos', {
        method: 'POST',
        body: { name: repo, private: true, description: 'Respaldo de datos de la app ASSIS (no borrar)' }
      });
      if (!created.ok) throw new Error('No se pudo crear el repositorio de respaldo en GitHub.');
      return;
    }
    if (!res.ok) throw new Error('No se pudo acceder al repositorio de respaldo.');
  }

  const toB64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const fromB64 = (b64) => decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));

  /* ───────── CONFIGURACIÓN ───────── */
  window.assisConfigurar = () => {
    document.getElementById('gh-token-input').value = getToken();
    document.getElementById('gh-repo-input').value = getRepo();
    document.getElementById('modal-backup').classList.add('open');
  };
  window.assisPegarToken = async () => {
    try {
      let txt = '';
      if (window.assisPortapapeles) txt = await window.assisPortapapeles.pegar();
      if (!txt && navigator.clipboard && navigator.clipboard.readText) txt = await navigator.clipboard.readText();
      txt = (txt || '').trim();
      if (txt) {
        document.getElementById('gh-token-input').value = txt;
        bStatus('✓ Token pegado');
      } else {
        alert('El portapapeles está vacío. Primero copia tu token de GitHub y luego pulsa «Pegar».');
      }
    } catch (e) {
      alert('No se pudo pegar automáticamente. Haz clic en el campo del token y pulsa Ctrl+V.');
    }
  };
  window.assisGuardarConfig = () => {
    const token = document.getElementById('gh-token-input').value.trim();
    const repo = document.getElementById('gh-repo-input').value.trim() || DEFAULT_REPO;
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_REPO, repo);
    localStorage.removeItem(LS_OWNER);
    closeModal('modal-backup');
    bStatus(token ? '✓ Respaldo configurado' : 'Configuración guardada');
  };

  function requireToken() {
    if (!getToken()) {
      alert('Primero configura el respaldo: pega tu token de GitHub en «Configurar respaldo».');
      window.assisConfigurar();
      return false;
    }
    return true;
  }

  /* ───────── RESPALDAR ───────── */
  window.assisRespaldar = async () => {
    if (!requireToken()) return;
    if (!window.__assisDumpAll) { alert('La app aún está cargando, intenta de nuevo en un segundo.'); return; }
    try {
      bStatus('☁️ Subiendo respaldo…');
      const owner = await getOwner();
      const repo = getRepo();
      await ensureRepo(owner, repo);
      const datos = await window.__assisDumpAll();
      const payload = { app: 'ASSIS', version: 1, fecha: new Date().toISOString(), datos };
      const json = JSON.stringify(payload);
      if (json.length > 950000) {
        alert('El respaldo es muy grande para esta vía (más de ~1 MB de datos). Avísale a Alejandro.');
        return;
      }
      let sha = null;
      const existing = await gh(`/repos/${owner}/${repo}/contents/${FILE_NAME}`);
      if (existing.ok) { const j = await existing.json(); sha = j.sha; }
      const put = await gh(`/repos/${owner}/${repo}/contents/${FILE_NAME}`, {
        method: 'PUT',
        body: { message: 'Respaldo ASSIS ' + payload.fecha, content: toB64(json), ...(sha ? { sha } : {}) }
      });
      if (!put.ok) throw new Error('GitHub rechazó la subida del respaldo.');
      bStatus('✓ Respaldo subido a la nube');
      alert('Respaldo guardado en la nube ✓\n\nRepositorio: ' + owner + '/' + repo + '\nFecha: ' + new Date().toLocaleString());
    } catch (e) {
      bStatus('✗ Error al respaldar');
      alert('No se pudo respaldar: ' + e.message + '\n\nRevisa tu conexión a internet y el token de GitHub.');
    }
  };

  /* ───────── RESTAURAR ───────── */
  window.assisRestaurar = async () => {
    if (!requireToken()) return;
    if (!window.__assisLoadAll) { alert('La app aún está cargando, intenta de nuevo en un segundo.'); return; }
    if (!confirm('¿Restaurar la última copia de la nube?\n\nEsto REEMPLAZA todos los datos guardados en ESTA computadora por los del respaldo.')) return;
    try {
      bStatus('⬇️ Bajando respaldo…');
      const owner = await getOwner();
      const repo = getRepo();
      const res = await gh(`/repos/${owner}/${repo}/contents/${FILE_NAME}`);
      if (res.status === 404) { alert('Todavía no hay ningún respaldo en la nube para este repositorio.'); return; }
      if (!res.ok) throw new Error('No se pudo bajar el respaldo.');
      const j = await res.json();
      const payload = JSON.parse(fromB64(j.content));
      if (payload.app !== 'ASSIS' || !payload.datos) throw new Error('El archivo de la nube no es un respaldo válido de ASSIS.');
      await window.__assisLoadAll(payload.datos);
      if (window.__assisReloadUI) await window.__assisReloadUI();
      bStatus('✓ Respaldo restaurado');
      alert('Respaldo restaurado ✓\n\nDatos de la copia: ' + new Date(payload.fecha).toLocaleString());
    } catch (e) {
      bStatus('✗ Error al restaurar');
      alert('No se pudo restaurar: ' + e.message + '\n\nRevisa tu conexión a internet y el token de GitHub.');
    }
  };
})();
