import { parseNorma43, parseCSVBanco, leerExtracto } from '../src/lib/norma43';
import { sha256HexUpper, VECTORES_AEAT, cadenaAlta, urlCotejoQR } from '../src/lib/verifactu';
import { proponerCruces } from '../src/lib/conciliacion';

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
