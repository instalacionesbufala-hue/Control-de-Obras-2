// Lector de tickets y facturas de proveedor con la API de Gemini.
// La clave la pone cada usuario en Configuración (es SU clave, de su cuenta de Google). Nunca va en el
// código ni en el repositorio. Se guarda en su configuración y se excluye de las copias exportadas.
// Todo lo que devuelve la IA se muestra en un formulario editable: el usuario revisa y confirma.
//
// Google retira modelos y los renombra cada pocos meses ("no longer available to new users"), así que
// aquí no se fija ninguno a mano: se le pregunta a la API qué modelos admite esta clave y se elige.

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

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

export interface ModeloGemini {
  id: string; // sin el prefijo "models/"
  nombre: string;
  entradaTokens?: number;
}

const CATEGORIAS = ['Materiales', 'Subcontratas', 'Alquiler Maquinaria', 'Herramientas', 'Vehículo / Combustible', 'Gestoría / Asesoría', 'Seguros y PRL', 'Suministros / Taller', 'Telefonía / Software', 'Otros'];

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    proveedor: { type: 'STRING', description: 'Nombre comercial o razón social del emisor del ticket o factura' },
    cif: { type: 'STRING', description: 'NIF/CIF del emisor, sin espacios ni guiones. Vacío si no aparece' },
    numeroFactura: { type: 'STRING', description: 'Número de factura. Vacío si es un ticket simplificado' },
    fecha: { type: 'STRING', description: 'Fecha de emisión en formato YYYY-MM-DD' },
    concepto: { type: 'STRING', description: 'Resumen corto de qué se compró, en español, máximo 80 caracteres' },
    baseImponible: { type: 'NUMBER', description: 'Base imponible total sin IVA, en euros' },
    ivaPorcentaje: { type: 'NUMBER', description: 'Tipo de IVA principal: 21, 10, 4 o 0' },
    ivaTotal: { type: 'NUMBER', description: 'Cuota total de IVA en euros' },
    irpfPorcentaje: { type: 'NUMBER', description: 'Retención de IRPF aplicada, 0 si no hay' },
    total: { type: 'NUMBER', description: 'Importe total pagado en euros' },
    metodoPago: { type: 'STRING', description: 'Tarjeta, Transferencia Bancaria, Domiciliación, Efectivo o Bizum si se deduce; vacío si no' },
    categoria: { type: 'STRING', description: `Una de: ${CATEGORIAS.join(', ')}` },
    esTicketSinFactura: { type: 'BOOLEAN', description: 'true si es un ticket simplificado' },
    confianza: { type: 'STRING', description: 'alta, media o baja según la legibilidad' },
    observaciones: { type: 'STRING', description: 'Dudas o campos poco legibles, en una frase. Vacío si todo está claro' },
  },
  required: ['proveedor', 'fecha', 'baseImponible', 'ivaPorcentaje', 'total', 'confianza'],
};

const PROMPT = `Eres un asistente de contabilidad para un instalador eléctrico español. Lee este ticket o factura de proveedor y extrae los datos en JSON.
Reglas:
- Importes en euros con punto decimal. Si solo aparece el total con IVA incluido, calcula la base con el tipo de IVA más probable (21 % en materiales y herramientas, 10 % en algunos servicios, 0 % si es exento).
- La fecha en formato YYYY-MM-DD. Si solo ves día y mes, usa el año actual.
- El proveedor es quien EMITE el documento, no quien paga.
- El CIF sin espacios ni guiones, en mayúsculas.
- Elige la categoría que mejor encaje de esta lista: ${CATEGORIAS.join(', ')}.
- Si algo no se lee, déjalo vacío y explícalo en observaciones. No inventes datos.`;

const b64DeDataUrl = (dataUrl: string) => dataUrl.substring(dataUrl.indexOf(',') + 1);
const mimeDeDataUrl = (dataUrl: string) => dataUrl.substring(5, dataUrl.indexOf(';'));

function mensajeDeError(status: number, texto: string): string {
  if (status === 400 && /API key not valid/i.test(texto)) return 'La clave de la API no es válida. Revísala en Configuración.';
  if (status === 403) return 'Google ha rechazado la clave (403). Comprueba que esté activa y que no tenga restricciones que bloqueen esta web.';
  if (status === 429) return 'Se ha superado el límite gratuito de peticiones. Espera un momento y vuelve a intentarlo.';
  if (status === 404) return 'El modelo indicado ya no está disponible. Pulsa "Probar" en Configuración para que la app elija uno actual.';
  return `Google respondió ${status}: ${texto.substring(0, 160)}`;
}

// ---- Modelos disponibles para esta clave ----
export async function listarModelosGemini(apiKey: string): Promise<ModeloGemini[]> {
  if (!apiKey?.trim()) throw new Error('Falta la clave de la API de Gemini.');
  const res = await fetch(`${BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey.trim())}`);
  if (!res.ok) throw new Error(mensajeDeError(res.status, await res.text()));
  const json = await res.json();
  return (json.models || [])
    .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m: any) => ({ id: String(m.name || '').replace(/^models\//, ''), nombre: m.displayName || m.name, entradaTokens: m.inputTokenLimit }))
    .filter((m: ModeloGemini) => m.id && !/embedding|aqa|imagen|veo|tts|image-generation|native-audio|live/i.test(m.id));
}

// Preferimos un modelo rápido y barato que lea imágenes. El orden va del más deseable al menos.
const PREFERENCIAS = [/flash-lite/i, /flash/i, /pro/i];

export function elegirModelo(modelos: ModeloGemini[]): string | null {
  if (!modelos.length) return null;
  const version = (id: string) => {
    const m = id.match(/(\d+)(?:[.-](\d+))?/);
    return m ? Number(m[1]) * 100 + Number(m[2] || 0) : 0;
  };
  // Descarta preliminares si hay alternativas estables
  const estables = modelos.filter((m) => !/preview|exp|experimental/i.test(m.id));
  const candidatos = estables.length ? estables : modelos;
  for (const patron of PREFERENCIAS) {
    const grupo = candidatos.filter((m) => patron.test(m.id)).sort((a, b) => version(b.id) - version(a.id));
    if (grupo.length) return grupo[0].id;
  }
  return candidatos[0].id;
}

export async function modeloDisponible(apiKey: string): Promise<string> {
  const modelo = elegirModelo(await listarModelosGemini(apiKey));
  if (!modelo) throw new Error('Tu clave no tiene ningún modelo disponible para leer documentos. Crea la clave desde aistudio.google.com/apikey.');
  return modelo;
}

// ---- Llamada al modelo ----
async function generar(apiKey: string, modelo: string, partes: any[], conEsquema: boolean) {
  const body: any = {
    contents: [{ role: 'user', parts: partes }],
    generationConfig: conEsquema
      ? { temperature: 0.1, responseMimeType: 'application/json', responseSchema: ESQUEMA }
      : { temperature: 0.1 },
  };
  const res = await fetch(`${BASE}/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, texto: res.ok ? '' : await res.text() };
}

// Extrae el primer objeto JSON de un texto (por si el modelo lo envuelve en ```json)
function jsonDeTexto(t: string): any {
  const limpio = t.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const i = limpio.indexOf('{');
    const f = limpio.lastIndexOf('}');
    if (i >= 0 && f > i) return JSON.parse(limpio.slice(i, f + 1));
    throw new Error('La respuesta de la IA no se ha podido interpretar. Vuelve a intentarlo.');
  }
}

export async function extraerDatosTicket(apiKey: string, dataUrl: string, modelo?: string): Promise<{ datos: DatosTicket; modelo: string }> {
  if (!apiKey?.trim()) throw new Error('Falta la clave de la API de Gemini. Ponla en Configuración → Lector de tickets con IA.');
  let usado = modelo || (await modeloDisponible(apiKey));
  const partes = [{ text: PROMPT }, { inline_data: { mime_type: mimeDeDataUrl(dataUrl), data: b64DeDataUrl(dataUrl) } }];

  let { res, texto } = await generar(apiKey, usado, partes, true);
  // El modelo guardado ha desaparecido o ya no admite este uso: se busca otro y se reintenta
  if (res.status === 404 && modelo) {
    usado = await modeloDisponible(apiKey);
    ({ res, texto } = await generar(apiKey, usado, partes, true));
  }
  // Algunos modelos no aceptan esquema de respuesta: se reintenta pidiendo JSON en el texto
  if (res.status === 400 && /responseSchema|response_schema|not supported/i.test(texto)) {
    ({ res, texto } = await generar(apiKey, usado, partes, false));
  }
  if (!res.ok) throw new Error(mensajeDeError(res.status, texto));

  const json = await res.json();
  const salida: string = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!salida) throw new Error('La IA no ha devuelto datos. Prueba con una foto más nítida.');
  return { datos: normalizar(jsonDeTexto(salida)), modelo: usado };
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

// Comprueba la clave, descubre los modelos disponibles y hace una llamada mínima con el elegido
export async function probarClaveGemini(apiKey: string): Promise<{ mensaje: string; modelo: string; modelos: ModeloGemini[] }> {
  const modelos = await listarModelosGemini(apiKey);
  const modelo = elegirModelo(modelos);
  if (!modelo) throw new Error('La clave funciona pero no tiene ningún modelo capaz de leer documentos.');
  const { res, texto } = await generar(apiKey, modelo, [{ text: 'Responde solo con la palabra OK.' }], false);
  if (!res.ok) throw new Error(mensajeDeError(res.status, texto));
  return { mensaje: `Clave correcta. Se usará el modelo ${modelo} (${modelos.length} disponibles para tu cuenta).`, modelo, modelos };
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
