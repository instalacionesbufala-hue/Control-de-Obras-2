import React, { useMemo, useState } from 'react';
import { TrendingUp, AlertTriangle, BarChart3, Search, ChevronRight, Eye, Package, Users, Wrench, Info } from 'lucide-react';
import { Project, Expense, Invoice } from '../types';
import { costeRealMateriales } from '../lib/consumo';
import { formatCurrency } from '../utils/formatters';
import { PeriodFilter } from './PeriodFilter';
import { PeriodoFiltro, periodoActual, coincidePeriodo, aniosDisponibles, etiquetaPeriodo } from '../utils/dates';

interface Props {
  projects: Project[];
  expenses: Expense[];
  invoices: Invoice[];
  onSelectProject?: (projectId: string) => void;
}

const ESTADOS_OBRA = ['Aceptado', 'En ejecución', 'En legalización CIE', 'Finalizada', 'Facturada'];

export const RentabilityView: React.FC<Props> = ({ projects, expenses, invoices, onSelectProject }) => {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoActual());
  const [estado, setEstado] = useState('obras');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<Project | null>(null);
  const anios = aniosDisponibles(projects.map((p) => p.fechaAceptacion || p.fechaInicio));

  // Coste previsto (escandallo de las partidas) frente a coste real (gastos imputados)
  const costePrevisto = (p: Project) => (p.partidas || []).reduce((a, x) => a + (x.costeInternoTotal || 0) * x.cantidad, 0);
  // Si la obra tiene el consumo de material cerrado, ese es el coste real de material.
  // A eso se le suman los gastos imputados que no sean material (subcontratas, alquileres…).
  const costeReal = (p: Project) => {
    if (p.consumoCerrado && (p.consumoReal || []).length) {
      const material = costeRealMateriales(p.consumoReal || []);
      const otros = Math.max(0, (p.totalGastos || 0) - (p.desgloseGastos?.materiales || 0));
      return Math.round((material + otros) * 100) / 100;
    }
    return p.totalGastos || 0;
  };
  const ventaDe = (p: Project) => p.presupuestoAceptado || 0;
  const facturadoDe = (p: Project) => invoices.filter((i) => i.obraId === p.id && !['Anulada', 'Rectificada'].includes(i.estado)).reduce((a, i) => a + i.baseImponible, 0);

  const filtrados = useMemo(() => projects.filter((p) => {
    const fecha = p.fechaAceptacion || p.fechaInicio;
    if (!coincidePeriodo(fecha, periodo)) return false;
    if (estado === 'obras' && !ESTADOS_OBRA.includes(p.estado)) return false;
    if (estado !== 'obras' && estado !== 'todos' && p.estado !== estado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!p.nombre.toLowerCase().includes(q) && !p.codigo.toLowerCase().includes(q) && !(p.obraCodigo || '').toLowerCase().includes(q) && !p.clienteNombre.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [projects, periodo, estado, busqueda]);

  const stats = useMemo(() => {
    const venta = filtrados.reduce((a, p) => a + ventaDe(p), 0);
    const real = filtrados.reduce((a, p) => a + costeReal(p), 0);
    const previsto = filtrados.reduce((a, p) => a + costePrevisto(p), 0);
    const mat = filtrados.reduce((a, p) => a + (p.desgloseGastos?.materiales || 0), 0);
    const mo = filtrados.reduce((a, p) => a + (p.desgloseGastos?.manoDeObra || 0), 0);
    const sub = filtrados.reduce((a, p) => a + (p.desgloseGastos?.subcontratas || 0) + (p.desgloseGastos?.maquinaria || 0) + (p.desgloseGastos?.otros || 0), 0);
    const beneficio = venta - real;
    const margen = venta > 0 ? (beneficio / venta) * 100 : 0;
    const bajas = filtrados.filter((p) => ventaDe(p) > 0 && ((ventaDe(p) - costeReal(p)) / ventaDe(p)) * 100 < 20).length;
    const sinCoste = filtrados.filter((p) => costeReal(p) === 0 && costePrevisto(p) === 0).length;
    return { venta, real, previsto, mat, mo, sub, beneficio, margen, bajas, sinCoste };
  }, [filtrados]); // eslint-disable-line react-hooks/exhaustive-deps

  const semaforo = (margen: number, beneficio: number) => (margen < 15 || beneficio < 0 ? { c: 'bg-rose-500', b: 'bg-rose-50 text-rose-700 border-rose-200', t: 'Crítico' } : margen < 30 ? { c: 'bg-amber-500', b: 'bg-amber-50 text-amber-700 border-amber-200', t: 'Aceptable' } : { c: 'bg-emerald-500', b: 'bg-emerald-50 text-emerald-700 border-emerald-200', t: 'Bien' });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg"><TrendingUp size={22} /></div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Rentabilidad por obra</h1>
            <p className="text-slate-500 text-sm mt-0.5">Precio de venta frente a coste previsto (escandallo) y coste real (material consumido en obra y gastos imputados) · {etiquetaPeriodo(periodo)}</p>
          </div>
        </div>
        <PeriodFilter value={periodo} onChange={setPeriodo} anios={anios} totalFiltrado={filtrados.length} totalGlobal={projects.filter((p) => estado !== 'obras' || ESTADOS_OBRA.includes(p.estado)).length} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs"><div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2"><span>Venta (base)</span><div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><BarChart3 size={16} /></div></div><p className="text-2xl font-black text-slate-900">{formatCurrency(stats.venta)}</p><p className="text-[11px] text-slate-500 mt-2">{filtrados.length} obras en el periodo</p></div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs"><div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2"><span>Coste real</span><div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Package size={16} /></div></div><p className="text-2xl font-black text-slate-900">{formatCurrency(stats.real)}</p><p className="text-[11px] text-slate-500 mt-2">Previsto en escandallo: {formatCurrency(stats.previsto)}</p></div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs"><div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2"><span>Beneficio bruto</span><div className={`w-8 h-8 rounded-xl flex items-center justify-center ${stats.beneficio >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}><TrendingUp size={16} /></div></div><p className={`text-2xl font-black ${stats.beneficio >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(stats.beneficio)}</p><span className={`inline-block text-[11px] font-bold mt-2 px-2 py-0.5 rounded-full ${stats.margen >= 30 ? 'bg-emerald-100 text-emerald-800' : stats.margen >= 15 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{stats.margen.toFixed(1)} % de margen</span></div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs"><div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2"><span>Atención</span><div className={`w-8 h-8 rounded-xl flex items-center justify-center ${stats.bajas > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}><AlertTriangle size={16} /></div></div><p className="text-2xl font-black text-slate-900">{stats.bajas} obras</p><p className="text-[11px] mt-2 text-slate-500">{stats.bajas > 0 ? 'con margen real por debajo del 20 %' : 'todas con margen saludable'}{stats.sinCoste > 0 ? ` · ${stats.sinCoste} sin coste registrado` : ''}</p></div>
      </div>

      {stats.sinCoste > 0 && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2"><Info size={15} className="shrink-0 mt-0.5" /><span>Dato incompleto: {stats.sinCoste} obra(s) sin ningún coste registrado. Imputa los gastos de material desde Gastos o añade el escandallo a las partidas para que el margen sea real.</span></div>}

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por código, nombre o cliente…" className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none" /></div>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="text-xs font-bold text-slate-700 bg-slate-100 py-2 px-3 rounded-xl outline-none cursor-pointer">
          <option value="obras">Solo obras (aceptadas o posteriores)</option>
          <option value="todos">Todos, incluidos presupuestos</option>
          {['Aceptado', 'En ejecución', 'En legalización CIE', 'Finalizada', 'Facturada', 'Enviado', 'Borrador', 'Rechazado'].map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="p-12 text-center space-y-2"><TrendingUp size={24} className="mx-auto text-slate-300" /><p className="text-sm font-bold text-slate-700">No hay obras en el periodo seleccionado</p><p className="text-xs text-slate-400">Cambia el mes o el año, o pulsa "Ver todo".</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider"><tr><th className="p-4">Obra</th><th className="p-4">Cliente</th><th className="p-4 text-right">Venta</th><th className="p-4 text-right">Coste previsto</th><th className="p-4 text-right">Coste real</th><th className="p-4 text-right">Facturado</th><th className="p-4 text-right">Beneficio</th><th className="p-4 text-center">Margen real</th><th className="p-4 text-center">Estado</th><th className="p-4"></th></tr></thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtrados.map((p) => {
                  const venta = ventaDe(p);
                  const real = costeReal(p);
                  const prev = costePrevisto(p);
                  const ben = venta - real;
                  const margen = venta > 0 ? (ben / venta) * 100 : 0;
                  const s = semaforo(margen, ben);
                  const desv = prev > 0 ? ((real - prev) / prev) * 100 : null;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="p-4"><div className="font-bold text-slate-900">{p.nombre}</div><div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.obraCodigo || p.codigo}</div></td>
                      <td className="p-4"><div className="font-bold text-slate-700">{p.clienteNombre}</div><div className="text-[10px] text-slate-400">{p.estado}</div></td>
                      <td className="p-4 text-right font-bold text-slate-900">{formatCurrency(venta)}</td>
                      <td className="p-4 text-right text-slate-600">{prev > 0 ? formatCurrency(prev) : <span className="text-slate-300">—</span>}</td>
                      <td className="p-4 text-right"><div className="font-bold text-slate-800">{formatCurrency(real)}</div>{desv !== null && real > 0 && <div className={`text-[10px] ${desv > 5 ? 'text-rose-600' : 'text-emerald-600'}`}>{desv > 0 ? '+' : ''}{desv.toFixed(0)} % vs previsto</div>}</td>
                      <td className="p-4 text-right text-slate-600">{formatCurrency(facturadoDe(p))}</td>
                      <td className={`p-4 text-right font-black ${ben >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(ben)}</td>
                      <td className="p-4 text-center"><div className="inline-flex items-center gap-1.5 font-bold"><span className={`w-2 h-2 rounded-full ${s.c}`} /><span>{margen.toFixed(1)} %</span></div><div className="w-16 h-1.5 bg-slate-100 rounded-full mx-auto mt-1 overflow-hidden"><div className={`h-full ${s.c}`} style={{ width: `${Math.min(Math.max(margen, 0), 100)}%` }} /></div></td>
                      <td className="p-4 text-center"><span className={`inline-block px-2 py-0.5 text-[10px] font-black rounded-md border ${s.b}`}>{s.t}</span></td>
                      <td className="p-4 text-center"><div className="flex items-center justify-center gap-1"><button onClick={() => setDetalle(p)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl cursor-pointer" title="Detalle"><Eye size={15} /></button>{onSelectProject && <button onClick={() => onSelectProject(p.id)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer" title="Abrir obra"><ChevronRight size={15} /></button>}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detalle && (() => {
        const venta = ventaDe(detalle);
        const real = costeReal(detalle);
        const prev = costePrevisto(detalle);
        const gastos = expenses.filter((e) => e.obraId === detalle.id);
        const margen = venta > 0 ? ((venta - real) / venta) * 100 : 0;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between">
                <div><span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">Detalle de rentabilidad</span><h3 className="text-xl font-black text-slate-900 mt-1">{detalle.nombre}</h3><p className="text-xs text-slate-500 font-mono">{detalle.obraCodigo || detalle.codigo} · {detalle.clienteNombre}</p></div>
                <button onClick={() => setDetalle(null)} className="p-2 text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] font-bold text-slate-400 uppercase">Venta</p><p className="text-base font-black text-slate-900 mt-0.5">{formatCurrency(venta)}</p></div>
                <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] font-bold text-slate-400 uppercase">Coste previsto</p><p className="text-base font-black text-slate-900 mt-0.5">{formatCurrency(prev)}</p></div>
                <div className="p-3 bg-slate-50 rounded-2xl"><p className="text-[10px] font-bold text-slate-400 uppercase">Coste real</p><p className="text-base font-black text-slate-900 mt-0.5">{formatCurrency(real)}</p></div>
              </div>
              <div className="border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Coste real por tipo</h4>
                <div className="flex justify-between"><span className="flex items-center gap-2 text-slate-600"><Package size={14} className="text-blue-500" /> Materiales</span><span className="font-bold">{formatCurrency(detalle.desgloseGastos?.materiales || 0)}</span></div>
                <div className="flex justify-between"><span className="flex items-center gap-2 text-slate-600"><Wrench size={14} className="text-amber-500" /> Mano de obra</span><span className="font-bold">{formatCurrency(detalle.desgloseGastos?.manoDeObra || 0)}</span></div>
                <div className="flex justify-between"><span className="flex items-center gap-2 text-slate-600"><Users size={14} className="text-purple-500" /> Subcontratas, maquinaria y otros</span><span className="font-bold">{formatCurrency((detalle.desgloseGastos?.subcontratas || 0) + (detalle.desgloseGastos?.maquinaria || 0) + (detalle.desgloseGastos?.otros || 0))}</span></div>
              </div>
              {gastos.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                  <div className="p-3 bg-slate-50 font-bold text-slate-700">Gastos imputados ({gastos.length})</div>
                  <div className="divide-y divide-slate-100">{gastos.map((g) => <div key={g.id} className="p-3 flex justify-between"><span className="truncate pr-3">{g.fecha} · {g.proveedor} · {g.concepto}</span><span className="font-bold shrink-0">{formatCurrency(g.baseImponible)}</span></div>)}</div>
                </div>
              )}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1">
                <div className="flex justify-between text-xs font-bold"><span>Beneficio bruto</span><span className="text-emerald-400 text-sm font-black">{formatCurrency(venta - real)} ({margen.toFixed(1)} %)</span></div>
                <p className="text-[11px] text-slate-400">{real === 0 ? 'Sin gastos imputados todavía: el margen mostrado es el previsto en el presupuesto.' : margen >= 35 ? 'Margen alto.' : margen >= 20 ? 'Margen habitual en instalaciones de baja tensión.' : 'Margen bajo: revisa compras de material y horas.'}</p>
              </div>
              <div className="flex justify-end"><button onClick={() => setDetalle(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cerrar</button></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
