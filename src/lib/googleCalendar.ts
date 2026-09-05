// Google Calendar: tres niveles, de menos a más integración.
// 1) Enlace "Añadir a Google Calendar" (funciona siempre, sin permisos).
// 2) Archivo .ics para cualquier agenda (Outlook, Apple, Android).
// 3) Inserción real en el calendario de la cuenta vinculada mediante la API REST de Google
//    Calendar, con el token OAuth que devuelve Firebase Auth al pedir el permiso
//    "calendar.events". Requiere que la API de Google Calendar esté habilitada en el proyecto
//    de Google Cloud del que sale la configuración de Firebase (ver docs/GUIA-INICIO.md).
import { SCOPE_CALENDAR, tieneToken, pedirPermisoGoogle, tokenPara, olvidarToken, mensajeErrorGoogle } from './googleToken';
import { CalendarInstallation } from '../types';

// El token OAuth se comparte con Gmail (ver googleToken.ts): una sola ventana de Google para ambos.
export const tieneTokenCalendar = () => tieneToken(SCOPE_CALENDAR);
export const pedirPermisoCalendar = () => pedirPermisoGoogle();
const tokenValido = () => tokenPara(SCOPE_CALENDAR);

function zonaHoraria(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
  } catch {
    return 'Europe/Madrid';
  }
}

function descripcionEvento(ev: CalendarInstallation, urlApp: string): string {
  return [
    `Obra: ${ev.obraNombre}`,
    `Cliente: ${ev.clienteNombre}${ev.clienteTelefono ? ` (${ev.clienteTelefono})` : ''}`,
    `Dirección: ${ev.direccion}`,
    ev.tecnicos.length ? `Técnicos: ${ev.tecnicos.join(', ')}` : '',
    ev.presupuestoCodigo ? `Presupuesto: ${ev.presupuestoCodigo}` : '',
    ev.notasTecnicas ? `Notas: ${ev.notasTecnicas}` : '',
    ev.obraId ? `Abrir en la app: ${urlApp}?obra=${encodeURIComponent(ev.obraId)}` : '',
  ].filter(Boolean).join('\n');
}

// Nivel 3: inserta el evento en el calendario principal de la cuenta vinculada
export async function insertarEventoGoogle(ev: CalendarInstallation, urlApp: string, calendarId = 'primary'): Promise<{ id: string; htmlLink: string }> {
  const token = await tokenValido();
  const body = {
    summary: ev.titulo,
    location: ev.direccion,
    description: descripcionEvento(ev, urlApp),
    start: { dateTime: ev.fechaHoraInicio, timeZone: zonaHoraria() },
    end: { dateTime: ev.fechaHoraFin, timeZone: zonaHoraria() },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 24 * 60 }] },
  };
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${ev.googleCalendarEventId ? `/${encodeURIComponent(ev.googleCalendarEventId)}` : ''}`;
  const res = await fetch(url, {
    method: ev.googleCalendarEventId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    olvidarToken();
    throw new Error(mensajeErrorGoogle(401, 'Google Calendar API'));
  }
  if (res.status === 403) throw new Error(mensajeErrorGoogle(403, 'Google Calendar API'));
  if (!res.ok) throw new Error(`Google Calendar respondió ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { id: json.id, htmlLink: json.htmlLink };
}

export async function borrarEventoGoogle(eventId: string, calendarId = 'primary'): Promise<void> {
  const token = await tokenValido();
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`No se pudo borrar el evento (${res.status}).`);
}

// Nivel 1: enlace de plantilla (no requiere permisos)
export function enlaceGoogleCalendar(ev: CalendarInstallation, urlApp: string): string {
  const limpiar = (iso: string) => iso.replace(/[-:]/g, '').substring(0, 15);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.titulo,
    dates: `${limpiar(ev.fechaHoraInicio)}/${limpiar(ev.fechaHoraFin)}`,
    details: descripcionEvento(ev, urlApp),
    location: ev.direccion,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// Nivel 2: archivo iCalendar
export function generarICS(eventos: CalendarInstallation[], nombreEmpresa: string, urlApp: string): string {
  const limpiar = (iso: string) => iso.replace(/[-:]/g, '').substring(0, 15);
  const esc = (s: string) => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${esc(nombreEmpresa || 'Control de Obra')}//Agenda//ES`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const ev of eventos) {
    lineas.push('BEGIN:VEVENT');
    lineas.push(`UID:${ev.id}@control-de-obra`);
    lineas.push(`DTSTAMP:${limpiar(new Date().toISOString())}Z`);
    lineas.push(`DTSTART;TZID=${zonaHoraria()}:${limpiar(ev.fechaHoraInicio)}`);
    lineas.push(`DTEND;TZID=${zonaHoraria()}:${limpiar(ev.fechaHoraFin)}`);
    lineas.push(`SUMMARY:${esc(ev.titulo)}`);
    lineas.push(`LOCATION:${esc(ev.direccion)}`);
    lineas.push(`DESCRIPTION:${esc(descripcionEvento(ev, urlApp))}`);
    lineas.push(`STATUS:${ev.estado === 'Cancelada' ? 'CANCELLED' : ev.estado === 'Pendiente confirmación' ? 'TENTATIVE' : 'CONFIRMED'}`);
    lineas.push('END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n');
}

export function descargarArchivo(nombre: string, contenido: string, tipo = 'text/plain;charset=utf-8') {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
