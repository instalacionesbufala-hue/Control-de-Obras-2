import React, { useState } from 'react';
import { 
  Boxes, Plus, Search, Filter, Trash2, Edit3, Copy, Tag, 
  Layers, Check, Sparkles, FolderPlus, ArrowUpDown, 
  HelpCircle, RefreshCw, X, AlertCircle, Euro, ShieldCheck,
  Building2, Hash, FileText, CheckCircle2, Lock, Eye, Calculator,
  TrendingUp, Percent, Info
} from 'lucide-react';
import { CatalogItem, CatalogCategory, MaterialCostComponent } from '../types';
import { formatCurrency } from '../utils/formatters';

interface CatalogViewProps {
  categories: CatalogCategory[];
  items: CatalogItem[];
  onAddItem: (item: Omit<CatalogItem, 'id'>) => void;
  onUpdateItem: (id: string, updatedData: Partial<CatalogItem>) => void;
  onDeleteItem: (id: string) => void;
  onClearAllItems?: () => void;
  onAddCategory: (category: Omit<CatalogCategory, 'id'>) => void;
  onUpdateCategory: (id: string, updatedData: Partial<CatalogCategory>) => void;
  onDeleteCategory: (id: string) => void;
  onResetToDefaults: () => void;
  embebido?: boolean; // dentro de "Materiales y kits": la cabecera la pone el contenedor
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  embebido = false,
  categories,
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onClearAllItems,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onResetToDefaults,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('todas');
  const [sortBy, setSortBy] = useState<'concepto' | 'precio-asc' | 'precio-desc' | 'categoria' | 'margen'>('categoria');

  // Modals state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [showMaterialsModal, setShowMaterialsModal] = useState<CatalogItem | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CatalogCategory | null>(null);
  const [formCatNombre, setFormCatNombre] = useState('');
  const [formCatDescripcion, setFormCatDescripcion] = useState('');

  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<CatalogCategory | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Form State for Item (Add / Edit)
  const [formConcepto, setFormConcepto] = useState('');
  const [formCategoriaId, setFormCategoriaId] = useState(categories[0]?.id || '');
  const [formUnidad, setFormUnidad] = useState('ud');
  const [formPrecioUnitario, setFormPrecioUnitario] = useState<number>(0);
  const [formIvaPorcentaje, setFormIvaPorcentaje] = useState<number>(21);
  const [formReferenciaSku, setFormReferenciaSku] = useState('');
  const [formProveedorHabitual, setFormProveedorHabitual] = useState('');
  const [formDescripcionDetallada, setFormDescripcionDetallada] = useState('');
  
  // Internal Materials & Margin state
  const [formMateriales, setFormMateriales] = useState<MaterialCostComponent[]>([]);
  const [formMargenPorcentaje, setFormMargenPorcentaje] = useState<number>(40);

  // Helper to calculate total internal cost from materials list
  const calcTotalInternalCost = (materials: MaterialCostComponent[]) => {
    return materials.reduce((acc, m) => acc + (Number(m.cantidad) || 0) * (Number(m.costeUnitario) || 0), 0);
  };

  // Open Add Item Modal
  const handleOpenAddItem = () => {
    setEditingItem(null);
    setFormConcepto('');
    setFormCategoriaId(categories[0]?.id || '');
    setFormUnidad('ud');
    setFormPrecioUnitario(0);
    setFormIvaPorcentaje(21);
    setFormReferenciaSku('');
    setFormProveedorHabitual('');
    setFormDescripcionDetallada('');
    setFormMateriales([
      {
        id: `mat-c-${Date.now()}`,
        nombre: 'Material o equipo principal',
        cantidad: 1,
        unidad: 'ud',
        costeUnitario: 0,
        totalCoste: 0,
        proveedor: 'Distribuidor Eléctrico',
      },
    ]);
    setFormMargenPorcentaje(40);
    setShowItemModal(true);
  };

  // Open Edit Item Modal
  const handleOpenEditItem = (item: CatalogItem) => {
    setEditingItem(item);
    setFormConcepto(item.concepto);
    setFormCategoriaId(item.categoriaId);
    setFormUnidad(item.unidad);
    setFormPrecioUnitario(item.precioUnitario);
    setFormIvaPorcentaje(item.ivaPorcentaje);
    setFormReferenciaSku(item.referenciaSku || '');
    setFormProveedorHabitual(item.proveedorHabitual || '');
    setFormDescripcionDetallada(item.descripcionDetallada || '');
    
    // Set materials or generate default item if empty
    if (item.materiales && item.materiales.length > 0) {
      setFormMateriales(item.materiales);
    } else {
      const defaultCost = item.costeInternoTotal || (item.precioUnitario > 0 ? Number((item.precioUnitario * 0.6).toFixed(2)) : 0);
      setFormMateriales([
        {
          id: `mat-c-${Date.now()}`,
          nombre: `Material base (${item.concepto})`,
          cantidad: 1,
          unidad: item.unidad || 'ud',
          costeUnitario: defaultCost,
          totalCoste: defaultCost,
          proveedor: item.proveedorHabitual || 'Distribuidor',
        },
      ]);
    }

    setFormMargenPorcentaje(
      item.margenPorcentaje !== undefined 
        ? item.margenPorcentaje 
        : (item.costeInternoTotal && item.costeInternoTotal > 0 
            ? Number((((item.precioUnitario - item.costeInternoTotal) / item.costeInternoTotal) * 100).toFixed(2))
            : 40)
    );

    setShowItemModal(true);
  };

  // Materials row handlers in Form
  const handleAddMaterialRow = () => {
    const newMat: MaterialCostComponent = {
      id: `mat-c-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      nombre: '',
      cantidad: 1,
      unidad: 'ud',
      costeUnitario: 0,
      totalCoste: 0,
      proveedor: '',
    };
    setFormMateriales([...formMateriales, newMat]);
  };

  const handleUpdateMaterialRow = (id: string, field: keyof MaterialCostComponent, val: any) => {
    const updated = formMateriales.map((m) => {
      if (m.id !== id) return m;
      const modified = { ...m, [field]: val };
      if (field === 'cantidad' || field === 'costeUnitario') {
        const qty = field === 'cantidad' ? Number(val) : Number(m.cantidad);
        const cost = field === 'costeUnitario' ? Number(val) : Number(m.costeUnitario);
        modified.totalCoste = Number((qty * cost).toFixed(2));
      }
      return modified;
    });
    setFormMateriales(updated);

    // Auto-update selling price based on current margin percentage if desired
    const totalCost = calcTotalInternalCost(updated);
    if (totalCost > 0 && formMargenPorcentaje > 0) {
      const calculatedPVP = Number((totalCost * (1 + formMargenPorcentaje / 100)).toFixed(2));
      setFormPrecioUnitario(calculatedPVP);
    }
  };

  const handleRemoveMaterialRow = (id: string) => {
    if (formMateriales.length > 1) {
      const updated = formMateriales.filter((m) => m.id !== id);
      setFormMateriales(updated);
      const totalCost = calcTotalInternalCost(updated);
      if (totalCost > 0 && formMargenPorcentaje > 0) {
        setFormPrecioUnitario(Number((totalCost * (1 + formMargenPorcentaje / 100)).toFixed(2)));
      }
    }
  };

  const handleMarginChange = (newMargin: number) => {
    setFormMargenPorcentaje(newMargin);
    const totalCost = calcTotalInternalCost(formMateriales);
    if (totalCost > 0) {
      const newPvp = Number((totalCost * (1 + newMargin / 100)).toFixed(2));
      setFormPrecioUnitario(newPvp);
    }
  };

  const handlePvpChange = (newPvp: number) => {
    setFormPrecioUnitario(newPvp);
    const totalCost = calcTotalInternalCost(formMateriales);
    if (totalCost > 0) {
      const computedMargin = Number((((newPvp - totalCost) / totalCost) * 100).toFixed(2));
      setFormMargenPorcentaje(computedMargin);
    }
  };

  // Duplicate Item
  const handleDuplicateItem = (item: CatalogItem) => {
    const category = categories.find((c) => c.id === item.categoriaId);
    onAddItem({
      concepto: `${item.concepto} (Copia)`,
      categoriaId: item.categoriaId,
      categoriaNombre: category ? category.nombre : item.categoriaNombre,
      unidad: item.unidad,
      costeInternoTotal: item.costeInternoTotal,
      margenPorcentaje: item.margenPorcentaje,
      precioUnitario: item.precioUnitario,
      ivaPorcentaje: item.ivaPorcentaje,
      referenciaSku: item.referenciaSku ? `${item.referenciaSku}-CP` : undefined,
      proveedorHabitual: item.proveedorHabitual,
      descripcionDetallada: item.descripcionDetallada,
      materiales: item.materiales ? JSON.parse(JSON.stringify(item.materiales)) : undefined,
    });
  };

  // Submit Item Form
  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formConcepto.trim()) return;

    const category = categories.find((c) => c.id === formCategoriaId);
    const catName = category ? category.nombre : 'General';
    const costeInternoTotal = calcTotalInternalCost(formMateriales);

    if (editingItem) {
      onUpdateItem(editingItem.id, {
        concepto: formConcepto.trim(),
        categoriaId: formCategoriaId,
        categoriaNombre: catName,
        unidad: formUnidad,
        costeInternoTotal,
        margenPorcentaje: formMargenPorcentaje,
        precioUnitario: Number(formPrecioUnitario) || 0,
        ivaPorcentaje: Number(formIvaPorcentaje) || 21,
        referenciaSku: formReferenciaSku.trim() || undefined,
        proveedorHabitual: formProveedorHabitual.trim() || undefined,
        descripcionDetallada: formDescripcionDetallada.trim() || undefined,
        materiales: formMateriales,
      });
    } else {
      onAddItem({
        concepto: formConcepto.trim(),
        categoriaId: formCategoriaId,
        categoriaNombre: catName,
        unidad: formUnidad,
        costeInternoTotal,
        margenPorcentaje: formMargenPorcentaje,
        precioUnitario: Number(formPrecioUnitario) || 0,
        ivaPorcentaje: Number(formIvaPorcentaje) || 21,
        referenciaSku: formReferenciaSku.trim() || undefined,
        proveedorHabitual: formProveedorHabitual.trim() || undefined,
        descripcionDetallada: formDescripcionDetallada.trim() || undefined,
        materiales: formMateriales,
      });
    }
    setShowItemModal(false);
  };

  // Open Add Category Modal
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setFormCatNombre('');
    setFormCatDescripcion('');
    setShowCategoryModal(true);
  };

  // Open Edit Category Modal
  const handleOpenEditCategory = (cat: CatalogCategory) => {
    setEditingCategory(cat);
    setFormCatNombre(cat.nombre);
    setFormCatDescripcion(cat.descripcion);
    setShowCategoryModal(true);
  };

  // Submit Category Form
  const handleSubmitCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCatNombre.trim()) return;

    if (editingCategory) {
      onUpdateCategory(editingCategory.id, {
        nombre: formCatNombre.trim(),
        descripcion: formCatDescripcion.trim(),
      });
    } else {
      onAddCategory({
        nombre: formCatNombre.trim(),
        descripcion: formCatDescripcion.trim(),
      });
    }
    setShowCategoryModal(false);
  };

  // Filter & Search Items
  const filteredItems = items
    .filter((item) => {
      const matchesSearch =
        item.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.referenciaSku && item.referenciaSku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.proveedorHabitual && item.proveedorHabitual.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.descripcionDetallada && item.descripcionDetallada.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        selectedCategoryFilter === 'todas' || item.categoriaId === selectedCategoryFilter;

      return matchesSearch && matchesCat;
    })
    .sort((a, b) => {
      if (sortBy === 'concepto') return a.concepto.localeCompare(b.concepto);
      if (sortBy === 'precio-asc') return a.precioUnitario - b.precioUnitario;
      if (sortBy === 'precio-desc') return b.precioUnitario - a.precioUnitario;
      if (sortBy === 'margen') return (b.margenPorcentaje || 0) - (a.margenPorcentaje || 0);
      return a.categoriaNombre.localeCompare(b.categoriaNombre);
    });

  // Calculate catalog stats
  const totalItemsCount = items.length;
  const avgMargin = Math.round(
    items.reduce((acc, it) => acc + (it.margenPorcentaje || 50), 0) / (items.length || 1)
  );
  const totalCostInventory = items.reduce((acc, it) => acc + (it.costeInternoTotal || it.precioUnitario * 0.6), 0);

  return (
    <div className={embebido ? "space-y-6" : "p-6 md:p-8 space-y-6 max-w-7xl mx-auto"}>
      {/* ======================================================== */}
      {/* HEADER WITH ACTIONS */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={embebido ? "hidden" : undefined}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              Base de Datos Técnica & Escandallos de Obras
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 mt-1">
            <Boxes className="text-blue-600" size={28} /> Materiales & Conceptos
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-0.5">
            Conceptos con su escandallo de materiales y mano de obra. El coste interno nunca sale en presupuestos ni facturas; en cada presupuesto eliges qué materiales ve el cliente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {items.length > 0 && (
            <button
              onClick={() => setShowClearAllModal(true)}
              className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2.5 rounded-2xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Eliminar todos los materiales predeterminados para dejar el catálogo virgen"
            >
              <Trash2 size={14} className="text-rose-600" />
              <span>Vaciar Catálogo</span>
            </button>
          )}

          <button
            onClick={() => setShowResetConfirmModal(true)}
            className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-2xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Restaurar catálogo inicial predeterminado"
          >
            <RefreshCw size={14} className="text-slate-500" />
            <span>Restaurar</span>
          </button>

          <button
            onClick={handleOpenAddCategory}
            className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-2xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FolderPlus size={15} className="text-slate-500" />
            <span>Nueva Categoría</span>
          </button>

          <button
            onClick={handleOpenAddItem}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>Nuevo Material / Concepto</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* KPI METRICS CARDS */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Boxes size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Conceptos</p>
            <p className="text-lg font-black text-slate-900">{totalItemsCount} Partidas</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Categorías ITC-BT-52</p>
            <p className="text-lg font-black text-slate-900">{categories.length} Grupos</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Margen Medio Comercial</p>
            <p className="text-lg font-black text-emerald-600">+{avgMargin}% sobre coste</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Lock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Privacidad de Costes</p>
            <p className="text-xs font-bold text-amber-700">Materiales Ocultos en Ofertas</p>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CATEGORIES PILLS FILTER */}
      {/* ======================================================== */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Filter size={13} /> Filtrar por Categoría Técnica
          </span>
          <span className="text-xs font-bold text-slate-500">
            {filteredItems.length} de {items.length} partidas mostradas
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategoryFilter('todas')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedCategoryFilter === 'todas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>Todas las Categorías</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategoryFilter === 'todas' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'}`}>
              {items.length}
            </span>
          </button>

          {categories.map((cat) => {
            const count = items.filter((it) => it.categoriaId === cat.id).length;
            const isSelected = selectedCategoryFilter === cat.id;

            return (
              <div key={cat.id} className="flex items-center shrink-0">
                <button
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  className={`px-3.5 py-2 rounded-l-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{cat.nombre}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-800 text-white' : 'bg-white text-slate-600'}`}>
                    {count}
                  </span>
                </button>
                <div className={`flex items-center pr-1.5 rounded-r-xl border-l ${
                  isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  <button
                    title="Editar categoría"
                    onClick={() => handleOpenEditCategory(cat)}
                    className="p-1.5 hover:text-white rounded-md cursor-pointer transition-colors"
                  >
                    <Edit3 size={13} />
                  </button>
                  {categories.length > 1 && (
                    <button
                      title="Eliminar categoría"
                      onClick={() => setCategoryToDelete(cat)}
                      className="p-1.5 hover:text-red-300 rounded-md cursor-pointer transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SEARCH, FILTERS & CONTROLS */}
      {/* ======================================================== */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar concepto, material interno, SKU, proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort and View Toggle */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={14} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="categoria">Ordenar por Categoría</option>
              <option value="concepto">Ordenar por Concepto (A-Z)</option>
              <option value="margen">Mayor Margen Comercial (%)</option>
              <option value="precio-asc">PVP: Menor a Mayor</option>
              <option value="precio-desc">PVP: Mayor a Menor</option>
            </select>
          </div>

          <button
            onClick={() => setShowResetConfirmModal(true)}
            title="Restaurar catálogo inicial"
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ITEMS LISTING TABLE WITH INTERNAL COSTS & MARGINS */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Boxes size={28} />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">No se encontraron materiales o conceptos</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Prueba a cambiar el texto de búsqueda o añade un nuevo concepto haciendo clic en "Nuevo Material / Concepto".
            </p>
            <button
              onClick={handleOpenAddItem}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>Añadir Primer Concepto</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Concepto Visible al Cliente</th>
                  <th className="py-3.5 px-3">Categoría</th>
                  <th className="py-3.5 px-3 text-center">Unidad</th>
                  <th className="py-3.5 px-3 text-right bg-amber-50/40 border-l border-amber-100">
                    <span className="flex items-center justify-end gap-1 text-amber-800 font-black">
                      <Lock size={11} /> Coste Interno
                    </span>
                  </th>
                  <th className="py-3.5 px-3 text-right bg-amber-50/40">
                    <span className="text-amber-800 font-black">% Margen</span>
                  </th>
                  <th className="py-3.5 px-3 text-right">PVP Base (Cliente)</th>
                  <th className="py-3.5 px-4 text-right">PVP con IVA</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const pvpConIva = item.precioUnitario * (1 + item.ivaPorcentaje / 100);
                  const coste = item.costeInternoTotal || (item.materiales ? calcTotalInternalCost(item.materiales) : 0);
                  const margen = item.margenPorcentaje !== undefined 
                    ? item.margenPorcentaje 
                    : (coste > 0 ? ((item.precioUnitario - coste) / coste) * 100 : 0);
                  const beneficio = item.precioUnitario - coste;
                  const materialsCount = item.materiales?.length || 0;

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                      {/* CONCEPTO & DESCRIPCION */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-sm">
                          <p className="font-black text-slate-900 text-xs leading-snug">{item.concepto}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            {item.referenciaSku && (
                              <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                {item.referenciaSku}
                              </span>
                            )}
                            {item.proveedorHabitual && <span>{item.proveedorHabitual}</span>}
                          </div>
                          {materialsCount > 0 && (
                            <button
                              onClick={() => setShowMaterialsModal(item)}
                              className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-200/70 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1 cursor-pointer transition-colors"
                            >
                              <Lock size={10} /> {materialsCount} material{materialsCount > 1 ? 'es' : ''} asignado{materialsCount > 1 ? 's' : ''} (Ver escandallo)
                            </button>
                          )}
                        </div>
                      </td>

                      {/* CATEGORIA */}
                      <td className="py-3.5 px-3">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200/80">
                          {item.categoriaNombre}
                        </span>
                      </td>

                      {/* UNIDAD */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-block font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {item.unidad}
                        </span>
                      </td>

                      {/* COSTE INTERNO TOTAL (COMPRA) */}
                      <td className="py-3.5 px-3 text-right font-bold text-amber-900 bg-amber-50/30 border-l border-amber-100/80 text-xs">
                        <div className="space-y-0.5">
                          <span>{formatCurrency(coste)}</span>
                          <p className="text-[10px] text-amber-600 font-medium">Coste compra</p>
                        </div>
                      </td>

                      {/* % MARGEN Y BENEFICIO */}
                      <td className="py-3.5 px-3 text-right bg-amber-50/30 text-xs">
                        <div className="space-y-0.5">
                          <span className={`font-black ${margen >= 50 ? 'text-emerald-700' : 'text-slate-800'}`}>
                            +{Math.round(margen)}%
                          </span>
                          <p className="text-[10px] text-emerald-600 font-bold">
                            +{formatCurrency(beneficio)}
                          </p>
                        </div>
                      </td>

                      {/* PRECIO BASE (VENTA AL CLIENTE) */}
                      <td className="py-3.5 px-3 text-right font-bold text-slate-900 text-xs">
                        {formatCurrency(item.precioUnitario)}
                      </td>

                      {/* PVP CON IVA */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-blue-700 text-xs">
                          {formatCurrency(pvpConIva)}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium">con {item.ivaPorcentaje}% IVA</p>
                      </td>

                      {/* ACCIONES */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                          <button
                            title="Duplicar partida"
                            onClick={() => handleDuplicateItem(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            title="Modificar partida & materiales internos"
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100/60 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            title="Eliminar partida"
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: VER ESCANDALLO DE MATERIALES DE UN CONCEPTO */}
      {/* ======================================================== */}
      {showMaterialsModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="font-black text-base">Escandallo Interno & Costes</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{showMaterialsModal.concepto}</p>
                </div>
              </div>
              <button onClick={() => setShowMaterialsModal(null)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex items-start gap-2.5">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Escandallo interno:</strong> Este desglose de costes y materiales es solo para calcular el margen comercial. En los presupuestos y facturas emitidas al cliente solo aparecerá el concepto final.
                </p>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                <div className="p-3 bg-slate-100/80 font-bold text-slate-600 grid grid-cols-12 text-[11px]">
                  <div className="col-span-6">Material / Gasto Interno</div>
                  <div className="col-span-2 text-center">Cant.</div>
                  <div className="col-span-2 text-right">Coste U.</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {(showMaterialsModal.materiales || []).map((m, idx) => (
                  <div key={idx} className="p-3 grid grid-cols-12 items-center">
                    <div className="col-span-6 font-medium text-slate-800">
                      <p className="font-bold">{m.nombre}</p>
                      {m.proveedor && <span className="text-[10px] text-slate-400">{m.proveedor}</span>}
                    </div>
                    <div className="col-span-2 text-center font-bold text-slate-600">
                      {m.cantidad} {m.unidad}
                    </div>
                    <div className="col-span-2 text-right text-slate-600">
                      {formatCurrency(m.costeUnitario)}
                    </div>
                    <div className="col-span-2 text-right font-black text-amber-900">
                      {formatCurrency(m.totalCoste)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2">
                <div className="flex justify-between text-slate-300">
                  <span>Coste Interno Total de Materiales:</span>
                  <span className="font-bold">{formatCurrency(showMaterialsModal.costeInternoTotal || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Margen Comercial Aplicado:</span>
                  <span className="font-bold text-emerald-400">+{Math.round(showMaterialsModal.margenPorcentaje || 0)}% (+{formatCurrency(showMaterialsModal.precioUnitario - (showMaterialsModal.costeInternoTotal || 0))})</span>
                </div>
                <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-slate-800">
                  <span>PVP de Venta al Cliente (Base):</span>
                  <span className="text-blue-400">{formatCurrency(showMaterialsModal.precioUnitario)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowMaterialsModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    const item = showMaterialsModal;
                    setShowMaterialsModal(null);
                    handleOpenEditItem(item);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Edit3 size={14} /> Editar Desglose
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT CATALOG ITEM WITH INTERNAL MATERIALS */}
      {/* ======================================================== */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-600 text-white">
                  <Boxes size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base">
                    {editingItem ? 'Modificar Material / Concepto' : 'Añadir Nuevo Material o Concepto'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Define el concepto visible y su desglose interno de costes de materiales
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowItemModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitItem} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* CONCEPTO & CATEGORIA */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nombre del Concepto Visible al Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Instalación de punto de recarga hasta 20m, Cargador Wallbox Pulsar..."
                    value={formConcepto}
                    onChange={(e) => setFormConcepto(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Categoría *</label>
                    <select
                      value={formCategoriaId}
                      onChange={(e) => setFormCategoriaId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Unidad *</label>
                    <select
                      value={formUnidad}
                      onChange={(e) => setFormUnidad(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                      <option value="ud">ud (Unidad)</option>
                      <option value="m">m (Metros)</option>
                      <option value="m²">m² (Metros²)</option>
                      <option value="h">h (Horas)</option>
                      <option value="pack">pack (Kit / Conjunto)</option>
                      <option value="partida">partida (Alzada)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Referencia SKU</label>
                    <input
                      type="text"
                      placeholder="Ej: WB-PULS-74"
                      value={formReferenciaSku}
                      onChange={(e) => setFormReferenciaSku(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* SECTION: DESGLOSE INTERNO DE MATERIALES & COSTES */}
              {/* ======================================================== */}
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                      <Lock size={14} />
                    </span>
                    <div>
                      <h4 className="font-black text-amber-950 text-xs">
                        Desglose Interno de Materiales & Costes de Compra
                      </h4>
                      <p className="text-[10px] text-amber-700">
                        Oculto para el cliente. Se utiliza exclusivamente para calcular el coste y margen real.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMaterialRow}
                    className="self-start sm:self-auto px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <Plus size={13} /> Añadir Material al Concepto
                  </button>
                </div>

                {/* MATERIALS ROWS */}
                <div className="space-y-2">
                  {formMateriales.map((m, idx) => (
                    <div key={m.id} className="p-2.5 bg-white rounded-xl border border-amber-200/70 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="Nombre material / componente..."
                          value={m.nombre}
                          onChange={(e) => handleUpdateMaterialRow(m.id, 'nombre', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          placeholder="Cant."
                          value={m.cantidad}
                          onChange={(e) => handleUpdateMaterialRow(m.id, 'cantidad', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            placeholder="Coste €"
                            value={m.costeUnitario || ''}
                            onChange={(e) => handleUpdateMaterialRow(m.id, 'costeUnitario', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg pl-2 pr-5 py-1.5 text-xs text-right font-bold text-amber-900"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">€</span>
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-black text-amber-900">
                        {formatCurrency(m.totalCoste)}
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterialRow(m.id)}
                          className="p-1 text-slate-300 hover:text-rose-600 rounded-md transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CALCULATION & MARGIN BAR */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/60">
                  <div className="p-2.5 bg-amber-100/60 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-amber-800 block">Coste Total Compra</span>
                    <span className="text-sm font-black text-amber-950">
                      {formatCurrency(calcTotalInternalCost(formMateriales))}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                    <span className="text-[10px] font-black uppercase text-slate-600 block">% Margen Comercial</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="number"
                        step="1"
                        value={formMargenPorcentaje}
                        onChange={(e) => handleMarginChange(Number(e.target.value))}
                        className="w-full font-black text-emerald-600 text-sm bg-transparent border-0 p-0 focus:outline-hidden"
                      />
                      <Percent size={13} className="text-emerald-600 shrink-0" />
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-black uppercase text-emerald-800 block">Beneficio Estimado</span>
                    <span className="text-sm font-black text-emerald-700">
                      +{formatCurrency(formPrecioUnitario - calcTotalInternalCost(formMateriales))}
                    </span>
                  </div>
                </div>
              </div>

              {/* PRECIO BASE DE VENTA & % IVA */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">PVP Base Cliente (€) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formPrecioUnitario || ''}
                      onChange={(e) => handlePvpChange(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-xs font-black text-slate-900 bg-white"
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">% IVA *</label>
                  <select
                    value={formIvaPorcentaje}
                    onChange={(e) => setFormIvaPorcentaje(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
                  >
                    <option value={21}>21% (General VE)</option>
                    <option value={10}>10% (Reducido)</option>
                    <option value={4}>4% (Superreducido)</option>
                    <option value={0}>0% (Exento)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-blue-900 mb-1">PVP con IVA Incluido</label>
                  <div className="w-full bg-blue-100/70 border border-blue-200 rounded-xl px-3 py-2 text-xs font-black text-blue-800 flex items-center justify-between">
                    <span>{formatCurrency(formPrecioUnitario * (1 + formIvaPorcentaje / 100))}</span>
                    <span className="text-[10px] text-blue-600 font-medium">IVA Inc.</span>
                  </div>
                </div>
              </div>

              {/* DESCRIPCIÓN DETALLADA */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Descripción Técnica y Pliego de Condiciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Especificaciones técnicas, certificados ITC-BT-52, material ignífugo..."
                  value={formDescripcionDetallada}
                  onChange={(e) => setFormDescripcionDetallada(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs resize-none"
                />
              </div>

              {/* BOTONES ACCIÓN */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={16} />
                  <span>{editingItem ? 'Guardar Cambios' : 'Añadir al Catálogo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT CATEGORY */}
      {/* ======================================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <FolderPlus size={18} className="text-blue-600" />
                <span>{editingCategory ? 'Modificar Categoría' : 'Nueva Categoría de Partidas'}</span>
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Nombre de la Categoría (con emoji) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 🔌 Cableado Especial, 🛡️ Protecciones..."
                  value={formCatNombre}
                  onChange={(e) => setFormCatNombre(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Descripción de la categoría de materiales..."
                  value={formCatDescripcion}
                  onChange={(e) => setFormCatDescripcion(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-xs cursor-pointer"
                >
                  {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ======================================================== */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-600">
              <Trash2 size={24} />
            </div>
            <h3 className="font-black text-slate-900 text-base">¿Eliminar Partida del Catálogo?</h3>
            <p className="text-xs text-slate-500">
              Vas a eliminar <strong>"{itemToDelete.concepto}"</strong>. Los presupuestos ya creados conservarán la partida intacta.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteItem(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RESTORE DEFAULTS CONFIRMATION */}
      {/* ======================================================== */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
              <RefreshCw size={24} />
            </div>
            <h3 className="font-black text-slate-900 text-base">¿Restaurar Catálogo Predeterminado?</h3>
            <p className="text-xs text-slate-500">
              Esta acción restablecerá todas las partidas homologadas de puntos de recarga VE y sus costes de materiales predeterminados.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onResetToDefaults();
                  setShowResetConfirmModal(false);
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CLEAR ALL CATALOG ITEMS CONFIRMATION */}
      {/* ======================================================== */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
              <Trash2 size={24} />
            </div>
            <h3 className="font-black text-slate-900 text-base">¿Borrar todos los ítems predeterminados?</h3>
            <p className="text-xs text-slate-500">
              Se eliminarán todos los materiales y partidas para dejar el catálogo virgen. Podrás añadir tus propios conceptos de obra o volver a restaurar el catálogo predeterminado cuando lo desees.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowClearAllModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onClearAllItems) {
                    onClearAllItems();
                  }
                  setShowClearAllModal(false);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Sí, Vaciar Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};