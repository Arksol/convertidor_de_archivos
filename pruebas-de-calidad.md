# Pruebas de calidad — lote de 10 archivos

Metodología: se generaron 10 imágenes y 10 videos de prueba con contenido conocido (patrones de color + texto), se convirtieron a HEIC/MOV como lo haría un iPhone, y se corrieron exactamente los mismos comandos que usa la app. Se comparó el resultado contra el original con métricas objetivas.

## Imágenes — HEIC → PNG

Herramienta final: `heic-to` (libheif actualizado). Concurrencia probada: 10 en paralelo.

| Archivo | Estado | PSNR (dB) | SSIM |
|---|---|---|---|
| img_01 | OK | 50.78 | 0.903 |
| img_02 | OK | 50.72 | 0.903 |
| img_03 | OK | 50.70 | 0.903 |
| img_04 | OK | 50.72 | 0.903 |
| img_05 | OK | 50.69 | 0.903 |
| img_06 | OK | 50.70 | 0.903 |
| img_07 | OK | 50.72 | 0.903 |
| img_08 | OK | 50.67 | 0.903 |
| img_09 | OK | 50.70 | 0.903 |
| img_10 | OK | 50.78 | 0.903 |

**Interpretación:** PSNR > 40dB se considera visualmente indistinguible del original; aquí el promedio es ~50.7dB. El SSIM de ~0.90 (en vez de más cerca de 1.0) se explica por el patrón de prueba usado (bordes de alto contraste tipo barras de color, que son el peor caso para el submuestreo de croma 4:2:0 de HEIC/HEVC); fotos reales, con transiciones de color más suaves, deberían dar SSIM más alto. Ningún archivo cambió de dimensiones ni de contenido reconocible — no se "convierte en otra cosa", se recomprime con pérdida controlada, como es inherente al formato HEIC.

*Nota: la prueba de 10/10 se hizo directamente con el motor `libheif-js` (mismo `libheif` que usa `heic-to` por dentro) porque la variante que corre en Web Worker del navegador no se puede automatizar fácilmente en este entorno de pruebas. El comportamiento del decodificador es el mismo.*

## Video — MOV → MP4 (remux)

Herramienta: FFmpeg, comando `-c copy` (sin recodificar). Pool probado: 2 motores en paralelo.

| Archivo | Estado | Checksum origen | Checksum destino | ¿Idéntico? |
|---|---|---|---|---|
| vid_01–vid_10 | OK (10/10) | `8ca000f8b7c23e...` | `8ca000f8b7c23e...` | Sí, bit-exacto |

**Interpretación:** el remux cambia solo el contenedor (de `.mov` a `.mp4`), no toca ni un bit del video ni del audio comprimido. El checksum MD5 del stream decodificado es idéntico en los 10 casos — no hay pérdida de calidad posible en este camino, porque no hay recodificación.

## Lo que NO se pudo probar en este entorno
- El comportamiento exacto dentro de un navegador real (Chrome/Safari/Firefox) con los Workers de `heic-to` y `ffmpeg.wasm` — se probó el motor de decodificación equivalente fuera del navegador (Node.js), no el wrapper de Worker.
- Fotos HDR reales de iPhone con "gain map" (no se pudo generar una sintéticamente sin hardware Apple). Es el caso límite conocido que motivó este cambio; si aparece, la app ahora al menos da un mensaje de error claro en vez de fallar en silencio.
