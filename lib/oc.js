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
