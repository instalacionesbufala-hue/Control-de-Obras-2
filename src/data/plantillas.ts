import { DocumentTemplate, CompanySettings, Project, Invoice, Client, PresupuestoPartida, InvoiceLine, FirmaCliente } from '../types';

// Plantillas por defecto. Son presets: color, tipografía, base de maquetación y textos de pie.
// La zona fiscal de la factura (identificación, totales, QR y leyenda VERI*FACTU) no depende
// de la plantilla y no se puede ocultar.
export const DEFAULT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'moderna',
    base: 'moderna',
    nombre: 'Moderna (banda de color)',
    descripcion: 'Cabecera con banda de color corporativo y tarjetas. Limpia y legible en móvil.',
    colorPrimario: 'from-blue-600 to-indigo-700',
    acento: '#2563EB',
    fuente: 'sans',
    condicionesPago: 'Transferencia bancaria a la cuenta indicada. Vencimiento a {vencimiento} días desde la fecha de emisión.',
    notaFinal: 'Forma de pago: 50 % a la aceptación del presupuesto y 50 % restante a la finalización de la instalación. Validez de la oferta: {validez} días naturales. Los trabajos se ejecutan conforme al REBT (ITC-BT-52) e incluyen la documentación técnica necesaria para su legalización.',
    pieDePagina: '',
  },
  {
    id: 'tecnica',
    base: 'tecnica',
    nombre: 'Técnica (ficha de instalación)',
    descripcion: 'Barra lateral, numeración monoespaciada y datos técnicos destacados. Para obra industrial.',
    colorPrimario: 'from-slate-800 to-slate-950',
    acento: '#0F172A',
    fuente: 'mono',
    condicionesPago: 'Pago por transferencia. Certificaciones parciales según avance de obra.',
    notaFinal: 'Forma de pago: 40 % al aceptar, 40 % al inicio del montaje y 20 % a la puesta en marcha. Validez: {validez} días. Instalación conforme al REBT e ITC-BT-52, con certificado de instalación eléctrica (CIE) incluido.',
    pieDePagina: '',
  },
  {
    id: 'ejecutiva',
    base: 'editorial',
    nombre: 'Ejecutiva (sobria)',
    descripcion: 'Tipografía con serifa y mucho aire. Para clientes corporativos y comunidades.',
    colorPrimario: 'from-emerald-700 to-teal-900',
    acento: '#047857',
    fuente: 'serif',
    condicionesPago: 'Transferencia bancaria. Vencimiento a {vencimiento} días fecha factura.',
    notaFinal: 'Forma de pago: 50 % a la aceptación y 50 % a la finalización. Oferta válida {validez} días. Precios sin IVA salvo indicación contraria. Los trabajos incluyen retirada de escombros y limpieza final de la zona de trabajo.',
    pieDePagina: '',
  },
  {
    id: 'compacta',
    base: 'compacta',
    nombre: 'Compacta (una página)',
    descripcion: 'Densa y directa, pensada para presupuestos residenciales rápidos.',
    colorPrimario: 'from-amber-600 to-orange-700',
    acento: '#D97706',
    fuente: 'helvetica',
    condicionesPago: 'Pago al finalizar la instalación por transferencia o Bizum.',
    notaFinal: 'Pago: 50 % al aceptar y 50 % al terminar. Validez {validez} días. Incluye pruebas de funcionamiento y explicación de uso del equipo al cliente.',
    pieDePagina: '',
  },
  // Modelos añadidos en la segunda revisión: otras bases de maquetación con su propio carácter.
  {
    id: 'clasica',
    base: 'clasica',
    nombre: 'Clásica (cabecera formal)',
    descripcion: 'Cabecera con línea divisoria y tipografía neutra. Para administraciones y comunidades de propietarios.',
    colorPrimario: 'from-slate-700 to-slate-900',
    acento: '#1E3A8A',
    fuente: 'helvetica',
    condicionesPago: 'Transferencia bancaria. Vencimiento a {vencimiento} días fecha factura.',
    notaFinal: 'Forma de pago: 50 % a la aceptación y 50 % a la finalización. Validez de la oferta: {validez} días. Instalación conforme al REBT (ITC-BT-52) con boletín eléctrico incluido.',
    pieDePagina: '',
  },
  {
    id: 'lateral',
    base: 'lateral',
    nombre: 'Lateral (tarjeta de cliente)',
    descripcion: 'Tarjeta de cliente con borde de color y cabecera limpia. Moderna sin ser llamativa.',
    colorPrimario: 'from-cyan-600 to-blue-700',
    acento: '#0284C7',
    fuente: 'sans',
    condicionesPago: 'Transferencia bancaria o Bizum al finalizar la instalación.',
    notaFinal: 'Pago: 50 % al aceptar y 50 % al terminar. Validez {validez} días. Incluye pruebas de funcionamiento, puesta en marcha y explicación de uso.',
    pieDePagina: '',
  },
  {
    id: 'bloques',
    base: 'bloques',
    nombre: 'Bloques (tarjetas)',
    descripcion: 'Secciones en tarjetas sobre fondo gris claro. Muy legible en el móvil del cliente.',
    colorPrimario: 'from-violet-600 to-purple-800',
    acento: '#7C3AED',
    fuente: 'sans',
    condicionesPago: 'Transferencia bancaria a la cuenta indicada. Vencimiento a 15 días.',
    notaFinal: 'Forma de pago: 50 % a la aceptación y 50 % al finalizar. Validez {validez} días. Garantía de 2 años en la instalación y la del fabricante en los equipos.',
    pieDePagina: '',
  },
  {
    id: 'oscura',
    base: 'oscura',
    nombre: 'Oscura (pantalla)',
    descripcion: 'Fondo oscuro con acento cian. Pensada para verse en pantalla; en papel gasta más tinta.',
    colorPrimario: 'from-slate-900 to-black',
    acento: '#06B6D4',
    fuente: 'sans',
    condicionesPago: 'Transferencia bancaria. Vencimiento a {vencimiento} días fecha factura.',
    notaFinal: 'Pago: 50 % a la aceptación y 50 % a la finalización. Validez {validez} días. Instalación conforme al REBT e ITC-BT-52.',
    pieDePagina: '',
  },
];

// Documento ficticio para la vista previa de plantillas en Configuración.
export function documentoDeMuestra(settings: CompanySettings): { presupuesto: Project; factura: Invoice; cliente: Client } {
  const hoy = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const fecha = iso(hoy);
  const venc = iso(new Date(hoy.getTime() + 30 * 86400000));
  const fechaAEAT = fecha.split('-').reverse().join('-');
  const anio = hoy.getFullYear();
  const partidas: PresupuestoPartida[] = [
    { id: 'm1', categoria: 'Recarga VE', concepto: 'Instalación de punto de recarga 7,4 kW en garaje (ITC-BT-52)', cantidad: 1, unidad: 'ud', precioUnitario: 690, ivaPorcentaje: 21, total: 834.9, descripcion: 'Incluye canalización hasta 20 m, protecciones y puesta en marcha.', materiales: [{ id: 'a', nombre: 'Cargador 7,4 kW tipo 2 con cable de 5 m', cantidad: 1, unidad: 'ud', costeUnitario: 420, totalCoste: 420, visibleCliente: true }, { id: 'b', nombre: 'Tubo rígido libre de halógenos M25', cantidad: 20, unidad: 'm', costeUnitario: 1.4, totalCoste: 28, visibleCliente: true }] },
    { id: 'm2', categoria: 'Protecciones', concepto: 'Cuadro de protección: IGA, diferencial tipo A y sobretensiones', cantidad: 1, unidad: 'ud', precioUnitario: 245, ivaPorcentaje: 21, total: 296.45 },
    { id: 'm3', categoria: 'Legalización', concepto: 'Tramitación del certificado de instalación eléctrica (CIE)', cantidad: 1, unidad: 'ud', precioUnitario: 180, ivaPorcentaje: 21, total: 217.8 },
  ];
  const base = partidas.reduce((a, x) => a + x.cantidad * x.precioUnitario, 0);
  const iva = Math.round(base * 0.21 * 100) / 100;
  const total = Math.round((base + iva) * 100) / 100;
  const firma: FirmaCliente = { firmadoPor: 'Laura Martín Ruiz', dni: '12345678Z', fechaFirma: `${fecha}T10:42:00`, metodo: 'portal', codigoAceptacion: 'ACEPT-MUESTRA-0000' };
  const cliente = { id: 'cli-muestra', nombre: 'Laura Martín Ruiz', nif: '12345678Z', email: 'cliente@ejemplo.es', telefono: '600 000 000', direccion: 'Calle Real 15, garaje plaza 4', codigoPostal: '18001', ciudad: 'Granada', totalFacturado: 0, exigirFirma: true } as unknown as Client;
  const presupuesto = {
    id: 'pre-muestra', codigo: `PRE-${anio}-042`, nombre: 'Punto de recarga 7,4 kW en garaje comunitario', clienteId: cliente.id, clienteNombre: cliente.nombre, clienteEmail: cliente.email, clienteTelefono: cliente.telefono,
    direccion: 'Calle Real 15, garaje plaza 4, 18001 Granada', estado: 'Enviado', fechaInicio: fecha, fechaFinPrevista: venc, presupuestoAceptado: base, totalFacturado: 0, totalGastos: 0,
    desgloseGastos: { materiales: 0, manoDeObra: 0, subcontratas: 0, maquinaria: 0, otros: 0 }, fotos: [], documentos: [], bitacora: [], partidas, firmaCliente: firma,
  } as unknown as Project;
  const lineas: InvoiceLine[] = partidas.map((x) => ({ id: x.id, concepto: x.concepto, cantidad: x.cantidad, unidad: x.unidad, precioUnitario: x.precioUnitario, ivaPorcentaje: x.ivaPorcentaje, total: x.total, materialesVisibles: (x.materiales || []).filter((m) => m.visibleCliente).map((m) => ({ nombre: m.nombre, cantidad: m.cantidad, unidad: m.unidad })) }));
  const numero = `FAC-${anio}-017`;
  const nif = (settings.cif || 'B12345674').replace(/\W/g, '').toUpperCase();
  const factura = {
    id: 'fac-muestra', numero, fecha, fechaVencimiento: venc, clienteId: cliente.id, clienteNombre: cliente.nombre, clienteNif: cliente.nif, clienteDireccion: 'Calle Real 15, garaje plaza 4, 18001 Granada',
    obraId: 'pre-muestra', obraNombre: presupuesto.nombre, obraCodigo: `OB-${anio}-019`, lineas, baseImponible: base, ivaTotal: iva, total, estado: 'Pendiente', metodoPago: 'Transferencia Bancaria', firmaCliente: firma,
    verifactu: {
      registrada: true, tipoFactura: 'F1', fechaHoraHuso: `${fecha}T10:45:00+02:00`,
      cadena: `IDEmisorFactura=${nif}&NumSerieFactura=${numero}&FechaExpedicionFactura=${fechaAEAT}&TipoFactura=F1&CuotaTotal=${iva.toFixed(2)}&ImporteTotal=${total.toFixed(2)}&Huella=&FechaHoraHusoGenRegistro=${fecha}T10:45:00+02:00`,
      huellaHash: '3F2A9C1E7B6D5A4F8E0C1B2A3D4E5F60718293A4B5C6D7E8F9A0B1C2D3E4F5A6', hashAnterior: '',
      codigoQR: `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=${nif}&numserie=${encodeURIComponent(numero)}&fecha=${fechaAEAT}&importe=${total.toFixed(2)}`,
      sistemaEmisor: 'Control de Obra', estadoEnvio: 'pendiente',
    },
  } as unknown as Invoice;
  return { presupuesto, factura, cliente };
}
