# Deploy Checklist — Convertidor HEIC/MOV → PNG/MP4

## Antes de subir

- [ ] Reemplazar `index.html` y `README.md` locales por los de esta entrega.
- [ ] Confirmar que el nombre de la carpeta local coincide con el repo: `convertidor_de_archivos`.
- [ ] Revisar que no haya archivos de prueba (`.heic`, `.mov`, `node_modules/`) sueltos en la carpeta antes de hacer commit — deben quedar solo `index.html`, `README.md`, `.gitignore` y `docs/`.

## Comandos

```bash
cd "C:\Users\ulise\OneDrive\Escritorio\proyectos-programación\convertidor_de_archivos"
git add .
git commit -m "Reemplaza heic2any por heic-to (libheif actualizado); documenta pruebas de calidad"
git push
```

## Verificación post-deploy (GitHub Pages)

1. Esperar 1–2 minutos y revisar la pestaña **Actions** del repo — el despliegue debe verse con palomita verde.
2. Abrir `https://arksol.github.io/convertidor_de_archivos/`.
3. **Prueba mínima (obligatoria):** subir 1 archivo `.heic` y 1 `.mov` reales, confirmar que ambos descargan correctamente y se abren sin errores.
4. **Prueba de carga (recomendada):** subir 10 archivos mixtos (HEIC + MOV) a la vez, confirmar que todos terminan sin que la pestaña se congele.
5. Si algo fallara, el aviso rojo en la parte superior de la página debe mostrar un mensaje de error legible — copiarlo y compartirlo para seguir depurando.

## Rollback

Si la nueva versión rompe algo que antes funcionaba:
```bash
git log --oneline   # identificar el commit anterior
git revert <hash-del-commit-problemático>
git push
```
GitHub Pages se actualiza solo con el nuevo `main`.

## Riesgos conocidos (no bloquean el deploy, pero hay que tenerlos presentes)

- **Dependencia de CDNs externos** (`unpkg.com`, `cdn.jsdelivr.net`). Si alguno cae, la conversión no carga — la app lo detecta y muestra el aviso rojo en vez de quedarse en blanco, pero no hay reintento automático todavía.
- **Fotos HDR/Live Photo muy nuevas** de iPhone pueden seguir sin ser 100% compatibles (ver `docs/pruebas-de-calidad.md`, sección "Lo que no se pudo probar"). El mensaje de error ahora es claro y sugiere exportarlas como JPEG desde el propio iPhone.
- **Memoria del navegador** con videos muy grandes o muchos a la vez — limitación conocida de FFmpeg en WebAssembly, no de la app.
