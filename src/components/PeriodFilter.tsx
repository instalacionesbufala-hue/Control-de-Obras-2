import React from 'react';
import { Calendar } from 'lucide-react';
import { MESES, PeriodoFiltro } from '../utils/dates';

interface PeriodFilterProps {
  value: PeriodoFiltro;
  onChange: (p: PeriodoFiltro) => void;
  anios: string[];
  compact?: boolean;
  totalFiltrado?: number;
  totalGlobal?: number;
}

// Selector de mes y año compartido por todas las secciones. Cada sección guarda su propio
// valor; por defecto arranca en el mes y año en curso.
export const PeriodFilter: React.FC<PeriodFilterProps> = ({ value, onChange, anios, compact = false, totalFiltrado, totalGlobal }) => {
  const hayOculto = totalFiltrado !== undefined && totalGlobal !== undefined && totalFiltrado < totalGlobal;
  return (
    <div className={`flex items-center gap-2 bg-white ${compact ? 'p-1' : 'p-1.5'} rounded-2xl border border-slate-200 shadow-xs flex-wrap`}>
      <Calendar size={15} className="text-slate-400 ml-2" />
      <select
        value={value.mes}
        onChange={(e) => onChange({ ...value, mes: e.target.value })}
        className="text-xs font-bold text-slate-700 bg-transparent py-1.5 px-1 outline-none cursor-pointer"
        aria-label="Mes"
      >
        <option value="todos">Todo el año</option>
        {MESES.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>
            {m}
          </option>
        ))}
      </select>
      <span className="text-slate-300">|</span>
      <select
        value={value.anio}
        onChange={(e) => onChange({ ...value, anio: e.target.value })}
        className="text-xs font-bold text-slate-700 bg-transparent py-1.5 px-1 outline-none cursor-pointer"
        aria-label="Año"
      >
        <option value="todos">Todos los años</option>
        {anios.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      {(value.mes !== 'todos' || value.anio !== 'todos') && (
        <button
          type="button"
          onClick={() => onChange({ mes: 'todos', anio: 'todos' })}
          className="text-[10px] font-bold text-blue-600 hover:underline px-2 cursor-pointer"
          title="Quitar el filtro de fecha"
        >
          Ver todo
        </button>
      )}
      {hayOculto && (
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full mr-1" title="Registros fuera del periodo elegido">
          {totalGlobal! - totalFiltrado!} fuera del periodo
        </span>
      )}
    </div>
  );
};
