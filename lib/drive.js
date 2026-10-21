// Google Drive y Google Sheets con la cuenta de Google del taller. SOLO servidor.
// Permiso pedido: drive.file (la app solo ve y modifica los archivos y carpetas que ella misma crea).
// La cuenta se conecta una vez desde Ajustes → Google Drive; el permiso queda guardado en la tabla drive_cuenta.

export const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email'];
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
export const MIME_CARPETA = 'application/vnd.google-apps.folder';

export function googleConfigurado() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function urlConsentimiento(redirectUri, state) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
}

// Cambia el código que devuelve Google por el permiso permanente (refresh token) y el correo de la cuenta
export async function canjearCodigo(code, redirectUri) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || 'Google no aceptó el código');
  let email = null;
  try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()).email || null; } catch {}
  return { refresh: j.refresh_token || null, access: j.access_token, email };
}

// Cliente de Drive para una cuenta conectada
export function crearDrive(refreshToken) {
  let token = null, vence = 0;
  async function acceso() {
    if (token && Date.now() < vence - 60000) return token;
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' }),
    });
    const j = await r.json();
    if (!r.ok) {
      const e = new Error(j.error === 'invalid_grant' ? 'Google revocó o venció el permiso. Vuelve a conectar la cuenta en Ajustes → Google Drive.' : (j.error_description || j.error || 'No se pudo renovar el acceso a Google'));
      e.revocado = j.error === 'invalid_grant';
      throw e;
    }
    token = j.access_token; vence = Date.now() + (j.expires_in || 3600) * 1000;
    return token;
  }
  async function api(url, { method = 'GET', json, body, headers = {}, crudo = false } = {}) {
    const t = await acceso();
    const r = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + t, ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json ? JSON.stringify(json) : body,
    });
    if (!r.ok) {
      let msg = r.status + '';
      try { const j = await r.json(); msg = (j.error && (j.error.message || j.error)) || msg; } catch {}
      const e = new Error('Google ' + r.status + ': ' + msg);
      e.status = r.status;
      throw e;
    }
    if (crudo) return r;
    if (r.status === 204) return null;
    return r.json();
  }

  const F = 'id,name,webViewLink,mimeType,trashed';

  async function info(id) {
    try { return await api(`${DRIVE}/files/${id}?fields=${F}`); } catch (e) { if (e.status === 404) return null; throw e; }
  }
  async function carpeta(nombre, padre) {
    return api(`${DRIVE}/files?fields=${F}`, { method: 'POST', json: { name: nombre, mimeType: MIME_CARPETA, ...(padre ? { parents: [padre] } : {}) } });
  }
  // Sube un archivo. datos: Buffer / Uint8Array / string. convertirA: tipo de Google (Docs/Sheets) para convertirlo al subir.
  async function subir({ nombre, mime, datos, padre, convertirA }) {
    const limite = 'hawaiira' + Math.random().toString(36).slice(2);
    const meta = { name: nombre, ...(padre ? { parents: [padre] } : {}), ...(convertirA ? { mimeType: convertirA } : {}) };
    const cuerpo = Buffer.concat([
      Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`),
      Buffer.isBuffer(datos) ? datos : Buffer.from(datos),
      Buffer.from(`\r\n--${limite}--`),
    ]);
    return api(`${UPLOAD}/files?uploadType=multipart&fields=${F}`, { method: 'POST', body: cuerpo, headers: { 'Content-Type': `multipart/related; boundary=${limite}` } });
  }
  async function exportar(id, mime) {
    const r = await api(`${DRIVE}/files/${id}/export?mimeType=${encodeURIComponent(mime)}`, { crudo: true });
    return Buffer.from(await r.arrayBuffer());
  }
  async function descargar(id) {
    const r = await api(`${DRIVE}/files/${id}?alt=media`, { crudo: true });
    return Buffer.from(await r.arrayBuffer());
  }
  async function borrar(id) {
    try { await api(`${DRIVE}/files/${id}`, { method: 'DELETE' }); } catch (e) { if (e.status !== 404) throw e; }
  }
  // HTML → PDF: Google convierte el HTML en un documento, se exporta en PDF y se borra el documento temporal
  async function pdfDesdeHtml({ nombre, html, padre }) {
    const tmp = await subir({ nombre: nombre + ' (temporal)', mime: 'text/html; charset=UTF-8', datos: html, padre, convertirA: 'application/vnd.google-apps.document' });
    try {
      const pdf = await exportar(tmp.id, 'application/pdf');
      return await subir({ nombre: nombre + '.pdf', mime: 'application/pdf', datos: pdf, padre });
    } finally {
      await borrar(tmp.id).catch(() => {});
    }
  }
  async function mover(id, padre) {
    const f = await api(`${DRIVE}/files/${id}?fields=parents`);
    return api(`${DRIVE}/files/${id}?addParents=${padre}&removeParents=${(f.parents || []).join(',')}&fields=${F}`, { method: 'PATCH', json: {} });
  }
  // Mueve a otra carpeta (y opcionalmente cambia el nombre) en una sola llamada
  async function moverA(id, padre, nombre) {
    const f = await api(`${DRIVE}/files/${id}?fields=parents`);
    const quitar = (f.parents || []).filter((p) => p !== padre).join(',');
    return api(`${DRIVE}/files/${id}?addParents=${padre}${quitar ? '&removeParents=' + quitar : ''}&fields=${F}`, { method: 'PATCH', json: nombre ? { name: nombre } : {} });
  }

  // ---------- Hojas de cálculo ----------
  async function crearHoja(titulo, pestanas, padre) {
    const s = await api(SHEETS, { method: 'POST', json: { properties: { title: titulo, locale: 'es_VE', timeZone: 'America/Caracas' }, sheets: pestanas.map((t, i) => ({ properties: { sheetId: i, title: t, gridProperties: { frozenRowCount: 1 } } })) } });
    if (padre) await mover(s.spreadsheetId, padre);
    return { id: s.spreadsheetId, url: s.spreadsheetUrl };
  }
  async function agregarFilas(hojaId, pestana, filas) {
    if (!filas.length) return null;
    return api(`${SHEETS}/${hojaId}/values/${encodeURIComponent(`'${pestana}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', json: { values: filas } });
  }
  async function reemplazarFilas(hojaId, pestana, filas) {
    await api(`${SHEETS}/${hojaId}/values/${encodeURIComponent(`'${pestana}'`)}:clear`, { method: 'POST', json: {} });
    return api(`${SHEETS}/${hojaId}/values/${encodeURIComponent(`'${pestana}'!A1`)}?valueInputOption=USER_ENTERED`, { method: 'PUT', json: { values: filas } });
  }
  async function formatoEncabezado(hojaId, n) {
    const requests = [];
    for (let i = 0; i < n; i++) {
      requests.push({ repeatCell: { range: { sheetId: i, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.95, blue: 0.96 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } });
    }
    return api(`${SHEETS}/${hojaId}:batchUpdate`, { method: 'POST', json: { requests } }).catch(() => null);
  }

  return { acceso, info, carpeta, subir, exportar, descargar, borrar, pdfDesdeHtml, mover, moverA, crearHoja, agregarFilas, reemplazarFilas, formatoEncabezado };
}
