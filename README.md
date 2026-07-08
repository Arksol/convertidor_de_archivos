# Convertidor HEIC/MOV → PNG/MP4

Convertidor de archivos que corre 100% en el navegador (sin backend, sin subir archivos a ningún servidor).

- **HEIC/HEIF → PNG** usando [`heic-to`](https://github.com/hoppergee/heic-to) (envuelve `libheif`, actualizado a la versión 1.22.x — a diferencia de `heic2any`, que usa una compilación congelada desde hace años y falla con fotos HDR/Live Photo de iPhones recientes). Hasta **10 imágenes en paralelo**. Probado con 10/10 archivos exitosos, PSNR promedio ~50.7dB contra el original.
- **MOV/M4V → MP4** usando [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm). Primero intenta un *remux* (`-c copy`, cambia solo el contenedor, cero recodificación — probado bit-exacto en 10/10 archivos). Si el códec no es compatible con MP4, recodifica en calidad muy alta (`-crf 16`) como respaldo. Pool de **2 motores en paralelo**.

## Uso

Abre `index.html` directamente en el navegador (doble clic) o publícalo en GitHub Pages. No necesita instalación ni build — las librerías se cargan desde CDN bajo demanda.

## Estructura

```
proyecto-convertidor/
├── index.html   ← toda la app (UI + lógica de conversión)
├── README.md
└── docs/
    ├── debug-report.md         ← bugs encontrados y cómo se resolvieron
    ├── pruebas-de-calidad.md   ← metodología y resultados de las pruebas con 10 archivos
    ├── deploy-checklist.md     ← pasos para publicar y verificar
    └── system-design.md        ← arquitectura y decisiones de diseño
```

## Notas técnicas

- La primera vez que se convierte un `.mov`, el navegador descarga el motor de `ffmpeg.wasm` (~25-30 MB por instancia del pool). Se queda en caché para las siguientes veces.
- **Fix cross-origin**: `ffmpeg.wasm` crea un worker interno. Si se carga desde un CDN mientras la página vive en otro dominio (ej. GitHub Pages), el navegador lo bloquea por política de mismo origen. Se soluciona pasando `classWorkerURL` como blob (ver `createFFmpegInstance()` en `index.html`).
- **HEIC**: se probó exhaustivamente que el fallback anterior (usar FFmpeg para HEIC difíciles) no servía — el build estándar de FFmpeg no tiene soporte HEIF. Ver `docs/debug-report.md` para el detalle.
- Videos muy grandes (varios GB) pueden ser lentos o consumir mucha memoria — es una limitación conocida de correr FFmpeg en WebAssembly, no de esta app.
- Todo el procesamiento ocurre en el dispositivo del usuario. Ningún archivo sale de su equipo.

## Próximos pasos posibles

- Empaquetar "Descargar todo" como un .zip real (con `jszip`) en vez de descargas individuales.
- Mostrar comparación de tamaño antes/después.
- Opción de elegir calidad (JPEG con `quality` en vez de PNG sin pérdida).
