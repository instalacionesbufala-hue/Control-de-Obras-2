import React, { useMemo, useState } from 'react';
import { BadgeEuro, Receipt, BarChart3, Wallet, Calendar, AlertTriangle, Plus, ChevronRight, TrendingUp, TrendingDown, HardHat, CheckCircle2, SlidersHorizontal, X, RotateCcw, FileCheck2, Phone } from 'lucide-react';
import { Project, Invoice, Expense, BankTransaction, CalendarInstallation, Client, CompanySettings } from '../types';
import { formatCurrency, telefonoWhatsApp } from '../utils/formatters';
import { PeriodoFiltro, periodoActual, coincidePeriodo, aniosDisponibles, etiquetaRelativa, horaDe, hoyISO, etiquetaPeriodo, fechaES } from '../utils/dates';
import { PeriodFilter } from './PeriodFilter';
import { HaciendaCountdownWidget } from './HaciendaCountdownWidget';

interface Props {
  projects: Project[];
  invoices: Invoice[];
  expenses: Expense[];
  bankTransactions: BankTransaction[];
  calendarEvents: CalendarInstallation[];
  clients: Client[];
  companySettings: CompanySettings;
  onNavigate: (tab: string) => void;
  onSelectProject: (projectId: string) => void;
  onOpenNewInvoice: () => void;
  onOpenNewExpense: () => void;
}

interface WidgetsConfig { kpis: boolean; alertas: boolean; agenda: boolean; rentabilidad: boolean; hacienda: boolean; pendientes: boolean }
const DEFAULT_WIDGETS: WidgetsConfig = { kpis: true, alertas: true, agenda: true, rentabilidad: true, hacienda: true, pendientes: true };

export const DashboardView: React.FC<Props> = ({ projects, invoices, expenses, bankTransactions, calendarEvents, clients, companySettings, onNavigate, onSelectProject, onOpenNewInvoice, onOpenNewExpense }) => {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoActual());
  const [showCustomize, setShowCustomize] = useState(false);
  const [widgets, setWidgets] = useState<WidgetsConfig>(() => {
    try {
      const saved = localStorage.getItem('obracontrol_dashboard_widgets');
      return saved ? { ...DEFAULT_WIDGETS, ...JSON.parse(saved) } : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });
  const guardarWidgets = (w: WidgetsConfig) => {
    setWidgets(w);
    try {
      localStorage.setItem('obracontrol_dashboard_widgets', JSON.stringify(w));
    } catch {
      // ignorar
    }
  };

  const anios = aniosDisponibles([...invoices.map((i) => i.fecha), ...expenses.map((e) => e.fecha), ...projects.map((p) => p.fechaInicio)]);

  // Periodo anterior para comparar
  const periodoAnterior = useMemo<PeriodoFiltro | null>(() => {
    if (periodo.mes === 'todos' || periodo.anio === 'todos') return null;
    const m = Number(periodo.mes) - 1;
    return m >= 1 ? { mes: String(m).padStart(2, '0'), anio: periodo.anio } : { mes: '12', anio: String(Number(periodo.anio) - 1) };
  }, [periodo]);

  const k = useMemo(() => {
    const invP = invoices.filter((i) => !['Anulada', 'Rectificada'].includes(i.estado) && i.estado !== 'Borrador' && coincidePeriodo(i.fecha, periodo));
    const expP = expenses.filter((e) => coincidePeriodo(e.fecha, periodo));
    const ventas = invP.reduce((a, i) => a + i.baseImponible, 0);
    const gastos = expP.reduce((a, e) => a + e.baseImponible, 0);
    const gastosSL = expP.filter((e) => e.tipo === 'SL').reduce((a, e) => a + e.baseImponible, 0);
    const ventasAnt = periodoAnterior ? invoices.filter((i) => !['Anulada', 'Rectificada'].includes(i.estado) && coincidePeriodo(i.fecha, periodoAnterior)).reduce((a, i) => a + i.baseImponible, 0) : null;
    const variacion = ventasAnt && ventasAnt > 0 && ventas > 0 ? ((ventas - ventasAnt) / ventasAnt) * 100 : null;
    const obrasActivas = projects.filter((p) => p.estado === 'En ejecución' || p.estado === 'Aceptado' || p.estado === 'En legalización CIE');
    const facturadoObras = obrasActivas.reduce((a, p) => a + p.totalFacturado, 0) + projects.filter((p) => p.estado === 'Finalizada' || p.estado === 'Facturada').reduce((a, p) => a + p.totalFacturado, 0);
    const presupuestadoObras = projects.filter((p) => ['En ejecución', 'Aceptado', 'En legalización CIE', 'Finalizada', 'Facturada'].includes(p.estado)).reduce((a, p) => a + p.presupuestoAceptado, 0);
    const costeObras = projects.filter((p) => ['En ejecución', 'Aceptado', 'En legalización CIE', 'Finalizada', 'Facturada'].includes(p.estado)).reduce((a, p) => a + p.totalGastos, 0);
    const margen = presupuestadoObras > 0 ? Math.round(((presupuestadoObras - costeObras) / presupuestadoObras) * 100) : 0;
    const ultimoMov = [...bankTransactions].sort((a, b) => b.fecha.localeCompare(a.fecha)).find((t) => t.saldoPosterior !== undefined);
    const sinConciliar = bankTransactions.filter((t) => !t.conciliado).length;
    return { invP, expP, ventas, gastos, gastosSL, variacion, obrasActivas, facturadoObras, presupuestadoObras, costeObras, margen, ultimoMov, sinConciliar };
  }, [invoices, expenses, projects, bankTransactions, periodo, periodoAnterior]);

  const pendientesCobro = invoices.filter((i) => i.estado === 'Pendiente' || i.estado === 'Vencida');
  const hoy = hoyISO();
  const vencidas = pendientesCobro.filter((i) => i.fechaVencimiento < hoy);
  const proximosEventos = [...calendarEvents].filter((e) => e.estado !== 'Cancelada' && e.estado !== 'Completada' && e.fechaHoraInicio.split('T')[0] >= hoy).sort((a, b) => a.fechaHoraInicio.localeCompare(b.fechaHoraInicio)).slice(0, 5);
  const citasPorConfirmar = projects.filter((p) => p.estado === 'Aceptado' && !p.fechaCitaCalendario);
  const presupuestosEnviados = projects.filter((p) => p.estado === 'Enviado');
  const obrasParaFacturar = projects.filter((p) => p.estado === 'Finalizada' && p.totalFacturado < p.presupuestoAceptado - 0.01);
  const docsPendientes = projects.flatMap((p) => p.documentos.filter((d) => d.tipo === 'CIE' && d.estado !== 'Aprobado').map((d) => ({ p, d })));

  const kpiObras = k.obrasActivas.slice(0, 4);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Resumen</h1>
          <p className="text-slate-500 text-sm mt-1">{etiquetaPeriodo(periodo)} · {k.obrasActivas.length} obras activas · {clients.length} clientes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter value={periodo} onChange={setPeriodo} anios={anios} />
          <button onClick={() => setShowCustomize(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer border border-slate-200" title="Elegir qué bloques se muestran"><SlidersHorizontal size={15} /> Bloques</button>
          <button onClick={onOpenNewInvoice} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"><Plus size={16} /> Nueva factura</button>
        </div>
      </div>

      {widgets.kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Kpi icon={<BadgeEuro size={22} />} color="blue" titulo="Ventas (base imponible)" valor={formatCurrency(k.ventas)} pie={`${k.invP.length} facturas`} enlace="Ver facturas" onClick={() => onNavigate('ventas')}
            badge={k.variacion !== null ? <span className={`text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${k.variacion >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{k.variacion >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {k.variacion >= 0 ? '+' : ''}{k.variacion.toFixed(0)} % vs mes anterior</span> : undefined} />
          <Kpi icon={<Receipt size={22} />} color="amber" titulo="Gastos (base imponible)" valor={formatCurrency(k.gastos)} pie={`Estructura: ${formatCurrency(k.gastosSL)}`} enlace="Ver gastos" onClick={() => onNavigate('gastos')} />
          <Kpi icon={<BarChart3 size={22} />} color="emerald" titulo="Margen previsto en obras" valor={`${k.margen} %`} pie={`Presupuestado ${formatCurrency(k.presupuestadoObras)} · coste ${formatCurrency(k.costeObras)}`} enlace="Rentabilidad" onClick={() => onNavigate('rentabilidad')}
            badge={<span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${k.margen >= 35 ? 'bg-emerald-100 text-emerald-800' : k.margen >= 20 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{k.margen >= 35 ? 'Bien' : k.margen >= 20 ? 'Ajustado' : 'Revisar'}</span>} />
          <Kpi icon={<Wallet size={22} />} color="indigo" titulo="Tesorería (banco)" valor={k.ultimoMov ? formatCurrency(k.ultimoMov.saldoPosterior || 0) : '—'} pie={k.ultimoMov ? `Saldo al ${fechaES(k.ultimoMov.fecha)} · ${k.ultimoMov.entidad}` : 'Importa el extracto del banco'} enlace={k.sinConciliar ? 'Conciliar' : 'Ver banco'} onClick={() => onNavigate('bancos')}
            badge={k.sinConciliar > 0 ? <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">{k.sinConciliar} por conciliar</span> : <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">Al día</span>} />
        </div>
      )}

      {widgets.alertas && pendientesCobro.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200/80 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0"><AlertTriangle size={22} /></div>
            <div>
              <p className="text-sm font-black text-amber-950">{pendientesCobro.length} factura{pendientesCobro.length > 1 ? 's' : ''} por cobrar · {formatCurrency(pendientesCobro.reduce((a, b) => a + b.total, 0))}{vencidas.length > 0 ? ` · ${vencidas.length} vencida${vencidas.length > 1 ? 's' : ''}` : ''}</p>
              <p className="text-xs text-amber-900/80 mt-0.5">{vencidas[0] ? `${vencidas[0].numero} de ${vencidas[0].clienteNombre} venció el ${fechaES(vencidas[0].fechaVencimiento)}.` : `La más próxima vence el ${fechaES([...pendientesCobro].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))[0].fechaVencimiento)}.`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            {(vencidas[0] || pendientesCobro[0]) && (() => {
              const f = vencidas[0] || pendientesCobro[0];
              const c = clients.find((x) => x.id === f.clienteId);
              const tel = telefonoWhatsApp(c?.telefono);
              const msg = `Hola ${f.clienteNombre}, te recordamos que la factura ${f.numero} por ${formatCurrency(f.total)} venció el ${fechaES(f.fechaVencimiento)}. IBAN: ${companySettings.ibanPrincipal || '(ver factura)'}. Gracias, ${companySettings.nombreComercial || companySettings.razonSocial}.`;
              return tel ? <a href={`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center gap-1.5"><Phone size={13} /> Recordar por WhatsApp</a> : null;
            })()}
            <button onClick={() => onNavigate('ventas')} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl cursor-pointer">Ver cobros</button>
          </div>
        </div>
      )}

      {widgets.hacienda && <HaciendaCountdownWidget companySettings={companySettings} compact onNavigateToTaxClosing={() => onNavigate('gestoria')} />}

      {(widgets.agenda || widgets.rentabilidad) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {widgets.agenda && (
            <div className={`${widgets.rentabilidad ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col`}>
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><Calendar size={20} /></div>
                  <div><h2 className="font-black text-slate-900 text-base">Próximas citas</h2><p className="text-[11px] text-slate-500">{citasPorConfirmar.length ? `${citasPorConfirmar.length} obra${citasPorConfirmar.length > 1 ? 's' : ''} aceptada${citasPorConfirmar.length > 1 ? 's' : ''} sin fecha` : 'Agenda al día'}</p></div>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                {proximosEventos.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">No hay citas programadas.</p>}
                {proximosEventos.map((ev) => {
                  const dia = ev.fechaHoraInicio.split('T')[0];
                  return (
                    <div key={ev.id} className="p-4 bg-slate-50/80 hover:bg-slate-100/80 rounded-2xl border border-slate-200/60 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3.5">
                          <div className={`w-14 h-12 rounded-2xl flex flex-col items-center justify-center font-black text-xs shrink-0 ${dia === hoy ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                            <span className="text-[9px] uppercase tracking-wider font-semibold">{etiquetaRelativa(dia)}</span>
                            <span className="text-xs font-black">{horaDe(ev.fechaHoraInicio)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 text-xs leading-snug line-clamp-1">{ev.titulo}</p>
                            <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5"><HardHat size={12} className="text-slate-400" /> {ev.clienteNombre}</p>
                            <p className="text-[11px] text-slate-400 truncate">{ev.direccion}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${ev.estado === 'Pendiente confirmación' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/80 text-slate-700'}`}>{ev.estado}</span>
                      </div>
                      {ev.obraId && <button onClick={() => onSelectProject(ev.obraId!)} className="text-blue-600 text-[11px] font-bold hover:text-blue-800 flex items-center gap-0.5 cursor-pointer mt-2">Abrir obra <ChevronRight size={12} /></button>}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => onNavigate('agenda')} className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold cursor-pointer">Abrir la agenda</button>
            </div>
          )}

          {widgets.rentabilidad && (
            <div className={`${widgets.agenda ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col`}>
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600"><BarChart3 size={20} /></div>
                  <div><h2 className="font-black text-slate-900 text-base">Obras activas: coste frente a presupuesto</h2><p className="text-[11px] text-slate-500">Materiales, mano de obra, subcontratas y margen</p></div>
                </div>
                <button onClick={() => onNavigate('rentabilidad')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">Ver todas <ChevronRight size={14} /></button>
              </div>
              <div className="space-y-4 flex-1">
                {kpiObras.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">No hay obras en curso.</p>}
                {kpiObras.map((p) => {
                  const pres = p.presupuestoAceptado || 0;
                  const margen = pres > 0 ? Math.round(((pres - p.totalGastos) / pres) * 100) : 0;
                  const pct = (v: number) => (pres > 0 ? Math.min(100, Math.round((v / pres) * 100)) : 0);
                  return (
                    <div key={p.id} onClick={() => onSelectProject(p.id)} className="p-4 rounded-2xl border border-slate-200/70 hover:border-blue-300 transition-all cursor-pointer bg-slate-50/40">
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2"><span className="text-[10px] font-black bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md">{p.obraCodigo || p.codigo}</span><h3 className="font-bold text-slate-900 text-sm truncate">{p.nombre}</h3></div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{p.clienteNombre} · {p.estado}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block text-xs font-black px-2.5 py-0.5 rounded-full ${margen >= 35 ? 'bg-emerald-100 text-emerald-800' : margen >= 20 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{margen} % margen</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">Beneficio previsto {formatCurrency(pres - p.totalGastos)}</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600 font-semibold mb-1"><span>Coste {formatCurrency(p.totalGastos)}</span><span>Facturado {formatCurrency(p.totalFacturado)}</span><span>Presupuesto {formatCurrency(pres)}</span></div>
                      <div className="w-full bg-slate-200/70 h-2.5 rounded-full overflow-hidden flex">
                        <div className="bg-blue-500 h-full" style={{ width: `${pct(p.desgloseGastos.materiales)}%` }} title={`Materiales ${formatCurrency(p.desgloseGastos.materiales)}`} />
                        <div className="bg-indigo-400 h-full" style={{ width: `${pct(p.desgloseGastos.manoDeObra)}%` }} title={`Mano de obra ${formatCurrency(p.desgloseGastos.manoDeObra)}`} />
                        <div className="bg-amber-400 h-full" style={{ width: `${pct(p.desgloseGastos.subcontratas + p.desgloseGastos.maquinaria + p.desgloseGastos.otros)}%` }} title="Subcontratas y otros" />
                        <div className="bg-emerald-500 h-full flex-1" title={`Margen ${margen} %`} />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1">
                        <div className="flex items-center gap-3"><Leyenda c="bg-blue-500" t="Materiales" /><Leyenda c="bg-indigo-400" t="Mano de obra" /><Leyenda c="bg-amber-400" t="Otros" /><Leyenda c="bg-emerald-500" t="Margen" /></div>
                        <span className="font-bold text-slate-600">Avance {p.porcentajeAvance} %</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Los gastos imputados a una obra alimentan esta barra.</span>
                <button onClick={onOpenNewExpense} className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"><Plus size={14} /> Imputar gasto</button>
              </div>
            </div>
          )}
        </div>
      )}

      {widgets.pendientes && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Tarjeta titulo="Presupuestos enviados" icono={<FileCheck2 size={18} className="text-blue-600" />} badge={`${presupuestosEnviados.length}`}>
            {presupuestosEnviados.length === 0 ? <p className="text-xs text-slate-400">Nada pendiente de respuesta.</p> : presupuestosEnviados.slice(0, 4).map((p) => <Fila key={p.id} onClick={() => onSelectProject(p.id)} izq={`${p.codigo} · ${p.clienteNombre}`} der={formatCurrency(p.presupuestoAceptado)} />)}
          </Tarjeta>
          <Tarjeta titulo="Obras aceptadas sin cita" icono={<Calendar size={18} className="text-amber-600" />} badge={`${citasPorConfirmar.length}`}>
            {citasPorConfirmar.length === 0 ? <p className="text-xs text-slate-400">Todas las obras aceptadas tienen fecha.</p> : citasPorConfirmar.slice(0, 4).map((p) => <Fila key={p.id} onClick={() => onSelectProject(p.id)} izq={`${p.obraCodigo || p.codigo} · ${p.clienteNombre}`} der={p.huecoElegido ? 'Cliente eligió hueco' : 'Proponer huecos'} />)}
          </Tarjeta>
          <Tarjeta titulo="Obras terminadas por facturar" icono={<CheckCircle2 size={18} className="text-emerald-600" />} badge={`${obrasParaFacturar.length}${docsPendientes.length ? ` · ${docsPendientes.length} CIE en trámite` : ''}`}>
            {obrasParaFacturar.length === 0 ? <p className="text-xs text-slate-400">Nada pendiente de facturar.</p> : obrasParaFacturar.slice(0, 4).map((p) => <Fila key={p.id} onClick={() => onSelectProject(p.id)} izq={`${p.obraCodigo || p.codigo} · ${p.clienteNombre}`} der={formatCurrency(p.presupuestoAceptado - p.totalFacturado)} />)}
          </Tarjeta>
        </div>
      )}

      {showCustomize && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5"><div className="p-2 rounded-xl bg-blue-50 text-blue-600"><SlidersHorizontal size={18} /></div><div><h3 className="font-black text-slate-900 text-base">Bloques del resumen</h3><p className="text-[11px] text-slate-500">Activa o desactiva lo que quieres ver</p></div></div>
              <button onClick={() => setShowCustomize(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"><X size={18} /></button>
            </div>
            <div className="py-4 space-y-2">
              {([['kpis', 'Indicadores', 'Ventas, gastos, margen y tesorería'], ['alertas', 'Cobros pendientes', 'Aviso con recordatorio por WhatsApp'], ['hacienda', 'Cuenta atrás de Hacienda', 'Próximo plazo y modelos'], ['agenda', 'Próximas citas', 'Lo que hay en la agenda'], ['rentabilidad', 'Obras activas', 'Coste frente a presupuesto'], ['pendientes', 'Pendientes', 'Enviados, sin cita y por facturar']] as Array<[keyof WidgetsConfig, string, string]>).map(([key, label, desc]) => (
                <div key={key} onClick={() => guardarWidgets({ ...widgets, [key]: !widgets[key] })} className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/70 hover:bg-slate-50 cursor-pointer">
                  <div><p className="text-xs font-bold text-slate-900">{label}</p><p className="text-[10px] text-slate-500">{desc}</p></div>
                  <div className={`w-11 h-6 rounded-full relative flex items-center px-0.5 ${widgets[key] ? 'bg-blue-600' : 'bg-slate-200'}`}><div className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${widgets[key] ? 'translate-x-5' : ''}`} /></div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => guardarWidgets(DEFAULT_WIDGETS)} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"><RotateCcw size={13} /> Restablecer</button>
              <button onClick={() => setShowCustomize(false)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer">Listo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Kpi: React.FC<{ icon: React.ReactNode; color: string; titulo: string; valor: string; pie: string; enlace: string; onClick: () => void; badge?: React.ReactNode }> = ({ icon, color, titulo, valor, pie, enlace, onClick, badge }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-3"><div className={`p-3 rounded-2xl ${{ blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', indigo: 'bg-indigo-50 text-indigo-600' }[color] || 'bg-slate-50 text-slate-600'}`}>{icon}</div>{badge}</div>
    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{titulo}</p>
    <p className="text-2xl font-black text-slate-900 tracking-tight mt-1">{valor}</p>
    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100"><span className="truncate pr-2">{pie}</span><span className="text-blue-600 font-bold cursor-pointer hover:underline shrink-0" onClick={onClick}>{enlace}</span></div>
  </div>
);

const Leyenda: React.FC<{ c: string; t: string }> = ({ c, t }) => <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${c}`} /> {t}</span>;

const Tarjeta: React.FC<{ titulo: string; icono: React.ReactNode; badge: string; children: React.ReactNode }> = ({ titulo, icono, badge, children }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
    <div className="flex items-center justify-between mb-4"><h3 className="font-black text-slate-900 text-sm flex items-center gap-2">{icono}{titulo}</h3><span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">{badge}</span></div>
    <div className="space-y-2">{children}</div>
  </div>
);

const Fila: React.FC<{ izq: string; der: string; onClick: () => void }> = ({ izq, der, onClick }) => (
  <div onClick={onClick} className="flex items-center justify-between p-2.5 bg-slate-50/90 rounded-xl border border-slate-200/50 text-xs cursor-pointer hover:bg-blue-50">
    <span className="font-semibold text-slate-800 truncate pr-2">{izq}</span><span className="text-[11px] font-bold text-slate-600 shrink-0">{der}</span>
  </div>
);
