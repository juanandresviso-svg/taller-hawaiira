// Envío de correos con Brevo (API transaccional). Solo se usa en el servidor.
export async function enviarBrevo({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Taller Hawaiira' },
      to,
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  return res.json();
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLOR = { rojo: '#B0261E', amarillo: '#9C5D05', info: '#2C5AA3' };

export function htmlResumen({ nombre, fecha, alertas, recs, carga, site }) {
  const filas = alertas.map((a) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #E7E7E3">
      <div style="border-left:4px solid ${COLOR[a.sev]};padding-left:12px">
        <div style="font-weight:600;color:#111">${esc(a.t)}</div>
        <div style="color:#5C5C58;font-size:14px">${esc(a.d)}</div>
      </div></td></tr>`).join('');
  const recHtml = recs && recs.length ? `
    <h3 style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#5C5C58;margin:28px 0 8px">Recomendaciones</h3>
    ${recs.map((r) => `<div style="border:1px solid #E7E7E3;border-radius:10px;padding:12px;margin-bottom:8px"><div style="font-weight:600">${esc(r.titulo)}</div><ul style="margin:6px 0 0;padding-left:18px;color:#111;font-size:14px">${r.ops.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>`).join('')}` : '';
  const cargaHtml = carga ? `
    <h3 style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#5C5C58;margin:28px 0 8px">Carga de las próximas 2 semanas</h3>
    <table width="100%" style="font-size:14px;border-collapse:collapse">${carga.map((c) => `<tr><td style="padding:6px 0;border-bottom:1px solid #E7E7E3">${esc(c.nombre)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #E7E7E3;font-weight:600;color:${c.u > 1 ? '#B0261E' : c.u > 0.85 ? '#9C5D05' : '#2E7A38'}">${esc(c.txt)}</td></tr>`).join('')}</table>` : '';
  return `<!doctype html><html><body style="margin:0;background:#FFFFFF;font-family:Arial,Helvetica,sans-serif;color:#111">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px">
  <table width="100%" style="max-width:600px" cellpadding="0" cellspacing="0"><tr><td>
    <img src="${site}/icons/icon-192.png" width="48" height="48" alt="Hawaiira Studio" style="border-radius:10px">
    <h1 style="font-size:20px;margin:16px 0 4px">Buenos días, ${esc(nombre)}</h1>
    <p style="color:#5C5C58;margin:0 0 18px">Resumen del taller · ${esc(fecha)}</p>
    <table width="100%" cellpadding="0" cellspacing="0">${filas}</table>
    ${cargaHtml}${recHtml}
    <p style="margin:28px 0"><a href="${site}" style="background:#111;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600">Abrir el taller</a></p>
    <p style="color:#8D8D88;font-size:12px">Recibes este correo porque tienes alertas asignadas en la app del Taller Hawaiira.</p>
  </td></tr></table></td></tr></table></body></html>`;
}
