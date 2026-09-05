import { DocumentTemplate } from '../types';

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
    condicionesPago: 'Transferencia bancaria a la cuenta indicada. Vencimiento a 30 días desde la fecha de emisión.',
    notaFinal: 'Forma de pago: 50 % a la aceptación del presupuesto y 50 % restante a la finalización de la instalación. Validez de la oferta: 30 días naturales. Los trabajos se ejecutan conforme al REBT (ITC-BT-52) e incluyen la documentación técnica necesaria para su legalización.',
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
    notaFinal: 'Forma de pago: 40 % al aceptar, 40 % al inicio del montaje y 20 % a la puesta en marcha. Validez: 30 días. Instalación conforme al REBT e ITC-BT-52, con certificado de instalación eléctrica (CIE) incluido.',
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
    condicionesPago: 'Transferencia bancaria. Vencimiento a 30 días fecha factura.',
    notaFinal: 'Forma de pago: 50 % a la aceptación y 50 % a la finalización. Oferta válida 30 días. Precios sin IVA salvo indicación contraria. Los trabajos incluyen retirada de escombros y limpieza final de la zona de trabajo.',
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
    notaFinal: 'Pago: 50 % al aceptar y 50 % al terminar. Validez 30 días. Incluye pruebas de funcionamiento y explicación de uso del equipo al cliente.',
    pieDePagina: '',
  },
];
