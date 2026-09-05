// Lectura de extractos bancarios: Norma 43 (AEB, cuaderno 43) y CSV/Excel exportado por el banco.
// Todo se procesa en el navegador; el archivo nunca sale del dispositivo.
import { BankTransaction } from '../types';
import { uid } from '../utils/formatters';

export interface MovimientoLeido {
  fecha: string; // YYYY-MM-DD (fecha de operación)
  fechaValor?: string;
  concepto: string;
  importe: number;
  saldoPosterior?: number;
  referencia?: string;
  iban?: string;
  entidad?: string;
}

export interface ResultadoLectura {
  formato: 'norma43' | 'csv';
  movimientos: MovimientoLeido[];
  avisos: string[];
  cuenta?: string;
}

// Código de entidad (4 dígitos) -> nombre habitual
const ENTIDADES: Record<string, string> = {
  '0182': 'BBVA', '2100': 'CaixaBank', '0049': 'Santander', '0081': 'Banco Sabadell', '0128': 'Bankinter',
  '1465': 'ING', '0073': 'Openbank', '2085': 'Ibercaja', '2080': 'Abanca', '2103': 'Unicaja', '0239': 'EVO Banco',
  '3058': 'Cajamar', '2038': 'Bankia (CaixaBank)', '0019': 'Deutsche Bank', '0075': 'Banco Popular (Santander)',
  '0186': 'Banco Mediolanum', '1491': 'Triodos Bank', '0487': 'Banco Mare Nostrum', '3183': 'Arquia Banca',
  '0216': 'Targobank', '2095': 'Kutxabank', '2048': 'Liberbank (Unicaja)', '3190': 'Globalcaja',
  '2013': 'Catalunya Banc', '0061': 'Banca March', '0130': 'Banco Caixa Geral', '3025': 'Caixa Enginyers',
  '6713': 'Revolut', '1550': 'N26', '0138': 'Bankoa', '0234': 'Banco Caminos', '3005': 'Caja Rural Central',
};

export function nombreEntidad(codigo: string): string {
  return ENTIDADES[codigo] || `Entidad ${codigo}`;
}

const fechaN43 = (aammdd: string): string => {
  // AAMMDD -> 20AA-MM-DD
  if (!/^\d{6}$/.test(aammdd)) return '';
  const aa = Number(aammdd.substring(0, 2));
  const yyyy = aa < 70 ? 2000 + aa : 1900 + aa;
  return `${yyyy}-${aammdd.substring(2, 4)}-${aammdd.substring(4, 6)}`;
};

const importeN43 = (signo: string, cifras: string): number => {
  // 14 cifras, las 2 últimas son decimales. Clave 1 = debe (cargo), 2 = haber (abono)
  const n = Number(cifras) / 100;
  return signo === '1' ? -n : n;
};

export function parseNorma43(texto: string): ResultadoLectura {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const movimientos: MovimientoLeido[] = [];
  const avisos: string[] = [];
  let cuentaActual = '';
  let entidadActual = '';
  let actual: MovimientoLeido | null = null;

  const cerrar = () => {
    if (actual) movimientos.push(actual);
    actual = null;
  };

  for (const l of lineas) {
    const tipo = l.substring(0, 2);
    if (tipo === '11') {
      // Cabecera de cuenta: entidad(4) oficina(4) cuenta(10) fecha inicial fecha final ...
      cerrar();
      const entidad = l.substring(2, 6);
      const oficina = l.substring(6, 10);
      const cuenta = l.substring(10, 20);
      entidadActual = nombreEntidad(entidad);
      cuentaActual = `${entidad} ${oficina} ···· ${cuenta.slice(-4)}`;
    } else if (tipo === '22') {
      cerrar();
      // Posiciones (1-based) del cuaderno 43: 3-6 oficina, 7-12 fecha operación, 13-18 fecha valor,
      // 19-20 concepto común, 21-23 concepto propio, 24 clave debe(1)/haber(2), 25-38 importe,
      // 39-48 nº documento, 49-60 referencia 1, 61-76 referencia 2
      const fechaOp = fechaN43(l.substring(6, 12));
      const fechaVal = fechaN43(l.substring(12, 18));
      const clave = l.substring(23, 24);
      const importe = importeN43(clave, l.substring(24, 38));
      const numDoc = l.substring(38, 48).trim();
      const ref1 = l.substring(48, 60).trim();
      const ref2 = l.substring(60, 76).trim();
      actual = {
        fecha: fechaOp || fechaVal,
        fechaValor: fechaVal || undefined,
        concepto: '',
        importe,
        referencia: [numDoc, ref1, ref2].filter(Boolean).join(' ').trim() || undefined,
        iban: cuentaActual || undefined,
        entidad: entidadActual || undefined,
      };
    } else if (tipo === '23' && actual) {
      // Conceptos complementarios: 23 + codigo(2) + concepto(38) + concepto2(38)
      const c1 = l.substring(4, 42).trim();
      const c2 = l.substring(42, 80).trim();
      const texto2 = [c1, c2].filter(Boolean).join(' ');
      actual.concepto = (actual.concepto ? actual.concepto + ' ' : '') + texto2;
    } else if (tipo === '33') {
      cerrar();
      // Final de cuenta: saldo final en posiciones 59..73 (clave 58)
      const claveSaldo = l.substring(58, 59);
      const saldo = importeN43(claveSaldo, l.substring(59, 73));
      // Reconstruimos saldos hacia atrás desde el saldo final
      let s = saldo;
      for (let i = movimientos.length - 1; i >= 0; i--) {
        if (movimientos[i].saldoPosterior === undefined) {
          movimientos[i].saldoPosterior = Math.round(s * 100) / 100;
          s -= movimientos[i].importe;
        }
      }
    } else if (tipo === '88') {
      cerrar();
    }
  }
  cerrar();

  movimientos.forEach((m) => {
    if (!m.concepto) m.concepto = m.referencia ? `Movimiento ${m.referencia}` : 'Movimiento bancario';
    m.concepto = m.concepto.replace(/\s+/g, ' ').trim();
  });

  if (movimientos.length === 0) avisos.push('No se han encontrado registros de movimiento (tipo 22) en el archivo.');
  return { formato: 'norma43', movimientos, avisos, cuenta: cuentaActual || undefined };
}

// --- CSV genérico -----------------------------------------------------------------------

function detectarSeparador(linea: string): string {
  const counts = { ';': (linea.match(/;/g) || []).length, ',': (linea.match(/,/g) || []).length, '\t': (linea.match(/\t/g) || []).length };
  if (counts['\t'] > counts[';'] && counts['\t'] > counts[',']) return '\t';
  return counts[';'] >= counts[','] ? ';' : ',';
}

function splitCSV(linea: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') {
      if (inQ && linea[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// Convierte "1.234,56", "-1234.56", "1 234,56 €" a número
export function parseImporteES(txt: string): number {
  let s = (txt || '').replace(/[€\s]/g, '').trim();
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()]/g, '').replace(/^-/, '');
  if (s.includes(',') && s.includes('.')) {
    // el último separador es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return neg ? -n : n;
}

// Convierte dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd, dd.mm.aa a YYYY-MM-DD
export function parseFechaFlexible(txt: string): string {
  const s = (txt || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = (Number(y) < 70 ? '20' : '19') + y;
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function parseCSVBanco(texto: string): ResultadoLectura {
  const avisos: string[] = [];
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lineas.length < 2) return { formato: 'csv', movimientos: [], avisos: ['El archivo no tiene filas de datos.'] };

  // Buscar la fila de cabecera (la primera que contenga "fecha" y "importe|cantidad|debe|haber|monto")
  let headerIdx = lineas.findIndex((l) => /fecha/i.test(l) && /(importe|cantidad|debe|haber|monto|amount|valor)/i.test(l));
  if (headerIdx < 0) {
    headerIdx = 0;
    avisos.push('No se ha reconocido la fila de cabecera; se han usado las columnas por posición (fecha, concepto, importe, saldo).');
  }
  const sep = detectarSeparador(lineas[headerIdx]);
  const cab = splitCSV(lineas[headerIdx], sep).map(norm);

  const idx = (...cands: string[]) => cab.findIndex((c) => cands.some((k) => c.includes(k)));
  let iFecha = idx('fecha operacion', 'fecha operación', 'f. operacion', 'fecha contable', 'fecha');
  let iValor = idx('fecha valor', 'f. valor');
  if (iValor === iFecha) iValor = -1;
  let iConcepto = idx('concepto', 'descripcion', 'description', 'detalle', 'movimiento', 'observaciones');
  let iImporte = idx('importe', 'cantidad', 'monto', 'amount');
  const iDebe = idx('debe', 'cargo');
  const iHaber = idx('haber', 'abono');
  let iSaldo = idx('saldo', 'balance');
  const iRef = idx('referencia', 'ref.', 'num. documento', 'numero documento');

  if (headerIdx === 0 && iFecha < 0) {
    iFecha = 0;
    iConcepto = 1;
    iImporte = 2;
    iSaldo = 3;
  }

  const movimientos: MovimientoLeido[] = [];
  for (let i = headerIdx + 1; i < lineas.length; i++) {
    const cols = splitCSV(lineas[i], sep);
    if (cols.length < 2) continue;
    const fecha = parseFechaFlexible(cols[iFecha] || '');
    if (!fecha) continue;
    let importe = NaN;
    if (iImporte >= 0) importe = parseImporteES(cols[iImporte] || '');
    if (isNaN(importe) && (iDebe >= 0 || iHaber >= 0)) {
      const d = iDebe >= 0 ? parseImporteES(cols[iDebe] || '') : NaN;
      const h = iHaber >= 0 ? parseImporteES(cols[iHaber] || '') : NaN;
      importe = (isNaN(h) ? 0 : Math.abs(h)) - (isNaN(d) ? 0 : Math.abs(d));
    }
    if (isNaN(importe)) continue;
    const saldo = iSaldo >= 0 ? parseImporteES(cols[iSaldo] || '') : NaN;
    movimientos.push({
      fecha,
      fechaValor: iValor >= 0 ? parseFechaFlexible(cols[iValor] || '') || undefined : undefined,
      concepto: (iConcepto >= 0 ? cols[iConcepto] : cols[1]) || 'Movimiento bancario',
      importe: Math.round(importe * 100) / 100,
      saldoPosterior: isNaN(saldo) ? undefined : Math.round(saldo * 100) / 100,
      referencia: iRef >= 0 ? cols[iRef] || undefined : undefined,
    });
  }
  if (movimientos.length === 0) avisos.push('No se ha podido leer ninguna fila con fecha e importe válidos.');
  return { formato: 'csv', movimientos, avisos };
}

export function leerExtracto(texto: string, nombreArchivo = ''): ResultadoLectura {
  const esN43 = /\.(n43|q43|aeb|txt)$/i.test(nombreArchivo) && /^11\d{18}/m.test(texto);
  if (esN43 || /^11\d{4}\d{4}\d{10}\d{6}\d{6}/m.test(texto)) return parseNorma43(texto);
  return parseCSVBanco(texto);
}

// Clave para detectar duplicados al importar de nuevo el mismo extracto
export function claveMovimiento(m: { fecha: string; importe: number; concepto: string; referencia?: string }): string {
  return `${m.fecha}|${m.importe.toFixed(2)}|${(m.referencia || m.concepto).toLowerCase().replace(/\s+/g, ' ').substring(0, 60)}`;
}

export function aTransacciones(res: ResultadoLectura, entidadPorDefecto: string, existentes: BankTransaction[]): { nuevas: BankTransaction[]; duplicadas: number } {
  const claves = new Set(existentes.map((t) => claveMovimiento({ fecha: t.fecha, importe: t.importe, concepto: t.concepto, referencia: t.referencia })));
  const nuevas: BankTransaction[] = [];
  let duplicadas = 0;
  for (const m of res.movimientos) {
    const k = claveMovimiento(m);
    if (claves.has(k)) {
      duplicadas++;
      continue;
    }
    claves.add(k);
    nuevas.push({
      id: uid('tx'),
      fecha: m.fecha,
      fechaValor: m.fechaValor,
      concepto: m.concepto,
      importe: m.importe,
      tipo: m.importe >= 0 ? 'ingreso' : 'gasto',
      saldoPosterior: m.saldoPosterior,
      conciliado: false,
      entidad: m.entidad || entidadPorDefecto || 'Banco',
      iban: m.iban,
      referencia: m.referencia,
      origen: res.formato,
    });
  }
  // Orden cronológico descendente
  nuevas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { nuevas, duplicadas };
}
