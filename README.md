# ASSIS — Asistencia Escolar (versión .exe)

App de escritorio para Windows del sistema de asistencia **ASSIS** (Juan Miguel Roo):
asistencia de estudiantes por sección/aula y asistencia de personal general.

## Cómo funciona esta versión

- **100% local y sin internet:** todos los datos se guardan en la propia computadora,
  en el almacenamiento interno de la app (**IndexedDB**). Consultas, registras y
  editas sin conexión.
- **Respaldar (botón en el menú lateral):** cuando el usuario lo pulsa, la app sube
  una copia completa de los datos a un repositorio **privado** de su GitHub
  (`assis-respaldo/respaldo.json` por defecto).
- **Restaurar:** baja la última copia de la nube y la deja en local, reemplazando
  los datos de esa computadora. Sirve al cambiar de PC o ante cualquier pérdida.
- **Configurar respaldo:** ahí se pega el token de GitHub (se guarda solo en esa
  computadora) y el nombre del repositorio de respaldo.

## Compilación

El instalador `.exe` se compila solo en GitHub Actions (Windows) con cada push a
`main` o al lanzar el workflow **«Compilar ASSIS (.exe)»** manualmente.
El archivo queda en la sección **Releases** de este repositorio
(`ASSIS-Instalador-1.0.0.exe`).

## Estructura

- `main.js` — proceso principal de Electron.
- `app/index.html` — la app completa (misma interfaz y lógica de siempre).
- `app/backup.js` — Respaldar / Restaurar contra la API de GitHub.
- `app/assets/` — librerías locales (jsPDF), fuente Playfair Display y logos:
  la app no descarga NADA de internet para funcionar.
