import React, { useMemo, useState } from 'react';
import { CalendarDays, Clock, MapPin, User, CheckCircle2, AlertCircle, Plus, Search, ChevronLeft, ChevronRight, ExternalLink, Phone, HardHat, Download, X, Edit3, Trash2, Zap, Cloud, Info } from 'lucide-react';
import { CalendarInstallation, Project, Client, CompanySettings, HuecoPropuesto } from '../types';
import { formatCurrency, telefonoWhatsApp } from '../utils/formatters';
import { MESES, celdasMes, diasSemana, hoyISO, horaDe, fechaES, fechaLarga, etiquetaRelativa, toISODate, parseISO } from '../utils/dates';
import { enlaceGoogleCalendar, generarICS, insertarEventoGoogle, borrarEventoGoogle, descargarArchivo, tieneTokenCalendar } from '../lib/googleCalendar';
import { firebaseDisponible } from '../lib/firebase';

interface Props {
  calendarEvents: CalendarInstallation[];
  projects: Project[];
  clients: Client[];
  companySettings: CompanySettings;
  onAddCalendarEvent: (event: Omit<CalendarInstallation, 'id'>) => CalendarInstallation;
  onUpdateCalendarEvent: (id: string, campos: Partial<CalendarInstallation>) => void;
  onDeleteCalendarEvent: (id: string) => void;
  onConfirmarCita: (projectId: string, hueco: HuecoPropuesto, tecnicos: string[], notas?: string) => CalendarInstallation | null;
  onSelectProject?: (projectId: string | null) => void;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

const urlApp = () => (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');

type FormEv = { titulo: string; obraId: string; clienteNombre: string; clienteTelefono: string; direccion: string; fecha: string; horaInicio: string; horaFin: string; tipo: CalendarInstallation['tipo']; estado: CalendarInstallation['estado']; tecnicos: string[]; notas: string };

export const CalendarAgendaView: React.FC<Props> = ({ calendarEvents, projects, clients, companySettings, onAddCalendarEvent, onUpdateCalendarEvent, onDeleteCalendarEvent, onConfirmarCita, onSelectProject, onAviso }) => {
  const tecnicos = companySettings.tecnicos && companySettings.tecnicos.length ? companySettings.tecnicos : [companySettings.nombreUsuario || 'Yo'];
  const fr = companySettings.franjas;
  const [vista, setVista] = useState<'mes' | 'semana' | 'lista'>('mes');
  const [fechaRef, setFechaRef] = useState<string>(hoyISO());
  const [busqueda, setBusqueda] = useState('');
  const [tecnicoFiltro, setTecnicoFiltro] = useState('todos');
  const [detalle, setDetalle] = useState<CalendarInstallation | null>(null);
  const [editando, setEditando] = useState<CalendarInstallation | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormEv>(formVacio());
  const [sincronizando, setSincronizando] = useState<string | null>(null);


  function formVacio(fecha = hoyISO()): FormEv {
    return { titulo: '', obraId: '', clienteNombre: '', clienteTelefono: '', direccion: '', fecha, horaInicio: fr?.manana.inicio || '08:30', horaFin: fr?.manana.fin || '14:00', tipo: 'Instalación', estado: 'Programada', tecnicos: tecnicos.slice(0, 1), notas: '' };
  }

  const ref = parseISO(fechaRef);
  const filtrados = useMemo(() => calendarEvents.filter((e) => {
    if (tecnicoFiltro !== 'todos' && !e.tecnicos.includes(tecnicoFiltro)) return false;
    const q = busqueda.toLowerCase();
    return !q || e.titulo.toLowerCase().includes(q) || e.clienteNombre.toLowerCase().includes(q) || e.direccion.toLowerCase().includes(q);
  }), [calendarEvents, tecnicoFiltro, busqueda]);

  const porDia = (iso: string) => filtrados.filter((e) => e.fechaHoraInicio.startsWith(iso)).sort((a, b) => a.fechaHoraInicio.localeCompare(b.fechaHoraInicio));
  const pendientesConfirmar = calendarEvents.filter((e) => e.estado === 'Pendiente confirmación');
  const obrasSinCita = projects.filter((p) => p.estado === 'Aceptado' && !p.fechaCitaCalendario);

  const mover = (delta: number) => {
    const d = parseISO(fechaRef);
    if (vista === 'mes') d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setFechaRef(toISODate(d));
  };

  const abrirNuevo = (fecha?: string) => {
    setEditando(null);
    setForm(formVacio(fecha));
    setShowForm(true);
  };
  const abrirEditar = (ev: CalendarInstallation) => {
    setEditando(ev);
    setForm({ titulo: ev.titulo, obraId: ev.obraId || '', clienteNombre: ev.clienteNombre, clienteTelefono: ev.clienteTelefono || '', direccion: ev.direccion, fecha: ev.fechaHoraInicio.split('T')[0], horaInicio: horaDe(ev.fechaHoraInicio), horaFin: horaDe(ev.fechaHoraFin), tipo: ev.tipo, estado: ev.estado, tecnicos: ev.tecnicos, notas: ev.notasTecnicas || '' });
    setDetalle(null);
    setShowForm(true);
  };
  const vincularObra = (id: string) => {
    const p = projects.find((x) => x.id === id);
    setForm((f) => ({ ...f, obraId: id, titulo: p ? (f.tipo === 'Instalación' ? `Instalación: ${p.nombre}` : f.titulo || p.nombre) : f.titulo, clienteNombre: p?.clienteNombre || f.clienteNombre, clienteTelefono: p?.clienteTelefono || f.clienteTelefono, direccion: p?.direccion || f.direccion }));
  };
  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.fecha) return;
    const ini = `${form.fecha}T${form.horaInicio}:00`;
    const fin = `${form.fecha}T${form.horaFin}:00`;
    const p = projects.find((x) => x.id === form.obraId);
    if (editando) {
      onUpdateCalendarEvent(editando.id, { titulo: form.titulo, obraId: form.obraId || undefined, obraNombre: p?.nombre || form.titulo, clienteNombre: form.clienteNombre, clienteTelefono: form.clienteTelefono, direccion: form.direccion, fechaHoraInicio: ini, fechaHoraFin: fin, tipo: form.tipo, estado: form.estado, tecnicos: form.tecnicos, notasTecnicas: form.notas });
    } else if (p && form.tipo === 'Instalación') {
      onConfirmarCita(p.id, { fecha: form.fecha, franja: form.horaInicio < '14:00' ? 'manana' : 'tarde', horaInicio: form.horaInicio, horaFin: form.horaFin }, form.tecnicos, form.notas);
    } else {
      onAddCalendarEvent({ titulo: form.titulo, obraId: form.obraId || undefined, obraNombre: p?.nombre || form.titulo, clienteNombre: form.clienteNombre || '—', clienteTelefono: form.clienteTelefono, direccion: form.direccion, fechaHoraInicio: ini, fechaHoraFin: fin, tipo: form.tipo, estado: form.estado, tecnicos: form.tecnicos, notasTecnicas: form.notas, googleCalendarSynced: false, origenReserva: 'oficina' });
    }
    setShowForm(false);
  };

  const enviarAGoogle = async (ev: CalendarInstallation) => {
    if (!firebaseDisponible) return onAviso?.('La sincronización con Google no está disponible en esta instalación.', 'error');
    setSincronizando(ev.id);
    try {
      const r = await insertarEventoGoogle(ev, urlApp(), companySettings.googleCalendarId || 'primary');
      onUpdateCalendarEvent(ev.id, { googleCalendarSynced: true, googleCalendarEventId: r.id, googleCalendarLink: r.htmlLink });
      if (ev.obraId) {
        const p = projects.find((x) => x.id === ev.obraId);
        if (p) onAviso?.(`Cita de ${p.clienteNombre} ${ev.googleCalendarEventId ? 'actualizada' : 'creada'} en Google Calendar.`, 'ok');
      } else onAviso?.('Evento guardado en Google Calendar.', 'ok');
    } catch (e: any) {
      onAviso?.(e?.message || 'No se pudo guardar en Google Calendar.', 'error');
    } finally {
      setSincronizando(null);
    }
  };
  const borrarEvento = async (ev: CalendarInstallation) => {
    if (!confirm(`¿Eliminar "${ev.titulo}"?`)) return;
    if (ev.googleCalendarEventId) {
      try {
        await borrarEventoGoogle(ev.googleCalendarEventId, companySettings.googleCalendarId || 'primary');
      } catch {
        onAviso?.('El evento se ha borrado aquí pero no en Google Calendar (permiso caducado). Bórralo allí a mano.', 'info');
      }
    }
    onDeleteCalendarEvent(ev.id);
    setDetalle(null);
  };
  const whatsappConfirmacion = (ev: CalendarInstallation) => {
    const msg = `Hola ${ev.clienteNombre}, te confirmamos la cita de ${ev.tipo.toLowerCase()} el ${fechaLarga(ev.fechaHoraInicio.split('T')[0])} de ${horaDe(ev.fechaHoraInicio)} a ${horaDe(ev.fechaHoraFin)} en ${ev.direccion}.${ev.tecnicos.length ? ` Irá ${ev.tecnicos.join(' y ')}.` : ''}\n\nPor favor, ten despejada la zona de trabajo y el acceso al cuadro eléctrico. Si necesitas cambiar la fecha, respóndenos por aquí.\n\n${companySettings.nombreComercial || companySettings.razonSocial}`;
    window.open(`https://wa.me/${telefonoWhatsApp(ev.clienteTelefono)}?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const exportarICS = () => descargarArchivo(`Agenda_${hoyISO()}.ics`, generarICS(filtrados.filter((e) => e.estado !== 'Cancelada'), companySettings.nombreComercial || companySettings.razonSocial, urlApp()), 'text/calendar;charset=utf-8');

  const badge = (estado: CalendarInstallation['estado']) => estado === 'Pendiente confirmación' ? 'bg-amber-100 text-amber-900 border-amber-300' : estado === 'En curso' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : estado === 'Completada' ? 'bg-slate-900 text-white border-slate-900' : estado === 'Cancelada' ? 'bg-slate-100 text-slate-500 border-slate-200 line-through' : 'bg-blue-100/80 text-blue-950 border-blue-200';
  const celdas = celdasMes(ref.getFullYear(), ref.getMonth());
  const semana = diasSemana(fechaRef);
  const listaOrdenada = [...filtrados].filter((e) => e.fechaHoraInicio.split('T')[0] >= (vista === 'lista' ? hoyISO() : '0000')).sort((a, b) => a.fechaHoraInicio.localeCompare(b.fechaHoraInicio));

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><CalendarDays className="text-blue-600" size={28} /> Agenda</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2 flex-wrap">Citas de instalación, mediciones e inspecciones.{companySettings.googleCalendarConectado ? <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-xs"><Cloud size={12} className="text-emerald-500" /> Google: {companySettings.googleAccountEmail}{tieneTokenCalendar() ? ' · permiso de Calendar activo' : ''}</span> : <span className="text-xs text-slate-400">Vincula Google en Configuración para guardar las citas en tu calendario.</span>}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportarICS} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-2xl shadow-xs flex items-center gap-2 cursor-pointer" title="Archivo .ics para cualquier calendario"><Download size={15} /> Exportar .ics</button>
          <button onClick={() => abrirNuevo()} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"><Plus size={16} /> Nueva cita</button>
        </div>
      </div>

      {(pendientesConfirmar.length > 0 || obrasSinCita.length > 0) && (
        <div className="bg-gradient-to-r from-amber-500/10 to-transparent border-2 border-amber-400/40 rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center"><Clock size={20} /></div><div><h3 className="font-black text-slate-900 text-base">Pendiente de confirmar</h3><p className="text-xs text-slate-600">{obrasSinCita.length ? `${obrasSinCita.length} obra(s) aceptada(s) sin fecha` : ''}{obrasSinCita.length && pendientesConfirmar.length ? ' · ' : ''}{pendientesConfirmar.length ? `${pendientesConfirmar.length} cita(s) solicitadas por clientes` : ''}</p></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {obrasSinCita.map((p) => (
              <div key={p.id} className="bg-white p-4 rounded-2xl border border-amber-200 flex items-center justify-between gap-3 text-xs">
                <div><p className="font-black text-slate-900">{p.obraCodigo || p.codigo} · {p.clienteNombre}</p><p className="text-slate-500">{p.huecoElegido ? `El cliente eligió ${fechaES(p.huecoElegido.fecha)} (${p.huecoElegido.franja === 'manana' ? 'mañana' : 'tarde'})` : p.huecosPropuestos?.length ? 'Huecos propuestos, esperando al cliente' : 'Sin huecos propuestos todavía'}</p></div>
                <div className="flex gap-2 shrink-0">
                  {p.huecoElegido && <button onClick={() => { const ev = onConfirmarCita(p.id, p.huecoElegido!, p.tecnicosAsignados?.length ? p.tecnicosAsignados : tecnicos.slice(0, 1)); if (ev) whatsappConfirmacion(ev); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"><CheckCircle2 size={13} /> Confirmar y avisar</button>}
                  <button onClick={() => onSelectProject?.(p.id)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">Abrir obra</button>
                </div>
              </div>
            ))}
            {pendientesConfirmar.map((ev) => (
              <div key={ev.id} className="bg-white p-4 rounded-2xl border border-amber-200 flex items-center justify-between gap-3 text-xs">
                <div><p className="font-black text-slate-900">{ev.clienteNombre}</p><p className="text-slate-500">{fechaES(ev.fechaHoraInicio.split('T')[0])} {horaDe(ev.fechaHoraInicio)}–{horaDe(ev.fechaHoraFin)} · {ev.direccion}</p>{ev.solicitudClienteNotas && <p className="italic text-slate-500">"{ev.solicitudClienteNotas}"</p>}</div>
                <button onClick={() => { onUpdateCalendarEvent(ev.id, { estado: 'Programada' }); whatsappConfirmacion(ev); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 shrink-0 cursor-pointer"><CheckCircle2 size={13} /> Confirmar y avisar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => mover(-1)} className="p-1.5 hover:bg-white rounded-xl cursor-pointer"><ChevronLeft size={18} /></button>
            <span className="font-black text-slate-900 text-sm px-3 min-w-[170px] text-center">{vista === 'semana' ? `Semana del ${fechaES(semana[0])}` : `${MESES[ref.getMonth()]} ${ref.getFullYear()}`}</span>
            <button onClick={() => mover(1)} className="p-1.5 hover:bg-white rounded-xl cursor-pointer"><ChevronRight size={18} /></button>
          </div>
          <button onClick={() => setFechaRef(hoyISO())} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">Hoy</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={14} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-xs w-40" placeholder="Buscar…" /></div>
          {tecnicos.length > 1 && <select value={tecnicoFiltro} onChange={(e) => setTecnicoFiltro(e.target.value)} className="border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold bg-slate-50 cursor-pointer"><option value="todos">Todos los técnicos</option>{tecnicos.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
          <div className="flex bg-slate-100 p-1 rounded-2xl">{(['mes', 'semana', 'lista'] as const).map((v) => <button key={v} onClick={() => setVista(v)} className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer capitalize ${vista === v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>{v}</button>)}</div>
        </div>
      </div>

      {vista === 'mes' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 md:p-6 shadow-xs space-y-3">
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-black text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => <div key={d} className={i >= 5 ? 'text-blue-600' : ''}>{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1.5">
            {celdas.map((c) => {
              const evs = porDia(c.iso);
              const esHoy = c.iso === hoyISO();
              return (
                <div key={c.iso} onClick={() => abrirNuevo(c.iso)} className={`min-h-[96px] p-1.5 rounded-2xl border cursor-pointer flex flex-col ${esHoy ? 'bg-blue-50/60 border-blue-500' : c.enMes ? 'bg-slate-50/50 hover:bg-slate-100/70 border-slate-200/70' : 'bg-white text-slate-300 border-slate-100'}`}>
                  <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${esHoy ? 'bg-blue-600 text-white' : c.enMes ? 'text-slate-800' : 'text-slate-300'}`}>{c.dia}</span>
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {evs.slice(0, 3).map((ev) => <div key={ev.id} onClick={(e) => { e.stopPropagation(); setDetalle(ev); }} className={`p-1 rounded-lg text-[10px] font-bold border truncate ${badge(ev.estado)}`} title={`${ev.titulo} · ${ev.clienteNombre}`}>{horaDe(ev.fechaHoraInicio)} {ev.clienteNombre.split(' ')[0]}</div>)}
                    {evs.length > 3 && <p className="text-[9px] text-slate-400 font-bold">+{evs.length - 3} más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === 'semana' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 md:p-6 shadow-xs grid grid-cols-1 md:grid-cols-7 gap-2">
          {semana.map((iso) => {
            const evs = porDia(iso);
            const d = parseISO(iso);
            const esHoy = iso === hoyISO();
            return (
              <div key={iso} className={`rounded-2xl border p-2 min-h-[160px] ${esHoy ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2"><span className="text-[11px] font-black text-slate-700">{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]} {d.getDate()}</span><button onClick={() => abrirNuevo(iso)} className="text-slate-400 hover:text-blue-600 cursor-pointer"><Plus size={14} /></button></div>
                <div className="space-y-1.5">{evs.map((ev) => <div key={ev.id} onClick={() => setDetalle(ev)} className={`p-2 rounded-xl text-[11px] border cursor-pointer ${badge(ev.estado)}`}><p className="font-black">{horaDe(ev.fechaHoraInicio)}–{horaDe(ev.fechaHoraFin)}</p><p className="truncate">{ev.clienteNombre}</p><p className="truncate opacity-70">{ev.tipo}</p></div>)}{evs.length === 0 && <p className="text-[10px] text-slate-300 text-center pt-6">libre</p>}</div>
              </div>
            );
          })}
        </div>
      )}

      {vista === 'lista' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 md:p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100"><h3 className="font-black text-slate-900 text-base">Próximas citas</h3><span className="text-xs text-slate-400 font-bold">{listaOrdenada.length}</span></div>
          {listaOrdenada.length === 0 && <p className="text-xs text-slate-400 py-8 text-center">Nada programado a partir de hoy.</p>}
          {listaOrdenada.map((ev) => (
            <div key={ev.id} className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${badge(ev.estado)}`}>{ev.estado}</span><span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{ev.tipo}</span>{ev.googleCalendarSynced && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1"><Cloud size={11} className="text-emerald-500" /> Google</span>}</div>
                <h4 className="font-black text-slate-900 text-sm">{ev.titulo}</h4>
                <p className="text-xs text-slate-600 flex items-center gap-2 flex-wrap"><span className="flex items-center gap-1 font-bold"><User size={13} className="text-slate-400" /> {ev.clienteNombre}</span><span className="flex items-center gap-1"><MapPin size={13} className="text-slate-400" /> {ev.direccion}</span></p>
                <p className="text-xs text-slate-500 flex items-center gap-3"><span className="flex items-center gap-1 font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200"><Clock size={12} className="text-blue-600" /> {etiquetaRelativa(ev.fechaHoraInicio.split('T')[0])} · {fechaES(ev.fechaHoraInicio.split('T')[0])} {horaDe(ev.fechaHoraInicio)}–{horaDe(ev.fechaHoraFin)}</span><span className="flex items-center gap-1"><HardHat size={12} className="text-slate-400" /> {ev.tecnicos.join(', ') || 'sin técnico'}</span></p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setDetalle(ev)} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer">Ver</button>
                {ev.clienteTelefono && <button onClick={() => whatsappConfirmacion(ev)} className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl cursor-pointer" title="WhatsApp"><Phone size={15} /></button>}
                <button onClick={() => enviarAGoogle(ev)} disabled={sincronizando === ev.id} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer" title={ev.googleCalendarEventId ? 'Actualizar en Google Calendar' : 'Guardar en Google Calendar'}><Cloud size={15} className={sincronizando === ev.id ? 'animate-pulse' : ''} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETALLE */}
      {detalle && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex items-start justify-between gap-3">
              <div><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${badge(detalle.estado)}`}>{detalle.estado}</span><h3 className="font-black text-lg mt-1.5">{detalle.titulo}</h3><p className="text-xs text-slate-400">{fechaLarga(detalle.fechaHoraInicio.split('T')[0])} · {horaDe(detalle.fechaHoraInicio)}–{horaDe(detalle.fechaHoraFin)}</p></div>
              <button onClick={() => setDetalle(null)} className="p-2 text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <a href={`https://maps.google.com/?q=${encodeURIComponent(detalle.direccion)}`} target="_blank" rel="noreferrer" className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2"><MapPin size={15} /> Navegar</a>
                {detalle.clienteTelefono ? <a href={`tel:${detalle.clienteTelefono}`} className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2"><Phone size={15} /> Llamar</a> : <div className="p-3 bg-slate-100 text-slate-400 rounded-2xl font-bold flex items-center justify-center gap-2">Sin teléfono</div>}
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <p className="font-bold text-slate-900 flex items-center gap-1.5"><User size={14} className="text-slate-400" /> {detalle.clienteNombre}{detalle.clienteTelefono ? ` · ${detalle.clienteTelefono}` : ''}</p>
                <p className="text-slate-600 flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {detalle.direccion}</p>
                <p className="text-slate-600 flex items-center gap-1.5"><HardHat size={14} className="text-slate-400" /> {detalle.tecnicos.join(', ') || 'Sin técnico asignado'}</p>
                {detalle.presupuestoCodigo && <p className="text-slate-600 flex items-center gap-1.5"><Zap size={14} className="text-slate-400" /> Presupuesto {detalle.presupuestoCodigo}{detalle.presupuestoTotal ? ` · ${formatCurrency(detalle.presupuestoTotal)}` : ''}</p>}
                {detalle.notasTecnicas && <p className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-700 mt-1">{detalle.notasTecnicas}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {detalle.estado === 'Pendiente confirmación' && <button onClick={() => { onUpdateCalendarEvent(detalle.id, { estado: 'Programada' }); setDetalle({ ...detalle, estado: 'Programada' }); }} className="px-3 py-2 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"><CheckCircle2 size={13} /> Confirmar</button>}
                {detalle.estado === 'Programada' && <button onClick={() => { onUpdateCalendarEvent(detalle.id, { estado: 'Completada' }); setDetalle({ ...detalle, estado: 'Completada' }); }} className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"><CheckCircle2 size={13} /> Marcar realizada</button>}
                {detalle.clienteTelefono && <button onClick={() => whatsappConfirmacion(detalle)} className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Phone size={13} /> WhatsApp al cliente</button>}
                <button onClick={() => enviarAGoogle(detalle)} disabled={sincronizando === detalle.id} className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Cloud size={13} /> {detalle.googleCalendarEventId ? 'Actualizar en Google' : 'Guardar en Google Calendar'}</button>
                <a href={detalle.googleCalendarLink || enlaceGoogleCalendar(detalle, urlApp())} target="_blank" rel="noreferrer" className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-1"><ExternalLink size={13} /> Abrir en Google</a>
                {detalle.obraId && <button onClick={() => { setDetalle(null); onSelectProject?.(detalle.obraId!); }} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer">Abrir obra</button>}
                <button onClick={() => abrirEditar(detalle)} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Edit3 size={13} /> Editar</button>
                <button onClick={() => borrarEvento(detalle)} className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Trash2 size={13} /> Eliminar</button>
              </div>
              {!companySettings.googleCalendarConectado && <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><Info size={12} /> "Guardar en Google Calendar" pedirá permiso a tu cuenta de Google la primera vez (dura una hora). "Abrir en Google" funciona sin permisos.</p>}
            </div>
          </div>
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100"><div><h3 className="text-xl font-black text-slate-900">{editando ? 'Editar cita' : 'Nueva cita'}</h3><p className="text-xs text-slate-500 mt-0.5">{!editando && form.obraId && form.tipo === 'Instalación' ? 'Al guardar, la obra pasa a "En ejecución" con esta fecha.' : 'Se guarda en la agenda; después puedes enviarla a Google Calendar.'}</p></div><button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"><X size={20} /></button></div>
            <form onSubmit={guardar} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="font-bold text-slate-700 block mb-1">Obra / presupuesto</label><select value={form.obraId} onChange={(e) => vincularObra(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"><option value="">Sin vincular</option>{projects.filter((p) => !['Rechazado', 'Facturada'].includes(p.estado)).map((p) => <option key={p.id} value={p.id}>{p.obraCodigo || p.codigo} · {p.nombre} ({p.clienteNombre})</option>)}</select></div>
                <div><label className="font-bold text-slate-700 block mb-1">Tipo</label><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as any })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">{['Instalación', 'Medición', 'Inspección CIE / OCA', 'Reunión', 'Entrega de Llaves', 'Otro'].map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="font-bold text-slate-700 block mb-1">Título *</label><input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej.: Instalación punto de recarga garaje" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="font-bold text-slate-700 block mb-1">Cliente</label><input list="clientes-agenda" value={form.clienteNombre} onChange={(e) => { const c = clients.find((x) => x.nombre === e.target.value); setForm({ ...form, clienteNombre: e.target.value, clienteTelefono: c?.telefono || form.clienteTelefono, direccion: form.direccion || c?.direccion || '' }); }} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /><datalist id="clientes-agenda">{clients.map((c) => <option key={c.id} value={c.nombre} />)}</datalist></div>
                <div><label className="font-bold text-slate-700 block mb-1">Teléfono (WhatsApp)</label><input value={form.clienteTelefono} onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
              </div>
              <div><label className="font-bold text-slate-700 block mb-1">Dirección</label><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="font-bold text-slate-700 block mb-1">Fecha</label><input type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
                <div><label className="font-bold text-slate-700 block mb-1">Inicio</label><input type="time" required value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
                <div><label className="font-bold text-slate-700 block mb-1">Fin</label><input type="time" required value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
              </div>
              <div className="flex gap-2">{fr && <><button type="button" onClick={() => setForm({ ...form, horaInicio: fr.manana.inicio, horaFin: fr.manana.fin })} className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold cursor-pointer">Mañana {fr.manana.inicio}–{fr.manana.fin}</button><button type="button" onClick={() => setForm({ ...form, horaInicio: fr.tarde.inicio, horaFin: fr.tarde.fin })} className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold cursor-pointer">Tarde {fr.tarde.inicio}–{fr.tarde.fin}</button></>}</div>
              <div><label className="font-bold text-slate-700 block mb-1">Técnicos</label><div className="flex flex-wrap gap-2">{tecnicos.map((t) => <label key={t} className={`px-3 py-1.5 rounded-xl border cursor-pointer font-bold ${form.tecnicos.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}><input type="checkbox" className="hidden" checked={form.tecnicos.includes(t)} onChange={(e) => setForm({ ...form, tecnicos: e.target.checked ? [...form.tecnicos, t] : form.tecnicos.filter((x) => x !== t) })} />{t}</label>)}</div>{tecnicos.length <= 1 && <p className="text-[10px] text-slate-400 mt-1">Añade más técnicos en Configuración.</p>}</div>
              {editando && <div><label className="font-bold text-slate-700 block mb-1">Estado</label><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as any })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">{['Programada', 'Pendiente confirmación', 'En curso', 'Completada', 'Cancelada', 'Urgente'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
              <div><label className="font-bold text-slate-700 block mb-1">Notas (accesos, llaves, material…)</label><textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer">Cancelar</button><button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer"><CalendarDays size={15} /> {editando ? 'Guardar cambios' : 'Guardar cita'}</button></div>
            </form>
          </div>
        </div>
      )}

      {calendarEvents.length === 0 && <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><AlertCircle size={12} /> Sin citas todavía. Cuando un cliente acepte un presupuesto podrás proponerle huecos libres desde la ficha de la obra.</p>}
    </div>
  );
};
