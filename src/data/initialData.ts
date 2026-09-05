// Datos de ejemplo. Son ficticios y se generan con fechas relativas al día de hoy para que
// el filtro "mes en curso" siempre muestre algo. Al pulsar "Borrar ejemplos" se eliminan
// todos los registros marcados con esDemo.
import { Client, Project, Invoice, Expense, BankTransaction, CalendarInstallation, CatalogCategory, CatalogItem, Supplier, Kit } from '../types';
import { addDays, hoyISO, anioActual } from '../utils/dates';

const HOY = hoyISO();
// Fechas relativas a hoy. Las fechas pasadas no salen del mes en curso para que el filtro
// por defecto (mes actual) siempre muestre los ejemplos.
const PRIMERO_MES = HOY.substring(0, 8) + '01';
const d = (offset: number) => {
  const f = addDays(HOY, offset);
  return offset < 0 && f < PRIMERO_MES ? PRIMERO_MES : f;
};
const A = anioActual();

export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'sup-demo-1', nombre: 'Suministros Eléctricos del Sur S.L.', cif: 'B12345678', categoria: 'Materiales', telefono: '958 000 001', email: 'pedidos@suministros-demo.es', direccion: 'Polígono Industrial, nave 4', esDemo: true },
  { id: 'sup-demo-2', nombre: 'Distribuidora Cables y Tubos S.A.', cif: 'A87654321', categoria: 'Materiales', telefono: '958 000 002', email: 'ventas@cablesytubos-demo.es', direccion: 'Avenida de la Industria 12', esDemo: true },
  { id: 'sup-demo-3', nombre: 'Cargadores VE Ibérica S.L.', cif: 'B11223344', categoria: 'Puntos de Recarga', telefono: '900 000 003', email: 'partners@cargadores-demo.es', direccion: 'Parque Tecnológico, edificio 2', esDemo: true },
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-demo-1', nombre: 'Laura Martín Ruiz (ejemplo)', nif: '12345678Z', email: 'laura.demo@ejemplo.es', telefono: '600 000 001',
    direccion: 'Calle Real 15, garaje plaza 4', ciudad: 'Granada', codigoPostal: '18001',
    obraPrincipal: 'Instalación punto de recarga 7,4 kW en garaje comunitario', totalFacturado: 0, obrasCount: 1, documentosCount: 0,
    notas: 'Cliente de ejemplo. Instalación monofásica con balanceo dinámico.', exigirFirma: true, tipoCliente: 'particular', fotos: [], documentos: [], esDemo: true,
  },
  {
    id: 'cli-demo-2', nombre: 'Logística Ejemplo S.L.', nif: 'B98765432', email: 'compras@logistica-ejemplo.es', telefono: '958 000 100',
    direccion: 'Polígono Industrial Norte, parcela 18', ciudad: 'Granada', codigoPostal: '18210',
    obraPrincipal: 'Electrificación de flota: 2 postes dobles 22 kW', totalFacturado: 0, obrasCount: 1, documentosCount: 0,
    notas: 'Gran empresa: acepta presupuestos por pedido de compra, sin firma manuscrita.', exigirFirma: false, tipoCliente: 'gran_empresa', fotos: [], documentos: [], esDemo: true,
  },
  {
    id: 'cli-demo-3', nombre: 'Comunidad de Propietarios Avenida Ejemplo 22', nif: 'H18000000', email: 'administracion@cp-ejemplo.es', telefono: '958 000 200',
    direccion: 'Avenida Ejemplo 22', ciudad: 'Granada', codigoPostal: '18004',
    obraPrincipal: 'Preinstalación troncal en garaje comunitario', totalFacturado: 0, obrasCount: 1, documentosCount: 0,
    notas: 'Administrador de fincas como interlocutor.', exigirFirma: true, tipoCliente: 'comunidad', fotos: [], documentos: [], esDemo: true,
  },
];

const M = (id: string, nombre: string, cantidad: number, unidad: string, costeUnitario: number, proveedor?: string, visibleCliente = false) => ({
  id, nombre, cantidad, unidad, costeUnitario, totalCoste: Math.round(cantidad * costeUnitario * 100) / 100, proveedor, visibleCliente,
});

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'obr-demo-1',
    codigo: `PRE-${A}-001`,
    obraCodigo: `OB-${A}-001`,
    nombre: 'Instalación punto de recarga 7,4 kW en garaje comunitario',
    clienteId: 'cli-demo-1', clienteNombre: 'Laura Martín Ruiz (ejemplo)', clienteEmail: 'laura.demo@ejemplo.es', clienteTelefono: '600 000 001',
    direccion: 'Calle Real 15, garaje plaza 4, Granada',
    estado: 'En ejecución',
    fechaInicio: d(-20), fechaAceptacion: d(-15), fechaFinPrevista: d(10),
    presupuestoAceptado: 1785, totalFacturado: 892.5, totalGastos: 920, facturaIds: ['inv-demo-1'],
    desgloseGastos: { materiales: 580, manoDeObra: 240, subcontratas: 0, maquinaria: 50, otros: 50 },
    porcentajeAvance: 60,
    plantillaPresupuesto: 'moderna',
    notaFinal: 'Forma de pago: 50 % a la aceptación del presupuesto y 50 % restante a la finalización de la instalación. Validez de la oferta: 30 días naturales.',
    fechaCitaCalendario: `${d(3)}T08:30:00`,
    agendadaEnGoogleCalendar: false,
    tecnicosAsignados: ['Oficial instalador'],
    firmaCliente: { firmadoPor: 'Laura Martín Ruiz', dni: '12345678Z', fechaFirma: `${d(-15)}T17:42:00`, metodo: 'portal' },
    partidas: [
      {
        id: 'par-demo-1', categoria: '⚡ Puntos de recarga', concepto: 'Instalación básica de punto de recarga hasta 20 m (ITC-BT-52)', cantidad: 1, unidad: 'ud', precioUnitario: 650, ivaPorcentaje: 21, total: 786.5, costeInternoTotal: 345, margenPorcentaje: 88.4,
        materiales: [
          M('m-d1-1', 'Tubo rígido libre de halógenos M25', 20, 'm', 2.1, 'Distribuidora Cables y Tubos', true),
          M('m-d1-2', 'Caja estanca IP65 y fijaciones', 1, 'ud', 18, 'Suministros Eléctricos del Sur'),
          M('m-d1-3', 'Mano de obra oficial instalador', 5, 'h', 35, 'Propia'),
          M('m-d1-4', 'Tornillería y pequeño material', 1, 'pack', 30),
          M('m-d1-5', 'Comprobaciones de diferencial y tierra', 1, 'ud', 80, 'Propia'),
        ],
      },
      {
        id: 'par-demo-2', categoria: '⚡ Puntos de recarga', concepto: 'Cargador 7,4 kW monofásico con conectividad y app', cantidad: 1, unidad: 'ud', precioUnitario: 685, ivaPorcentaje: 21, total: 828.85, costeInternoTotal: 495, margenPorcentaje: 38.4,
        materiales: [
          M('m-d2-1', 'Cargador 7,4 kW tipo 2 con cable de 5 m', 1, 'ud', 430, 'Cargadores VE Ibérica', true),
          M('m-d2-2', 'Soporte de conector y colgador de cable', 1, 'ud', 25, 'Cargadores VE Ibérica', true),
          M('m-d2-3', 'Configuración de la app y puesta en marcha', 1, 'ud', 40, 'Propia'),
        ],
      },
      {
        id: 'par-demo-3', categoria: '🛡️ Protecciones y cuadro', concepto: 'Cuadro de protección VE: IGA, diferencial tipo A y sobretensiones', cantidad: 1, unidad: 'ud', precioUnitario: 245, ivaPorcentaje: 21, total: 296.45, costeInternoTotal: 142, margenPorcentaje: 72.5,
        materiales: [
          M('m-d3-1', 'Cuadro modular IP65 8 elementos', 1, 'ud', 24),
          M('m-d3-2', 'Protector sobretensiones permanentes y transitorias', 1, 'ud', 68, undefined, true),
          M('m-d3-3', 'Diferencial 40 A 30 mA clase A superinmunizado', 1, 'ud', 50, undefined, true),
        ],
      },
      {
        id: 'par-demo-4', categoria: '📑 Legalización', concepto: 'Tramitación del certificado de instalación eléctrica (CIE)', cantidad: 1, unidad: 'ud', precioUnitario: 205, ivaPorcentaje: 21, total: 248.05, costeInternoTotal: 58, margenPorcentaje: 253,
        materiales: [M('m-d4-1', 'Tasa de Industria', 1, 'ud', 38), M('m-d4-2', 'Esquema unifilar y memoria', 1, 'ud', 20, 'Propia')],
      },
    ],
    fotos: [],
    documentos: [
      { id: 'doc-demo-1', nombre: `Presupuesto_PRE-${A}-001_aceptado.pdf`, tipo: 'Presupuesto', fecha: d(-15), tamano: '160 KB', estado: 'Firmado', notas: 'Aceptado desde el portal por Laura Martín Ruiz (12345678Z).' },
    ],
    bitacora: [
      { id: 'log-demo-1', fecha: d(-15), autor: 'Portal de aceptación', tipo: 'avance', texto: 'Presupuesto aceptado y firmado por la clienta desde su móvil. Pasa a obra.' },
      { id: 'log-demo-2', fecha: d(-5), autor: 'Oficial instalador', tipo: 'material', texto: 'Recibido el cargador y el cuadro de protecciones. Pendiente de tendido.' },
    ],
    esDemo: true,
  },
  {
    id: 'obr-demo-2',
    codigo: `PRE-${A}-002`,
    nombre: 'Electrificación de flota: 2 postes dobles 22 kW',
    clienteId: 'cli-demo-2', clienteNombre: 'Logística Ejemplo S.L.', clienteEmail: 'compras@logistica-ejemplo.es', clienteTelefono: '958 000 100',
    direccion: 'Polígono Industrial Norte, parcela 18, Granada',
    estado: 'Enviado',
    fechaInicio: d(-4), fechaFinPrevista: d(40),
    presupuestoAceptado: 15197.6, totalFacturado: 0, totalGastos: 0,
    desgloseGastos: { materiales: 0, manoDeObra: 0, subcontratas: 0, maquinaria: 0, otros: 0 },
    porcentajeAvance: 0,
    plantillaPresupuesto: 'tecnica',
    notaFinal: 'Forma de pago: 40 % al aceptar, 40 % al inicio del montaje y 20 % a la puesta en marcha. Validez: 30 días. Precios sin IVA.',
    partidas: [
      {
        id: 'par-demo-21', categoria: '⚡ Puntos de recarga', concepto: 'Poste doble de recarga 2×22 kW trifásico con RFID y OCPP', cantidad: 2, unidad: 'ud', precioUnitario: 3450, ivaPorcentaje: 21, total: 8349, costeInternoTotal: 2100, margenPorcentaje: 64.3,
        materiales: [M('m-d21-1', 'Poste 2×22 kW con pantalla', 1, 'ud', 1850, 'Cargadores VE Ibérica', true), M('m-d21-2', 'Lector RFID y tarjetas', 1, 'pack', 90), M('m-d21-3', 'Placa de anclaje a zapata', 1, 'ud', 160)],
      },
      {
        id: 'par-demo-22', categoria: '🔌 Cableado', concepto: 'Línea trifásica RZ1-K 5×16 mm² por bandeja', cantidad: 60, unidad: 'm', precioUnitario: 28.5, ivaPorcentaje: 21, total: 2069.1, costeInternoTotal: 12, margenPorcentaje: 137.5,
        materiales: [M('m-d22-1', 'Manguera RZ1-K 5G16 Cu', 1, 'm', 9.8, 'Distribuidora Cables y Tubos', true), M('m-d22-2', 'Bandeja de rejilla y accesorios', 0.5, 'm', 4.4)],
      },
      {
        id: 'par-demo-23', categoria: '🛡️ Protecciones y cuadro', concepto: 'Cuadro general de recarga con protecciones y contador MID', cantidad: 1, unidad: 'ud', precioUnitario: 3950, ivaPorcentaje: 21, total: 4779.5, costeInternoTotal: 2300, margenPorcentaje: 71.7,
        materiales: [M('m-d23-1', 'Armario metálico IP66', 1, 'ud', 450), M('m-d23-2', 'Interruptor de caja moldeada 100 A', 1, 'ud', 650), M('m-d23-3', 'Diferenciales clase B 4×40 A 30 mA', 4, 'ud', 280, undefined, true), M('m-d23-4', 'Sobretensiones trifásico tipo 1+2', 1, 'ud', 180)],
      },
    ],
    fotos: [], documentos: [],
    bitacora: [{ id: 'log-demo-4', fecha: d(-4), autor: 'Oficina', tipo: 'avance', texto: 'Presupuesto enviado por correo al departamento de compras.' }],
    esDemo: true,
  },
  {
    id: 'obr-demo-3',
    codigo: `PRE-${A}-003`,
    nombre: 'Preinstalación troncal en garaje comunitario (3 plantas)',
    clienteId: 'cli-demo-3', clienteNombre: 'Comunidad de Propietarios Avenida Ejemplo 22', clienteEmail: 'administracion@cp-ejemplo.es', clienteTelefono: '958 000 200',
    direccion: 'Avenida Ejemplo 22, Granada',
    estado: 'Borrador',
    fechaInicio: d(-1), fechaFinPrevista: d(60),
    presupuestoAceptado: 6450, totalFacturado: 0, totalGastos: 0,
    desgloseGastos: { materiales: 0, manoDeObra: 0, subcontratas: 0, maquinaria: 0, otros: 0 },
    porcentajeAvance: 0,
    plantillaPresupuesto: 'ejecutiva',
    partidas: [
      { id: 'par-demo-31', categoria: '🔌 Cableado', concepto: 'Canalización troncal con bandeja y tubo por 3 plantas', cantidad: 120, unidad: 'm', precioUnitario: 32, ivaPorcentaje: 21, total: 4646.4, costeInternoTotal: 14, margenPorcentaje: 128, materiales: [M('m-d31-1', 'Bandeja perforada 100×60', 1, 'm', 8.5), M('m-d31-2', 'Tubo rígido M32', 1, 'm', 3.1), M('m-d31-3', 'Mano de obra', 0.07, 'h', 35, 'Propia')] },
      { id: 'par-demo-32', categoria: '🛡️ Protecciones y cuadro', concepto: 'Cuadro de servicios comunes para recarga con contador', cantidad: 1, unidad: 'ud', precioUnitario: 2610, ivaPorcentaje: 21, total: 3158.1, costeInternoTotal: 1500, margenPorcentaje: 74, materiales: [M('m-d32-1', 'Armario y aparamenta', 1, 'ud', 1500)] },
    ],
    fotos: [], documentos: [],
    bitacora: [{ id: 'log-demo-5', fecha: d(-1), autor: 'Oficina', tipo: 'avance', texto: 'Borrador tras la visita de replanteo. Falta confirmar la potencia disponible con la distribuidora.' }],
    esDemo: true,
  },
  {
    id: 'obr-demo-4',
    codigo: `PRE-${A}-000`,
    nombre: 'Cargador básico en parking (ejemplo rechazado)',
    clienteId: 'cli-demo-1', clienteNombre: 'Laura Martín Ruiz (ejemplo)', clienteEmail: 'laura.demo@ejemplo.es', clienteTelefono: '600 000 001',
    direccion: 'Calle Real 15, Granada',
    estado: 'Rechazado', motivoRechazo: 'La clienta prefirió posponer la instalación al año siguiente.',
    fechaInicio: d(-40), fechaFinPrevista: d(-20),
    presupuestoAceptado: 2100, totalFacturado: 0, totalGastos: 0,
    desgloseGastos: { materiales: 0, manoDeObra: 0, subcontratas: 0, maquinaria: 0, otros: 0 },
    porcentajeAvance: 0, plantillaPresupuesto: 'compacta', fotos: [], documentos: [],
    bitacora: [{ id: 'log-demo-6', fecha: d(-30), autor: 'Oficina', tipo: 'incidencia', texto: 'Presupuesto desestimado por la clienta.' }],
    esDemo: true,
  },
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-demo-1',
    numero: `FAC-${A}-001`,
    fecha: d(-12), fechaVencimiento: d(18),
    clienteId: 'cli-demo-1', clienteNombre: 'Laura Martín Ruiz (ejemplo)', clienteNif: '12345678Z', clienteDireccion: 'Calle Real 15, garaje plaza 4, 18001 Granada',
    obraId: 'obr-demo-1', obraNombre: 'Instalación punto de recarga 7,4 kW en garaje comunitario', obraCodigo: `OB-${A}-001`,
    plantillaFactura: 'moderna',
    lineas: [
      { id: 'l-demo-1', concepto: 'Anticipo 50 % · Instalación punto de recarga 7,4 kW (según presupuesto aceptado)', cantidad: 1, unidad: 'ud', precioUnitario: 892.5, ivaPorcentaje: 21, total: 1079.93 },
    ],
    baseImponible: 892.5, ivaTotal: 187.43, total: 1079.93,
    estado: 'Pagada', metodoPago: 'Transferencia Bancaria',
    firmaCliente: { firmadoPor: 'Laura Martín Ruiz', dni: '12345678Z', fechaFirma: `${d(-15)}T17:42:00`, metodo: 'portal' },
    verifactu: {
      registrada: true, tipoFactura: 'F1', fechaHoraHuso: `${d(-12)}T11:22:45+02:00`,
      cadena: '', huellaHash: 'DEMO-SIN-HUELLA-REAL', hashAnterior: '',
      codigoQR: '', sistemaEmisor: 'Datos de ejemplo', estadoEnvio: 'pendiente',
    },
    bancoConciliado: true, transaccionId: 'tx-demo-1',
    esDemo: true,
  },
];

export const INITIAL_EXPENSES: Expense[] = [
  { id: 'exp-demo-1', numeroFactura: 'GEST-001', proveedor: 'Asesoría Fiscal Ejemplo S.L.', cifProveedor: 'B28900000', concepto: 'Cuota mensual de gestoría', tipo: 'SL', categoria: 'Gestoría / Asesoría', baseImponible: 123.97, ivaPorcentaje: 21, ivaTotal: 26.03, total: 150, fecha: d(-18), estadoPago: 'Pagado', metodoPago: 'Domiciliación', bancoConciliado: true, transaccionId: 'tx-demo-2', esRecurrente: true, esDemo: true },
  { id: 'exp-demo-2', numeroFactura: 'SUM-9942', proveedor: 'Suministros Eléctricos del Sur S.L.', cifProveedor: 'B12345678', concepto: 'Cargador 7,4 kW + cuadro de protección VE', tipo: 'Obra', categoria: 'Materiales', obraId: 'obr-demo-1', obraNombre: 'Instalación punto de recarga 7,4 kW en garaje comunitario', baseImponible: 702.48, ivaPorcentaje: 21, ivaTotal: 147.52, total: 850, fecha: d(-9), estadoPago: 'Pagado', metodoPago: 'Tarjeta', ocrDetectado: true, bancoConciliado: false, esDemo: true },
  { id: 'exp-demo-3', numeroFactura: 'RENT-0410', proveedor: 'Renting Vehículos Ejemplo S.A.', cifProveedor: 'A78900000', concepto: 'Cuota renting furgoneta de taller', tipo: 'SL', categoria: 'Vehículo / Combustible', baseImponible: 371.9, ivaPorcentaje: 21, ivaTotal: 78.1, total: 450, fecha: d(-17), estadoPago: 'Pagado', metodoPago: 'Domiciliación', bancoConciliado: true, transaccionId: 'tx-demo-6', esRecurrente: true, esDemo: true },
  { id: 'exp-demo-4', numeroFactura: 'TKT-8841', proveedor: 'Estación de Servicio Ejemplo', cifProveedor: 'A28000000', concepto: 'Combustible / recarga furgoneta', tipo: 'SL', categoria: 'Vehículo / Combustible', baseImponible: 54.05, ivaPorcentaje: 21, ivaTotal: 11.35, total: 65.4, fecha: d(-11), estadoPago: 'Pagado', metodoPago: 'Tarjeta', ocrDetectado: true, bancoConciliado: true, transaccionId: 'tx-demo-3', esDemo: true },
  { id: 'exp-demo-5', numeroFactura: 'PRL-3T', proveedor: 'Servicio de Prevención Ejemplo S.L.U.', cifProveedor: 'B84900000', concepto: 'Cuota trimestral prevención de riesgos laborales', tipo: 'SL', categoria: 'Seguros y PRL', baseImponible: 320, ivaPorcentaje: 21, ivaTotal: 67.2, total: 387.2, fecha: d(-16), estadoPago: 'Pagado', metodoPago: 'Transferencia Bancaria', bancoConciliado: false, esRecurrente: true, esDemo: true },
  { id: 'exp-demo-6', numeroFactura: 'TEL-10', proveedor: 'Telecomunicaciones Ejemplo S.A.', cifProveedor: 'A80900000', concepto: 'Fibra y líneas móviles', tipo: 'SL', categoria: 'Software y Comunicaciones', baseImponible: 95, ivaPorcentaje: 21, ivaTotal: 19.95, total: 114.95, fecha: d(-18), estadoPago: 'Pagado', metodoPago: 'Domiciliación', bancoConciliado: true, esRecurrente: true, esDemo: true },
];

export const INITIAL_BANK_TRANSACTIONS: BankTransaction[] = [
  { id: 'tx-demo-1', fecha: d(-7), concepto: `TRANSFERENCIA RECIBIDA LAURA MARTIN FAC-${A}-001`, importe: 1079.93, tipo: 'ingreso', saldoPosterior: 12453.2, conciliado: true, conciliadoCon: { tipo: 'factura_venta', referenciaId: 'inv-demo-1', referenciaNombre: `FAC-${A}-001 · Laura Martín Ruiz` }, entidad: 'Banco (ejemplo)', origen: 'demo', esDemo: true },
  { id: 'tx-demo-2', fecha: d(-9), concepto: 'RECIBO ASESORIA FISCAL EJEMPLO', importe: -150, tipo: 'gasto', saldoPosterior: 11373.27, conciliado: true, conciliadoCon: { tipo: 'gasto_compra', referenciaId: 'exp-demo-1', referenciaNombre: 'GEST-001 · Asesoría Fiscal Ejemplo' }, entidad: 'Banco (ejemplo)', origen: 'demo', esDemo: true },
  { id: 'tx-demo-3', fecha: d(-11), concepto: 'PAGO TARJETA ESTACION SERVICIO EJEMPLO', importe: -65.4, tipo: 'gasto', saldoPosterior: 11523.27, conciliado: true, conciliadoCon: { tipo: 'gasto_compra', referenciaId: 'exp-demo-4', referenciaNombre: 'TKT-8841 · Estación de Servicio Ejemplo' }, entidad: 'Banco (ejemplo)', origen: 'demo', esDemo: true },
  { id: 'tx-demo-4', fecha: d(-2), concepto: 'TRANSFERENCIA RECIBIDA LOGISTICA EJEMPLO SL ANTICIPO', importe: 5000, tipo: 'ingreso', saldoPosterior: 17453.2, conciliado: false, entidad: 'Banco (ejemplo)', origen: 'demo', esDemo: true },
  { id: 'tx-demo-5', fecha: d(-8), concepto: 'PAGO TARJETA SUMINISTROS ELECTRICOS DEL SUR', importe: -850, tipo: 'gasto', saldoPosterior: 11588.67, conciliado: false, entidad: 'Banco (ejemplo)', origen: 'demo', esDemo: true },
  { id: 'tx-demo-6', fecha: d(-17), concepto: 'RECIBO RENTING VEHICULOS EJEMPLO', importe: -450, tipo: 'gasto', saldoPosterior: 12438.67, conciliado: true, conciliadoCon: { tipo: 'gasto_compra', referenciaId: 'exp-demo-3', referenciaNombre: 'RENT-0410 · Renting Vehículos Ejemplo' }, entidad: 'Banco (ejemplo)', origen: 'demo', esDemo: true },
];

export const INITIAL_CALENDAR_EVENTS: CalendarInstallation[] = [
  { id: 'cal-demo-1', titulo: 'Instalación punto de recarga 7,4 kW', obraId: 'obr-demo-1', obraNombre: 'Instalación punto de recarga 7,4 kW en garaje comunitario', clienteNombre: 'Laura Martín Ruiz (ejemplo)', clienteTelefono: '600 000 001', direccion: 'Calle Real 15, garaje plaza 4, Granada', fechaHoraInicio: `${d(3)}T08:30:00`, fechaHoraFin: `${d(3)}T14:00:00`, tecnicos: ['Oficial instalador'], tipo: 'Instalación', estado: 'Programada', googleCalendarSynced: false, presupuestoId: 'obr-demo-1', presupuestoCodigo: `PRE-${A}-001`, origenReserva: 'oficina', esDemo: true },
  { id: 'cal-demo-2', titulo: 'Medición y replanteo en nave', obraId: 'obr-demo-2', obraNombre: 'Electrificación de flota: 2 postes dobles 22 kW', clienteNombre: 'Logística Ejemplo S.L.', clienteTelefono: '958 000 100', direccion: 'Polígono Industrial Norte, parcela 18, Granada', fechaHoraInicio: `${d(1)}T09:00:00`, fechaHoraFin: `${d(1)}T12:30:00`, tecnicos: ['Oficial instalador'], tipo: 'Medición', estado: 'Programada', googleCalendarSynced: false, origenReserva: 'oficina', esDemo: true },
  { id: 'cal-demo-3', titulo: 'Inspección OCA y tramitación CIE', obraId: 'obr-demo-1', obraNombre: 'Instalación punto de recarga 7,4 kW en garaje comunitario', clienteNombre: 'Laura Martín Ruiz (ejemplo)', direccion: 'Calle Real 15, Granada', fechaHoraInicio: `${d(8)}T11:30:00`, fechaHoraFin: `${d(8)}T13:00:00`, tecnicos: ['Oficial instalador', 'Inspector OCA'], tipo: 'Inspección CIE / OCA', estado: 'Programada', googleCalendarSynced: false, esDemo: true },
];

export const INITIAL_CATALOG_CATEGORIES: CatalogCategory[] = [
  { id: 'cat-recarga-ve', nombre: '⚡ Puntos de recarga', descripcion: 'Equipos y estaciones de carga para garajes, viviendas y empresas' },
  { id: 'cat-cableado-lineas', nombre: '🔌 Cableado y líneas', descripcion: 'Conductores libres de halógenos, canalizaciones y bandejas' },
  { id: 'cat-cuadros-protecciones', nombre: '🛡️ Protecciones y cuadro', descripcion: 'Elementos de seguridad obligatorios según REBT / ITC-BT-52' },
  { id: 'cat-tramitacion-cie', nombre: '📑 Legalización y documentación', descripcion: 'Memoria técnica, certificado de instalación (CIE), OCA y ayudas' },
  { id: 'cat-mano-obra', nombre: '🛠️ Mano de obra', descripcion: 'Horas de oficial, ayudante, desplazamiento y pruebas' },
];

const C = (id: string, categoriaId: string, concepto: string, unidad: string, precioUnitario: number, materiales: CatalogItem['materiales'], extra: Partial<CatalogItem> = {}): CatalogItem => {
  const cat = INITIAL_CATALOG_CATEGORIES.find((c) => c.id === categoriaId)!;
  const coste = (materiales || []).reduce((a, m) => a + m.totalCoste, 0);
  return {
    id, categoriaId, categoriaNombre: cat.nombre, concepto, unidad, precioUnitario, ivaPorcentaje: 21,
    costeInternoTotal: Math.round(coste * 100) / 100,
    margenPorcentaje: coste > 0 ? Math.round(((precioUnitario - coste) / coste) * 10000) / 100 : 0,
    materiales, ...extra,
  };
};

export const INITIAL_CATALOG_ITEMS: CatalogItem[] = [
  C('mat-1', 'cat-recarga-ve', 'Instalación básica de punto de recarga hasta 20 m (ITC-BT-52)', 'ud', 650, [M('m-1-1', 'Tubo rígido libre de halógenos Ø25 mm', 20, 'm', 2.8, undefined, true), M('m-1-2', 'Cable Cu 3G6 mm² RZ1-K', 22, 'm', 3.9, undefined, true), M('m-1-3', 'Mano de obra oficial', 4, 'h', 28, 'Propia'), M('m-1-4', 'Fijaciones y pequeño material', 1, 'pack', 31.2)], { referenciaSku: 'INST-VE-20M', descripcionDetallada: 'Incluye fijación mural, canalización libre de halógenos, pasamuros y conexionado.' }),
  C('mat-2', 'cat-recarga-ve', 'Instalación de punto de recarga hasta 35 m con trazado complejo', 'ud', 890, [M('m-2-1', 'Tubo rígido curvable Ø32 mm', 35, 'm', 3.5, undefined, true), M('m-2-2', 'Cable Cu 3G10 mm² RZ1-K', 38, 'm', 5.6, undefined, true), M('m-2-3', 'Mano de obra oficial', 7, 'h', 28, 'Propia')], { referenciaSku: 'INST-VE-35M' }),
  C('mat-3', 'cat-recarga-ve', 'Cargador 7,4 kW monofásico tipo 2 con conectividad', 'ud', 685, [M('m-3-1', 'Cargador 7,4 kW tipo 2, cable 5 m', 1, 'ud', 465, undefined, true), M('m-3-2', 'Soporte mural de conector', 1, 'ud', 20)], { referenciaSku: 'CARG-74-MONO' }),
  C('mat-4', 'cat-recarga-ve', 'Cargador 7,4 kW con balanceo dinámico de potencia', 'ud', 760, [M('m-4-1', 'Cargador 7,4 kW monofásico con medidor', 1, 'ud', 510, undefined, true), M('m-4-2', 'Pinza toroidal de medida', 1, 'ud', 30, undefined, true)], { referenciaSku: 'CARG-74-BAL' }),
  C('mat-5', 'cat-recarga-ve', 'Punto de recarga doble 22 kW trifásico para empresas', 'ud', 1450, [M('m-5-1', 'Equipo doble 22 kW con RFID', 1, 'ud', 980, undefined, true), M('m-5-2', 'Pedestal de anclaje', 1, 'ud', 70, undefined, true)], { referenciaSku: 'CARG-22-DOBLE' }),
  C('mat-6', 'cat-recarga-ve', 'Medidor de balanceo dinámico de carga', 'ud', 145, [M('m-6-1', 'Módulo de medición monofásico', 1, 'ud', 95, undefined, true)], { referenciaSku: 'MED-BAL' }),
  C('mat-7', 'cat-cableado-lineas', 'Suplemento cable 10 mm² Cu libre de halógenos RZ1-K', 'm', 12.8, [M('m-7-1', 'Manguera RZ1-K 3G10 Cu', 1, 'm', 5.2, undefined, true), M('m-7-2', 'Grapas y fijación', 1, 'm', 1)], { referenciaSku: 'CAB-10' }),
  C('mat-8', 'cat-cableado-lineas', 'Suplemento cable 6 mm² Cu libre de halógenos RZ1-K', 'm', 8.5, [M('m-8-1', 'Manguera RZ1-K 3G6 Cu', 1, 'm', 3.6, undefined, true), M('m-8-2', 'Grapas y fijación', 1, 'm', 0.5)], { referenciaSku: 'CAB-6' }),
  C('mat-9', 'cat-cableado-lineas', 'Acometida trifásica 5×10 mm² Cu libre de halógenos', 'm', 21.5, [M('m-9-1', 'Manguera RZ1-K 5G10 Cu', 1, 'm', 10.2, undefined, true), M('m-9-2', 'Fijación pesada para bandeja', 1, 'm', 1.3)], { referenciaSku: 'CAB-TRIF-10' }),
  C('mat-10', 'cat-cableado-lineas', 'Cable de datos UTP Cat.6 libre de halógenos', 'm', 3.8, [M('m-10-1', 'Cable UTP Cat6 LSZH', 1, 'm', 1.2, undefined, true), M('m-10-2', 'Conectores RJ45', 1, 'm', 0.4)], { referenciaSku: 'CAB-UTP6' }),
  C('mat-11', 'cat-cableado-lineas', 'Tubo de acero galvanizado 32 mm para protección mecánica', 'm', 9.2, [M('m-11-1', 'Tubo metálico enchufable Ø32 mm', 1, 'm', 4.2, undefined, true), M('m-11-2', 'Abrazaderas', 1, 'm', 0.6)], { referenciaSku: 'TUB-GALV-32' }),
  C('mat-12', 'cat-cuadros-protecciones', 'Protección contra sobretensiones permanentes y transitorias + IGA', 'ud', 245, [M('m-12-1', 'Protector combinado 40 A', 1, 'ud', 120, undefined, true), M('m-12-2', 'Cuadro estanco 4 módulos IP65', 1, 'ud', 15)], { referenciaSku: 'PROT-IGA40' }),
  C('mat-13', 'cat-cuadros-protecciones', 'Interruptor diferencial 40 A 30 mA tipo A superinmunizado', 'ud', 165, [M('m-13-1', 'Diferencial 2P 40 A 30 mA tipo A-SI', 1, 'ud', 92, undefined, true)], { referenciaSku: 'DIF-40A' }),
  C('mat-14', 'cat-cuadros-protecciones', 'Caja estanca modular IP65 con cerradura', 'ud', 95, [M('m-14-1', 'Caja 8 módulos IP65 con cerradura', 1, 'ud', 48, undefined, true)], { referenciaSku: 'CAJA-IP65' }),
  C('mat-15', 'cat-cuadros-protecciones', 'Contador de energía MID monofásico', 'ud', 110, [M('m-15-1', 'Contador digital MID con salida de pulsos', 1, 'ud', 58, undefined, true)], { referenciaSku: 'CONT-MID' }),
  C('mat-16', 'cat-tramitacion-cie', 'Tramitación del certificado de instalación eléctrica (CIE)', 'ud', 180, [M('m-16-1', 'Tasa de Industria', 1, 'ud', 35), M('m-16-2', 'Revisión y registro', 1, 'ud', 25, 'Propia')], { referenciaSku: 'TRAM-CIE' }),
  C('mat-17', 'cat-tramitacion-cie', 'Memoria técnica de diseño (MTD) para recarga de VE', 'ud', 120, [M('m-17-1', 'Horas de oficina técnica', 1, 'ud', 30, 'Propia')], { referenciaSku: 'DOC-MTD' }),
  C('mat-18', 'cat-tramitacion-cie', 'Gestión de la ayuda pública para puntos de recarga', 'ud', 90, [M('m-18-1', 'Tramitación telemática', 1, 'ud', 25, 'Propia')], { referenciaSku: 'GEST-AYUDA' }),
  C('mat-19', 'cat-mano-obra', 'Hora de oficial instalador electricista', 'h', 42, [M('m-19-1', 'Coste hora laboral + PRL', 1, 'h', 22, 'Propia')], { referenciaSku: 'MO-OFICIAL' }),
  C('mat-20', 'cat-mano-obra', 'Hora de ayudante', 'h', 28, [M('m-20-1', 'Coste hora laboral + PRL', 1, 'h', 15, 'Propia')], { referenciaSku: 'MO-AYUD' }),
  C('mat-21', 'cat-mano-obra', 'Desplazamiento (por visita)', 'ud', 35, [M('m-21-1', 'Combustible y tiempo', 1, 'ud', 18, 'Propia')], { referenciaSku: 'DESPL' }),
];

export const INITIAL_KITS: Kit[] = [
  {
    id: 'kit-demo-1', nombre: 'Kit integral punto de recarga 7,4 kW (ITC-BT-52)', codigo: 'KIT-74', esDemo: true,
    descripcion: 'Solución llave en mano: cargador 7,4 kW, cuadro de protecciones, línea de 15 m y certificado CIE.',
    categoria: '⚡ Puntos de recarga', activo: true, fechaCreacion: d(-60),
    precioCosteTotal: 843, precioVentaTotal: 1495, margenPorcentaje: 44,
    partidas: [
      { id: 'kp-1-1', itemId: 'mat-3', concepto: 'Cargador 7,4 kW monofásico tipo 2 con conectividad', cantidad: 1, unidad: 'ud', precioCoste: 485, precioVenta: 685, ivaPorcentaje: 21 },
      { id: 'kp-1-2', itemId: 'mat-12', concepto: 'Cuadro de protección VE (diferencial clase A + IGA + sobretensiones)', cantidad: 1, unidad: 'ud', precioCoste: 138, precioVenta: 245, ivaPorcentaje: 21 },
      { id: 'kp-1-3', itemId: 'mat-8', concepto: 'Línea Cu 3G6 mm² RZ1-K bajo tubo libre de halógenos', cantidad: 15, unidad: 'm', precioCoste: 6.7, precioVenta: 16, ivaPorcentaje: 21 },
      { id: 'kp-1-4', concepto: 'Instalación, fijación mural y conexionado', cantidad: 1, unidad: 'ud', precioCoste: 112, precioVenta: 220, ivaPorcentaje: 21 },
      { id: 'kp-1-5', itemId: 'mat-16', concepto: 'Memoria técnica y tramitación del CIE', cantidad: 1, unidad: 'ud', precioCoste: 40, precioVenta: 105, ivaPorcentaje: 21 },
    ],
  },
  {
    id: 'kit-demo-2', nombre: 'Kit cargador con balanceo dinámico de potencia', codigo: 'KIT-74-BAL', esDemo: true,
    descripcion: 'Punto de recarga con control dinámico de potencia para no superar la potencia contratada.',
    categoria: '⚡ Puntos de recarga', activo: true, fechaCreacion: d(-45),
    precioCosteTotal: 965, precioVentaTotal: 1680, margenPorcentaje: 43,
    partidas: [
      { id: 'kp-2-1', itemId: 'mat-4', concepto: 'Cargador 7,4 kW con balanceo dinámico de potencia', cantidad: 1, unidad: 'ud', precioCoste: 580, precioVenta: 795, ivaPorcentaje: 21 },
      { id: 'kp-2-2', itemId: 'mat-12', concepto: 'Cuadro de mando y protección VE', cantidad: 1, unidad: 'ud', precioCoste: 138, precioVenta: 245, ivaPorcentaje: 21 },
      { id: 'kp-2-3', concepto: 'Tendido de línea de fuerza y cable de medida (18 m)', cantidad: 18, unidad: 'm', precioCoste: 8.5, precioVenta: 19, ivaPorcentaje: 21 },
      { id: 'kp-2-4', concepto: 'Mano de obra, configuración de la app y puesta en marcha', cantidad: 1, unidad: 'ud', precioCoste: 140, precioVenta: 260, ivaPorcentaje: 21 },
      { id: 'kp-2-5', itemId: 'mat-16', concepto: 'Tramitación del certificado de instalación (CIE)', cantidad: 1, unidad: 'ud', precioCoste: 40, precioVenta: 105, ivaPorcentaje: 21 },
    ],
  },
  {
    id: 'kit-demo-3', nombre: 'Kit cuadro de protecciones ITC-BT-52', codigo: 'KIT-PROT', esDemo: true,
    descripcion: 'Conjunto precableado en envolvente IP65 con diferencial clase A, IGA y sobretensiones.',
    categoria: '🛡️ Protecciones y cuadro', activo: true, fechaCreacion: d(-30),
    precioCosteTotal: 155, precioVentaTotal: 285, margenPorcentaje: 46,
    partidas: [
      { id: 'kp-3-1', itemId: 'mat-14', concepto: 'Caja estanca modular IP65 8 elementos', cantidad: 1, unidad: 'ud', precioCoste: 22, precioVenta: 42, ivaPorcentaje: 21 },
      { id: 'kp-3-2', itemId: 'mat-13', concepto: 'Interruptor diferencial 2P 40 A 30 mA clase A', cantidad: 1, unidad: 'ud', precioCoste: 52, precioVenta: 98, ivaPorcentaje: 21 },
      { id: 'kp-3-3', concepto: 'Interruptor magnetotérmico IGA 2P 32 A curva C', cantidad: 1, unidad: 'ud', precioCoste: 19, precioVenta: 35, ivaPorcentaje: 21 },
      { id: 'kp-3-4', concepto: 'Protector contra sobretensiones transitorias y permanentes', cantidad: 1, unidad: 'ud', precioCoste: 62, precioVenta: 110, ivaPorcentaje: 21 },
    ],
  },
];

// Nombre de los registros de ejemplo, por si algún registro antiguo no tiene esDemo
export const DEMO_IDS = new Set<string>([
  ...INITIAL_CLIENTS.map((c) => c.id),
  ...INITIAL_PROJECTS.map((p) => p.id),
  ...INITIAL_INVOICES.map((i) => i.id),
  ...INITIAL_EXPENSES.map((e) => e.id),
  ...INITIAL_BANK_TRANSACTIONS.map((t) => t.id),
  ...INITIAL_CALENDAR_EVENTS.map((c) => c.id),
  ...INITIAL_SUPPLIERS.map((s) => s.id),
  ...INITIAL_KITS.map((k) => k.id),
]);

export const esRegistroDemo = (r: { id: string; esDemo?: boolean }) => !!r.esDemo || DEMO_IDS.has(r.id) || r.id.includes('-demo-');
