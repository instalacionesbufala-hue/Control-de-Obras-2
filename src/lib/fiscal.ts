// Calendario fiscal de la AEAT y modelos según el tipo de entidad.
// Todas las cifras que salen de aquí son ESTIMACIONES INTERNAS para saber cuánto apartar;
// nunca sustituyen a la gestoría ni se envían a nadie.
import { CompanySettings } from '../types';
import { toISODate } from '../utils/dates';

export interface ModeloFiscal {
  codigo: string;
  nombre: string;
  periodicidad: 'Trimestral' | 'Anual' | 'Pagos a cuenta';
  descripcion: string;
  aplica: boolean; // según la configuración de la empresa
  condicion?: string; // por qué aplica o no
}

export function modelosAplicables(s: CompanySettings): ModeloFiscal[] {
  const autonomo = s.tipoEntidad === 'autonomo';
  const empleados = !!s.tieneEmpleados;
  const alquiler = !!s.pagaAlquiler;
  const intracom = !!s.operacionesIntracomunitarias;
  const base: ModeloFiscal[] = [
    { codigo: '303', nombre: 'IVA · autoliquidación', periodicidad: 'Trimestral', descripcion: 'IVA repercutido menos IVA soportado deducible', aplica: true },
    { codigo: '390', nombre: 'IVA · resumen anual', periodicidad: 'Anual', descripcion: 'Resumen informativo del IVA del año (enero)', aplica: true },
    { codigo: '111', nombre: 'Retenciones IRPF (trabajo y profesionales)', periodicidad: 'Trimestral', descripcion: 'Retenciones practicadas en nóminas y facturas de profesionales', aplica: empleados, condicion: empleados ? 'Tienes empleados o pagas a profesionales con retención' : 'Actívalo en Configuración si tienes empleados o retienes a profesionales' },
    { codigo: '190', nombre: 'Resumen anual de retenciones (111)', periodicidad: 'Anual', descripcion: 'Resumen anual del modelo 111 (enero)', aplica: empleados },
    { codigo: '115', nombre: 'Retenciones por alquiler de local', periodicidad: 'Trimestral', descripcion: 'Retención del 19 % al arrendador del local u oficina', aplica: alquiler, condicion: alquiler ? 'Pagas alquiler de local con retención' : 'Actívalo en Configuración si alquilas un local' },
    { codigo: '180', nombre: 'Resumen anual de retenciones por alquiler (115)', periodicidad: 'Anual', descripcion: 'Resumen anual del modelo 115 (enero)', aplica: alquiler },
    { codigo: '349', nombre: 'Operaciones intracomunitarias', periodicidad: 'Trimestral', descripcion: 'Compras o ventas a empresas de otros países de la UE', aplica: intracom, condicion: intracom ? 'Compras material en otros países de la UE' : 'Solo si compras o vendes a empresas de la UE' },
    { codigo: '347', nombre: 'Operaciones con terceros > 3.005,06 €', periodicidad: 'Anual', descripcion: 'Declaración informativa anual (febrero). Si estás en VERI*FACTU con envío, la AEAT ya tiene tus facturas emitidas', aplica: true },
  ];
  if (autonomo) {
    base.splice(2, 0,
      { codigo: '130', nombre: 'Pago fraccionado IRPF (estimación directa)', periodicidad: 'Trimestral', descripcion: '20 % del rendimiento neto acumulado del año, menos pagos anteriores y retenciones soportadas', aplica: !s.aplicaRetencionIrpf || true, condicion: 'Obligatorio salvo que más del 70 % de tus ingresos lleven retención' },
      { codigo: '100', nombre: 'Declaración de la Renta (IRPF)', periodicidad: 'Anual', descripcion: 'Campaña de abril a junio; incluye la actividad económica', aplica: true },
    );
  } else {
    base.splice(2, 0,
      { codigo: '202', nombre: 'Pagos fraccionados del Impuesto sobre Sociedades', periodicidad: 'Pagos a cuenta', descripcion: 'Abril, octubre y diciembre. El primer año no se presenta (no hay cuota previa)', aplica: true },
      { codigo: '200', nombre: 'Impuesto sobre Sociedades', periodicidad: 'Anual', descripcion: 'Hasta el 25 de julio del año siguiente (ejercicio natural)', aplica: true },
    );
  }
  return base;
}

export interface PlazoFiscal {
  fechaLimite: string; // YYYY-MM-DD
  fechaDomiciliacion: string; // 5 días antes, aprox.
  titulo: string;
  modelos: string[];
  periodo: string;
}

// Próximos plazos ordenados, a partir de hoy, para el tipo de entidad
export function proximosPlazos(s: CompanySettings, desde = new Date(), limite = 6): PlazoFiscal[] {
  const autonomo = s.tipoEntidad === 'autonomo';
  const modelos = modelosAplicables(s).filter((m) => m.aplica);
  const trimestrales = modelos.filter((m) => m.periodicidad === 'Trimestral').map((m) => m.codigo);
  const anualesEnero = modelos.filter((m) => ['390', '190', '180'].includes(m.codigo)).map((m) => m.codigo);
  const out: PlazoFiscal[] = [];
  const y0 = desde.getFullYear();
  for (const y of [y0 - 1, y0, y0 + 1]) {
    // 1T: 1-20 abril; 2T: 1-20 julio; 3T: 1-20 octubre; 4T: 1-30 enero (año siguiente)
    out.push({ fechaLimite: `${y}-04-20`, fechaDomiciliacion: `${y}-04-15`, titulo: `1er trimestre ${y}`, modelos: trimestrales, periodo: `1T ${y}` });
    out.push({ fechaLimite: `${y}-07-20`, fechaDomiciliacion: `${y}-07-15`, titulo: `2º trimestre ${y}`, modelos: trimestrales, periodo: `2T ${y}` });
    out.push({ fechaLimite: `${y}-10-20`, fechaDomiciliacion: `${y}-10-15`, titulo: `3er trimestre ${y}`, modelos: trimestrales, periodo: `3T ${y}` });
    out.push({ fechaLimite: `${y + 1}-01-30`, fechaDomiciliacion: `${y + 1}-01-25`, titulo: `4º trimestre ${y} y resúmenes anuales`, modelos: [...trimestrales, ...anualesEnero], periodo: `4T ${y}` });
    if (modelos.some((m) => m.codigo === '347')) out.push({ fechaLimite: `${y + 1}-02-28`, fechaDomiciliacion: `${y + 1}-02-28`, titulo: `Operaciones con terceros ${y}`, modelos: ['347'], periodo: `Anual ${y}` });
    if (autonomo) {
      out.push({ fechaLimite: `${y + 1}-06-30`, fechaDomiciliacion: `${y + 1}-06-25`, titulo: `Renta ${y} (IRPF)`, modelos: ['100'], periodo: `Renta ${y}` });
    } else {
      out.push({ fechaLimite: `${y + 1}-07-25`, fechaDomiciliacion: `${y + 1}-07-20`, titulo: `Impuesto sobre Sociedades ${y}`, modelos: ['200'], periodo: `Ejercicio ${y}` });
      out.push({ fechaLimite: `${y}-04-20`, fechaDomiciliacion: `${y}-04-15`, titulo: `1er pago a cuenta Sociedades ${y}`, modelos: ['202'], periodo: `1P ${y}` });
      out.push({ fechaLimite: `${y}-10-20`, fechaDomiciliacion: `${y}-10-15`, titulo: `2º pago a cuenta Sociedades ${y}`, modelos: ['202'], periodo: `2P ${y}` });
      out.push({ fechaLimite: `${y}-12-20`, fechaDomiciliacion: `${y}-12-15`, titulo: `3er pago a cuenta Sociedades ${y}`, modelos: ['202'], periodo: `3P ${y}` });
    }
  }
  const hoy = toISODate(desde);
  // Agrupa plazos con la misma fecha límite
  const porFecha = new Map<string, PlazoFiscal>();
  for (const p of out.filter((p) => p.fechaLimite >= hoy).sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite))) {
    const ex = porFecha.get(p.fechaLimite);
    if (ex) {
      ex.modelos = Array.from(new Set([...ex.modelos, ...p.modelos]));
      if (!ex.titulo.includes(p.titulo)) ex.titulo = `${ex.titulo} · ${p.titulo}`;
    } else porFecha.set(p.fechaLimite, { ...p, modelos: [...p.modelos] });
  }
  return Array.from(porFecha.values()).slice(0, limite);
}

// Tipos del Impuesto sobre Sociedades para microempresas (cifra de negocio < 1 M€), Ley 7/2024.
// Primer tramo: 50.000 € de base; resto al tipo general reducido.
export function tiposSociedadesMicro(anio: number): { tramo1: number; resto: number; nota: string } {
  if (anio <= 2024) return { tramo1: 23, resto: 23, nota: 'Tipo reducido pyme 23 % (hasta 2024)' };
  if (anio === 2025) return { tramo1: 21, resto: 22, nota: 'Microempresa 2025: 21 % hasta 50.000 € y 22 % el resto' };
  if (anio === 2026) return { tramo1: 19, resto: 21, nota: 'Microempresa 2026: 19 % hasta 50.000 € y 21 % el resto' };
  return { tramo1: 17, resto: 20, nota: `Microempresa ${anio}: 17 % hasta 50.000 € y 20 % el resto` };
}

export function cuotaSociedadesEstimada(baseImponible: number, anio: number): number {
  if (baseImponible <= 0) return 0;
  const t = tiposSociedadesMicro(anio);
  const tramo1 = Math.min(baseImponible, 50000);
  const resto = Math.max(0, baseImponible - 50000);
  return tramo1 * (t.tramo1 / 100) + resto * (t.resto / 100);
}
