// Cobros de una factura. Lo normal en obra es cobrar en dos veces (50 % al aceptar y 50 % al
// terminar), así que una factura puede estar cobrada a medias. El estado de cobro NO se decide
// a mano: se calcula sumando los cobros, y los cobros llegan sobre todo del banco al conciliar.
import { Invoice, CobroFactura } from '../types';

export const redondear2 = (n: number) => Math.round(n * 100) / 100;

export function totalCobrado(inv: Invoice): number {
  return redondear2((inv.cobros || []).reduce((a, c) => a + c.importe, 0));
}

export function pendienteDe(inv: Invoice): number {
  return redondear2(Math.max(0, inv.total - totalCobrado(inv)));
}

export type SituacionCobro = 'sin-cobrar' | 'parcial' | 'cobrada' | 'no-aplica';

export function situacionDe(inv: Invoice): SituacionCobro {
  if (inv.estado === 'Anulada' || inv.estado === 'Rectificada' || inv.estado === 'Borrador') return 'no-aplica';
  const cobrado = totalCobrado(inv);
  if (cobrado >= inv.total - 0.01) return 'cobrada';
  return cobrado > 0.01 ? 'parcial' : 'sin-cobrar';
}

// Días transcurridos desde el vencimiento. Negativo si aún no ha vencido.
export function diasVencida(inv: Invoice, hoy = new Date().toISOString().split('T')[0]): number {
  if (!inv.fechaVencimiento) return 0;
  const ms = new Date(hoy).getTime() - new Date(inv.fechaVencimiento).getTime();
  return Math.floor(ms / 86400000);
}

// El estado que se guarda en la factura, derivado de sus cobros. Nunca toca las anuladas
// ni las rectificadas, que tienen su propio estado.
export function estadoSegunCobros(inv: Invoice, hoy?: string): Invoice['estado'] {
  if (inv.estado === 'Anulada' || inv.estado === 'Rectificada' || inv.estado === 'Borrador') return inv.estado;
  const s = situacionDe(inv);
  if (s === 'cobrada') return 'Pagada';
  return diasVencida(inv, hoy) > 0 ? 'Vencida' : 'Pendiente';
}

// Añade un cobro y deja el estado coherente
export function conCobro(inv: Invoice, cobro: CobroFactura): Invoice {
  const cobros = [...(inv.cobros || []).filter((c) => c.id !== cobro.id), cobro].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const conCobros = { ...inv, cobros };
  return { ...conCobros, estado: estadoSegunCobros(conCobros), bancoConciliado: cobros.some((c) => !!c.transaccionId) };
}

// Quita un cobro (por id o por la transacción bancaria de la que vino)
export function sinCobro(inv: Invoice, filtro: { id?: string; transaccionId?: string }): Invoice {
  const cobros = (inv.cobros || []).filter((c) => (filtro.id ? c.id !== filtro.id : true) && (filtro.transaccionId ? c.transaccionId !== filtro.transaccionId : true));
  const conCobros = { ...inv, cobros };
  return { ...conCobros, estado: estadoSegunCobros(conCobros), bancoConciliado: cobros.some((c) => !!c.transaccionId) };
}

// Facturas por cobrar, las más viejas primero. Es la lista que importa para perseguir el dinero.
export function porCobrar(invoices: Invoice[], hoy?: string): Array<{ inv: Invoice; pendiente: number; dias: number }> {
  return invoices
    .filter((i) => {
      const s = situacionDe(i);
      return s === 'sin-cobrar' || s === 'parcial';
    })
    .map((inv) => ({ inv, pendiente: pendienteDe(inv), dias: diasVencida(inv, hoy) }))
    .sort((a, b) => b.dias - a.dias);
}

// Resumen para el aviso de la portada
export function resumenCobros(invoices: Invoice[], hoy?: string) {
  const lista = porCobrar(invoices, hoy);
  const vencidas = lista.filter((x) => x.dias > 0);
  return {
    cuantas: lista.length,
    importe: redondear2(lista.reduce((a, x) => a + x.pendiente, 0)),
    vencidas: vencidas.length,
    importeVencido: redondear2(vencidas.reduce((a, x) => a + x.pendiente, 0)),
    diasDeLaMasVieja: vencidas.length ? vencidas[0].dias : 0,
    masVieja: vencidas[0]?.inv,
  };
}

// Texto de reclamación, listo para enviar por correo o WhatsApp. El usuario lo revisa y envía.
export function textoReclamacion(inv: Invoice, empresa: string, iban?: string): string {
  const pendiente = pendienteDe(inv);
  const dias = diasVencida(inv);
  const parcial = totalCobrado(inv) > 0.01;
  return [
    `Hola ${inv.clienteNombre},`,
    '',
    parcial
      ? `Te escribimos por la factura ${inv.numero}. Nos consta un cobro parcial y queda pendiente ${pendiente.toFixed(2)} € de los ${inv.total.toFixed(2)} € totales.`
      : `Te escribimos por la factura ${inv.numero}, de ${inv.total.toFixed(2)} €, con vencimiento el ${inv.fechaVencimiento.split('-').reverse().join('/')}.`,
    dias > 0 ? `A día de hoy lleva ${dias} día${dias === 1 ? '' : 's'} de retraso.` : 'Vence en breve.',
    iban ? `\nPuedes hacer la transferencia a ${iban}, indicando ${inv.numero} en el concepto.` : '',
    '',
    'Si ya lo has pagado o hay cualquier problema con la factura, dínoslo y lo revisamos.',
    '',
    `Gracias,\n${empresa}`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}
