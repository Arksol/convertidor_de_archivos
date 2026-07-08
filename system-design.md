# System Design — Convertidor HEIC/MOV → PNG/MP4

## Objetivo
Convertir HEIC/HEIF → PNG y MOV/M4V → MP4 enteramente en el navegador del usuario, sin backend, preservando la máxima calidad posible, con capacidad de procesar lotes de 30+ archivos.

## Arquitectura

```
┌─────────────────────────── navegador del usuario ───────────────────────────┐
│                                                                               │
│  ┌───────────┐      ┌──────────────────┐      ┌─────────────────────────┐   │
│  │ Dropzone   │─────▶│  Router por      │      │   Salida                │   │
│  │ (drag/drop │      │  extensión       │      │   (Blob + URL.create    │   │
│  │  o input)  │      │  .heic/.heif ──┐ │      │   ObjectURL + <a        │   │
│  └───────────┘      │  .mov/.m4v ───┐ │ │      │   download>)            │   │
│                      └────────────────┼─┼──────┘         ▲                  │
│                                       │ │                 │                  │
│                    ┌──────────────────▼─┼─────────────────┘                  │
│                    │  Cola de imágenes  │                                    │
│                    │  (10 en paralelo)  │                                    │
│                    │  motor: heic-to    │                                    │
│                    │  (libheif WASM)    │                                    │
│                    └─────────────────────                                    │
│                                        │                                     │
│                    ┌───────────────────▼──────────────────┐                 │
│                    │  Pool de 2 instancias FFmpeg (WASM)   │                 │
│                    │  - remux -c copy (preferido)          │                 │
│                    │  - recodifica CRF16 (respaldo)        │                 │
│                    └────────────────────────────────────────┘                │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
        ▲ carga bajo demanda (lazy) vía CDN, solo cuando se necesita
        │
   unpkg.com (@ffmpeg/*)  ·  cdn.jsdelivr.net (heic-to)
```

## Decisiones de diseño

### 1. Todo corre en el cliente (sin backend)
**Por qué:** privacidad (el archivo nunca sale del equipo), costo cero de hosting, despliegue trivial en GitHub Pages.
**Trade-off:** el navegador tiene menos CPU/memoria que un servidor — de ahí las decisiones de concurrencia limitada (ver punto 3).

### 2. Dos motores distintos para dos tipos de archivo
- **Imágenes → `heic-to`** (envuelve `libheif`, la librería de referencia de la industria, actualizada). No usa `ffmpeg.wasm` porque, como se comprobó en las pruebas de esta iteración, el build estándar de FFmpeg no incluye soporte HEIF.
- **Video → `ffmpeg.wasm`**. Preferido sobre alternativas porque soporta remux (`-c copy`) — la única forma de garantizar cero pérdida de calidad en la conversión de contenedor.

### 3. Concurrencia distinta por tipo de trabajo
- **Imágenes: 10 en paralelo.** `heic-to` no comparte estado pesado entre llamadas, así que 10 tareas simultáneas son seguras y aprovechan que el decode es relativamente barato (~250ms/imagen en las pruebas).
- **Video: pool de 2 instancias FFmpeg.** Cada instancia de `ffmpeg.wasm` carga ~25-30MB de WASM y **no es segura para llamadas concurrentes sobre la misma instancia** (el filesystem virtual interno se pisaría). La alternativa de una sola instancia en fila es más segura pero más lenta; un pool de 2 balancea velocidad contra riesgo de quedarse sin memoria del navegador.

### 4. Carga perezosa (lazy loading)
Las librerías (`heic-to`, `@ffmpeg/*`) solo se descargan la primera vez que se necesitan, no al abrir la página. Esto evita que alguien que solo convierte imágenes pague el costo de red del motor de video (~30MB) y viceversa.

### 5. Manejo de errores visible, no silencioso
Cualquier fallo (de red, de librería, de archivo no soportado) se muestra en la interfaz con un mensaje entendible, en vez de que la conversión simplemente no haga nada. Esto fue clave para diagnosticar los dos bugs reales encontrados en esta iteración (worker cross-origin de FFmpeg, y el fallback roto de HEIC).

## Límites conocidos del diseño
- Sin backend, no hay forma de garantizar decodificación 100% de cualquier variante de HEIC (ej. HDR gain map muy nuevo) — depende de que el navegador soporte bien WebAssembly y de que `heic-to` mantenga `libheif` al día.
- Videos de varios GB pueden agotar la memoria del navegador (límite conocido de FFmpeg compilado a WebAssembly, no arreglable desde la app).
- "Descargar todo" dispara descargas individuales en secuencia, no genera un `.zip` — mencionado como mejora futura en el README.

## Alternativa considerada y descartada: backend ligero
Se evaluó al inicio del proyecto (ver conversación previa). Se descartó para esta fase por requerir hosting, romper la garantía de "el archivo nunca sale de tu equipo", y no ser necesario dado que el 90% de los casos de uso (fotos y videos personales de tamaño normal) funcionan bien 100% en navegador. Si en el futuro se necesita procesar archivos muy grandes o en volumen alto, esta es la ruta de escalamiento natural.
