// Persistencia local (localStorage) con migraciones, copias de seguridad en archivo
// y utilidades de fusión con la nube.
import { AppState, CompanySettings, DocumentTemplate } from '../types';
import { DEFAULT_TEMPLATES } from '../data/plantillas';

export const STATE_VERSION = 3;
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
    'Forma de pago: 50 % a la aceptación del presupuesto y 50 % restante a la finalización de la instalación. Validez de la oferta: 30 días naturales. Los trabajos se ejecutan conforme al REBT (ITC-BT-52) e incluyen la documentación técnica necesaria para su legalización. Garantía de instalación: 2 años; equipos según fabricante.',
  condicionesPagoDefecto: 'Transferencia bancaria a la cuenta indicada. Vencimiento a 30 días desde la fecha de emisión.',
  diasValidezPresupuesto: 30,
  diasVencimientoFactura: 30,
  tecnicos: [],
  franjas: { manana: { inicio: '08:30', fin: '14:00' }, tarde: { inicio: '15:30', fin: '19:30' } },
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
  copias: { autoLocal: true },
};

// Rellena campos que falten en una configuración antigua
export function migrarSettings(raw: Partial<CompanySettings> | undefined): CompanySettings {
  const s = { ...DEFAULT_COMPANY_SETTINGS, ...(raw || {}) } as CompanySettings;
  if (!s.tipoEntidad) s.tipoEntidad = 'empresa';
  if (!Array.isArray(s.tecnicos)) s.tecnicos = [];
  if (!s.franjas) s.franjas = DEFAULT_COMPANY_SETTINGS.franjas;
  if (!s.franjasActivas) s.franjasActivas = { manana: true, tarde: true };
  if (!s.disponibilidadTecnicos) s.disponibilidadTecnicos = {};
  if (Array.isArray(s.plantillasPersonalizadas) && s.plantillasPersonalizadas.length) {
    const ids = new Set(s.plantillasPersonalizadas.map((t) => t.id));
    DEFAULT_TEMPLATES.forEach((d) => { if (!ids.has(d.id)) s.plantillasPersonalizadas!.push(d); });
  }
  if (!s.verifactuCertificado) s.verifactuCertificado = DEFAULT_COMPANY_SETTINGS.verifactuCertificado;
  if (!s.bancoConexion) s.bancoConexion = { conectado: false, proveedor: 'manual', entidad: '' };
  if (!(s.bancoConexion as any).proveedor) (s.bancoConexion as any).proveedor = 'manual';
  if (!s.copias) s.copias = { autoLocal: true };
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
  if (!s.plantillasPersonalizadas || s.plantillasPersonalizadas.length === 0) s.plantillasPersonalizadas = DEFAULT_TEMPLATES;
  s.plantillasPersonalizadas = s.plantillasPersonalizadas.map((t: DocumentTemplate) => ({ ...t, base: t.base || (['moderna', 'tecnica', 'compacta', 'clasica'].includes(t.id) ? (t.id as any) : 'moderna') }));
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
