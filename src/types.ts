// Tipos de datos de la aplicación. Todo el estado se serializa a localStorage y a Firestore,
// así que aquí solo debe haber datos planos (sin funciones ni clases).

export type TipoCliente = 'particular' | 'pyme' | 'gran_empresa' | 'comunidad';

export interface Client {
  id: string;
  nombre: string;
  nif: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  codigoPostal: string;
  obraPrincipal?: string;
  totalFacturado: number;
  obrasCount: number;
  expedienteCIE?: string;
  documentosCount: number;
  notas?: string;
  fotos?: ProjectPhoto[];
  documentos?: ProjectDocument[];
  // true (por defecto): el cliente debe firmar cada presupuesto desde su móvil.
  // false: gran empresa que valida por pedido; basta el clic de aceptación con nombre y NIF.
  exigirFirma?: boolean;
  tipoCliente?: TipoCliente;
  fechaAlta?: string;
  esDemo?: boolean;
}

export interface ProjectPhoto {
  id: string;
  url: string; // miniatura pequeña para verla en la app; el original está en Drive
  titulo: string;
  fecha: string;
  tipo: 'antes' | 'durante' | 'despues' | 'detalle';
  // Archivo original en el Drive del usuario (15 GB gratis). Sin esto, la foto vive
  // dentro del estado y ocupa del límite de 1 MB del documento de la nube.
  driveFileId?: string;
  driveEnlace?: string;
  nombreArchivo?: string;
  tamano?: number;
  esVideo?: boolean;
}

export interface ProjectDocument {
  id: string;
  nombre: string;
  tipo: 'CIE' | 'Licencia' | 'Memoria' | 'PRL' | 'Planos' | 'Presupuesto' | 'Factura' | 'Otro';
  fecha: string;
  tamano: string;
  estado: 'Aprobado' | 'En trámite' | 'Pendiente' | 'Firmado';
  notas?: string;
  dataUrl?: string; // solo si no hay Drive: el archivo va dentro del estado y ocupa del límite de 1 MB
  driveFileId?: string;
  driveEnlace?: string;
  tamanoBytes?: number;
  mime?: string;
  paraCie?: boolean; // documentación necesaria para el certificado de instalación eléctrica
}

export interface ProjectLog {
  id: string;
  fecha: string;
  autor: string;
  tipo: 'avance' | 'incidencia' | 'material' | 'subcontrata' | 'certificacion';
  texto: string;
}

// Componente del escandallo interno de una partida (material, mano de obra, tasa...).
// El coste NUNCA se imprime en presupuestos ni facturas. Solo el nombre y la cantidad,
// y únicamente si visibleCliente es true.
export interface MaterialCostComponent {
  id: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  costeUnitario: number;
  totalCoste: number;
  proveedor?: string;
  visibleCliente?: boolean;
}

// Un material del almacén: algo que se compra. Las agrupaciones de materiales más mano de obra
// son Kits (ver más abajo); antes ambas cosas vivían aquí mezcladas y se separaron en la v4.
export interface CatalogItem {
  id: string;
  concepto: string; // nombre del material
  unidad: string;
  precioCompra?: number; // lo que te cuesta a ti
  precioUnitario: number; // PVP base sin IVA, por si lo vendes suelto
  ivaPorcentaje: number;
  descripcionDetallada?: string;
  categoriaId: string;
  categoriaNombre: string;
  referenciaSku?: string;
  proveedorHabitual?: string;
  fechaUltimoPrecio?: string; // cuándo se actualizó el precio de compra por última vez
  origenUltimoPrecio?: string; // de qué factura o proveedor salió
  esDemo?: boolean;
  // Restos del modelo antiguo: solo los usa la migración
  materiales?: MaterialCostComponent[];
  costeInternoTotal?: number;
  margenPorcentaje?: number;
}

export interface CatalogCategory {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface PresupuestoPartida {
  id: string;
  categoria: string;
  concepto: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number; // PVP base sin IVA
  ivaPorcentaje: number;
  total: number; // cantidad x precio x (1 + IVA)
  materiales?: MaterialCostComponent[];
  costeInternoTotal?: number; // coste interno por unidad
  margenPorcentaje?: number;
  kitId?: string; // si la partida viene de un kit
  descripcion?: string; // texto adicional visible para el cliente
}

export interface DisponibilidadTecnico {
  manana: boolean;
  tarde: boolean;
  horas?: { manana?: { inicio: string; fin: string }; tarde?: { inicio: string; fin: string } };
}

export type ProjectEstado =
  | 'Borrador'
  | 'Enviado'
  | 'Aceptado'
  | 'En ejecución'
  | 'En legalización CIE'
  | 'Finalizada'
  | 'Facturada'
  | 'Rechazado'
  | 'Pausada';

export interface FirmaCliente {
  firmadoPor: string;
  dni: string;
  fechaFirma: string; // ISO con hora
  trazoFirma?: string; // PNG en data URL (opcional si el cliente no exige firma)
  codigoAceptacion?: string;
  // Prueba de que se le mostró la información de protección de datos al firmar
  informadoProteccionDatos?: boolean;
  metodo?: 'portal' | 'presencial' | 'codigo';
}

// Motivos por los que un presupuesto se presenta sin impuestos. Solo afecta al presupuesto:
// la factura lleva siempre su régimen fiscal y su zona VERI*FACTU.
export const MOTIVOS_SIN_IMPUESTOS: Array<{ id: string; etiqueta: string; texto: string }> = [
  { id: 'orientativo', etiqueta: 'Presupuesto orientativo', texto: 'Importes sin impuestos. Este presupuesto es orientativo y no constituye factura; los impuestos que correspondan se aplicarán en la factura definitiva.' },
  { id: 'isp', etiqueta: 'Inversión del sujeto pasivo', texto: 'Operación con inversión del sujeto pasivo (art. 84.Uno.2º de la Ley 37/1992 del IVA). El IVA lo declara el destinatario, por lo que los importes se indican sin impuestos.' },
  { id: 'exenta', etiqueta: 'Operación exenta de IVA', texto: 'Operación exenta de IVA (art. 20 de la Ley 37/1992). Los importes se indican sin impuestos.' },
  { id: 'nosujeta', etiqueta: 'Operación no sujeta', texto: 'Operación no sujeta a IVA. Los importes se indican sin impuestos.' },
  { id: 'otro', etiqueta: 'Otro motivo (lo escribo yo)', texto: '' },
];

export interface HuecoPropuesto {
  fecha: string; // YYYY-MM-DD
  franja: 'manana' | 'tarde';
  horaInicio: string;
  horaFin: string;
}

// Una línea de material realmente gastado en la obra. Sale del escandallo del presupuesto
// con la cantidad prevista ya puesta, para que en obra solo haya que corregir lo que cambió.
export interface ConsumoObra {
  id: string;
  partidaId?: string;
  partidaConcepto?: string;
  materialId?: string; // material del catálogo, si lo es
  nombre: string;
  unidad: string;
  cantidadPrevista: number; // 0 si es un imprevisto
  cantidadReal: number;
  costeUnitario: number;
  extra?: boolean; // no estaba presupuestado
}

// Una línea de material realmente gastado en la obra. Sale del escandallo del presupuesto
// con la cantidad prevista ya puesta, para que en obra solo haya que corregir lo que cambió.
export interface ConsumoObra {
  id: string;
  partidaId?: string;
  partidaConcepto?: string;
  materialId?: string; // material del catálogo, si lo es
  nombre: string;
  unidad: string;
  cantidadPrevista: number; // 0 si es un imprevisto
  cantidadReal: number;
  costeUnitario: number;
  extra?: boolean; // no estaba presupuestado
}

// Una línea de material realmente gastado en la obra. Sale del escandallo del presupuesto
// con la cantidad prevista ya puesta, para que en obra solo haya que corregir lo que cambió.
export interface ConsumoObra {
  id: string;
  partidaId?: string;
  partidaConcepto?: string;
  materialId?: string; // material del catálogo, si lo es
  nombre: string;
  unidad: string;
  cantidadPrevista: number; // 0 si es un imprevisto
  cantidadReal: number;
  costeUnitario: number;
  extra?: boolean; // no estaba presupuestado
}

export interface Project {
  id: string;
  codigo: string; // PRE-2026-001 mientras es presupuesto; al aceptarse se guarda también obraCodigo
  obraCodigo?: string; // OB-2026-001
  nombre: string;
  clienteId: string;
  clienteNombre: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  direccion: string;
  estado: ProjectEstado;
  fechaInicio: string; // fecha del presupuesto
  fechaFinPrevista: string;
  fechaAceptacion?: string;
  fechaFinReal?: string;
  presupuestoAceptado: number; // base imponible total del presupuesto
  totalFacturado: number;
  totalGastos: number;
  desgloseGastos: {
    materiales: number;
    manoDeObra: number;
    subcontratas: number;
    maquinaria: number;
    otros: number;
  };
  fotos: ProjectPhoto[];
  documentos: ProjectDocument[];
  bitacora: ProjectLog[];
  porcentajeAvance: number;
  partidas?: PresupuestoPartida[];
  motivoRechazo?: string;
  plantillaPresupuesto?: string;
  // Material realmente gastado, para la rentabilidad real de la obra
  consumoReal?: ConsumoObra[];
  consumoCerrado?: boolean;
  // Presupuesto presentado sin impuestos (trabajos donde no procede repercutirlos)
  sinImpuestos?: boolean;
  motivoSinImpuestos?: string; // texto que se imprime explicando por qué
  notaFinal?: string; // comentario al pie del presupuesto (condiciones de pago, validez...)
  firmaCliente?: FirmaCliente;
  // Cita de instalación
  huecosPropuestos?: HuecoPropuesto[];
  huecoElegido?: HuecoPropuesto;
  fechaCitaCalendario?: string; // ISO con hora cuando la cita está confirmada
  agendadaEnGoogleCalendar?: boolean;
  googleCalendarEventId?: string;
  tecnicosAsignados?: string[];
  solicitudCitaCliente?: {
    fechaSugerida: string;
    franjaHoraria: string;
    horaInicio?: string;
    horaFin?: string;
    estado: 'Pendiente confirmación' | 'Aceptada' | 'Rechazada';
    notasCliente?: string;
    fechaSolicitud: string;
  };
  facturaIds?: string[];
  // Enlace público de aceptación (documento en Firestore legible sin sesión)
  propuestaToken?: string;
  propuestaPublicadaEl?: string;
  esDemo?: boolean;
}

export interface InvoiceLine {
  id: string;
  concepto: string;
  cantidad: number;
  unidad?: string;
  precioUnitario: number;
  ivaPorcentaje: number;
  total: number;
  materialesVisibles?: Array<{ nombre: string; cantidad: number; unidad: string }>;
}

export type TipoFacturaVerifactu = 'F1' | 'F2' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface RegistroVerifactu {
  registrada: boolean; // huella generada y encadenada
  tipoFactura: TipoFacturaVerifactu;
  fechaHoraHuso: string; // FechaHoraHusoGenRegistro
  cadena: string; // cadena exacta sobre la que se calculó la huella
  huellaHash: string; // SHA-256 hex mayúsculas
  hashAnterior: string; // '' en la primera factura de la cadena
  codigoQR: string; // URL de cotejo AEAT
  sistemaEmisor: string;
  // Envío a la AEAT: desde el navegador no se puede firmar con certificado; queda pendiente
  // hasta que exista un servidor con el .p12 (o se remita por otro medio).
  estadoEnvio: 'pendiente' | 'enviado' | 'no_requerido';
  fechaEnvio?: string;
  csvAEAT?: string;
  // Solo en rectificativas
  tipoRectificativa?: 'S' | 'I';
  facturasRectificadas?: Array<{ numero: string; fecha: string }>;
  importeRectificacion?: { baseRectificada: number; cuotaRectificada: number };
}

// Un cobro concreto de una factura. Lo habitual es cobrar en dos veces (50 % y 50 %),
// así que una factura guarda una lista y su estado sale de sumarlos.
export interface CobroFactura {
  id: string;
  fecha: string;
  importe: number;
  metodo?: string;
  transaccionId?: string; // si el cobro vino de conciliar un movimiento del banco
  nota?: string;
}

export interface Invoice {
  id: string;
  numero: string;
  fecha: string;
  fechaVencimiento: string;
  clienteId: string;
  clienteNombre: string;
  clienteNif: string;
  clienteDireccion: string;
  obraId?: string;
  obraNombre?: string;
  obraCodigo?: string;
  lineas: InvoiceLine[];
  baseImponible: number;
  ivaTotal: number;
  irpfPorcentaje?: number;
  irpfTotal?: number;
  total: number;
  estado: 'Pagada' | 'Pendiente' | 'Vencida' | 'Borrador' | 'Anulada' | 'Rectificada';
  plantillaFactura?: string;
  // Rectificativas (R1-R4). 'S' sustituye a la original (que pasa a estado Rectificada); 'I' solo recoge la diferencia.
  rectificaA?: { id: string; numero: string; fecha: string };
  rectificadaPor?: { id: string; numero: string };
  motivoRectificacion?: string;
  notaFinal?: string;
  inversionSujetoPasivo?: boolean;
  firmaCliente?: FirmaCliente; // copia de la aceptación del presupuesto
  verifactu: RegistroVerifactu;
  metodoPago: 'Transferencia Bancaria' | 'Pagaré' | 'Efectivo' | 'TPV' | 'Bizum' | 'Domiciliación';
  cobros?: CobroFactura[]; // de dónde sale que esté cobrada, entera o a medias
  bancoConciliado?: boolean;
  transaccionId?: string; // primer movimiento conciliado, se conserva por compatibilidad
  esDemo?: boolean;
}

export type ExpenseCategoria =
  | 'Materiales'
  | 'Subcontratas'
  | 'Alquiler Maquinaria'
  | 'Vehículo / Combustible'
  | 'Gestoría / Asesoría'
  | 'Seguros y PRL'
  | 'Suministros / Taller'
  | 'Software y Comunicaciones'
  | 'Herramientas'
  | 'Marketing'
  | 'Otros';

export interface Expense {
  id: string;
  numeroFactura?: string;
  proveedor: string;
  cifProveedor: string;
  concepto: string;
  tipo: 'SL' | 'Obra';
  categoria: ExpenseCategoria;
  obraId?: string;
  obraNombre?: string;
  baseImponible: number;
  ivaPorcentaje: number;
  ivaTotal: number;
  irpfRetencion?: number;
  total: number;
  fecha: string;
  estadoPago: 'Pagado' | 'Pendiente';
  metodoPago: string;
  adjuntoNombre?: string;
  adjuntoDataUrl?: string; // solo si no hay Drive
  adjuntoDriveId?: string;
  adjuntoDriveEnlace?: string;
  ocrDetectado?: boolean;
  bancoConciliado?: boolean;
  transaccionId?: string;
  esRecurrente?: boolean;
  esDemo?: boolean;
}

export type ConfianzaCruce = 'alta' | 'media' | 'baja';

export interface BankTransaction {
  id: string;
  fecha: string; // YYYY-MM-DD
  fechaValor?: string;
  concepto: string;
  importe: number; // positivo ingreso, negativo gasto
  tipo: 'ingreso' | 'gasto';
  saldoPosterior?: number;
  conciliado: boolean;
  conciliadoCon?: { tipo: 'factura_venta' | 'gasto_compra'; referenciaId: string; referenciaNombre: string };
  entidad: string;
  iban?: string;
  referencia?: string;
  origen: 'demo' | 'norma43' | 'csv' | 'manual' | 'api';
  esDemo?: boolean;
}

export type CalendarEventTipo = 'Instalación' | 'Medición' | 'Reunión' | 'Inspección CIE / OCA' | 'Entrega de Llaves' | 'Otro';
export type CalendarEventEstado = 'En curso' | 'Programada' | 'Completada' | 'Urgente' | 'Pendiente confirmación' | 'Cancelada';

export interface CalendarInstallation {
  id: string;
  titulo: string;
  obraId?: string;
  obraNombre: string;
  clienteNombre: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  direccion: string;
  fechaHoraInicio: string; // ISO local YYYY-MM-DDTHH:mm:ss
  fechaHoraFin: string;
  tecnicos: string[];
  tipo: CalendarEventTipo;
  estado: CalendarEventEstado;
  googleCalendarSynced: boolean;
  googleCalendarEventId?: string;
  googleCalendarLink?: string;
  presupuestoId?: string;
  presupuestoCodigo?: string;
  presupuestoTotal?: number;
  notasTecnicas?: string;
  origenReserva?: 'cliente_web' | 'oficina';
  solicitudClienteNotas?: string;
  checklistCampo?: {
    diferencialOk: boolean;
    tierraOk: boolean;
    cargaVeOk: boolean;
    fotosSubidas: number;
    firmaClienteOk: boolean;
    observacionesCampo?: string;
  };
  esDemo?: boolean;
}

export interface DocumentTemplate {
  id: string;
  nombre: string;
  descripcion: string;
  colorPrimario: string;
  acento: string;
  base?: DocumentBaseTemplate;
  fuente?: string;
  condicionesPago?: string;
  notaFinal?: string; // comentario al pie del presupuesto
  pieDePagina?: string;
  esPersonalizada?: boolean;
}

export type DocumentBaseTemplate =
  | 'clasica'
  | 'moderna'
  | 'compacta'
  | 'geometrica'
  | 'oscura'
  | 'editorial'
  | 'bloques'
  | 'cotizacion'
  | 'tecnica'
  | 'lateral';

export interface Supplier {
  id: string;
  nombre: string;
  cif: string;
  categoria: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  iban?: string;
  fechaAlta?: string;
  esDemo?: boolean;
}

export type BancoProveedor = 'manual' | 'gocardless' | 'enablebanking' | 'tink' | 'arcopay';

export interface CompanySettings {
  tipoEntidad: 'empresa' | 'autonomo';
  razonSocial: string; // para autónomo: nombre y apellidos
  nombreComercial: string;
  nombreUsuario?: string;
  cif: string; // NIF para autónomo
  direccion: string;
  codigoPostal: string;
  ciudad: string;
  provincia?: string;
  telefono: string;
  email: string;
  web: string;
  ibanPrincipal: string;
  bancoNombre: string;
  registroMercantil: string; // solo empresa
  epigrafeIAE: string;
  retencionIrpfPorcentaje?: number; // autónomo que factura a empresas: 15 % (7 % nuevos)
  aplicaRetencionIrpf?: boolean;
  tieneEmpleados?: boolean; // determina modelo 111 / 190
  pagaAlquiler?: boolean; // determina modelo 115 / 180
  operacionesIntracomunitarias?: boolean; // determina modelo 349
  // Series y numeración
  prefijoFacturas: string; // p. ej. "FAC-"; el año se añade automáticamente si incluye {AAAA}
  siguienteNumeroFactura: number;
  prefijoPresupuestos: string;
  siguienteNumeroPresupuesto: number;
  prefijoObras: string;
  siguienteNumeroObra: number;
  prefijoRectificativas: string; // serie propia para rectificativas (recomendación AEAT)
  siguienteNumeroRectificativa: number;
  logoUrl?: string;
  plantillaPorDefecto: string;
  plantillasPersonalizadas?: DocumentTemplate[];
  notaFinalPresupuestoDefecto: string;
  condicionesPagoDefecto: string;
  diasValidezPresupuesto: number;
  diasVencimientoFactura: number;
  tecnicos: string[];
  franjas: { manana: { inicio: string; fin: string }; tarde: { inicio: string; fin: string } };
  // Qué franjas ofrece la empresa (se puede quitar la tarde o la mañana para todos)
  franjasActivas?: { manana: boolean; tarde: boolean };
  // Qué franjas cubre cada técnico y, si lo necesita, con qué horas propias.
  // Sin "horas" se usan las generales de la empresa.
  disponibilidadTecnicos?: Record<string, DisponibilidadTecnico>;
  // Lector de tickets con IA: clave de Gemini del propio usuario (se sincroniza por su nube; nunca va en las copias exportadas)
  margenObjetivo?: number; // margen por defecto al sugerir precios de venta (%)
  geminiApiKey?: string;
  geminiModelo?: string; // el que se descubrió al probar la clave; si falta, la app lo busca sola
  // Aviso de aceptación por correo con Google Apps Script (URL /exec de la aplicación web del usuario)
  avisoScriptUrl?: string;
  verifactuCertificado: {
    instalado: boolean;
    nombreTitular: string;
    emisor: string;
    caducidad: string;
    huellaSHA256: string;
    modoEnvioAEAT: 'Directo (Veri*factu Inmediato)' | 'Remisión Periódica Requerida';
    archivoNombre?: string;
  };
  googleCalendarConectado: boolean;
  googleAccountEmail?: string;
  googleCalendarId?: string;
  bancoConexion?: {
    conectado: boolean;
    proveedor: BancoProveedor;
    entidad: string;
    iban?: string;
    notas?: string;
    ultimaImportacion?: string;
  };
  copias?: {
    ultimaLocal?: string;
    ultimaNube?: string;
    autoLocal?: boolean;
    recordarCadaDias?: number; // cada cuántos días recordar hacer copia local
  };
}

// Una línea dentro de un kit: o un material del catálogo (con itemId), o mano de obra
// y otros trabajos escritos a mano (sin itemId).
export interface KitItem {
  id: string;
  itemId?: string; // referencia al material del catálogo
  concepto: string;
  cantidad: number;
  unidad: string;
  precioCoste: number;
  precioVenta: number;
  ivaPorcentaje: number;
  proveedor?: string;
  visibleCliente?: boolean; // si el cliente lo ve en el presupuesto (nombre y cantidad, nunca el coste)
  tipo?: 'material' | 'mano-de-obra' | 'otro';
}

export interface Kit {
  id: string;
  nombre: string;
  codigo?: string;
  descripcion: string;
  categoria: string;
  partidas: KitItem[];
  precioCosteTotal: number;
  precioVentaTotal: number;
  margenPorcentaje: number;
  fechaCreacion?: string;
  activo?: boolean;
  esDemo?: boolean;
}

// Estado completo que se persiste (local y nube)
export interface AppState {
  version: number;
  updatedAt: string;
  deviceId?: string;
  syncUid?: string; // cuenta de Google con la que este estado se ha sincronizado alguna vez
  companySettings: CompanySettings;
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  bankTransactions: BankTransaction[];
  calendarEvents: CalendarInstallation[];
  catalogCategories: CatalogCategory[];
  catalogItems: CatalogItem[];
  suppliers: Supplier[];
  kits: Kit[];
  demoCargada: boolean;
  guiaVista: boolean;
}
