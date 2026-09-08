// Materiales sueltos del almacén: lo que compras, con su precio de compra y su proveedor.
// Las agrupaciones de materiales más mano de obra son kits y viven en su propia pestaña.
import React, { useMemo, useState } from 'react';
import { Boxes, Plus, Search, Edit3, Trash2, Copy, X, AlertCircle, TrendingUp, Tag, Truck, Sparkles, Check, PackagePlus, Calendar, RefreshCw } from 'lucide-react';
import { CatalogItem, CatalogCategory, Kit, CompanySettings, Expense } from '../types';
import { formatCurrency, formatDate, uid } from '../utils/formatters';
import { hoyISO } from '../utils/dates';
import { costeDe, margenDe, ventaConMargen, kitsQueUsan, redondear } from '../lib/catalogo';

interface Props {
  items: CatalogItem[];
  categories: CatalogCategory[];
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
  onIrAKits: () => void;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

type Form = { concepto: string; unidad: string; categoriaId: string; referenciaSku: string; proveedorHabitual: string; precioCompra: number; precioUnitario: number; ivaPorcentaje: number; descripcionDetallada: string };

const UNIDADES = ['ud', 'm', 'm²', 'kg', 'h', 'pack', 'rollo', 'l'];

export const MaterialsView: React.FC<Props> = ({ items, categories, kits, expenses, companySettings, onAddItem, onUpdateItem, onDeleteItem, onAddCategory, onPropagarCoste, onVaciarCatalogo, onRestaurarCatalogo, onIrAKits, onAviso }) => {
  const margenObjetivo = companySettings.margenObjetivo ?? 40;
  const vacio = (): Form => ({ concepto: '', unidad: 'ud', categoriaId: categories[0]?.id || '', referenciaSku: '', proveedorHabitual: '', precioCompra: 0, precioUnitario: 0, ivaPorcentaje: 21, descripcionDetallada: '' });

  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('todas');
  const [form, setForm] = useState<Form | null>(null);
  const [editando, setEditando] = useState<CatalogItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<CatalogItem | null>(null);
  const [nuevaCat, setNuevaCat] = useState('');
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  // Al cambiar el precio de compra de un material que usan varios kits, decides a quién afecta
  const [propagar, setPropagar] = useState<{ material: CatalogItem; nuevoCoste: number; kits: Kit[]; elegidos: Set<string> } | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return items
      .filter((i) => (catFiltro === 'todas' || i.categoriaId === catFiltro) && (!q || i.concepto.toLowerCase().includes(q) || (i.referenciaSku || '').toLowerCase().includes(q) || (i.proveedorHabitual || '').toLowerCase().includes(q)))
      .sort((a, b) => a.concepto.localeCompare(b.concepto));
  }, [items, busqueda, catFiltro]);

  const totalCompra = items.reduce((a, i) => a + costeDe(i), 0);
  const margenMedio = items.length ? Math.round(items.reduce((a, i) => a + margenDe(costeDe(i), i.precioUnitario), 0) / items.length) : 0;

  // ---- Sugerencia de precio ----
  // Dos fuentes reales: lo que ya pagaste por algo parecido (tus gastos) y el margen objetivo.
  const sugerenciaCompra = (nombre: string): { importe: number; origen: string } | null => {
    const q = nombre.toLowerCase().trim();
    if (q.length < 4) return null;
    const palabras = q.split(/\s+/).filter((p) => p.length > 3);
    if (!palabras.length) return null;
    const candidatos = expenses
      .filter((g) => palabras.some((p) => g.concepto.toLowerCase().includes(p)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (!candidatos.length) return null;
    const g = candidatos[0];
    return { importe: redondear(g.baseImponible), origen: `último gasto parecido: ${g.proveedor} el ${formatDate(g.fecha)}` };
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm(vacio());
    setError(null);
  };
  const abrirEditar = (m: CatalogItem) => {
    setEditando(m);
    setForm({ concepto: m.concepto, unidad: m.unidad, categoriaId: m.categoriaId, referenciaSku: m.referenciaSku || '', proveedorHabitual: m.proveedorHabitual || '', precioCompra: costeDe(m), precioUnitario: m.precioUnitario, ivaPorcentaje: m.ivaPorcentaje || 21, descripcionDetallada: m.descripcionDetallada || '' });
    setError(null);
  };
  const duplicar = (m: CatalogItem) => {
    const { id, ...resto } = m;
    void id;
    onAddItem({ ...resto, concepto: `${m.concepto} (copia)`, esDemo: false });
    onAviso?.(`Material duplicado a partir de "${m.concepto}".`, 'ok');
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.concepto.trim()) return setError('El material necesita un nombre.');
    if (form.precioCompra < 0 || form.precioUnitario < 0) return setError('Los precios no pueden ser negativos.');
    const cat = categories.find((c) => c.id === form.categoriaId);
    const datos = {
      concepto: form.concepto.trim(),
      unidad: form.unidad,
      categoriaId: form.categoriaId,
      categoriaNombre: cat?.nombre || 'Materiales',
      referenciaSku: form.referenciaSku.trim() || undefined,
      proveedorHabitual: form.proveedorHabitual.trim() || undefined,
      precioCompra: redondear(form.precioCompra),
      precioUnitario: redondear(form.precioUnitario),
      ivaPorcentaje: form.ivaPorcentaje,
      descripcionDetallada: form.descripcionDetallada.trim() || undefined,
      esDemo: false,
    };

    if (editando) {
      const costeAntes = costeDe(editando);
      onUpdateItem(editando.id, { ...datos, fechaUltimoPrecio: costeAntes !== datos.precioCompra ? hoyISO() : editando.fechaUltimoPrecio });
      // Si cambia el coste y hay kits que lo usan, se pregunta a cuáles se aplica
      const usan = kitsQueUsan(editando.id, kits);
      if (costeAntes !== datos.precioCompra && usan.length > 0) {
        setPropagar({ material: { ...editando, ...datos }, nuevoCoste: datos.precioCompra, kits: usan, elegidos: new Set(usan.map((k) => k.id)) });
      } else {
        onAviso?.(`Material "${datos.concepto}" actualizado.`, 'ok');
      }
    } else {
      onAddItem(datos);
      onAviso?.(`Material "${datos.concepto}" añadido.`, 'ok');
    }
    setForm(null);
    setEditando(null);
  };

  const confirmarPropagacion = () => {
    if (!propagar) return;
    onPropagarCoste(propagar.material.id, propagar.nuevoCoste, Array.from(propagar.elegidos));
    onAviso?.(propagar.elegidos.size ? `Coste actualizado en ${propagar.elegidos.size} kit${propagar.elegidos.size > 1 ? 's' : ''}. Revisa sus márgenes.` : 'Solo se ha cambiado el material; los kits mantienen su coste anterior.', 'ok');
    setPropagar(null);
  };

  const sug = form && !editando ? sugerenciaCompra(form.concepto) : null;
  const margenForm = form ? margenDe(form.precioCompra, form.precioUnitario) : 0;

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full lg:w-80"><Search className="absolute left-4 top-3 text-slate-400" size={18} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar material, referencia o proveedor…" className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl bg-slate-50/80 text-xs outline-none" /></div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)} className="border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold bg-white cursor-pointer">
            <option value="todas">Todas las categorías ({items.length})</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({items.filter((i) => i.categoriaId === c.id).length})</option>)}
          </select>
          {onRestaurarCatalogo && <button onClick={() => { onRestaurarCatalogo(); onAviso?.('Catálogo de ejemplo restaurado.', 'ok'); }} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer" title="Volver al catálogo de ejemplo"><RefreshCw size={14} /> Restaurar</button>}
          {onVaciarCatalogo && items.length > 0 && <button onClick={() => setConfirmarVaciar(true)} className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer" title="Dejar el catálogo vacío para meter los tuyos"><Trash2 size={14} /> Vaciar</button>}
          <button onClick={abrirNuevo} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"><Plus size={16} /> Nuevo material</button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Boxes size={12} /> Materiales</p><p className="text-xl font-black text-slate-900 mt-1">{items.length}</p></div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Tag size={12} /> Suma de precios de compra</p><p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(totalCompra)}</p><p className="text-[10px] text-slate-400">por unidad de cada material</p></div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><TrendingUp size={12} /> Margen medio al venderlos sueltos</p><p className={`text-xl font-black mt-1 ${margenMedio >= margenObjetivo ? 'text-emerald-600' : 'text-amber-600'}`}>{margenMedio} %</p><p className="text-[10px] text-slate-400">objetivo {margenObjetivo} %</p></div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3.5">Material</th>
                <th className="p-3.5">Categoría</th>
                <th className="p-3.5 text-center">Unidad</th>
                <th className="p-3.5 text-right bg-amber-50/60">Precio de compra</th>
                <th className="p-3.5 text-right">PVP suelto</th>
                <th className="p-3.5 text-center">Margen</th>
                <th className="p-3.5 text-center">En kits</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((m) => {
                const coste = costeDe(m);
                const margen = margenDe(coste, m.precioUnitario);
                const usan = kitsQueUsan(m.id, kits);
                return (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5"><p className="font-bold text-slate-900">{m.concepto}</p><p className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">{m.referenciaSku && <span className="font-mono">{m.referenciaSku}</span>}{m.proveedorHabitual && <span className="flex items-center gap-0.5"><Truck size={10} /> {m.proveedorHabitual}</span>}{m.fechaUltimoPrecio && <span className="flex items-center gap-0.5"><Calendar size={10} /> precio de {formatDate(m.fechaUltimoPrecio)}</span>}</p></td>
                    <td className="p-3.5"><span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded">{m.categoriaNombre}</span></td>
                    <td className="p-3.5 text-center text-slate-500">{m.unidad}</td>
                    <td className="p-3.5 text-right font-black text-slate-900 bg-amber-50/40">{formatCurrency(coste)}</td>
                    <td className="p-3.5 text-right font-bold text-slate-700">{formatCurrency(m.precioUnitario)}</td>
                    <td className={`p-3.5 text-center font-black ${margen >= margenObjetivo ? 'text-emerald-600' : margen > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{coste > 0 ? `${margen} %` : '—'}</td>
                    <td className="p-3.5 text-center">{usan.length > 0 ? <button onClick={onIrAKits} className="text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded cursor-pointer hover:bg-purple-100" title={usan.map((k) => k.nombre).join('\n')}>{usan.length} kit{usan.length > 1 ? 's' : ''}</button> : <span className="text-slate-300">—</span>}</td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => duplicar(m)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer" title="Duplicar"><Copy size={14} /></button>
                        <button onClick={() => abrirEditar(m)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer" title="Editar"><Edit3 size={14} /></button>
                        <button onClick={() => setABorrar(m)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer" title="Eliminar"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center text-slate-400"><Boxes size={30} className="mx-auto text-slate-300 mb-2" /><p className="font-bold text-slate-600 text-sm">{items.length === 0 ? 'Todavía no hay materiales' : 'Ningún material coincide con la búsqueda'}</p>{items.length === 0 && <button onClick={abrirNuevo} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs cursor-pointer">Añadir el primero</button>}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alta y edición */}
      {form && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <form onSubmit={guardar} className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl my-6 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div><span className="text-[10px] font-black uppercase tracking-wider bg-blue-500 px-2 py-0.5 rounded">Material</span><h3 className="text-lg font-black mt-1">{editando ? `Editar: ${editando.concepto}` : 'Nuevo material'}</h3><p className="text-[11px] text-slate-400">Un artículo que compras. Para agrupar varios con mano de obra, usa un kit.</p></div>
              <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 text-xs max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2"><label className="block font-bold text-slate-700 mb-1">Nombre *</label><input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} placeholder="Cable Cu 3G6 mm² RZ1-K" className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold" required /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Unidad</label><select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white">{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Referencia</label><input value={form.referenciaSku} onChange={(e) => setForm({ ...form, referenciaSku: e.target.value })} placeholder="SKU del proveedor" className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono" /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Proveedor habitual</label><input value={form.proveedorHabitual} onChange={(e) => setForm({ ...form, proveedorHabitual: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Categoría</label><select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white">{categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <p className="font-black text-slate-800">Precios</p>
                {sug && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5"><Sparkles size={13} /> Sugerencia: {formatCurrency(sug.importe)} de compra, según tu {sug.origen}.</span>
                    <button type="button" onClick={() => setForm({ ...form, precioCompra: sug.importe, precioUnitario: ventaConMargen(sug.importe, margenObjetivo) })} className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold cursor-pointer shrink-0">Usarla</button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className="block font-bold text-slate-700 mb-1">Precio de compra (€/{form.unidad})</label><input type="number" step="0.01" min="0" value={form.precioCompra || ''} onChange={(e) => setForm({ ...form, precioCompra: Number(e.target.value) })} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-black" /></div>
                  <div><label className="block font-bold text-slate-700 mb-1">PVP suelto (sin IVA)</label><input type="number" step="0.01" min="0" value={form.precioUnitario || ''} onChange={(e) => setForm({ ...form, precioUnitario: Number(e.target.value) })} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-black" /></div>
                  <div><label className="block font-bold text-slate-700 mb-1">IVA</label><select value={form.ivaPorcentaje} onChange={(e) => setForm({ ...form, ivaPorcentaje: Number(e.target.value) })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"><option value={21}>21 %</option><option value={10}>10 %</option><option value={4}>4 %</option><option value={0}>0 %</option></select></div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500">Aplicar margen:</span>
                  {[30, 40, 50, 60, 80, 100].map((p) => (
                    <button key={p} type="button" onClick={() => setForm({ ...form, precioUnitario: ventaConMargen(form.precioCompra, p) })} className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${Math.abs(margenForm - p) < 1 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'}`}>{p} %{p === margenObjetivo ? ' ·' : ''}</button>
                  ))}
                  <span className={`ml-auto font-black ${margenForm >= margenObjetivo ? 'text-emerald-600' : margenForm > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Margen actual: {form.precioCompra > 0 ? `${margenForm} %` : 'sin coste'}</span>
                </div>
                <p className="text-[10px] text-slate-400">El precio de compra es interno y nunca sale en un presupuesto ni en una factura. El margen marcado con un punto es tu objetivo, configurable en Configuración.</p>
              </div>

              <div><label className="block font-bold text-slate-700 mb-1">Notas internas</label><textarea value={form.descripcionDetallada} onChange={(e) => setForm({ ...form, descripcionDetallada: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>

              <div className="flex gap-2 items-end pt-2 border-t border-slate-100">
                <div className="flex-1"><label className="block font-bold text-slate-700 mb-1">Nueva categoría</label><input value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} placeholder="Ej.: Cableado y líneas" className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
                <button type="button" onClick={() => { if (nuevaCat.trim()) { onAddCategory({ nombre: nuevaCat.trim(), descripcion: '' }); setNuevaCat(''); onAviso?.('Categoría creada. Selecciónala arriba.', 'ok'); } }} className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer">Crear</button>
              </div>

              {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2"><AlertCircle size={14} /> {error}</div>}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black cursor-pointer">{editando ? 'Guardar cambios' : 'Añadir material'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Propagación del nuevo coste a los kits */}
      {propagar && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center"><PackagePlus size={24} /></div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">Has cambiado el precio de compra</h3>
              <p className="text-xs text-slate-500">«{propagar.material.concepto}» ahora cuesta {formatCurrency(propagar.nuevoCoste)}. Este material se usa en {propagar.kits.length} kit{propagar.kits.length > 1 ? 's' : ''}. Elige a cuáles se lo aplicas. El precio de venta de cada kit no se toca: solo cambia su coste, y verás cómo queda el margen.</p>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {propagar.kits.map((k) => {
                const sel = propagar.elegidos.has(k.id);
                return (
                  <label key={k.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs ${sel ? 'bg-purple-50/60 border-purple-300' : 'bg-white border-slate-200'}`}>
                    <input type="checkbox" checked={sel} onChange={() => { const s = new Set(propagar.elegidos); if (sel) s.delete(k.id); else s.add(k.id); setPropagar({ ...propagar, elegidos: s }); }} className="accent-purple-600" />
                    <span className="flex-1 min-w-0"><span className="font-bold text-slate-800 block truncate">{k.nombre}</span><span className="text-[10px] text-slate-500">coste actual {formatCurrency(k.precioCosteTotal)} · venta {formatCurrency(k.precioVentaTotal)} · margen {k.margenPorcentaje} %</span></span>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button onClick={() => setPropagar({ ...propagar, elegidos: new Set(propagar.kits.map((k) => k.id)) })} className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold cursor-pointer">Todos</button>
              <button onClick={() => setPropagar({ ...propagar, elegidos: new Set() })} className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold cursor-pointer">Ninguno</button>
              <span className="ml-auto self-center text-slate-500">{propagar.elegidos.size} de {propagar.kits.length}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPropagar(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Solo el material</button>
              <button onClick={confirmarPropagacion} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"><Check size={14} /> Aplicar a los marcados</button>
            </div>
            <p className="text-[10px] text-slate-400 text-center">Los presupuestos ya hechos no cambian: conservan el coste con el que se calcularon.</p>
          </div>
        </div>
      )}

      {confirmarVaciar && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center"><Trash2 size={22} /></div>
            <h3 className="text-base font-black text-slate-900">¿Vaciar el catálogo de materiales?</h3>
            <p className="text-xs text-slate-500">Se borran los {items.length} materiales para que metas los tuyos. Los kits no se tocan, pero sus líneas dejarán de estar enlazadas al catálogo y conservarán el precio que tengan ahora.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirmarVaciar(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button>
              <button onClick={() => { onVaciarCatalogo?.(); setConfirmarVaciar(false); onAviso?.('Catálogo vacío. Añade tus materiales.', 'ok'); }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer">Vaciar</button>
            </div>
          </div>
        </div>
      )}

      {/* Borrar */}
      {aBorrar && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center"><Trash2 size={22} /></div>
            <h3 className="text-base font-black text-slate-900">¿Eliminar «{aBorrar.concepto}»?</h3>
            {kitsQueUsan(aBorrar.id, kits).length > 0
              ? <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">Lo usan {kitsQueUsan(aBorrar.id, kits).length} kits. Esos kits conservarán la línea con su precio, pero dejará de estar enlazada al catálogo.</p>
              : <p className="text-xs text-slate-500">No lo usa ningún kit. Los presupuestos ya hechos no cambian.</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setABorrar(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button>
              <button onClick={() => { onDeleteItem(aBorrar.id); onAviso?.(`Material "${aBorrar.concepto}" eliminado.`, 'ok'); setABorrar(null); }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
