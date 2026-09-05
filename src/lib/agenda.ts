// Huecos libres de la agenda para proponer al cliente
import { CalendarInstallation, CompanySettings, HuecoPropuesto } from '../types';
import { addDays, hoyISO, parseISO } from '../utils/dates';

const FRANJAS_DEFECTO = { manana: { inicio: '08:30', fin: '14:00' }, tarde: { inicio: '15:30', fin: '19:30' } };

function solapa(aIni: string, aFin: string, bIni: string, bFin: string): boolean {
  return aIni < bFin && bIni < aFin;
}

export function franjasDe(s?: CompanySettings) {
  return s?.franjas || FRANJAS_DEFECTO;
}

// Técnicos que cubren una franja. Sin técnicos definidos, se considera que hay uno (el propio usuario).
export function tecnicosDisponibles(franja: 'manana' | 'tarde', settings?: CompanySettings): string[] {
  const nombres = settings?.tecnicos || [];
  if (nombres.length === 0) return ['*'];
  const disp = settings?.disponibilidadTecnicos || {};
  return nombres.filter((n) => (disp[n] ? disp[n][franja] : true));
}

export function franjaActiva(franja: 'manana' | 'tarde', settings?: CompanySettings): boolean {
  const act = settings?.franjasActivas || { manana: true, tarde: true };
  return act[franja] !== false && tecnicosDisponibles(franja, settings).length > 0;
}

// Devuelve los huecos (mañana/tarde) libres de lunes a viernes desde `desde`, durante `dias` días.
// Solo se ofrecen las franjas activas que algún técnico cubra. Un hueco está ocupado cuando todos los
// técnicos que cubren esa franja ya tienen cita que solape (una cita sin técnico asignado ocupa a uno).
export function huecosLibres(eventos: CalendarInstallation[], settings?: CompanySettings, desde = addDays(hoyISO(), 1), dias = 14): HuecoPropuesto[] {
  const fr = franjasDe(settings);
  const out: HuecoPropuesto[] = [];
  const activos = eventos.filter((e) => e.estado !== 'Cancelada' && e.estado !== 'Completada');
  let fecha = desde;
  for (let i = 0; i < dias; i++) {
    const d = parseISO(fecha);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      (['manana', 'tarde'] as const).forEach((franja) => {
        if (!franjaActiva(franja, settings)) return;
        const ini = `${fecha}T${fr[franja].inicio}:00`;
        const fin = `${fecha}T${fr[franja].fin}:00`;
        const cubren = tecnicosDisponibles(franja, settings);
        const solapan = activos.filter((e) => solapa(ini, fin, e.fechaHoraInicio, e.fechaHoraFin));
        let libre: boolean;
        if (cubren[0] === '*') libre = solapan.length === 0;
        else {
          const ocupados = new Set<string>();
          let sinAsignar = 0;
          solapan.forEach((e) => { const t = (e.tecnicos || []).filter((x) => cubren.includes(x)); if (t.length) t.forEach((x) => ocupados.add(x)); else sinAsignar++; });
          libre = ocupados.size + sinAsignar < cubren.length;
        }
        if (libre) out.push({ fecha, franja, horaInicio: fr[franja].inicio, horaFin: fr[franja].fin });
      });
    }
    fecha = addDays(fecha, 1);
  }
  return out;
}

export function textoHueco(h: HuecoPropuesto): string {
  const [y, m, d] = h.fecha.split('-');
  return `${d}/${m}/${y} · ${h.franja === 'manana' ? 'mañana' : 'tarde'} (${h.horaInicio}–${h.horaFin})`;
}

export function huecoOcupado(h: HuecoPropuesto, eventos: CalendarInstallation[]): boolean {
  const ini = `${h.fecha}T${h.horaInicio}:00`;
  const fin = `${h.fecha}T${h.horaFin}:00`;
  return eventos.filter((e) => e.estado !== 'Cancelada' && e.estado !== 'Completada').some((e) => solapa(ini, fin, e.fechaHoraInicio, e.fechaHoraFin));
}
