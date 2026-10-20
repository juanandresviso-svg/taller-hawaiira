// Lectura de la orden de compra (OC) del cliente con inteligencia artificial (Claude, de Anthropic). SOLO servidor.
// Recibe el PDF o la foto y devuelve los datos ordenados. Si algo no se lee, queda vacío para completarlo a mano.

const API = 'https://api.anthropic.com/v1/messages';
const MODELOS = [process.env.ANTHROPIC_MODEL, 'claude-sonnet-5-5', 'claude-sonnet-4-5'].filter(Boolean);
const IMAGENES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY;

const num = { type: ['number', 'null'] };
const txt = { type: ['string', 'null'] };
const HERRAMIENTA = {
  name: 'registrar_orden_compra',
  description: 'Registra los datos leídos de la orden de compra del cliente.',
  input_schema: {
    type: 'object',
    properties: {
      legible: { type: 'boolean', description: 'false si el documento no es una orden de compra o no se puede leer' },
      numero_oc: { ...txt, description: 'Número de la orden de compra' },
      fecha_emision: { ...txt, description: 'Fecha de emisión, formato AAAA-MM-DD' },
      cliente: {
        type: 'object',
        description: 'Empresa que compra (quien emite la OC), no el proveedor',
        properties: { nombre: txt, rif: txt, contacto: txt, telefono: txt, correo: txt, direccion: txt },
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            descripcion: txt, cantidad: num, unidad: txt, precio_unitario: num, total: num,
            tallas: { ...txt, description: 'Desglose de tallas si aparece, por ejemplo "S 50 · M 100 · L 50"' },
          },
        },
      },
      unidades_total: { ...num, description: 'Total de unidades (prendas) pedidas: suma de las cantidades' },
      subtotal: num,
      impuesto: { ...num, description: 'IVA u otros impuestos' },
      total: { ...num, description: 'Monto total a pagar, con impuestos' },
      moneda: { ...txt, description: 'USD, VES (bolívares) o EUR' },
      condiciones_pago: txt,
      fecha_entrega: { ...txt, description: 'Fecha de entrega pedida, formato AAAA-MM-DD' },
      lugar_entrega: txt,
      observaciones: txt,
      dudas: { type: 'array', items: { type: 'string' }, description: 'Campos que se leyeron con dudas o no aparecen' },
    },
    required: ['legible', 'items', 'dudas'],
  },
};

const INSTRUCCIONES = `Eres el asistente del taller de confección Hawaiira Studio (Caracas, Venezuela). Este documento es una orden de compra que un cliente le envía al taller. Extrae sus datos y regístralos con la herramienta.
Reglas:
- No inventes nada. Si un dato no aparece, déjalo en null y anótalo en "dudas".
- El cliente es la empresa que compra (quien emite la orden), no Hawaiira Studio.
- Los montos van como número, sin símbolos ni separadores de miles. En Venezuela se suele usar coma decimal: "1.250,50" es 1250.5.
- unidades_total es la suma de las cantidades de prendas o productos.
- total es el monto final a pagar, con impuestos si los hay.
- Fechas en formato AAAA-MM-DD. Si la fecha es ambigua (por ejemplo 03/04/2026), interprétala como día/mes/año.`;

export async function leerOrdenCompra({ datos, mime }) {
  if (!iaConfigurada()) { const e = new Error('Falta la clave ANTHROPIC_API_KEY en Vercel (instructivo, paso 4.7). Mientras tanto, completa los datos a mano.'); e.configuracion = true; throw e; }
  let bloque;
  const b64 = Buffer.from(datos).toString('base64');
  if (mime === 'application/pdf') bloque = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };
  else if (IMAGENES.includes(mime)) {
    if (datos.length > 4.8 * 1024 * 1024) throw new Error('La foto pesa más de 5 MB. Tómala de nuevo con menos resolución o envía el PDF.');
    bloque = { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };
  } else throw new Error('Este formato no se puede leer (' + (mime || 'desconocido') + '). Sube la OC en PDF, JPG o PNG.');

  let ultimoError = null;
  for (const modelo of MODELOS) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modelo, max_tokens: 4000, tools: [HERRAMIENTA], tool_choice: { type: 'tool', name: HERRAMIENTA.name },
        messages: [{ role: 'user', content: [bloque, { type: 'text', text: INSTRUCCIONES }] }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 || (j.error && j.error.type === 'not_found_error')) { ultimoError = new Error('Modelo no disponible: ' + modelo); continue; }
    if (!r.ok) {
      const msg = (j.error && j.error.message) || r.status;
      throw new Error(r.status === 401 ? 'La clave ANTHROPIC_API_KEY no es válida.' : r.status === 429 || r.status === 529 ? 'El servicio de lectura está ocupado. Inténtalo en un minuto.' : 'No se pudo leer la OC: ' + msg);
    }
    const uso = (j.content || []).find((c) => c.type === 'tool_use');
    if (!uso) throw new Error('La lectura no devolvió datos. Completa a mano.');
    return { datos: limpiar(uso.input), modelo };
  }
  throw ultimoError || new Error('No hay un modelo disponible para leer la OC.');
}

// Normaliza lo que devolvió la lectura
function limpiar(d) {
  const n = (v) => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);
  const f = (v) => {
    if (typeof v !== 'string') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // día/mes/año
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  };
  const items = (d.items || []).map((i) => ({ descripcion: i.descripcion || '', cantidad: n(i.cantidad), unidad: i.unidad || '', precio_unitario: n(i.precio_unitario), total: n(i.total), tallas: i.tallas || '' }));
  const suma = items.reduce((a, i) => a + (i.cantidad || 0), 0);
  return {
    legible: d.legible !== false,
    numero_oc: d.numero_oc || '', fecha_emision: f(d.fecha_emision),
    cliente: { nombre: '', rif: '', contacto: '', telefono: '', correo: '', direccion: '', ...(d.cliente || {}) },
    items, unidades_total: n(d.unidades_total) ?? (suma || null),
    subtotal: n(d.subtotal), impuesto: n(d.impuesto), total: n(d.total), moneda: (d.moneda || '').toUpperCase() || null,
    condiciones_pago: d.condiciones_pago || '', fecha_entrega: f(d.fecha_entrega), lugar_entrega: d.lugar_entrega || '',
    observaciones: d.observaciones || '', dudas: d.dudas || [],
  };
}
