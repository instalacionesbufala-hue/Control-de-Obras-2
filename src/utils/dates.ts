// Utilidades de fechas. Todo en hora local; las fechas se guardan como YYYY-MM-DD
// y las fechas con hora como YYYY-MM-DDTHH:mm:ss (sin zona) para que el usuario vea
// siempre la misma hora que escribió.

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const p2 = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function toISODateTime(d: Date): string {
  return `${toISODate(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

export function hoyISO(): string {
  return toISODate(new Date());
}

export function ahoraISO(): string {
  return toISODateTime(new Date());
}

export function anioActual(): number {
  return new Date().getFullYear();
}

// Mes actual en formato "01".."12"
export function mesActual(): string {
  return p2(new Date().getMonth() + 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function parseISO(iso: string): Date {
  // Acepta YYYY-MM-DD o YYYY-MM-DDTHH:mm[:ss]
  if (!iso) return new Date(NaN);
  const [datePart, timePart] = iso.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  if (timePart) {
    const [hh, mm, ss] = timePart.split(':').map((x) => Number(x) || 0);
    return new Date(y, m - 1, d, hh, mm, ss || 0);
  }
  return new Date(y, m - 1, d);
}

export function esFechaValida(iso?: string): boolean {
  if (!iso) return false;
  return !isNaN(parseISO(iso).getTime());
}

export function fechaES(iso?: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return iso;
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fechaHoraES(iso?: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return iso;
  return `${fechaES(iso)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function horaDe(iso?: string): string {
  if (!iso || !iso.includes('T')) return '';
  return iso.split('T')[1].substring(0, 5);
}

export function fechaLarga(iso?: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return iso;
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return `${dias[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}

// Etiqueta relativa: Hoy, Mañana, o día de la semana
export function etiquetaRelativa(iso?: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return iso;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - hoy.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  if (diff > 1 && diff < 7) return dias[d.getDay()];
  return `${p2(d.getDate())} ${MESES_CORTO[d.getMonth()]}`;
}

export type PeriodoFiltro = { mes: string; anio: string }; // 'todos' permitido en ambos

export function periodoActual(): PeriodoFiltro {
  return { mes: mesActual(), anio: String(anioActual()) };
}

export function coincidePeriodo(iso: string | undefined, periodo: PeriodoFiltro): boolean {
  if (!iso) return periodo.mes === 'todos' && periodo.anio === 'todos';
  const [y, m] = iso.split('-');
  if (periodo.anio !== 'todos' && y !== periodo.anio) return false;
  if (periodo.mes !== 'todos' && m !== periodo.mes) return false;
  return true;
}

// Años disponibles a partir de un conjunto de fechas (siempre incluye el actual)
export function aniosDisponibles(fechas: Array<string | undefined>): string[] {
  const set = new Set<string>([String(anioActual())]);
  fechas.forEach((f) => {
    if (f && /^\d{4}-/.test(f)) set.add(f.substring(0, 4));
  });
  return Array.from(set).sort((a, b) => Number(b) - Number(a));
}

export function trimestreDe(iso?: string): 1 | 2 | 3 | 4 {
  if (!iso) return 4;
  const m = Number(iso.substring(5, 7));
  if (m <= 3) return 1;
  if (m <= 6) return 2;
  if (m <= 9) return 3;
  return 4;
}

export function etiquetaPeriodo(periodo: PeriodoFiltro): string {
  if (periodo.mes === 'todos' && periodo.anio === 'todos') return 'Todo el histórico';
  if (periodo.mes === 'todos') return `Año ${periodo.anio}`;
  const nombreMes = MESES[Number(periodo.mes) - 1] || periodo.mes;
  return periodo.anio === 'todos' ? `${nombreMes} (todos los años)` : `${nombreMes} ${periodo.anio}`;
}

// Días de un mes para la rejilla del calendario (empezando en lunes). Devuelve 42 celdas.
export function celdasMes(anio: number, mes0: number): Array<{ iso: string; enMes: boolean; dia: number }> {
  const primero = new Date(anio, mes0, 1);
  let offset = primero.getDay() - 1; // lunes = 0
  if (offset < 0) offset = 6;
  const celdas: Array<{ iso: string; enMes: boolean; dia: number }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(anio, mes0, 1 - offset + i);
    celdas.push({ iso: toISODate(d), enMes: d.getMonth() === mes0, dia: d.getDate() });
  }
  return celdas;
}

export function diasSemana(iso: string): string[] {
  const d = parseISO(iso);
  let offset = d.getDay() - 1;
  if (offset < 0) offset = 6;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - offset);
  return Array.from({ length: 7 }).map((_, i) => {
    const x = new Date(lunes);
    x.setDate(lunes.getDate() + i);
    return toISODate(x);
  });
}
