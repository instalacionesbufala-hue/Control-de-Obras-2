import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, Zap, Boxes, Calculator, ArrowRight, 
  CheckCircle2, AlertCircle, Percent, Euro, Layers
} from 'lucide-react';
import { Kit, KitItem, CatalogItem } from '../types';
import { margenDe, ventaConMargen, costeDe } from '../lib/catalogo';
import { formatCurrency } from '../utils/formatters';

interface KitBuilderModalProps {
  isOpen: boolean;
  kitToEdit: Kit | null;
  catalogItems: CatalogItem[];
  categorias?: string[];
  margenObjetivo?: number; // margen por defecto de la empresa, para el selector rápido
  onSave: (kit: Kit) => void;
  onClose: () => void;
}

export const KitBuilderModal: React.FC<KitBuilderModalProps> = ({
  isOpen,
  kitToEdit,
  catalogItems,
  categorias = [],
  margenObjetivo = 40,
  onSave,
  onClose,
}) => {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState(categorias[0] || 'General');
  const [descripcion, setDescripcion] = useState('');
  const [partidas, setPartidas] = useState<KitItem[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');

  useEffect(() => {
    if (kitToEdit) {
      setNombre(kitToEdit.nombre);
      setCodigo(kitToEdit.codigo || `KIT-${Math.floor(100 + Math.random() * 900)}`);
      setCategoria(kitToEdit.categoria || categorias[0] || 'General');
      setDescripcion(kitToEdit.descripcion || '');
      setPartidas(kitToEdit.partidas ? [...kitToEdit.partidas] : []);
    } else {
      setNombre('');
      setCodigo(`KIT-${Math.floor(100 + Math.random() * 900)}`);
      setCategoria(categorias[0] || 'General');
      setDescripcion('');
      setPartidas([]);
    }
  }, [kitToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddFromCatalog = () => {
    if (!selectedCatalogId) return;
    const catItem = catalogItems.find(i => i.id === selectedCatalogId);
    if (!catItem) return;

    const newItem: KitItem = {
      id: `ki-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemId: catItem.id,
      concepto: catItem.concepto,
      cantidad: 1,
      unidad: catItem.unidad || 'ud',
      precioCoste: costeDe(catItem),
      proveedor: catItem.proveedorHabitual,
      precioVenta: catItem.precioUnitario,
      ivaPorcentaje: catItem.ivaPorcentaje || 21,
    };

    setPartidas(prev => [...prev, newItem]);
    setSelectedCatalogId('');
  };

  const handleAddCustomItem = () => {
    const newItem: KitItem = {
      id: `ki-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      concepto: 'Nuevo material o partida',
      cantidad: 1,
      unidad: 'ud',
      precioCoste: 0,
      precioVenta: 0,
      ivaPorcentaje: 21,
    };
    setPartidas(prev => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof KitItem, val: any) => {
    setPartidas(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setPartidas(prev => prev.filter(item => item.id !== id));
  };

  // Calculations
  const precioCosteTotal = partidas.reduce((acc, p) => acc + (Number(p.cantidad) || 0) * (Number(p.precioCoste) || 0), 0);
  const precioVentaTotal = partidas.reduce((acc, p) => acc + (Number(p.cantidad) || 0) * (Number(p.precioVenta) || 0), 0);
  const beneficioNeto = precioVentaTotal - precioCosteTotal;
  // Margen sobre el coste, el mismo criterio que en materiales y en los presupuestos
  const margenPorcentaje = margenDe(precioCosteTotal, precioVentaTotal);

  // Fija el precio de venta de todas las líneas aplicando el mismo margen sobre su coste
  const aplicarMargen = (pct: number) => setPartidas((prev) => prev.map((p) => ({ ...p, precioVenta: ventaConMargen(Number(p.precioCoste) || 0, pct) })));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      alert('Por favor introduce un nombre para el Kit.');
      return;
    }
    if (partidas.length === 0) {
      alert('Debes incluir al menos un material o partida dentro del Kit.');
      return;
    }

    const newKit: Kit = {
      id: kitToEdit?.id || `kit-${Date.now()}`,
      nombre: nombre.trim(),
      codigo: codigo.trim() || `KIT-${Math.floor(100 + Math.random() * 900)}`,
      categoria,
      descripcion: descripcion.trim(),
      partidas,
      precioCosteTotal: Math.round(precioCosteTotal * 100) / 100,
      precioVentaTotal: Math.round(precioVentaTotal * 100) / 100,
      margenPorcentaje,
      fechaCreacion: kitToEdit?.fechaCreacion || new Date().toISOString().split('T')[0],
      activo: true,
    };

    onSave(newKit);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-tight">
                {kitToEdit ? 'Editar Kit de Instalación' : 'Crear Nuevo Kit de Instalación'}
              </h3>
              <p className="text-xs text-slate-400">
                Agrupa materiales y mano de obra con su coste interno y su precio de venta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* GENERAL INFO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre Comercial del Kit *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Kit Completo Wallbox Pulsar Plus 7.4kW + Protecciones"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Código / SKU del Kit
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="KIT-001"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Categoría de Obra
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
              >
                {(categorias.length ? categorias : ['General']).map((c) => <option key={c} value={c}>{c}</option>)}
                {categoria && !categorias.includes(categoria) && <option value={categoria}>{categoria}</option>}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Descripción para Memoria Técnica / Presupuesto
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Suministro, montaje, protecciones ITC-BT-52 y puesta en servicio completa..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* PARTIDAS / MATERIALS IN KIT */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <Boxes size={18} className="text-blue-600" />
                  Desglose de Partidas y Materiales en el Kit ({partidas.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Establece coste de compra y precio de venta para calcular la rentabilidad asegurada
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus size={14} /> Partida Manual
                </button>
              </div>
            </div>

            {/* QUICK ADD FROM CATALOG */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <span className="text-xs font-bold text-slate-600 shrink-0">Añadir desde Catálogo:</span>
              <select
                value={selectedCatalogId}
                onChange={(e) => setSelectedCatalogId(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
              >
                <option value="">-- Seleccionar material del catálogo para añadir al Kit --</option>
                {catalogItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.concepto} ({formatCurrency(item.precioUnitario)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddFromCatalog}
                disabled={!selectedCatalogId}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Añadir al Kit
              </button>
            </div>

            {/* LIST OF KIT ITEMS */}
            {partidas.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                No hay partidas en este kit todavía. Añade componentes desde el catálogo o de forma manual.
              </div>
            ) : (
              <div className="space-y-2.5">
                {partidas.map((item) => {
                  const subCost = (Number(item.cantidad) || 0) * (Number(item.precioCoste) || 0);
                  const subVenta = (Number(item.cantidad) || 0) * (Number(item.precioVenta) || 0);
                  const subMargin = subVenta > 0 ? Math.round(((subVenta - subCost) / subVenta) * 100) : 0;

                  return (
                    <div 
                      key={item.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.concepto}
                          onChange={(e) => handleUpdateItem(item.id, 'concepto', e.target.value)}
                          className="w-full font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden py-0.5"
                          placeholder="Concepto o descripción del componente..."
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Cant:</span>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={item.cantidad}
                            onChange={(e) => handleUpdateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold"
                          />
                          <input
                            type="text"
                            value={item.unidad}
                            onChange={(e) => handleUpdateItem(item.id, 'unidad', e.target.value)}
                            className="w-10 border border-slate-200 rounded-lg px-1 py-1 text-center text-slate-500 uppercase text-[10px]"
                            placeholder="ud"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Coste Ud:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.precioCoste}
                            onChange={(e) => handleUpdateItem(item.id, 'precioCoste', parseFloat(e.target.value) || 0)}
                            className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-right font-mono font-bold text-slate-700"
                          />
                          <span className="text-[10px] text-slate-400">€</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">PVP Ud:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.precioVenta}
                            onChange={(e) => handleUpdateItem(item.id, 'precioVenta', parseFloat(e.target.value) || 0)}
                            className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-right font-mono font-bold text-blue-600"
                          />
                          <span className="text-[10px] text-slate-400">€</span>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            subMargin >= 35 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {subMargin}% Margen
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FINANCIAL SUMMARY OF THE KIT */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Coste de Compra Kit</p>
              <p className="text-lg font-black text-rose-300 font-mono mt-0.5">
                {formatCurrency(precioCosteTotal)}
              </p>
              <span className="text-[9px] text-slate-400">Gasto interno directo</span>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">PVP de Venta Kit</p>
              <p className="text-lg font-black text-blue-400 font-mono mt-0.5">
                {formatCurrency(precioVentaTotal)}
              </p>
              <span className="text-[9px] text-slate-400">Base antes de IVA</span>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Beneficio Neto</p>
              <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                {formatCurrency(beneficioNeto)}
              </p>
              <span className="text-[9px] text-slate-400">Ganancia por kit vendido</span>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Margen sobre coste</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-lg font-black font-mono ${
                  margenPorcentaje >= 35 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {margenPorcentaje}%
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {margenPorcentaje >= 35 ? 'Bien' : margenPorcentaje >= 20 ? 'Ajustado' : 'Bajo'}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                <span className="text-[9px] text-slate-500 mr-0.5">Aplicar a todo el kit:</span>
                {[30, 40, 50, 60, 80].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => aplicarMargen(p)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer border hover:bg-slate-800 ${p === margenObjetivo ? 'border-emerald-500 text-emerald-300' : 'border-slate-700 text-slate-400'}`}
                    title={p === margenObjetivo ? 'Tu margen objetivo' : `Recalcular el precio de venta con un ${p} % sobre el coste`}
                  >
                    {p} %
                  </button>
                ))}
              </div>
              <span className="text-[9px] text-slate-400">Sobre el coste. Puedes seguir poniendo el precio a mano en cada línea.</span>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 size={16} />
              {kitToEdit ? 'Guardar Cambios del Kit' : 'Crear y Guardar Kit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
