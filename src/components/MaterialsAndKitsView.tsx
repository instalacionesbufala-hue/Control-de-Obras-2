// Pantalla única para el catálogo: los materiales son artículos sueltos y los kits agrupan
// varios materiales más mano de obra y otros conceptos. Antes eran dos entradas de menú.
import React, { useState } from 'react';
import { Boxes, PackagePlus, Info } from 'lucide-react';
import { CatalogCategory, CatalogItem, Kit } from '../types';
import { CatalogView } from './CatalogView';
import { KitsView } from './KitsView';

interface Props {
  categories: CatalogCategory[];
  items: CatalogItem[];
  kits: Kit[];
  onAddItem: (item: Omit<CatalogItem, 'id'>) => void;
  onUpdateItem: (id: string, campos: Partial<CatalogItem>) => void;
  onDeleteItem: (id: string) => void;
  onClearAllItems?: () => void;
  onAddCategory: (c: Omit<CatalogCategory, 'id'>) => void;
  onUpdateCategory: (id: string, campos: Partial<CatalogCategory>) => void;
  onDeleteCategory: (id: string) => void;
  onResetToDefaults: () => void;
  onSaveKit: (kit: Kit) => void;
  onDeleteKit: (id: string) => void;
  onDuplicateKit: (kit: Kit) => void;
  onUsarEnPresupuesto?: (kit: Kit) => void;
}

export const MaterialsAndKitsView: React.FC<Props> = (props) => {
  const { categories, items, kits, onSaveKit, onDeleteKit, onDuplicateKit, onUsarEnPresupuesto, ...catalogo } = props;
  const [solapa, setSolapa] = useState<'materiales' | 'kits'>('materiales');

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Boxes className="text-blue-600" size={28} /> Materiales y kits</h1>
          <p className="text-slate-500 text-sm mt-1">Los materiales son artículos sueltos con su coste. Los kits agrupan varios materiales más mano de obra y otros conceptos, y entran en el presupuesto como una sola partida.</p>
        </div>
        <div className="flex bg-slate-100/90 p-1.5 rounded-2xl shrink-0">
          {([['materiales', `Materiales (${items.length})`, Boxes], ['kits', `Kits (${kits.length})`, PackagePlus]] as const).map(([id, label, Icono]) => (
            <button key={id} onClick={() => setSolapa(id)} className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${solapa === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icono size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
        <span>El coste interno nunca sale en el presupuesto ni en la factura. En cada presupuesto eliges qué materiales ve el cliente, con su nombre y cantidad, nunca con su precio de compra.</span>
      </div>

      {solapa === 'materiales'
        ? <CatalogView {...catalogo} categories={categories} items={items} embebido />
        : <KitsView kits={kits} catalogItems={items} catalogCategories={categories} onSaveKit={onSaveKit} onDeleteKit={onDeleteKit} onDuplicateKit={onDuplicateKit} onUsarEnPresupuesto={onUsarEnPresupuesto} embebido />}
    </div>
  );
};
