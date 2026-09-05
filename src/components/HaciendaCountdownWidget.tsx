import React, { useEffect, useState } from 'react';
import { Clock, ExternalLink, Building2, UserCheck, ChevronRight, CalendarDays } from 'lucide-react';
import { CompanySettings } from '../types';
import { modelosAplicables, proximosPlazos } from '../lib/fiscal';
import { fechaES, parseISO } from '../utils/dates';

interface Props {
  companySettings: CompanySettings;
  onNavigateToTaxClosing?: () => void;
  compact?: boolean;
}

function restante(fechaLimite: string) {
  const fin = parseISO(fechaLimite);
  fin.setHours(23, 59, 59, 0);
  const diff = fin.getTime() - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  return { d: Math.floor(diff / 86400000), h: Math.floor((diff / 3600000) % 24), m: Math.floor((diff / 60000) % 60), s: Math.floor((diff / 1000) % 60) };
}

// Cuenta atrás hasta el próximo plazo de la AEAT según el tipo de entidad y lo que tenga
// activado en Configuración (empleados, alquiler, intracomunitarias).
export const HaciendaCountdownWidget: React.FC<Props> = ({ companySettings, onNavigateToTaxClosing, compact = false }) => {
  const plazos = proximosPlazos(companySettings, new Date(), 5);
  const proximo = plazos[0];
  const [t, setT] = useState(() => (proximo ? restante(proximo.fechaLimite) : { d: 0, h: 0, m: 0, s: 0 }));
  useEffect(() => {
    if (!proximo) return;
    const i = setInterval(() => setT(restante(proximo.fechaLimite)), 1000);
    return () => clearInterval(i);
  }, [proximo?.fechaLimite]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAutonomo = companySettings.tipoEntidad === 'autonomo';
  const modelos = modelosAplicables(companySettings);
  const urgente = t.d <= 7;
  const aviso = t.d <= 20 && !urgente;

  if (!proximo) return null;

  if (compact) {
    return (
      <div onClick={onNavigateToTaxClosing} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${urgente ? 'bg-rose-100 text-rose-700' : aviso ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-600'}`}><Clock size={20} /></div>
          <div className="min-w-0">
            <span className="text-xs font-black text-slate-900 block truncate">Hacienda: {proximo.titulo}</span>
            <p className="text-[11px] text-slate-500 truncate">Hasta el {fechaES(proximo.fechaLimite)} · Modelos {proximo.modelos.join(', ')} · Domiciliación hasta el {fechaES(proximo.fechaDomiciliacion)}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-lg font-black font-mono ${urgente ? 'text-rose-700' : 'text-slate-900'}`}>{t.d} d {String(t.h).padStart(2, '0')} h</span>
          <span className="block text-[10px] uppercase font-bold text-slate-400">{isAutonomo ? 'Autónomo' : 'Sociedad'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white p-6 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30"><Clock size={18} /></div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm tracking-tight">Cuenta atrás Hacienda (AEAT)</h3>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${urgente ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : aviso ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>{urgente ? 'Plazo a punto de vencer' : aviso ? 'Plazo abierto' : 'Al día'}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Próximo: <strong className="text-slate-200">{proximo.titulo}</strong> · límite <strong className="text-white">{fechaES(proximo.fechaLimite)}</strong> · si domicilias, hasta el {fechaES(proximo.fechaDomiciliacion)}</p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 self-start">
            {isAutonomo ? <UserCheck size={13} className="text-emerald-400" /> : <Building2 size={13} className="text-blue-400" />}{isAutonomo ? 'Autónomo (persona física)' : 'Sociedad mercantil'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
          {[[t.d, 'Días', 'text-white'], [t.h, 'Horas', 'text-blue-400'], [t.m, 'Minutos', 'text-slate-200'], [t.s, 'Segundos', 'text-emerald-400']].map(([v, l, c]) => (
            <div key={l as string} className="p-3 bg-white/5 rounded-2xl border border-white/10">
              <span className={`block text-2xl sm:text-3xl font-black font-mono ${c}`}>{String(v).padStart(2, '0')}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">{l}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Modelos que te corresponden</span>
            <span className="text-[10px] text-slate-400">Según tu configuración · orientativo, confírmalo con la gestoría</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {modelos.filter((m) => m.aplica).map((m) => (
              <div key={m.codigo} className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/80">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800/50">Mod. {m.codigo}</span>
                  <span className="text-[9px] font-bold text-slate-400">{m.periodicidad}</span>
                </div>
                <p className="font-bold text-white text-[11px] mt-1 line-clamp-1">{m.nombre}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{m.descripcion}</p>
              </div>
            ))}
          </div>
          {modelos.some((m) => !m.aplica) && <p className="text-[10px] text-slate-500">No activos: {modelos.filter((m) => !m.aplica).map((m) => `${m.codigo}`).join(', ')}. Se activan en Configuración si tienes empleados, alquiler o compras en la UE.</p>}
        </div>

        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1"><CalendarDays size={12} /> Siguientes plazos</span>
          <div className="flex flex-wrap gap-2">
            {plazos.slice(1).map((p) => <span key={p.fechaLimite} className="text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300"><strong className="text-white">{fechaES(p.fechaLimite)}</strong> · {p.titulo} ({p.modelos.join(', ')})</span>)}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <a href="https://sede.agenciatributaria.gob.es" target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700"><ExternalLink size={13} /> Sede AEAT</a>
            {onNavigateToTaxClosing && <button type="button" onClick={onNavigateToTaxClosing} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer">Ver el trimestre <ChevronRight size={14} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
};
