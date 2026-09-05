// Propuestas de cruce entre movimientos bancarios y facturas/gastos.
// La app PROPONE y el usuario CONFIRMA. Nada se concilia solo.
import { BankTransaction, Expense, Invoice, ConfianzaCruce } from '../types';

export interface PropuestaCruce {
  tipo: 'factura_venta' | 'gasto_compra';
  referenciaId: string;
  referenciaNombre: string;
  importeDoc: number;
  confianza: ConfianzaCruce;
  motivos: string[];
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function palabrasClave(s: string): string[] {
  const stop = new Set(['sl', 'sa', 'slu', 'sau', 'de', 'la', 'el', 'los', 'las', 'y', 'the', 'transf', 'transferencia', 'recibo', 'pago', 'compra', 'tarjeta', 'bizum', 'adeudo', 'abono', 'recibida', 'emitida', 'factura', 'fra', 'fac']);
  return norm(s).split(' ').filter((w) => w.length >= 3 && !stop.has(w) && !/^\d+$/.test(w));
}

function coincidenciaTexto(concepto: string, nombre: string): number {
  const a = new Set(palabrasClave(concepto));
  const b = palabrasClave(nombre);
  if (a.size === 0 || b.length === 0) return 0;
  let hits = 0;
  b.forEach((w) => {
    if (a.has(w)) hits++;
  });
  return hits / b.length;
}

function diasEntre(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 999;
  return Math.abs(Math.round((da - db) / 86400000));
}

export function proponerCruces(tx: BankTransaction, invoices: Invoice[], expenses: Expense[]): PropuestaCruce[] {
  const out: PropuestaCruce[] = [];
  const abs = Math.abs(tx.importe);
  const conceptoNorm = norm(tx.concepto);

  if (tx.importe > 0) {
    for (const inv of invoices) {
      if (['Anulada', 'Rectificada'].includes(inv.estado) || inv.bancoConciliado) continue;
      const motivos: string[] = [];
      let puntos = 0;
      const difImporte = Math.abs(inv.total - abs);
      const numEnConcepto = inv.numero && conceptoNorm.includes(norm(inv.numero));
      if (numEnConcepto) {
        motivos.push(`El concepto menciona la factura ${inv.numero}`);
        puntos += 3;
      }
      if (difImporte < 0.01) {
        motivos.push('Importe exacto');
        puntos += 3;
      } else if (difImporte <= 1) {
        motivos.push('Importe casi exacto (≤ 1 €)');
        puntos += 2;
      } else if (abs < inv.total && abs >= inv.total * 0.4) {
        motivos.push(`Podría ser un cobro parcial (${Math.round((abs / inv.total) * 100)} %)`);
        puntos += 1;
      } else continue;
      const txt = coincidenciaTexto(tx.concepto, inv.clienteNombre);
      if (txt >= 0.5) {
        motivos.push('El nombre del cliente aparece en el concepto');
        puntos += 2;
      }
      const dias = diasEntre(tx.fecha, inv.fecha);
      if (dias <= 45 && tx.fecha >= inv.fecha) {
        motivos.push(`Cobrada ${dias} días después de emitirse`);
        puntos += 1;
      }
      if (puntos < 2) continue;
      out.push({
        tipo: 'factura_venta',
        referenciaId: inv.id,
        referenciaNombre: `${inv.numero} · ${inv.clienteNombre}`,
        importeDoc: inv.total,
        confianza: puntos >= 6 ? 'alta' : puntos >= 4 ? 'media' : 'baja',
        motivos,
      });
    }
  } else {
    for (const exp of expenses) {
      if (exp.bancoConciliado) continue;
      const motivos: string[] = [];
      let puntos = 0;
      const difImporte = Math.abs(exp.total - abs);
      if (difImporte < 0.01) {
        motivos.push('Importe exacto');
        puntos += 3;
      } else if (difImporte <= 1) {
        motivos.push('Importe casi exacto (≤ 1 €)');
        puntos += 2;
      } else continue;
      const txt = coincidenciaTexto(tx.concepto, exp.proveedor);
      if (txt >= 0.5) {
        motivos.push('El proveedor aparece en el concepto');
        puntos += 2;
      }
      if (exp.numeroFactura && conceptoNorm.includes(norm(exp.numeroFactura))) {
        motivos.push(`El concepto menciona ${exp.numeroFactura}`);
        puntos += 2;
      }
      const dias = diasEntre(tx.fecha, exp.fecha);
      if (dias <= 45) {
        motivos.push(`Fechas a ${dias} días`);
        puntos += 1;
      }
      if (puntos < 2) continue;
      out.push({
        tipo: 'gasto_compra',
        referenciaId: exp.id,
        referenciaNombre: `${exp.numeroFactura || 'Gasto'} · ${exp.proveedor}`,
        importeDoc: exp.total,
        confianza: puntos >= 6 ? 'alta' : puntos >= 4 ? 'media' : 'baja',
        motivos,
      });
    }
  }
  const orden = { alta: 0, media: 1, baja: 2 };
  return out.sort((a, b) => orden[a.confianza] - orden[b.confianza]).slice(0, 4);
}
