// Orden de compra (OC) del cliente: se guarda en Supabase Storage (carpeta privada "ordenes-compra")
export const OC_TIPOS = 'application/pdf,image/jpeg,image/png,image/webp,image/heic';
export const OC_MAX = 10 * 1024 * 1024;

export function validarOC(file) {
  if (!file) return 'Elige el archivo de la orden de compra.';
  if (file.size > OC_MAX) return 'El archivo pesa más de 10 MB. Exporta el PDF más liviano o toma una foto.';
  if (!/pdf|jpe?g|png|webp|heic/i.test(file.type + file.name)) return 'Sube la OC en PDF o como foto (JPG o PNG).';
  return null;
}

// Sube el archivo y devuelve los campos que se guardan en el pedido
export async function subirOC(supabase, file, { referencia, numero, perfilId }) {
  const err = validarOC(file);
  if (err) return { error: err };
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const ruta = `${new Date().getFullYear()}/${String(referencia || 'oc').replace(/[^A-Za-z0-9-]/g, '')}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('ordenes-compra').upload(ruta, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { error: 'No se pudo subir la OC: ' + error.message };
  const ahora = new Date().toISOString();
  return { campos: { oc_numero: String(numero || '').trim(), oc_archivo: ruta, oc_nombre: file.name.slice(0, 120), oc_subida: ahora, oc_por: perfilId, estado: 'activo', activado: ahora } };
}

// Abre la OC en una pestaña nueva (enlace temporal de 5 minutos)
export async function verOC(supabase, ruta) {
  const w = window.open('', '_blank');
  const { data, error } = await supabase.storage.from('ordenes-compra').createSignedUrl(ruta, 300);
  if (error || !data) { if (w) w.close(); return error ? error.message : 'No se encontró el archivo.'; }
  if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  return null;
}

// Fotos muy grandes se reducen antes de subirlas (para que se puedan leer y suban rápido)
async function reducirFoto(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.2 * 1024 * 1024) return file;
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 2200 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

// Paso 1: solo sube el archivo y devuelve dónde quedó (la lectura y los datos van después)
export async function subirArchivoOC(supabase, file, referencia) {
  const err = validarOC(file);
  if (err) return { error: err };
  const f = await reducirFoto(file);
  const ext = (f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const ruta = `${new Date().getFullYear()}/${String(referencia || 'oc').replace(/[^A-Za-z0-9-]/g, '')}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('ordenes-compra').upload(ruta, f, { contentType: f.type || undefined, upsert: false });
  if (error) return { error: 'No se pudo subir la OC: ' + error.message };
  return { ruta, nombre: file.name.slice(0, 120) };
}

// Paso 2: la app lee la OC con inteligencia artificial
export async function leerOC(ruta) {
  try {
    const r = await fetch('/api/oc/leer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruta }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return { error: j.error || 'No se pudo leer la OC.', configuracion: !!j.configuracion };
    return { datos: j.datos };
  } catch { return { error: 'Sin conexión: no se pudo leer la OC.' }; }
}
