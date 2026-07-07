# Convertidor HEIC/MOV → PNG/MP4

Convertidor de archivos que corre 100% en el navegador (sin backend, sin subir archivos a ningún servidor).

- **HEIC/HEIF → PNG** usando [`heic2any`](https://github.com/alexcorvi/heic2any) (basado en `libheif`, mismo códec que usa iOS — sin pérdida de calidad).
- **MOV/M4V → MP4** usando [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm). Primero intenta un *remux* (`-c copy`, cambia solo el contenedor, cero recodificación). Si el códec no es compatible con MP4, recodifica en calidad muy alta (`-crf 16`) como respaldo.

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
- Videos muy grandes (varios GB) pueden ser lentos o consumir mucha memoria — es una limitación conocida de correr FFmpeg en WebAssembly, no de esta app.
- Todo el procesamiento ocurre en el dispositivo del usuario. Ningún archivo sale de su equipo.

## Próximos pasos posibles

- Añadir soporte de arrastrar carpetas completas.
- Mostrar comparación de tamaño antes/después.
- Opción de elegir calidad (JPEG con `quality` en vez de PNG sin pérdida).
