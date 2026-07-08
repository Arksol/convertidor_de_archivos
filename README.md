# Convertidor local de archivos

Convertidor de archivos que corre en el navegador. No usa backend y no sube los archivos a un servidor propio: la conversión ocurre en el dispositivo del usuario después de cargar los motores desde CDN.

## Conversiones principales

- **HEIC/HEIF → PNG/JPEG/WEBP** con `heic-to@1.5.2`, basado en `libheif`. La salida recomendada es **PNG** para conservar la mejor calidad visual posible después de decodificar el HEIC original.
- **MOV/M4V/MP4/WEBM/AVI/MKV → MP4** con `ffmpeg.wasm`. Primero intenta **remux** con `-c copy` para evitar pérdida de calidad. Si el contenedor/códec no es compatible con MP4, recodifica a **H.264/AAC** con `CRF 16`.

## Formatos aceptados

Imágenes:

- HEIC
- HEIF
- JPG/JPEG
- PNG
- WEBP
- BMP
- GIF
- TIFF/TIF

Video:

- MOV
- M4V
- MP4
- WEBM
- AVI
- MKV

## Uso

Abre `index.html` directamente en el navegador o publícalo en GitHub Pages.

1. Elige la salida de imágenes: PNG, JPEG o WEBP.
2. Arrastra o selecciona hasta **30 archivos**.
3. Espera a que termine cada conversión.
4. Descarga cada archivo o usa **Descargar todo (.zip)**.
5. Borra archivos convertidos con **Borrar**, **Borrar descargados** o activa **Borrar de la cola después de descargar**.

## Estructura

```txt
convertidor_de_archivos/
├── index.html
├── styles.css
├── app.js
├── README.md
└── docs/
    └── pruebas-locales.md
```

## Cambios técnicos incluidos

- Validación estricta de formatos soportados.
- Límite de 30 archivos por lote para evitar saturar memoria.
- Cola de imágenes con hasta 10 conversiones en paralelo.
- Pool de 2 instancias de FFmpeg para videos y TIFF.
- Carga única de librerías mediante `libsPromise` para evitar cargas duplicadas.
- Código separado en `index.html`, `styles.css` y `app.js`.
- Limpieza con `finally` en FFmpeg para quitar listeners de progreso y archivos temporales.
- Uso de `textContent` para nombres de archivo, evitando inyección HTML por nombres maliciosos.
- `URL.revokeObjectURL()` al borrar archivos convertidos para liberar memoria.
- Descarga múltiple real con `JSZip`, en vez de disparar muchas descargas individuales.

## Limitaciones conocidas

- PNG no añade pérdida visual, pero **no garantiza conservar metadata** del HEIC original, como EXIF, ubicación, HDR, profundidad o Live Photo.
- En iPhone, una Live Photo suele tener imagen `.HEIC` y movimiento `.MOV`. Un archivo como `IMG_2033-live.HEIC` se convierte como imagen; el movimiento debe convertirse desde el `.MOV` correspondiente.
- GIF se convierte como imagen fija; no conserva animación.
- TIFF usa FFmpeg y puede tardar más.
- Videos grandes pueden consumir mucha memoria porque `ffmpeg.wasm` corre dentro del navegador.
- La app necesita internet la primera vez para cargar librerías desde CDN.
