const $ = (id) => document.getElementById(id);
const dropzone = $('dropzone');
const fileInput = $('fileInput');
const queue = $('queue');
let emptyMsg = $('emptyMsg');
const banner = $('banner');
const imageOutput = $('imageOutput');
const autoDelete = $('autoDelete');
const countNumber = $('countNumber');
const countText = $('countText');
const downloadAllBtn = $('downloadAllBtn');
const clearDownloadedBtn = $('clearDownloadedBtn');
const clearFinishedBtn = $('clearFinishedBtn');

const MAX_FILES_PER_BATCH = 30;
const IMAGE_CONCURRENCY = 10;
const FFMPEG_POOL_SIZE = 2;
const HEIC = new Set(['heic', 'heif']);
const IMG = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif']);
const FFMPEG_IMG = new Set(['tif', 'tiff']);
const VID = new Set(['mov', 'm4v', 'mp4', 'webm', 'avi', 'mkv']);
const MIME = { png:'image/png', jpeg:'image/jpeg', webp:'image/webp' };
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);
const VIDEO_BRANDS = new Set(['qt  ', 'isom', 'iso2', 'mp41', 'mp42', 'm4v ', 'avc1', 'dash']);
const VIDEO_BOXES = new Set(['ftyp', 'moov', 'mdat', 'free', 'wide']);

let HeicTo, FFmpegCtor, fetchFile, toBlobURL, JSZipCtor;
let libsReady = false, libsFailed = false, libsPromise = null, zipPromise = null;
let activeImageJobs = 0, itemSeq = 0;
const imageQueue = [], ffmpegPool = [], items = new Map();

function bannerText(msg, append = false){
  banner.textContent = append && banner.textContent ? `${banner.textContent}\n${msg}` : msg;
  banner.style.display = 'block';
}
function errText(err){ return err?.message || String(err || 'Error desconocido'); }
function extOf(name){ const i = String(name || '').lastIndexOf('.'); return i >= 0 ? name.slice(i + 1).toLowerCase() : ''; }
function baseName(name){
  const cleaned = String(name || 'archivo').replace(/\.[^.]+$/, '').replace(/^\.+/, '');
  return cleaned || 'archivo';
}
function fmtBytes(bytes){
  const units = ['B', 'KB', 'MB', 'GB']; let n = bytes || 0, i = 0;
  while (n >= 1024 && i < units.length - 1){ n /= 1024; i++; }
  return `${i ? n.toFixed(1) : n.toFixed(0)} ${units[i]}`;
}
function kind(ext){ if (HEIC.has(ext) || IMG.has(ext) || FFMPEG_IMG.has(ext)) return 'image'; if (VID.has(ext)) return 'video'; return 'bad'; }
function supported(ext){ return kind(ext) !== 'bad'; }
function outputName(fileName, ext){ return kind(ext) === 'video' ? `${baseName(fileName)}.mp4` : `${baseName(fileName)}.${imageOutput.value}`; }
function ascii(bytes, start, length){
  if (bytes.length < start + length) return '';
  return String.fromCharCode(...bytes.slice(start, start + length));
}
function brandsFromFtyp(bytes){
  if (ascii(bytes, 4, 4) !== 'ftyp') return [];
  const brands = [ascii(bytes, 8, 4)];
  for (let i = 16; i + 4 <= bytes.length; i += 4) brands.push(ascii(bytes, i, 4));
  return brands.filter(Boolean);
}
function isHeifHeader(bytes){ return brandsFromFtyp(bytes).some(brand => HEIF_BRANDS.has(brand)); }
function isVideoHeader(bytes){
  const box = ascii(bytes, 4, 4);
  if (!VIDEO_BOXES.has(box)) return false;
  if (box !== 'ftyp') return true;
  return brandsFromFtyp(bytes).some(brand => VIDEO_BRANDS.has(brand) || brand.startsWith('3g'));
}
function livePhotoName(name){ return /(^|[._-])live\.(heic|heif|mov|m4v)$/i.test(String(name || '')); }
async function fileHeader(file, length = 64){
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
}
async function validateSignature(file, ext){
  if (file.size < 16) throw new Error('El archivo esta incompleto o vacio.');
  if (!HEIC.has(ext) && !VID.has(ext)) return;
  const header = await fileHeader(file);
  if (HEIC.has(ext) && !isHeifHeader(header)) {
    throw new Error('El contenido no parece un HEIC/HEIF valido aunque el nombre termine en .HEIC. Si viene de una Live Photo, exporta la foto desde iPhone/iCloud como imagen normal o prueba con el .MOV asociado.');
  }
  if (VID.has(ext) && !isVideoHeader(header)) {
    throw new Error('El contenido no parece un video MOV/MP4 valido aunque el nombre termine en .MOV. Si viene de una Live Photo, vuelve a exportar el par desde iPhone/iCloud y selecciona el .MOV original.');
  }
}
function conversionMessage(item, err){
  const msg = errText(err);
  if (/El contenido no parece|incompleto|vacio/i.test(msg)) return msg;
  if (HEIC.has(item.ext) && /HEIF image not found|libheif|format not supported|invalid|heic|heif/i.test(msg)) {
    return 'No se pudo leer este HEIC. Si es Live Photo, prueba tambien con el archivo .MOV asociado o exporta la foto desde iPhone/iCloud como imagen normal.';
  }
  if (VID.has(item.ext) && /moov atom not found|Invalid data|could not find codec|unsupported|error opening/i.test(msg)) {
    return 'No se pudo leer este MOV. Si es parte de una Live Photo, vuelve a exportar el video original desde iPhone/iCloud y prueba otra vez.';
  }
  return msg;
}
function loadScript(src){
  return new Promise((resolve, reject) => {
    const old = [...document.scripts].find(s => s.src === src);
    if (old) { old.dataset.loaded === 'true' ? resolve() : old.addEventListener('load', resolve, { once:true }); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true; s.dataset.loaded = 'false';
    s.onload = () => { s.dataset.loaded = 'true'; resolve(); };
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}
async function loadLibs(){
  if (libsReady) return;
  if (libsFailed) throw new Error('Motores de conversión no disponibles.');
  if (libsPromise) return libsPromise;
  libsPromise = (async () => {
    try {
      const [ffmpegMod, utilMod] = await Promise.all([
        import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js'),
        import('https://unpkg.com/@ffmpeg/util@0.12.2/dist/esm/index.js'),
        loadScript('https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js'),
      ]);
      FFmpegCtor = ffmpegMod.FFmpeg;
      fetchFile = utilMod.fetchFile;
      toBlobURL = utilMod.toBlobURL;
      HeicTo = window.HeicTo;
      if (!FFmpegCtor || !fetchFile || !toBlobURL || !HeicTo) throw new Error('Librerías incompletas.');
      libsReady = true;
    } catch (err) {
      libsFailed = true;
      bannerText(`No se pudieron cargar los motores. Revisa conexión o bloqueadores de CDN. Detalle: ${errText(err)}`);
      throw err;
    }
  })();
  return libsPromise;
}
async function loadZip(){
  if (JSZipCtor) return JSZipCtor;
  if (zipPromise) return zipPromise;
  zipPromise = loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js').then(() => {
    JSZipCtor = window.JSZip;
    if (!JSZipCtor) throw new Error('JSZip no cargó.');
    return JSZipCtor;
  });
  return zipPromise;
}
loadLibs().catch(() => {});

function scheduleImage(task){
  return new Promise((resolve, reject) => { imageQueue.push({ task, resolve, reject }); pumpImages(); });
}
function pumpImages(){
  while (activeImageJobs < IMAGE_CONCURRENCY && imageQueue.length){
    const job = imageQueue.shift(); activeImageJobs++;
    job.task().then(job.resolve, job.reject).finally(() => { activeImageJobs--; pumpImages(); });
  }
}
async function createFFmpeg(){
  const ffmpeg = new FFmpegCtor();
  const core = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  const pkg = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${core}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${core}/ffmpeg-core.wasm`, 'application/wasm'),
    classWorkerURL: await toBlobURL(`${pkg}/worker.js`, 'text/javascript'),
  });
  return ffmpeg;
}
async function ffmpegSlot(){
  let slot = ffmpegPool.find(s => !s.busy);
  if (!slot && ffmpegPool.length < FFMPEG_POOL_SIZE) ffmpegPool.push(slot = { busy:false, instance:null });
  while (!slot) { await new Promise(r => setTimeout(r, 150)); slot = ffmpegPool.find(s => !s.busy); }
  slot.busy = true;
  try { if (!slot.instance) slot.instance = await createFFmpeg(); return slot; }
  catch (err) { slot.busy = false; throw err; }
}
async function runFF(task){ const slot = await ffmpegSlot(); try { return await task(slot.instance); } finally { slot.busy = false; } }

async function heicToImage(file){
  const out = imageOutput.value;
  const options = { blob:file, type:MIME[out] || 'image/png' };
  if (out !== 'png') options.quality = 0.95;
  return HeicTo(options);
}
function canvasBlob(canvas, mime, quality){
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo crear la imagen.')), mime, quality));
}
async function imageViaBrowser(file, ext){
  const canvas = document.createElement('canvas');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation:'from-image' });
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d', { alpha:true }).drawImage(bitmap, 0, 0);
    bitmap.close();
  } catch {
    const url = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; canvas.getContext('2d').drawImage(img, 0, 0); resolve(); };
        img.onerror = () => reject(new Error('El navegador no pudo leer esta imagen.'));
        img.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }
  const out = imageOutput.value;
  const blob = await canvasBlob(canvas, MIME[out], out === 'png' ? undefined : 0.95);
  if (ext === 'gif') blob.warning = 'GIF convertido como imagen fija; no conserva animación.';
  return blob;
}
async function imageViaFFmpeg(file, ext, ffmpeg, progress){
  const out = imageOutput.value, outExt = out === 'jpeg' ? 'jpg' : out;
  const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const input = `in_${token}.${ext}`, output = `out_${token}.${outExt}`;
  const onProg = ({ progress:p }) => progress(Math.min(Math.max(p * 100, 0), 99));
  ffmpeg.on('progress', onProg);
  try {
    await ffmpeg.writeFile(input, await fetchFile(file));
    await ffmpeg.exec(['-y', '-i', input, '-frames:v', '1', output]);
    const data = await ffmpeg.readFile(output);
    return new Blob([data.buffer], { type:MIME[out] });
  } finally {
    ffmpeg.off('progress', onProg);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}
async function videoToMp4(file, ext, ffmpeg, progress){
  const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const input = `in_${token}.${ext}`, output = `out_${token}.mp4`;
  const onProg = ({ progress:p }) => progress(Math.min(Math.max(p * 100, 0), 99));
  ffmpeg.on('progress', onProg);
  try {
    await ffmpeg.writeFile(input, await fetchFile(file));
    try { await ffmpeg.exec(['-y', '-i', input, '-map', '0', '-c', 'copy', '-movflags', 'faststart', output]); }
    catch {
      await ffmpeg.exec(['-y', '-i', input, '-map', '0:v:0?', '-map', '0:a:0?', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', 'faststart', output]);
    }
    const data = await ffmpeg.readFile(output);
    return new Blob([data.buffer], { type:'video/mp4' });
  } finally {
    ffmpeg.off('progress', onProg);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}

function setProgress(item, p){ item.fill.style.width = `${p}%`; item.pct.textContent = `${Math.floor(p)}%`; }
function setError(item, msg){
  item.state = 'error'; item.row.classList.remove('queued'); item.row.classList.add('error'); item.status.textContent = '';
  const span = document.createElement('span'); span.className = 'err-msg'; span.textContent = msg.slice(0, 180); span.title = msg; item.status.appendChild(span);
}
function button(label, cls, fn){ const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.addEventListener('click', fn); return b; }
function updateCounters(){
  const total = items.size, done = [...items.values()].filter(i => i.state === 'done').length, downloaded = [...items.values()].filter(i => i.downloaded).length;
  countNumber.textContent = total; countText.textContent = total === 1 ? 'archivo' : 'archivos';
  downloadAllBtn.style.display = done > 1 ? 'inline-block' : 'none';
  clearFinishedBtn.style.display = done ? 'inline-block' : 'none';
  clearDownloadedBtn.style.display = downloaded ? 'inline-block' : 'none';
  if (!total && !emptyMsg) { emptyMsg = document.createElement('div'); emptyMsg.id = 'emptyMsg'; emptyMsg.className = 'empty'; emptyMsg.textContent = 'Aún no hay archivos en cola — arrastra o selecciona arriba.'; queue.appendChild(emptyMsg); }
}
function removeItem(id){
  const item = items.get(id); if (!item) return;
  if (item.url) URL.revokeObjectURL(item.url);
  item.file = null; item.blob = null; item.row.remove(); items.delete(id); updateCounters();
}
function triggerDownload(url, name){ const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function markDownloaded(item){ item.downloaded = true; updateCounters(); if (autoDelete.checked) setTimeout(() => removeItem(item.id), 500); }
function downloadItem(id){ const item = items.get(id); if (!item?.url) return; triggerDownload(item.url, item.outputName); markDownloaded(item); }
async function downloadAll(){
  const done = [...items.values()].filter(i => i.state === 'done' && i.blob);
  if (!done.length) return;
  if (done.length === 1) return downloadItem(done[0].id);
  downloadAllBtn.disabled = true; downloadAllBtn.textContent = 'Preparando .zip…';
  try {
    const JSZip = await loadZip(); const zip = new JSZip(); done.forEach(i => zip.file(i.outputName, i.blob));
    const blob = await zip.generateAsync({ type:'blob', compression:'STORE', streamFiles:true }, m => { downloadAllBtn.textContent = `ZIP ${m.percent.toFixed(0)}%`; });
    const url = URL.createObjectURL(blob); triggerDownload(url, 'archivos_convertidos.zip'); setTimeout(() => URL.revokeObjectURL(url), 30000); done.forEach(markDownloaded);
  } catch (err) { bannerText(`No se pudo crear el .zip. Descarga individualmente. Detalle: ${errText(err)}`, true); }
  finally { downloadAllBtn.disabled = false; downloadAllBtn.textContent = 'Descargar todo (.zip)'; }
}
function clearDownloaded(){ [...items.values()].filter(i => i.downloaded).forEach(i => removeItem(i.id)); }
function clearFinished(){ [...items.values()].filter(i => i.state === 'done').forEach(i => removeItem(i.id)); }

function makeRow(file, ext){
  const item = { id:++itemSeq, file, ext, state:'queued', outputName:outputName(file.name, ext), blob:null, url:null, downloaded:false, row:document.createElement('div') };
  item.row.className = 'row queued';
  const info = document.createElement('div'), name = document.createElement('div'), size = document.createElement('div');
  name.className = 'name'; name.textContent = file.name; size.className = 'size'; size.textContent = fmtBytes(file.size); info.append(name, size);
  if (HEIC.has(ext)) {
    const note = document.createElement('div'); note.className = 'note';
    note.textContent = livePhotoName(file.name) ? 'Live Photo HEIC detectado; si falla, agrega el .MOV asociado o exporta la foto normal.' : 'iPhone HEIC detectado; la parte Live Photo no se convierte aqui.';
    info.appendChild(note);
  } else if (VID.has(ext) && livePhotoName(file.name)) {
    const note = document.createElement('div'); note.className = 'note'; note.textContent = 'MOV de Live Photo detectado; se convertira a MP4.'; info.appendChild(note);
  }
  const flow = document.createElement('div'); flow.className = 'fmt-flow';
  const from = document.createElement('span'), arrow = document.createElement('span'), to = document.createElement('span');
  from.className = 'from'; from.textContent = ext ? ext.toUpperCase() : 'SIN EXT'; arrow.textContent = '→'; to.className = 'to'; to.textContent = kind(ext) === 'video' ? 'MP4' : imageOutput.value.toUpperCase(); flow.append(from, arrow, to);
  const bar = document.createElement('div'); bar.className = 'bar-wrap'; const track = document.createElement('div'); track.className = 'bar-track'; item.fill = document.createElement('div'); item.fill.className = 'bar-fill'; item.pct = document.createElement('span'); item.pct.className = 'pct'; item.pct.textContent = 'cola'; track.appendChild(item.fill); bar.append(track, item.pct);
  item.status = document.createElement('div'); item.status.className = 'status'; item.status.textContent = 'en cola'; item.row.append(info, flow, bar, item.status);
  return item;
}
function handleFiles(list){
  const files = [...list]; if (!files.length) return; if (emptyMsg) { emptyMsg.remove(); emptyMsg = null; }
  if (files.length > MAX_FILES_PER_BATCH) bannerText(`Se recibieron ${files.length} archivos. Solo se procesan los primeros ${MAX_FILES_PER_BATCH}.`, true);
  files.slice(0, MAX_FILES_PER_BATCH).forEach(file => { const item = makeRow(file, extOf(file.name)); items.set(item.id, item); queue.appendChild(item.row); updateCounters(); processFile(item); });
}
async function processFile(item){
  if (!supported(item.ext)) { setError(item, 'Formato no soportado. Usa HEIC, HEIF, JPG, PNG, WEBP, BMP, GIF, TIFF, MOV, MP4, M4V, WEBM, AVI o MKV.'); return updateCounters(); }
  try {
    await validateSignature(item.file, item.ext);
    await loadLibs(); item.state = 'processing'; item.row.classList.remove('queued'); item.status.textContent = 'convirtiendo…'; setProgress(item, 5);
    let out;
    if (HEIC.has(item.ext)) out = await scheduleImage(() => { setProgress(item, 35); return heicToImage(item.file); });
    else if (IMG.has(item.ext)) out = await scheduleImage(() => { setProgress(item, 30); return imageViaBrowser(item.file, item.ext); });
    else if (FFMPEG_IMG.has(item.ext)) out = await runFF(ffmpeg => imageViaFFmpeg(item.file, item.ext, ffmpeg, p => setProgress(item, p)));
    else out = await runFF(ffmpeg => videoToMp4(item.file, item.ext, ffmpeg, p => setProgress(item, p)));
    if (!out) throw new Error('No se generó archivo de salida.');
    item.file = null; item.blob = out; item.url = URL.createObjectURL(out); item.state = 'done'; setProgress(item, 100); item.row.classList.add('done');
    item.status.textContent = ''; item.status.append(button('Descargar', 'btn btn-dl', () => downloadItem(item.id)), button('Borrar', 'btn btn-danger', () => removeItem(item.id)));
    if (out.warning) bannerText(`${out.warning} Archivo: ${item.outputName}`, true);
  } catch (err) {
    setError(item, conversionMessage(item, err));
  } finally { updateCounters(); }
}

dropzone.addEventListener('click', () => fileInput.click());
['dragenter','dragover'].forEach(e => dropzone.addEventListener(e, ev => { ev.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave','drop'].forEach(e => dropzone.addEventListener(e, ev => { ev.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', e => { handleFiles(e.target.files); fileInput.value = ''; });
downloadAllBtn.addEventListener('click', downloadAll);
clearDownloadedBtn.addEventListener('click', clearDownloaded);
clearFinishedBtn.addEventListener('click', clearFinished);
