import React, { useState } from 'react';
import { PackagePlus, Info } from 'lucide-react';
import { Kit, CatalogItem, CatalogCategory } from '../types';
import { KitsListView } from './KitsListView';
import { KitBuilderModal } from './KitBuilderModal';

interface Props {
  kits: Kit[];
  catalogItems: CatalogItem[];
  catalogCategories: CatalogCategory[];
  onSaveKit: (kit: Kit) => void;
  onDeleteKit: (id: string) => void;
  onDuplicateKit: (kit: Kit) => void;
  onUsarEnPresupuesto?: (kit: Kit) => void;
}

export const KitsView: React.FC<Props> = ({ kits, catalogItems, catalogCategories, onSaveKit, onDeleteKit, onDuplicateKit, onUsarEnPresupuesto }) => {
  const [showBuilder, setShowBuilder] = useState(false);
  const [kitToEdit, setKitToEdit] = useState<Kit | null>(null);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><PackagePlus className="text-blue-600" size={28} /> Kits de instalación</h1>
          <p className="text-slate-500 text-sm mt-1">Un kit agrupa varios materiales y mano de obra con su coste y su precio de venta. Al insertarlo en un presupuesto entra como una sola partida con su escandallo.</p>
        </div>
      </div>

      <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
        <span>Los costes de los kits son internos y nunca salen en el presupuesto ni en la factura. En cada presupuesto puedes decidir qué materiales del kit ve el cliente (solo nombre y cantidad).</span>
      </div>

      <KitsListView
        kits={kits}
        onOpenCreateKit={() => { setKitToEdit(null); setShowBuilder(true); }}
        onEditKit={(k) => { setKitToEdit(k); setShowBuilder(true); }}
        onDeleteKit={onDeleteKit}
        onDuplicateKit={onDuplicateKit}
        onInsertKitToProject={onUsarEnPresupuesto}
      />

      <KitBuilderModal isOpen={showBuilder} kitToEdit={kitToEdit} catalogItems={catalogItems} categorias={catalogCategories.map((c) => c.nombre)} onSave={onSaveKit} onClose={() => setShowBuilder(false)} />
    </div>
  );
};
