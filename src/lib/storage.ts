// Persistencia local (localStorage) con migraciones, copias de seguridad en archivo
// y utilidades de fusión con la nube.
import { AppState, CompanySettings, DocumentTemplate } from '../types';
import { normalizarValidez } from './textos';
import { DEFAULT_TEMPLATES } from '../data/plantillas';
import { separarCatalogo } from './catalogo';

export const STATE_VERSION = 4;
export const STORAGE_KEY = 'obracontrol-estado-v1';
export const BACKUP_KEY = 'obracontrol-copia-anterior';
export const DEVICE_KEY = 'obracontrol-dispositivo';

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `dev-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev-sin-storage';
  }
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  tipoEntidad: 'empresa',
  razonSocial: '',
  nombreComercial: '',
  nombreUsuario: '',
  cif: '',
  direccion: '',
  codigoPostal: '',
  ciudad: '',
  provincia: '',
  telefono: '',
  email: '',
  web: '',
  ibanPrincipal: '',
  bancoNombre: '',
  registroMercantil: '',
  epigrafeIAE: '',
  retencionIrpfPorcentaje: 15,
  aplicaRetencionIrpf: false,
  tieneEmpleados: false,
  pagaAlquiler: false,
  operacionesIntracomunitarias: false,
  prefijoFacturas: 'FAC-{AAAA}-',
  siguienteNumeroFactura: 1,
  prefijoPresupuestos: 'PRE-{AAAA}-',
  siguienteNumeroPresupuesto: 1,
  prefijoObras: 'OB-{AAAA}-',
  siguienteNumeroObra: 1,
  prefijoRectificativas: 'REC-{AAAA}-',
  siguienteNumeroRectificativa: 1,
  plantillaPorDefecto: 'moderna',
  plantillasPersonalizadas: DEFAULT_TEMPLATES,
  logoUrl: '',
  notaFinalPresupuestoDefecto:
    'Forma de pago: 50 % a la aceptación del presupuesto y 50 % restante a la finalización de la instalación. Validez de la oferta: {validez} días naturales. Los trabajos se ejecutan conforme al REBT (ITC-BT-52) e incluyen la documentación técnica necesaria para su legalización. Garantía de instalación: 2 años; equipos según fabricante.',
  condicionesPagoDefecto: 'Transferencia bancaria a la cuenta indicada. Vencimiento a {vencimiento} días desde la fecha de emisión.',
  ivaPorDefecto: 21,
  metodoPagoPorDefecto: 'Transferencia Bancaria',
  diasValidezPresupuesto: 30,
  diasVencimientoFactura: 30,
  tecnicos: [],
  franjas: { manana: { inicio: '08:30', fin: '14:00' }, tarde: { inicio: '15:30', fin: '19:30' } },
  margenObjetivo: 40,
  franjasActivas: { manana: true, tarde: true },
  disponibilidadTecnicos: {},
  geminiApiKey: '',
  geminiModelo: '',
  avisoScriptUrl: '',
  verifactuCertificado: {
    instalado: false,
    nombreTitular: '',
    emisor: '',
    caducidad: '',
    huellaSHA256: '',
    modoEnvioAEAT: 'Directo (Veri*factu Inmediato)',
  },
  googleCalendarConectado: false,
  googleAccountEmail: '',
  googleCalendarId: 'primary',
  bancoConexion: { conectado: false, proveedor: 'manual', entidad: '' },
  copias: { autoLocal: true, recordarCadaDias: 7 },
};

// Rellena campos que falten en una configuración antigua
export function migrarSettings(raw: Partial<CompanySettings> | undefined): CompanySettings {
  const s = { ...DEFAULT_COMPANY_SETTINGS, ...(raw || {}) } as CompanySettings;
  if (!s.tipoEntidad) s.tipoEntidad = 'empresa';
  if (!Array.isArray(s.tecnicos)) s.tecnicos = [];
  if (!s.franjas) s.franjas = DEFAULT_COMPANY_SETTINGS.franjas;
  if (typeof s.margenObjetivo !== 'number') s.margenObjetivo = 40;
  if (!s.franjasActivas) s.franjasActivas = { manana: true, tarde: true };
  if (!s.disponibilidadTecnicos) s.disponibilidadTecnicos = {};
  if (Array.isArray(s.plantillasPersonalizadas) && s.plantillasPersonalizadas.length) {
    const ids = new Set(s.plantillasPersonalizadas.map((t) => t.id));
    DEFAULT_TEMPLATES.forEach((d) => { if (!ids.has(d.id)) s.plantillasPersonalizadas!.push(d); });
  }
  if (!s.verifactuCertificado) s.verifactuCertificado = DEFAULT_COMPANY_SETTINGS.verifactuCertificado;
  if (!s.bancoConexion) s.bancoConexion = { conectado: false, proveedor: 'manual', entidad: '' };
  if (!(s.bancoConexion as any).proveedor) (s.bancoConexion as any).proveedor = 'manual';
  if (!s.copias) s.copias = { autoLocal: true, recordarCadaDias: 7 };
  if (!s.copias.recordarCadaDias) s.copias.recordarCadaDias = 7;
  if (!s.prefijoPresupuestos) s.prefijoPresupuestos = 'PRE-{AAAA}-';
  if (!s.prefijoObras) s.prefijoObras = 'OB-{AAAA}-';
  if (!s.siguienteNumeroPresupuesto) s.siguienteNumeroPresupuesto = 1;
  if (!s.siguienteNumeroObra) s.siguienteNumeroObra = 1;
  if (!s.siguienteNumeroFactura) s.siguienteNumeroFactura = 1;
  if (!s.prefijoRectificativas) s.prefijoRectificativas = 'REC-{AAAA}-';
  if (!s.siguienteNumeroRectificativa) s.siguienteNumeroRectificativa = 1;
  // Prefijo antiguo con año fijo ("FAC-2024-") -> con comodín
  if (/^[A-Z]+-\d{4}-$/i.test(s.prefijoFacturas)) s.prefijoFacturas = s.prefijoFacturas.replace(/\d{4}/, '{AAAA}');
  if (!s.notaFinalPresupuestoDefecto) s.notaFinalPresupuestoDefecto = DEFAULT_COMPANY_SETTINGS.notaFinalPresupuestoDefecto;
  if (!s.condicionesPagoDefecto) s.condicionesPagoDefecto = DEFAULT_COMPANY_SETTINGS.condicionesPagoDefecto;
  if (!s.diasValidezPresupuesto) s.diasValidezPresupuesto = 30;
  if (!s.diasVencimientoFactura) s.diasVencimientoFactura = 30;
  if (!s.ivaPorDefecto) s.ivaPorDefecto = 21;
  if (!s.metodoPagoPorDefecto) s.metodoPagoPorDefecto = 'Transferencia Bancaria';
  // Los textos antiguos llevaban "30 días" escrito; pasan al comodín para obedecer al ajuste
  s.notaFinalPresupuestoDefecto = normalizarValidez(s.notaFinalPresupuestoDefecto);
  s.condicionesPagoDefecto = normalizarValidez(s.condicionesPagoDefecto);
  if (!s.plantillasPersonalizadas || s.plantillasPersonalizadas.length === 0) s.plantillasPersonalizadas = DEFAULT_TEMPLATES;
  s.plantillasPersonalizadas = s.plantillasPersonalizadas.map((t: DocumentTemplate) => ({ ...t, notaFinal: t.notaFinal ? normalizarValidez(t.notaFinal) : t.notaFinal, condicionesPago: t.condicionesPago ? normalizarValidez(t.condicionesPago) : t.condicionesPago, base: t.base || (['moderna', 'tecnica', 'compacta', 'clasica'].includes(t.id) ? (t.id as any) : 'moderna') }));
  return s;
}

// Aplica migraciones idempotentes a un estado cargado (local o nube)
export function migrarEstado(raw: any): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const st: AppState = {
    version: STATE_VERSION,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    deviceId: raw.deviceId,
    companySettings: migrarSettings(raw.companySettings),
    clients: Array.isArray(raw.clients) ? raw.clients : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    bankTransactions: Array.isArray(raw.bankTransactions) ? raw.bankTransactions : [],
    calendarEvents: Array.isArray(raw.calendarEvents) ? raw.calendarEvents : [],
    catalogCategories: Array.isArray(raw.catalogCategories) ? raw.catalogCategories : [],
    catalogItems: Array.isArray(raw.catalogItems) ? raw.catalogItems : [],
    suppliers: Array.isArray(raw.suppliers) ? raw.suppliers : [],
    kits: Array.isArray(raw.kits) ? raw.kits : [],
    demoCargada: raw.demoCargada !== undefined ? !!raw.demoCargada : true,
    guiaVista: !!raw.guiaVista,
  };
  // v2: movimientos bancarios con origen y fecha ISO
  st.bankTransactions = st.bankTransactions.map((t: any) => ({
    ...t,
    origen: t.origen || (t.esDemo ? 'demo' : 'manual'),
    fecha: /^\d{4}-\d{2}-\d{2}/.test(t.fecha || '') ? t.fecha : new Date().toISOString().split('T')[0],
    entidad: t.entidad || 'Banco',
  }));
  // v3: facturas antiguas sin registro Verifactu completo
  st.invoices = st.invoices.map((f: any) => ({
    ...f,
    verifactu: {
      registrada: !!f.verifactu?.registrada,
      tipoFactura: f.verifactu?.tipoFactura || 'F1',
      fechaHoraHuso: f.verifactu?.fechaHoraHuso || f.verifactu?.fechaRegistro || '',
      cadena: f.verifactu?.cadena || '',
      huellaHash: f.verifactu?.huellaHash || '',
      hashAnterior: f.verifactu?.hashAnterior || '',
      codigoQR: f.verifactu?.codigoQR || '',
      sistemaEmisor: f.verifactu?.sistemaEmisor || '',
      estadoEnvio: f.verifactu?.estadoEnvio || 'pendiente',
      fechaEnvio: f.verifactu?.fechaEnvio,
      csvAEAT: f.verifactu?.csvAEAT,
    },
  }));
  // Clientes: exigirFirma por defecto true
  st.clients = st.clients.map((c: any) => ({ ...c, exigirFirma: c.exigirFirma !== false, tipoCliente: c.tipoCliente === 'empresa' ? 'pyme' : c.tipoCliente || 'particular' }));
  // v4: separar materiales de kits. Los "conceptos" con escandallo eran kits disfrazados:
  // pasan a la lista de kits y sus materiales salen al catálogo como materiales sueltos.
  if ((raw.version || 0) < 4 && st.catalogItems.some((i: any) => (i.materiales || []).length > 0)) {
    const r = separarCatalogo(st.catalogItems, st.kits, st.catalogCategories);
    st.catalogItems = r.materiales;
    st.kits = r.kits;
    st.catalogCategories = r.categorias;
  }
  st.catalogItems = st.catalogItems.map((i: any) => ({ ...i, precioCompra: i.precioCompra !== undefined ? i.precioCompra : i.costeInternoTotal || 0 }));

  // v4: cobros de la factura. Lo que estaba marcado como pagado pasa a tener un cobro por el total,
  // para no perder la información al empezar a llevar los cobros uno a uno.
  st.invoices = st.invoices.map((f: any) => {
    if (Array.isArray(f.cobros)) return f;
    const pagada = f.estado === 'Pagada';
    return { ...f, cobros: pagada ? [{ id: `cob-${f.id}`, fecha: f.fecha, importe: f.total, metodo: f.metodoPago, transaccionId: f.transaccionId, nota: 'Cobro registrado antes de llevar el control por partes' }] : [] };
  });

  return st;
}

export function cargarLocal(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrarEstado(JSON.parse(raw));
  } catch (e) {
    console.warn('No se pudo leer el estado local:', e);
    return null;
  }
}

export function guardarLocal(state: AppState): { ok: boolean; error?: string } {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    return { ok: true };
  } catch (e: any) {
    // Cuota llena (p. ej. demasiadas fotos en base64)
    return { ok: false, error: e?.message || 'No se pudo guardar en el navegador (¿almacenamiento lleno?)' };
  }
}

// ¿Este estado contiene trabajo real del usuario, o solo los ejemplos de bienvenida?
// Se usa al iniciar sesión en un dispositivo nuevo para no pisar la nube con los ejemplos.
export function tieneDatosPropios(st: AppState | null): boolean {
  if (!st) return false;
  const demo = (r: { id: string; esDemo?: boolean }) => !!r.esDemo || r.id.includes('-demo-') || r.id.includes('muestra');
  const propios = (lista: Array<{ id: string; esDemo?: boolean }> | undefined) => (lista || []).some((r) => !demo(r));
  return propios(st.clients) || propios(st.projects) || propios(st.invoices) || propios(st.expenses) || propios(st.bankTransactions) || propios(st.calendarEvents);
}

// Última versión de la nube (su updatedAt) que ESTE dispositivo aplicó o subió. Va en una clave
// aparte a propósito: si formara parte del estado, anotarla contaría como un cambio más y volvería
// a disparar el guardado y la subida.
const MARCA_NUBE_KEY = 'obracontrol-version-nube';
export function leerMarcaNube(): string {
  try { return localStorage.getItem(MARCA_NUBE_KEY) || ''; } catch { return ''; }
}
export function guardarMarcaNube(updatedAt: string) {
  try { localStorage.setItem(MARCA_NUBE_KEY, updatedAt || ''); } catch { /* ignorar */ }
}

export function guardarCopiaAnterior(state: AppState) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(state));
  } catch {
    // ignorar
  }
}

export function leerCopiaAnterior(): AppState | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? migrarEstado(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function tamanoEstadoKB(state: AppState): number {
  try {
    return Math.round(JSON.stringify(state).length / 1024);
  } catch {
    return 0;
  }
}

// Copia de seguridad en archivo JSON
// Guarda cuándo se hizo la última copia local, para poder recordarlo
export function anotarCopiaLocal(): string {
  const hoy = new Date().toISOString().split('T')[0];
  try {
    localStorage.setItem('obracontrol-ultima-copia', hoy);
  } catch {
    // sin storage: solo queda en la configuración
  }
  return hoy;
}

export function ultimaCopiaLocal(settings?: { copias?: { ultimaLocal?: string } }): string | null {
  try {
    const local = localStorage.getItem('obracontrol-ultima-copia');
    const enConfig = settings?.copias?.ultimaLocal;
    if (local && enConfig) return local > enConfig ? local : enConfig;
    return local || enConfig || null;
  } catch {
    return settings?.copias?.ultimaLocal || null;
  }
}

// Días desde la última copia local. Devuelve null si nunca se ha hecho ninguna.
export function diasSinCopiaLocal(settings?: { copias?: { ultimaLocal?: string } }): number | null {
  const u = ultimaCopiaLocal(settings);
  if (!u) return null;
  return Math.floor((Date.now() - new Date(u).getTime()) / 86400000);
}

export function exportarCopia(state: AppState): string {
  const fecha = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const nombre = `copia-control-de-obra-${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}-${p(fecha.getHours())}${p(fecha.getMinutes())}.json`;
  const sinClave = { ...state, companySettings: { ...state.companySettings, geminiApiKey: '' } };
  const blob = new Blob([JSON.stringify({ ...sinClave, exportadoEl: fecha.toISOString(), app: 'Control de Obra' }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nombre;
}

export async function importarCopia(file: File): Promise<AppState> {
  const texto = await file.text();
  const raw = JSON.parse(texto);
  const st = migrarEstado(raw);
  if (!st) throw new Error('El archivo no contiene una copia válida.');
  if (!raw.companySettings && !raw.clients && !raw.projects) throw new Error('El archivo no parece una copia de Control de Obra.');
  return st;
}
