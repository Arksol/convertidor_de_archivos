# Pruebas locales realizadas

## Validaciones hechas antes del commit

1. Se extrajo el JavaScript embebido/refactorizado y se verificó la sintaxis con:

```bash
node --check app_short.js
```

Resultado: sin errores de sintaxis.

2. Se revisó que los nombres de archivos ya no se inserten con `innerHTML`.

Resultado: los nombres dinámicos se colocan con `textContent`.

3. Se verificó que existan llamadas a `URL.revokeObjectURL()` para liberar memoria al borrar descargas y URLs temporales.

4. Se verificó que el límite de lote esté definido en `MAX_FILES_PER_BATCH = 30`.

5. Se verificó que la carga de librerías use `libsPromise` para evitar cargas paralelas duplicadas.

## Conversiones cubiertas por diseño

- HEIC/HEIF a PNG, JPEG o WEBP.
- JPG/JPEG, PNG, WEBP, BMP y GIF a PNG, JPEG o WEBP.
- TIFF/TIF a PNG, JPEG o WEBP mediante FFmpeg.
- MOV, M4V, MP4, WEBM, AVI y MKV a MP4.

## Pendiente recomendado

Hacer una prueba manual en navegador con archivos reales de iPhone:

- `IMG_2033-live.HEIC`
- Un `.MOV` de Live Photo
- Un lote de 30 archivos mixtos
- Un video grande para medir memoria y tiempo
