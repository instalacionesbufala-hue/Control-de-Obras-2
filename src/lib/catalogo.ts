// Separación entre materiales y kits.
//
// Un MATERIAL es algo que compras: nombre, referencia, unidad, precio de compra y proveedor.
// Un KIT es una partida vendible: agrupa materiales del catálogo más mano de obra y otros
// trabajos; de ahí salen el coste, el precio de venta y el margen.
//
// Antes las dos cosas vivían mezcladas en CatalogItem: cada "concepto" llevaba dentro su
// escandallo, que es justo lo que hace un kit. Aquí está la conversión y las utilidades
// para mantener los precios al día sin que nada cambie solo.
import { CatalogItem, CatalogCategory, Kit, KitItem, MaterialCostComponent } from '../types';

export const redondear = (n: number) => Math.round(n * 100) / 100;

// Coste de compra de un material, admitiendo los datos antiguos
export const costeDe = (m: CatalogItem): number => (m.precioCompra !== undefined ? m.precioCompra : m.costeInternoTotal || 0);

// Margen sobre el coste, en porcentaje
export const margenDe = (coste: number, venta: number): number => (coste > 0 ? redondear(((venta - coste) / coste) * 100) : 0);

// Precio de venta a partir del coste y el margen deseado
export const ventaConMargen = (coste: number, margen: number): number => redondear(coste * (1 + margen / 100));

export const esMaterial = (i: CatalogItem) => !(i.materiales && i.materiales.length > 0);

const clave = (nombre: string, unidad: string) => `${nombre.trim().toLowerCase()}|${(unidad || 'ud').trim().toLowerCase()}`;

export interface ResultadoSeparacion {
  materiales: CatalogItem[];
  kits: Kit[];
  categorias: CatalogCategory[];
  resumen: { materialesNuevos: number; kitsNuevos: number; materialesQueYaEran: number };
}

// Convierte el catálogo mezclado en materiales sueltos + kits.
// Cada concepto con escandallo pasa a ser un kit, y los materiales de su escandallo se sacan
// al catálogo sin repetirlos. Los conceptos sin escandallo ya eran materiales y se quedan.
export function separarCatalogo(items: CatalogItem[], kitsExistentes: Kit[], categorias: CatalogCategory[]): ResultadoSeparacion {
  const materialesPorClave = new Map<string, CatalogItem>();
  const kitsNuevos: Kit[] = [];
  let materialesQueYaEran = 0;

  const catMateriales = categorias.find((c) => /material/i.test(c.nombre));
  const idCatMateriales = catMateriales?.id || categorias[0]?.id || 'cat-materiales';
  const nombreCatMateriales = catMateriales?.nombre || 'Materiales';

  // Los que ya eran materiales sueltos se conservan tal cual
  items.filter(esMaterial).forEach((i) => {
    materialesQueYaEran++;
    materialesPorClave.set(clave(i.concepto, i.unidad), { ...i, precioCompra: costeDe(i) });
  });

  // Los que llevan escandallo se convierten en kit y sueltan sus materiales
  items.filter((i) => !esMaterial(i)).forEach((item) => {
    const partidas: KitItem[] = (item.materiales || []).map((m: MaterialCostComponent) => {
      const k = clave(m.nombre, m.unidad);
      let material = materialesPorClave.get(k);
      if (!material) {
        material = {
          id: `mat-${k.replace(/[^a-z0-9]+/g, '-').substring(0, 40)}-${materialesPorClave.size}`,
          concepto: m.nombre.trim(),
          unidad: m.unidad || 'ud',
          precioCompra: redondear(m.costeUnitario || 0),
          // Precio de venta orientativo del material suelto: coste con un 40 % de margen
          precioUnitario: ventaConMargen(m.costeUnitario || 0, 40),
          ivaPorcentaje: item.ivaPorcentaje || 21,
          categoriaId: idCatMateriales,
          categoriaNombre: nombreCatMateriales,
          proveedorHabitual: m.proveedor,
        };
        materialesPorClave.set(k, material);
      } else if (!material.proveedorHabitual && m.proveedor) {
        material.proveedorHabitual = m.proveedor;
      }
      return {
        id: `ki-${material.id}-${Math.random().toString(36).substring(2, 7)}`,
        itemId: material.id,
        concepto: material.concepto,
        cantidad: m.cantidad,
        unidad: material.unidad,
        precioCoste: costeDe(material),
        precioVenta: material.precioUnitario,
        ivaPorcentaje: item.ivaPorcentaje || 21,
        proveedor: m.proveedor,
        visibleCliente: m.visibleCliente,
      };
    });
    const coste = redondear(partidas.reduce((a, p) => a + p.cantidad * p.precioCoste, 0));
    kitsNuevos.push({
      id: `kit-${item.id}`,
      nombre: item.concepto,
      codigo: item.referenciaSku,
      descripcion: item.descripcionDetallada || '',
      categoria: item.categoriaNombre,
      partidas,
      precioCosteTotal: coste,
      precioVentaTotal: item.precioUnitario,
      margenPorcentaje: margenDe(coste, item.precioUnitario),
      fechaCreacion: new Date().toISOString().split('T')[0],
      activo: true,
      esDemo: (item as any).esDemo,
    });
  });

  const materiales = Array.from(materialesPorClave.values());

  // Los kits que ya existían apuntaban a los conceptos antiguos, que ahora son kits y no materiales.
  // Se reenlazan por nombre y unidad; lo que no case queda como línea libre (mano de obra u otros).
  const porClave = new Map(materiales.map((m) => [clave(m.concepto, m.unidad), m]));
  const reenlazar = (k: Kit): Kit => ({
    ...k,
    partidas: (k.partidas || []).map((p) => {
      const m = porClave.get(clave(p.concepto, p.unidad));
      const manoDeObra = /mano de obra|instalaci[óo]n|montaje|mem[óo]ria|tramitaci[óo]n|puesta en marcha|desplazamiento|certificad/i.test(p.concepto);
      return { ...p, itemId: m ? m.id : undefined, tipo: m ? ('material' as const) : manoDeObra ? ('mano-de-obra' as const) : ('otro' as const) };
    }),
  });
  const kitsReenlazados = [...kitsExistentes.map(reenlazar), ...kitsNuevos.map(reenlazar)];
  const cats = categorias.some((c) => c.id === idCatMateriales)
    ? categorias
    : [...categorias, { id: idCatMateriales, nombre: nombreCatMateriales, descripcion: 'Materiales sueltos del almacén', color: 'slate' } as CatalogCategory];

  return {
    materiales,
    kits: kitsReenlazados,
    categorias: cats,
    resumen: { materialesNuevos: materiales.length - materialesQueYaEran, kitsNuevos: kitsNuevos.length, materialesQueYaEran },
  };
}

// Kits que usan un material concreto
export function kitsQueUsan(materialId: string, kits: Kit[]): Kit[] {
  return kits.filter((k) => (k.partidas || []).some((p) => p.itemId === materialId));
}

// Aplica el nuevo coste de un material a los kits indicados y recalcula sus totales.
// El precio de venta del kit NO se toca: solo cambia el coste, y con él el margen, para que
// se vea si la subida se ha comido el beneficio y decidas tú si subes el precio.
export function actualizarCosteEnKits(materialId: string, nuevoCoste: number, kits: Kit[], idsKits: string[]): Kit[] {
  const objetivo = new Set(idsKits);
  return kits.map((k) => {
    if (!objetivo.has(k.id)) return k;
    const partidas = (k.partidas || []).map((p) => (p.itemId === materialId ? { ...p, precioCoste: nuevoCoste } : p));
    const coste = redondear(partidas.reduce((a, p) => a + p.cantidad * p.precioCoste, 0));
    return { ...k, partidas, precioCosteTotal: coste, margenPorcentaje: margenDe(coste, k.precioVentaTotal) };
  });
}

// Catálogo de ejemplo ya separado en materiales y kits. Los datos de demostración se escribieron
// con el modelo antiguo (conceptos con escandallo), así que se convierten al cargarlos.
let cacheDemo: ResultadoSeparacion | null = null;
export function catalogoDemoSeparado(items: CatalogItem[], kits: Kit[], categorias: CatalogCategory[]): ResultadoSeparacion {
  if (!cacheDemo) cacheDemo = separarCatalogo(items, kits, categorias);
  return cacheDemo;
}

// ---- Poner al día los precios de compra con una factura de proveedor ----
// La IA devuelve las líneas del documento; aquí se emparejan con los materiales del catálogo
// por parecido de nombre. Nunca se actualiza nada solo: se propone y el usuario confirma.

export interface CoincidenciaPrecio {
  material: CatalogItem;
  descripcionFactura: string;
  precioAnterior: number;
  precioNuevo: number;
  variacion: number; // % de cambio
  confianza: 'alta' | 'media';
}

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'y', 'a', 'en', 'sin', 'mm', 'ud', 'uds']);

function fichas(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 2 && !PALABRAS_VACIAS.has(p));
}

// Parecido entre dos textos: proporción de palabras compartidas sobre el más corto
export function parecido(a: string, b: string): number {
  const fa = fichas(a);
  const fb = fichas(b);
  if (!fa.length || !fb.length) return 0;
  const setB = new Set(fb);
  const comunes = fa.filter((p) => setB.has(p) || fb.some((q) => q.startsWith(p) || p.startsWith(q))).length;
  return comunes / Math.min(fa.length, fb.length);
}

// Empareja las líneas de una factura con los materiales del catálogo y devuelve solo aquellas
// en las que el precio de compra ha cambiado de verdad.
export function proponerPreciosDesdeFactura(lineas: Array<{ descripcion: string; precioUnitario?: number; unidad?: string }>, materiales: CatalogItem[]): CoincidenciaPrecio[] {
  const out: CoincidenciaPrecio[] = [];
  const yaUsados = new Set<string>();
  for (const l of lineas) {
    if (!l.precioUnitario || l.precioUnitario <= 0) continue;
    let mejor: { m: CatalogItem; p: number } | null = null;
    for (const m of materiales) {
      if (yaUsados.has(m.id)) continue;
      const p = parecido(l.descripcion, m.concepto);
      if (!mejor || p > mejor.p) mejor = { m, p };
    }
    if (!mejor || mejor.p < 0.5) continue;
    const anterior = costeDe(mejor.m);
    const nuevo = redondear(l.precioUnitario);
    if (Math.abs(anterior - nuevo) < 0.005) continue; // mismo precio: no hay nada que proponer
    yaUsados.add(mejor.m.id);
    out.push({
      material: mejor.m,
      descripcionFactura: l.descripcion,
      precioAnterior: anterior,
      precioNuevo: nuevo,
      variacion: anterior > 0 ? redondear(((nuevo - anterior) / anterior) * 100) : 100,
      confianza: mejor.p >= 0.75 ? 'alta' : 'media',
    });
  }
  return out.sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));
}
