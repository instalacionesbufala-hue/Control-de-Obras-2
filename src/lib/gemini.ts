// Lector de tickets y facturas de proveedor con la API de Gemini.
// La clave la pone cada usuario en Configuración (es SU clave, de su cuenta de Google). Nunca va en el
// código ni en el repositorio. Se guarda en su configuración y se excluye de las copias exportadas.
// Todo lo que devuelve la IA se muestra en un formulario editable: el usuario revisa y confirma.

export interface DatosTicket {
  proveedor?: string;
  cif?: string;
  numeroFactura?: string;
  fecha?: string; // YYYY-MM-DD
  concepto?: string;
  baseImponible?: number;
  ivaPorcentaje?: number;
  ivaTotal?: number;
  irpfPorcentaje?: number;
  total?: number;
  metodoPago?: string;
  categoria?: string;
  esTicketSinFactura?: boolean;
  confianza?: 'alta' | 'media' | 'baja';
  observaciones?: string;
}

export const MODELO_GEMINI_DEFECTO = 'gemini-2.5-flash';

const CATEGORIAS = ['Materiales', 'Subcontratas', 'Alquiler Maquinaria', 'Herramientas', 'Vehículo / Combustible', 'Gestoría / Asesoría', 'Seguros y PRL', 'Suministros / Taller', 'Telefonía / Software', 'Otros'];

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    proveedor: { type: 'STRING', description: 'Nombre comercial o razón social del emisor del ticket o factura' },
    cif: { type: 'STRING', description: 'NIF/CIF del emisor, sin espacios ni guiones. Vacío si no aparece' },
    numeroFactura: { type: 'STRING', description: 'Número de factura. Vacío si es un ticket simplificado sin número de factura completa' },
    fecha: { type: 'STRING', description: 'Fecha de emisión en formato YYYY-MM-DD' },
    concepto: { type: 'STRING', description: 'Resumen corto de qué se compró (máx. 80 caracteres), en español' },
    baseImponible: { type: 'NUMBER', description: 'Base imponible total sin IVA, en euros' },
    ivaPorcentaje: { type: 'NUMBER', description: 'Tipo de IVA principal: 21, 10, 4 o 0' },
    ivaTotal: { type: 'NUMBER', description: 'Cuota total de IVA en euros' },
    irpfPorcentaje: { type: 'NUMBER', description: 'Retención de IRPF aplicada (0 si no hay)' },
    total: { type: 'NUMBER', description: 'Importe total pagado en euros' },
    metodoPago: { type: 'STRING', description: 'Tarjeta, Transferencia Bancaria, Domiciliación, Efectivo o Bizum si se puede deducir; vacío si no' },
    categoria: { type: 'STRING', description: `Una de: ${CATEGORIAS.join(', ')}` },
    esTicketSinFactura: { type: 'BOOLEAN', description: 'true si es un ticket simplificado (sin datos completos del receptor)' },
    confianza: { type: 'STRING', description: 'alta, media o baja según la legibilidad del documento' },
    observaciones: { type: 'STRING', description: 'Dudas o campos poco legibles, en una frase. Vacío si todo está claro' },
  },
  required: ['proveedor', 'fecha', 'baseImponible', 'ivaPorcentaje', 'total', 'confianza'],
};

const PROMPT = `Eres un asistente de contabilidad para un instalador eléctrico español. Lee este ticket o factura de proveedor y extrae los datos.
Reglas:
- Importes en euros con punto decimal. Si solo aparece el total con IVA incluido, calcula la base con el tipo de IVA más probable (21 % en materiales y herramientas, 10 % en algunos servicios, 0 % si es exento).
- La fecha en formato YYYY-MM-DD. Si solo ves día y mes, usa el año actual.
- El proveedor es quien EMITE el documento, no quien paga.
- El CIF sin espacios ni guiones, en mayúsculas.
- Elige la categoría que mejor encaje de la lista.
- Si algo no se lee, déjalo vacío y explícalo en observaciones. No inventes datos.`;

const b64DeDataUrl = (dataUrl: string) => dataUrl.substring(dataUrl.indexOf(',') + 1);
const mimeDeDataUrl = (dataUrl: string) => dataUrl.substring(5, dataUrl.indexOf(';'));

export async function extraerDatosTicket(apiKey: string, dataUrl: string, modelo = MODELO_GEMINI_DEFECTO): Promise<DatosTicket> {
  if (!apiKey?.trim()) throw new Error('Falta la clave de la API de Gemini. Ponla en Configuración → Lector de tickets con IA.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeDeDataUrl(dataUrl), data: b64DeDataUrl(dataUrl) } }] }],
    generationConfig: { temperature: 0.1, response_mime_type: 'application/json', response_schema: ESQUEMA },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 400 && /API key not valid/i.test(txt)) throw new Error('La clave de la API no es válida. Revísala en Configuración.');
    if (res.status === 403) throw new Error('Google ha rechazado la clave (403). Comprueba que la clave esté activa y sin restricciones que bloqueen esta web.');
    if (res.status === 429) throw new Error('Se ha superado el límite gratuito de peticiones por minuto. Espera un momento y vuelve a intentarlo.');
    throw new Error(`Gemini respondió ${res.status}: ${txt.substring(0, 160)}`);
  }
  const json = await res.json();
  const texto: string = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!texto) throw new Error('La IA no ha devuelto datos. Prueba con una foto más nítida.');
  let datos: DatosTicket;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('La respuesta de la IA no se ha podido interpretar. Vuelve a intentarlo.');
  }
  return normalizar(datos);
}

function normalizar(d: DatosTicket): DatosTicket {
  const num = (v: any) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : undefined);
  const iva = num(d.ivaPorcentaje);
  const ivaCerca = iva === undefined ? undefined : [21, 10, 4, 0].reduce((a, b) => (Math.abs(b - iva) < Math.abs(a - iva) ? b : a), 21);
  const base = num(d.baseImponible);
  const total = num(d.total);
  return {
    proveedor: (d.proveedor || '').trim(),
    cif: (d.cif || '').replace(/[\s-]/g, '').toUpperCase(),
    numeroFactura: (d.numeroFactura || '').trim(),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : undefined,
    concepto: (d.concepto || '').trim().substring(0, 120),
    baseImponible: base ?? (total !== undefined && ivaCerca !== undefined ? Math.round((total / (1 + ivaCerca / 100)) * 100) / 100 : undefined),
    ivaPorcentaje: ivaCerca,
    ivaTotal: num(d.ivaTotal),
    irpfPorcentaje: num(d.irpfPorcentaje) || 0,
    total,
    metodoPago: (d.metodoPago || '').trim(),
    categoria: CATEGORIAS.includes(d.categoria || '') ? d.categoria : undefined,
    esTicketSinFactura: !!d.esTicketSinFactura,
    confianza: d.confianza === 'alta' || d.confianza === 'media' || d.confianza === 'baja' ? d.confianza : 'media',
    observaciones: (d.observaciones || '').trim(),
  };
}

// Comprueba que la clave funciona con una petición mínima
export async function probarClaveGemini(apiKey: string, modelo = MODELO_GEMINI_DEFECTO): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responde solo con la palabra OK.' }] }] }) });
  if (!res.ok) {
    const txt = await res.text();
    if (/API key not valid/i.test(txt)) throw new Error('La clave no es válida.');
    throw new Error(`Google respondió ${res.status}. ${txt.substring(0, 120)}`);
  }
  return `Clave correcta. Modelo ${modelo} disponible.`;
}

// Reduce una imagen para que quepa en el estado (y para enviarla a la IA sin pasarse de tamaño)
export function comprimirImagen(file: File, maxLado = 1600, calidad = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}
