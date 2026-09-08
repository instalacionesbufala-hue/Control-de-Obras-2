import { parseNorma43, parseCSVBanco, leerExtracto } from '../src/lib/norma43';
import { sha256HexUpper, VECTORES_AEAT, cadenaAlta, urlCotejoQR } from '../src/lib/verifactu';
import { proponerCruces } from '../src/lib/conciliacion';
import { elegirModelo } from '../src/lib/gemini';
import { tieneDatosPropios } from '../src/lib/storage';
import { separarCatalogo, actualizarCosteEnKits, margenDe } from '../src/lib/catalogo';
import { conCobro, sinCobro, totalCobrado, pendienteDe, situacionDe, estadoSegunCobros, resumenCobros } from '../src/lib/cobros';
import { consumoDesdePresupuesto, consumoActualizado, costeRealMateriales, costePrevistoMateriales, desviaciones, resumenObra } from '../src/lib/consumo';
import type { AppState } from '../src/types';

const pad = (s: string, n: number) => s.padEnd(n, ' ').substring(0, n);
const n43 = [
  '11' + '0182' + '0001' + '0123456789' + '260901' + '260930' + '2' + '00000001000000' + '978' + pad('EMPRESA', 26),
  '22' + '0001' + '260903' + '260903' + '02' + '001' + '2' + '00000000107993' + pad('0000000001', 10) + pad('REF1', 12) + pad('REF2', 16),
  '23' + '01' + pad('TRANSFERENCIA RECIBIDA LAURA MARTIN', 38) + pad('FAC-2026-001', 38),
  '22' + '0001' + '260904' + '260904' + '04' + '002' + '1' + '00000000015000' + pad('0000000002', 10) + pad('', 12) + pad('', 16),
  '23' + '01' + pad('RECIBO ASESORIA FISCAL', 38) + pad('', 38),
  '33' + '0182' + '0001' + '0123456789' + '00001' + '00000000015000' + '00001' + '00000000107993' + '2' + '00000001092993' + '978' + pad('', 4),
  '88' + pad('', 18) + '000006' + pad('', 54),
].join('\n');
const r = parseNorma43(n43);
console.log('N43 movimientos:', r.movimientos.length, r.cuenta, r.avisos);
console.log(JSON.stringify(r.movimientos, null, 0));
const csv = 'Fecha;Concepto;Importe;Saldo\n03/09/2026;TRANSFERENCIA LAURA MARTIN FAC-2026-001;1.079,93;10.929,93\n04/09/2026;RECIBO ASESORIA;-150,00;10.779,93\n';
const c = parseCSVBanco(csv);
console.log('CSV movimientos:', c.movimientos.length, JSON.stringify(c.movimientos));
console.log('detecta N43:', leerExtracto(n43, 'x.txt').formato, '· detecta CSV:', leerExtracto(csv, 'x.csv').formato);

(async () => {
  for (const v of VECTORES_AEAT) console.log('vector AEAT', (await sha256HexUpper(v.cadena)) === v.huella ? 'OK' : 'MAL');
  const cad = cadenaAlta({ nif: '89890001K', numero: '12345678/G33', fecha: '2024-01-01', tipoFactura: 'F1', cuotaTotal: 12.35, importeTotal: 123.45, huellaAnterior: '', fechaHoraGen: '2024-01-01T19:20:30+01:00' });
  console.log('cadena alta', cad === VECTORES_AEAT[0].cadena ? 'OK' : 'MAL');
  console.log('QR', urlCotejoQR({ nif: 'B-12345674', numero: 'FAC-2026-002', fecha: '2026-09-05', importeTotal: 2159.85 }));
  const props = proponerCruces({ id: 't', fecha: '2026-09-03', concepto: 'TRANSFERENCIA RECIBIDA LAURA MARTIN FAC-2026-001', importe: 1079.93, tipo: 'ingreso', conciliado: false, entidad: 'B', origen: 'csv' } as any, [{ id: 'i1', numero: 'FAC-2026-001', clienteNombre: 'Laura Martín Ruiz', total: 1079.93, fecha: '2026-09-01', estado: 'Pendiente' } as any], []);
  console.log('cruce', props[0]?.confianza, props[0]?.motivos);
})();

// ---- Elección del modelo de Gemini ----
// Google retira y renombra modelos: la app pide el catálogo y elige. Estos casos fijan el criterio.
{
  const m = (ids: string[]) => ids.map((id) => ({ id, nombre: id }));
  const casos: Array<[string, string[], string | null]> = [
    ['catálogo típico', ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'], 'gemini-2.5-flash-lite'],
    ['solo pro', ['gemini-3-pro', 'gemini-2.5-pro'], 'gemini-3-pro'],
    ['descarta preliminares si hay estables', ['gemini-3-flash-preview', 'gemini-2.5-flash'], 'gemini-2.5-flash'],
    ['si todo es preliminar, se usa igual', ['gemini-4-flash-preview'], 'gemini-4-flash-preview'],
    ['gana la versión más nueva', ['gemini-2.5-flash', 'gemini-3-flash'], 'gemini-3-flash'],
    ['nombre desconocido: se usa el que haya', ['modelo-raro-1'], 'modelo-raro-1'],
    ['sin modelos', [], null],
  ];
  for (const [nombre, ids, esperado] of casos) {
    const r = elegirModelo(m(ids));
    console.log('modelo ·', nombre, r === esperado ? 'OK' : `MAL (devolvió ${r})`);
  }
}

// ---- Primer inicio de sesión en un dispositivo nuevo ----
// Antes, el estado recién creado con los ejemplos tenía fecha más reciente que la nube, ganaba,
// y borraba los datos reales de la cuenta. Estas comprobaciones fijan el criterio correcto.
{
  const st = (extra: Partial<AppState>): AppState => ({
    version: 4, updatedAt: new Date().toISOString(), companySettings: {} as any,
    clients: [], projects: [], invoices: [], expenses: [], bankTransactions: [], calendarEvents: [],
    catalogCategories: [], catalogItems: [], suppliers: [], kits: [], demoCargada: false, guiaVista: true,
    ...extra,
  });
  const casos: Array<[string, AppState | null, boolean]> = [
    ['sin estado', null, false],
    ['recién instalado, solo ejemplos', st({ clients: [{ id: 'cli-demo-1', esDemo: true }] as any, projects: [{ id: 'obr-demo-1', esDemo: true }] as any }), false],
    ['un cliente real', st({ clients: [{ id: 'cli-1757000000' }] as any }), true],
    ['ejemplos y además una factura real', st({ invoices: [{ id: 'inv-demo-1', esDemo: true }, { id: 'inv-1757000001' }] as any }), true],
    ['solo un gasto real', st({ expenses: [{ id: 'gas-1757000002' }] as any }), true],
    ['todo vacío', st({}), false],
  ];
  for (const [nombre, estado, esperado] of casos) {
    const r = tieneDatosPropios(estado);
    console.log('datos propios ·', nombre, r === esperado ? 'OK' : `MAL (devolvió ${r})`);
  }
}

// ---- Separación de materiales y kits ----
// Los "conceptos" con escandallo eran kits disfrazados. Al separarlos, sus materiales salen
// al catálogo sin repetirse y las líneas del kit quedan enlazadas al material correcto.
{
  const cats = [{ id: 'c1', nombre: 'Puntos de recarga', descripcion: '' }];
  const items: any[] = [
    { id: 'i1', concepto: 'Instalación 7,4 kW', unidad: 'ud', precioUnitario: 650, ivaPorcentaje: 21, categoriaId: 'c1', categoriaNombre: 'Puntos de recarga',
      materiales: [
        { id: 'm1', nombre: 'Cable 3G6', cantidad: 20, unidad: 'm', costeUnitario: 3.9, totalCoste: 78 },
        { id: 'm2', nombre: 'Mano de obra', cantidad: 4, unidad: 'h', costeUnitario: 28, totalCoste: 112 },
      ] },
    { id: 'i2', concepto: 'Instalación 22 kW', unidad: 'ud', precioUnitario: 980, ivaPorcentaje: 21, categoriaId: 'c1', categoriaNombre: 'Puntos de recarga',
      materiales: [{ id: 'm3', nombre: 'Cable 3G6', cantidad: 35, unidad: 'm', costeUnitario: 3.9, totalCoste: 136.5 }] },
    { id: 'i3', concepto: 'Tubo M25', unidad: 'm', precioUnitario: 3.5, ivaPorcentaje: 21, categoriaId: 'c1', categoriaNombre: 'Puntos de recarga' },
  ];
  const r = separarCatalogo(items, [], cats);
  const cable = r.materiales.find((m) => m.concepto === 'Cable 3G6');
  const kit1 = r.kits.find((k) => k.nombre === 'Instalación 7,4 kW');
  const pruebas: Array<[string, boolean]> = [
    ['los 2 conceptos con escandallo pasan a kits', r.kits.length === 2],
    ['el material que se repite no se duplica', r.materiales.filter((m) => m.concepto === 'Cable 3G6').length === 1],
    ['el que ya era material se conserva', !!r.materiales.find((m) => m.concepto === 'Tubo M25')],
    ['el coste de compra viaja al material', cable?.precioCompra === 3.9],
    ['las líneas quedan enlazadas al material', !!kit1 && kit1.partidas.every((p) => !p.itemId || r.materiales.some((m) => m.id === p.itemId))],
    ['el coste del kit es la suma de sus líneas', kit1?.precioCosteTotal === 190],
    ['el precio de venta del concepto se conserva', kit1?.precioVentaTotal === 650],
    ['margen sobre coste correcto', kit1?.margenPorcentaje === margenDe(190, 650)],
  ];
  for (const [nombre, ok] of pruebas) console.log('catálogo ·', nombre, ok ? 'OK' : 'MAL');

  // Propagar un coste nuevo solo a los kits elegidos
  const tras = actualizarCosteEnKits(cable!.id, 5, r.kits, [kit1!.id]);
  const k1 = tras.find((k) => k.id === kit1!.id)!;
  const k2 = tras.find((k) => k.id !== kit1!.id)!;
  console.log('catálogo · el kit elegido recoge el coste nuevo', k1.precioCosteTotal === 5 * 20 + 112 ? 'OK' : `MAL (${k1.precioCosteTotal})`);
  console.log('catálogo · el kit no elegido no cambia', k2.precioCosteTotal === r.kits.find((k) => k.id === k2.id)!.precioCosteTotal ? 'OK' : 'MAL');
  console.log('catálogo · el precio de venta nunca se toca solo', k1.precioVentaTotal === 650 ? 'OK' : 'MAL');
}

// ---- Cobros parciales ----
// Antes, conciliar el primer 50 % marcaba la factura como pagada entera. Ahora el estado sale
// de sumar los cobros, y desconciliar lo deshace.
{
  const base = { id: 'f1', numero: 'FAC-1', total: 1000, fecha: '2026-09-01', fechaVencimiento: '2026-09-30', estado: 'Pendiente', clienteNombre: 'X', cobros: [] } as any;
  const c1 = { id: 'c1', fecha: '2026-09-05', importe: 500, transaccionId: 'tx1' };
  const c2 = { id: 'c2', fecha: '2026-10-10', importe: 500, transaccionId: 'tx2' };
  const mitad = conCobro(base, c1);
  const entera = conCobro(mitad, c2);
  const deshecha = sinCobro(entera, { transaccionId: 'tx2' });
  const pruebas: Array<[string, boolean]> = [
    ['sin cobros, nada cobrado', totalCobrado(base) === 0 && pendienteDe(base) === 1000],
    ['el primer 50 % NO la da por pagada', situacionDe(mitad) === 'parcial' && mitad.estado !== 'Pagada'],
    ['queda pendiente la otra mitad', pendienteDe(mitad) === 500],
    ['con los dos cobros queda pagada', situacionDe(entera) === 'cobrada' && entera.estado === 'Pagada'],
    ['desconciliar el segundo la devuelve a parcial', situacionDe(deshecha) === 'parcial' && deshecha.estado !== 'Pagada'],
    ['sigue marcada como conciliada por el primer cobro', deshecha.bancoConciliado === true],
    ['vencida si pasó la fecha y falta dinero', estadoSegunCobros(mitad, '2026-10-15') === 'Vencida'],
    ['no vencida antes del vencimiento', estadoSegunCobros(mitad, '2026-09-20') === 'Pendiente'],
    ['una anulada no entra en el cálculo de cobro', situacionDe({ ...base, estado: 'Anulada' } as any) === 'no-aplica'],
  ];
  for (const [nombre, ok] of pruebas) console.log('cobros ·', nombre, ok ? 'OK' : 'MAL');

  const r = resumenCobros([mitad, { ...base, id: 'f2', numero: 'FAC-2', total: 300, fechaVencimiento: '2026-08-01' } as any], '2026-10-15');
  console.log('cobros · el resumen suma solo lo pendiente', r.importe === 800 ? 'OK' : `MAL (${r.importe})`);
  console.log('cobros · cuenta las vencidas', r.vencidas === 2 ? 'OK' : `MAL (${r.vencidas})`);
}

// ---- Consumo real de material en obra ----
// La lista arranca con lo presupuestado y solo se corrigen las cantidades. La rentabilidad
// real sale de ahí, no de una estimación.
{
  const obra: any = {
    id: 'ob1', presupuestoAceptado: 1000, totalGastos: 0,
    partidas: [{ id: 'p1', concepto: 'Punto de recarga', cantidad: 2, precioUnitario: 500, ivaPorcentaje: 21, unidad: 'ud', total: 0,
      materiales: [
        { id: 'm1', nombre: 'Cable', cantidad: 10, unidad: 'm', costeUnitario: 4, totalCoste: 40 },
        { id: 'm2', nombre: 'Cargador', cantidad: 1, unidad: 'ud', costeUnitario: 300, totalCoste: 300 },
      ] }],
  };
  const inicial = consumoDesdePresupuesto(obra);
  // 10 m por unidad y 2 unidades = 20 m previstos
  const cable = inicial.find((c) => c.nombre === 'Cable')!;
  const pruebas: Array<[string, boolean]> = [
    ['la lista sale del escandallo', inicial.length === 2],
    ['multiplica por las unidades de la partida', cable.cantidadPrevista === 20],
    ['arranca con lo real igual a lo previsto', inicial.every((c) => c.cantidadReal === c.cantidadPrevista)],
    ['sin corregir nada, no hay desvío', costeRealMateriales(inicial) === costePrevistoMateriales(inicial)],
  ];
  // Sobró cable: solo se usaron 15 m
  const corregido = inicial.map((c) => (c.id === cable.id ? { ...c, cantidadReal: 15 } : c));
  pruebas.push(['gastar menos baja el coste real', costeRealMateriales(corregido) === costePrevistoMateriales(inicial) - 20]);
  const d = desviaciones(corregido);
  pruebas.push(['la desviación señala la línea y los euros', d.length === 1 && d[0].diferenciaCantidad === -5 && d[0].diferenciaEuros === -20]);
  // Un imprevisto que no estaba presupuestado
  const conExtra = [...corregido, { id: 'x1', nombre: 'Tubo extra', unidad: 'm', cantidadPrevista: 0, cantidadReal: 6, costeUnitario: 3, extra: true }];
  pruebas.push(['el imprevisto suma al coste real', costeRealMateriales(conExtra) === costeRealMateriales(corregido) + 18]);
  pruebas.push(['el imprevisto no altera lo previsto', costePrevistoMateriales(conExtra) === costePrevistoMateriales(inicial)]);
  // Al reabrir, se conservan las correcciones
  const guardadas = consumoActualizado({ ...obra, consumoReal: conExtra });
  pruebas.push(['al volver conserva lo corregido y los extras', guardadas.find((c) => c.id === cable.id)!.cantidadReal === 15 && guardadas.some((c) => c.extra)]);
  for (const [nombre, ok] of pruebas) console.log('consumo ·', nombre, ok ? 'OK' : 'MAL');

  const r = resumenObra({ ...obra, consumoReal: conExtra, consumoCerrado: true });
  console.log('consumo · el margen usa el coste real al cerrar', r.margen === Math.round(((1000 - r.real) / 1000) * 100 * 100) / 100 ? 'OK' : `MAL (${r.margen})`);
}
