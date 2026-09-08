// Pantalla única del catálogo, con dos mundos bien separados:
// MATERIALES son artículos sueltos que compras. KITS agrupan materiales más mano de obra
// y otros trabajos, y son lo que se mete como partida en un presupuesto.
import React, { useState } from 'react';
import { Boxes, PackagePlus, Info } from 'lucide-react';
import { CatalogCategory, CatalogItem, Kit, CompanySettings, Expense } from '../types';
import { MaterialsView } from './MaterialsView';
import { KitsView } from './KitsView';

interface Props {
  categories: CatalogCategory[];
  items: CatalogItem[];
  kits: Kit[];
  expenses: Expense[];
  companySettings: CompanySettings;
  onAddItem: (item: Omit<CatalogItem, 'id'>) => void;
  onUpdateItem: (id: string, campos: Partial<CatalogItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddCategory: (c: Omit<CatalogCategory, 'id'>) => void;
  onPropagarCoste: (materialId: string, nuevoCoste: number, idsKits: string[]) => void;
  onVaciarCatalogo?: () => void;
  onRestaurarCatalogo?: () => void;
  onSaveKit: (kit: Kit) => void;
  onDeleteKit: (id: string) => void;
  onDuplicateKit: (kit: Kit) => void;
  onUsarEnPresupuesto?: (kit: Kit) => void;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

export const MaterialsAndKitsView: React.FC<Props> = (props) => {
  const { categories, items, kits, expenses, companySettings, onAddItem, onUpdateItem, onDeleteItem, onAddCategory, onPropagarCoste, onVaciarCatalogo, onRestaurarCatalogo, onSaveKit, onDeleteKit, onDuplicateKit, onUsarEnPresupuesto, onAviso } = props;
  const [solapa, setSolapa] = useState<'materiales' | 'kits'>('materiales');

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">{solapa === 'materiales' ? <><Boxes className="text-blue-600" size={28} /> Materiales</> : <><PackagePlus className="text-purple-600" size={28} /> Kits</>}</h1>
          <p className="text-slate-500 text-sm mt-1">{solapa === 'materiales' ? 'Artículos sueltos que compras, con su precio de compra y su proveedor. Uno por línea.' : 'Agrupaciones de materiales más mano de obra y otros trabajos. Es lo que insertas como partida en un presupuesto.'}</p>
        </div>
        <div className="flex bg-slate-100/90 p-1.5 rounded-2xl shrink-0">
          {([['materiales', `Materiales (${items.length})`, Boxes], ['kits', `Kits (${kits.length})`, PackagePlus]] as const).map(([id, label, Icono]) => (
            <button key={id} onClick={() => setSolapa(id)} className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 ${solapa === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icono size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`p-4 rounded-2xl text-xs flex items-start gap-2 border ${solapa === 'materiales' ? 'bg-blue-50/70 border-blue-100 text-blue-900' : 'bg-purple-50/70 border-purple-100 text-purple-900'}`}>
        <Info size={16} className="shrink-0 mt-0.5" />
        <span>{solapa === 'materiales'
          ? 'Aquí va solo material: cable, tubo, cargador, protecciones… con lo que te cuesta a ti. Ese precio de compra es interno y nunca sale en un presupuesto ni en una factura.'
          : 'Un kit toma materiales del catálogo y les suma la mano de obra y los trabajos. Si cambias el precio de un material, la app te preguntará a qué kits se lo aplicas.'}</span>
      </div>

      {solapa === 'materiales'
        ? <MaterialsView items={items} categories={categories} kits={kits} expenses={expenses} companySettings={companySettings} onAddItem={onAddItem} onUpdateItem={onUpdateItem} onDeleteItem={onDeleteItem} onAddCategory={onAddCategory} onPropagarCoste={onPropagarCoste} onVaciarCatalogo={onVaciarCatalogo} onRestaurarCatalogo={onRestaurarCatalogo} onIrAKits={() => setSolapa('kits')} onAviso={onAviso} />
        : <KitsView kits={kits} catalogItems={items} catalogCategories={categories} companySettings={companySettings} onSaveKit={onSaveKit} onDeleteKit={onDeleteKit} onDuplicateKit={onDuplicateKit} onUsarEnPresupuesto={onUsarEnPresupuesto} embebido />}
    </div>
  );
};
