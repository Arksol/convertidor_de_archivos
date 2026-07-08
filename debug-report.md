# Debug Report — Convertidor HEIC/MOV → PNG/MP4

## Síntoma reportado
"No me deja convertir archivos" al subir un `.HEIC` real de iPhone (`IMG_2033-live.HEIC`), con error visible en pantalla: `Error: ERR_LIBHEIF format not supported`.

## Investigación

### Hallazgo 1 — Worker cross-origin en ffmpeg.wasm (resuelto en iteración anterior)
`ffmpeg.wasm` crea un Worker interno. Cargado desde un CDN (unpkg) mientras la página vive en otro origen (GitHub Pages), el navegador bloquea la creación del worker por política de mismo origen.
**Fix:** pasar `classWorkerURL` como blob local (`toBlobURL`) al llamar `ffmpeg.load()`.

### Hallazgo 2 — `heic2any` no puede decodificar HEIC de iPhones recientes
`ERR_LIBHEIF format not supported` es un error conocido y sin resolver en el repositorio de `heic2any` (issues #50 y #61), reproducido específicamente con HEIC de iPhone 15 Pro / 16 con iOS 18. La causa raíz: `heic2any` embebe una compilación de `libheif.js` que no se ha actualizado en años y no entiende variantes nuevas de HEIC (HDR con gain map, Live Photos).

### Hallazgo 3 — El "plan B" con FFmpeg (agregado como respaldo) NUNCA iba a funcionar
Se instaló FFmpeg 6.1.1 (misma versión base que usa `@ffmpeg/core` en el navegador) en un entorno de prueba y se confirmó:
```
$ ffmpeg -i img_01.heic out.png
[mov,mp4,m4a,3gp,3g2,mj2 @ ...] moov atom not found
Error opening input file img_01.heic.
```
```
$ ffmpeg -version | grep libheif
(sin resultado — no está compilado con soporte HEIF)
```
**Conclusión:** el build estándar de FFmpeg no incluye `libheif`. El fallback que se había agregado a la app fallaba silenciosamente en el mismo tipo de archivo que `heic2any`, sin aportar ninguna cobertura real.

### Solución final
Reemplazar `heic2any` por [`heic-to`](https://github.com/hoppergee/heic-to), una librería que se mantiene activa y sigue las versiones más recientes de `libheif` (actualmente 1.22.x). Se eliminó el fallback de FFmpeg para HEIC (no aporta nada, según Hallazgo 3) y se mantiene FFmpeg exclusivamente para el trabajo de video, donde sí es la herramienta correcta.

## Pruebas de validación (10 archivos, ver `docs/pruebas-de-calidad.md` para el detalle completo)
| Prueba | Resultado |
|---|---|
| 10 HEIC → PNG con FFmpeg nativo (el fallback viejo) | 0/10 — no abre el archivo |
| 10 HEIC → PNG con `libheif-js` / `heic-to` (libheif actualizado) | 10/10 — PSNR promedio ~50.7 dB |
| 10 MOV → MP4 remux (`-c copy`) | 10/10 — checksum MD5 idéntico al original |

## Estado
Resuelto. Pendiente de que el usuario confirme con su archivo real (`IMG_2033-live.HEIC`) en producción.
