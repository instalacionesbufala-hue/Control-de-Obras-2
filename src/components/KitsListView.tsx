import React, { useState } from 'react';
import { 
  Zap, Plus, Search, Trash2, Edit3, Copy, ChevronDown, 
  ChevronUp, Boxes, Euro, TrendingUp, CheckCircle2, 
  Layers, PackagePlus, AlertCircle
} from 'lucide-react';
import { Kit, KitItem } from '../types';
import { formatCurrency } from '../utils/formatters';

interface KitsListViewProps {
  kits: Kit[];
  onOpenCreateKit: () => void;
  onEditKit: (kit: Kit) => void;
  onDeleteKit: (id: string) => void;
  onDuplicateKit: (kit: Kit) => void;
  onInsertKitToProject?: (kit: Kit) => void;
}

export const KitsListView: React.FC<KitsListViewProps> = ({
  kits,
  onOpenCreateKit,
  onEditKit,
  onDeleteKit,
  onDuplicateKit,
  onInsertKitToProject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todas');
  const [expandedKitId, setExpandedKitId] = useState<string | null>(null);

  const categories = Array.from(new Set(kits.map(k => k.categoria))).filter(Boolean);

  const filteredKits = kits.filter(kit => {
    const matchesSearch = 
      kit.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (kit.codigo && kit.codigo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (kit.descripcion && kit.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCat = selectedCategory === 'todas' || kit.categoria === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const toggleExpand = (id: string) => {
    setExpandedKitId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar kits por nombre, código o descripción..."
            className="bg-transparent border-none text-xs w-full focus:outline-hidden text-slate-800 font-medium"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-bold hidden md:inline">Categoría:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
            >
              <option value="todas">Todas las Categorías ({kits.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <button
            onClick={onOpenCreateKit}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} /> Crear Nuevo Kit
          </button>
        </div>
      </div>

      {/* KITS GRID / LIST */}
      {filteredKits.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Zap size={28} />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900">No se encontraron kits</h3>
            <p className="text-xs text-slate-500 mt-1">
              Crea kits que agrupen materiales y mano de obra para presupuestar en un clic y ver el margen al instante.
            </p>
          </div>
          <button
            onClick={onOpenCreateKit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Plus size={15} /> Crear Primer Kit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredKits.map((kit) => {
            const isExpanded = expandedKitId === kit.id;
            const beneficio = kit.precioVentaTotal - kit.precioCosteTotal;

            return (
              <div 
                key={kit.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all overflow-hidden"
              >
                {/* CARD SUMMARY ROW */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm shrink-0 mt-0.5">
                      <Zap size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {kit.codigo && (
                          <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                            {kit.codigo}
                          </span>
                        )}
                        <h3 className="font-bold text-slate-900 text-sm md:text-base">
                          {kit.nombre}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {kit.categoria}
                        </span>
                      </div>
                      {kit.descripcion && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-2xl">
                          {kit.descripcion}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                        <span><strong>{kit.partidas?.length || 0}</strong> componentes</span>
                        <span>•</span>
                        <span>Coste compra: <strong className="text-slate-700">{formatCurrency(kit.precioCosteTotal)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* FINANCIAL NUMBERS & ACTIONS */}
                  <div className="flex items-center justify-between lg:justify-end gap-5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-lg md:text-xl font-black text-blue-600 font-mono">
                          {formatCurrency(kit.precioVentaTotal)}
                        </span>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                          kit.margenPorcentaje >= 35 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {kit.margenPorcentaje}% Margen
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Beneficio neto estimado: <strong className="text-emerald-600 font-mono">+{formatCurrency(beneficio)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onInsertKitToProject && (
                        <button
                          onClick={() => onInsertKitToProject(kit)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                          title="Ir a presupuestos para usar este kit"
                        >
                          <PackagePlus size={14} /> Usar en presupuesto
                        </button>
                      )}

                      <button
                        onClick={() => toggleExpand(kit.id)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        title={isExpanded ? 'Ocultar componentes' : 'Ver componentes'}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>

                      <button
                        onClick={() => onDuplicateKit(kit)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        title="Duplicar Kit"
                      >
                        <Copy size={16} />
                      </button>

                      <button
                        onClick={() => onEditKit(kit)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        title="Editar Kit"
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar el kit "${kit.nombre}"?`)) {
                            onDeleteKit(kit.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Eliminar Kit"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPANDABLE COMPONENTS TABLE */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/60">
                    <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Boxes size={14} className="text-slate-500" />
                      Desglose de Partidas y Materiales incluidos en el Kit:
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                          <tr>
                            <th className="p-2.5">Concepto</th>
                            <th className="p-2.5 text-center">Cant.</th>
                            <th className="p-2.5 text-right">Coste</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {kit.partidas?.map((item) => {
                            const cTotal = (Number(item.cantidad) || 0) * (Number(item.precioCoste) || 0);

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="p-2.5 font-bold text-slate-800">{item.concepto}</td>
                                <td className="p-2.5 text-center text-slate-600 font-mono">
                                  {item.cantidad} {item.unidad}
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-600">
                                  {formatCurrency(cTotal)} ({formatCurrency(item.precioCoste)}/{item.unidad})
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
