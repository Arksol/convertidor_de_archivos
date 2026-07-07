# Convertidor HEIC/MOV → PNG/MP4

Convertidor de archivos que corre 100% en el navegador (sin backend, sin subir archivos a ningún servidor).

- **HEIC/HEIF → PNG** usando [`heic2any`](https://github.com/alexcorvi/heic2any) (basado en `libheif`, mismo códec que usa iOS — sin pérdida de calidad). Hasta 3 imágenes se procesan en paralelo.
- **MOV/M4V → MP4** usando [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm). Primero intenta un *remux* (`-c copy`, cambia solo el contenedor, cero recodificación). Si el códec no es compatible con MP4, recodifica en calidad muy alta (`-crf 16`) como respaldo. Los videos se procesan en fila (un solo motor de FFmpeg no puede convertir dos a la vez), pero puedes soltar 30+ de una vez y avanzan solos, uno tras otro.

## Uso

Abre `index.html` directamente en el navegador (doble clic) o publícalo en GitHub Pages. No necesita instalación ni build — las librerías se cargan desde CDN.

## Estructura

```
proyecto-convertidor/
├── index.html   ← toda la app (UI + lógica de conversión)
└── README.md
```

## Notas técnicas

- La primera vez que se convierte un archivo `.mov`, el navegador descarga el motor de `ffmpeg.wasm` (~25-30 MB). Se queda en caché para las siguientes veces.
- **Fix importante**: `ffmpeg.wasm` crea un worker interno. Si se carga desde un CDN (unpkg/jsdelivr) mientras la página vive en otro dominio (ej. GitHub Pages), el navegador bloquea ese worker por política de mismo origen. Se soluciona pasando `classWorkerURL` como blob (ver `getFFmpeg()` en `index.html`).
- Videos muy grandes (varios GB) pueden ser lentos o consumir mucha memoria — es una limitación conocida de correr FFmpeg en WebAssembly, no de esta app.
- Todo el procesamiento ocurre en el dispositivo del usuario. Ningún archivo sale de su equipo.
- Si algo falla al cargar los motores de conversión (sin internet, CDN bloqueado, etc.), aparece un aviso visible arriba de la página con el detalle del error.

## Próximos pasos posibles

- Empaquetar "Descargar todo" como un .zip real (con `jszip`) en vez de descargas individuales.
- Mostrar comparación de tamaño antes/después.
- Opción de elegir calidad (JPEG con `quality` en vez de PNG sin pérdida).
