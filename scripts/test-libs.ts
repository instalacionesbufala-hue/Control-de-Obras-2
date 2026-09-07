import { parseNorma43, parseCSVBanco, leerExtracto } from '../src/lib/norma43';
import { sha256HexUpper, VECTORES_AEAT, cadenaAlta, urlCotejoQR } from '../src/lib/verifactu';
import { proponerCruces } from '../src/lib/conciliacion';
import { elegirModelo } from '../src/lib/gemini';
import { tieneDatosPropios } from '../src/lib/storage';
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
