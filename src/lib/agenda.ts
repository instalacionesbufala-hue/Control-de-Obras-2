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

// Devuelve los huecos (mañana/tarde) libres de lunes a viernes desde `desde`, durante `dias` días.
// Un hueco está ocupado si ya hay una cita programada o pendiente que solape con la franja.
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
        const ini = `${fecha}T${fr[franja].inicio}:00`;
        const fin = `${fecha}T${fr[franja].fin}:00`;
        const ocupado = activos.some((e) => solapa(ini, fin, e.fechaHoraInicio, e.fechaHoraFin));
        if (!ocupado) out.push({ fecha, franja, horaInicio: fr[franja].inicio, horaFin: fr[franja].fin });
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
