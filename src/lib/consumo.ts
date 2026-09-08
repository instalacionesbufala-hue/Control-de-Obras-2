// Consumo real de material en la obra.
//
// La rentabilidad prevista sale del escandallo del presupuesto. La real sale de lo que de verdad
// se gastó, y eso solo lo sabe quien estuvo allí. Aquí se prepara la lista partiendo de lo
// presupuestado, para que en obra solo haya que corregir cantidades en vez de escribirlo todo.
import { Project, ConsumoObra } from '../types';

export const redondear2 = (n: number) => Math.round(n * 100) / 100;

// Lista inicial: cada material del escandallo, con la cantidad prevista ya puesta como real.
export function consumoDesdePresupuesto(p: Project): ConsumoObra[] {
  const out: ConsumoObra[] = [];
  (p.partidas || []).forEach((par) => {
    (par.materiales || []).forEach((m) => {
      const prevista = redondear2(m.cantidad * par.cantidad);
      out.push({
        id: `con-${par.id}-${m.id}`,
        partidaId: par.id,
        partidaConcepto: par.concepto,
        nombre: m.nombre,
        unidad: m.unidad || 'ud',
        cantidadPrevista: prevista,
        cantidadReal: prevista,
        costeUnitario: m.costeUnitario || 0,
      });
    });
  });
  return out;
}

// Une lo que ya estuviera anotado con lo que haya en el presupuesto ahora, sin perder los extras
// ni las cantidades ya corregidas.
export function consumoActualizado(p: Project): ConsumoObra[] {
  const guardado = p.consumoReal || [];
  if (!guardado.length) return consumoDesdePresupuesto(p);
  const desdePresupuesto = consumoDesdePresupuesto(p);
  const porId = new Map(guardado.map((c) => [c.id, c]));
  const union = desdePresupuesto.map((n) => {
    const y = porId.get(n.id);
    return y ? { ...n, cantidadReal: y.cantidadReal, costeUnitario: y.costeUnitario } : n;
  });
  const extras = guardado.filter((c) => c.extra);
  return [...union, ...extras];
}

export const costePrevistoMateriales = (lista: ConsumoObra[]) => redondear2(lista.reduce((a, c) => a + c.cantidadPrevista * c.costeUnitario, 0));
export const costeRealMateriales = (lista: ConsumoObra[]) => redondear2(lista.reduce((a, c) => a + c.cantidadReal * c.costeUnitario, 0));

export interface DesviacionLinea {
  consumo: ConsumoObra;
  diferenciaCantidad: number;
  diferenciaEuros: number;
}

// Líneas donde lo gastado no coincide con lo previsto, de mayor a menor impacto en euros
export function desviaciones(lista: ConsumoObra[]): DesviacionLinea[] {
  return lista
    .map((c) => ({
      consumo: c,
      diferenciaCantidad: redondear2(c.cantidadReal - c.cantidadPrevista),
      diferenciaEuros: redondear2((c.cantidadReal - c.cantidadPrevista) * c.costeUnitario),
    }))
    .filter((d) => Math.abs(d.diferenciaEuros) >= 0.01)
    .sort((a, b) => Math.abs(b.diferenciaEuros) - Math.abs(a.diferenciaEuros));
}

// Resumen de la obra con el consumo real si se ha cerrado, y con el previsto si todavía no
export function resumenObra(p: Project) {
  const lista = consumoActualizado(p);
  const previsto = costePrevistoMateriales(lista);
  const real = costeRealMateriales(lista);
  const cerrado = !!p.consumoCerrado;
  const venta = p.presupuestoAceptado || 0;
  // Los gastos imputados a la obra (facturas de proveedor) siguen contando aparte
  const otrosGastos = p.totalGastos || 0;
  const costeUsado = cerrado ? real : previsto;
  return {
    lista,
    previsto,
    real,
    cerrado,
    desviacionEuros: redondear2(real - previsto),
    desviacionPorcentaje: previsto > 0 ? redondear2(((real - previsto) / previsto) * 100) : 0,
    venta,
    otrosGastos,
    beneficio: redondear2(venta - costeUsado),
    margen: venta > 0 ? redondear2(((venta - costeUsado) / venta) * 100) : 0,
  };
}
