// Plantillas de presupuesto y factura, dentro de Configuración: lista de modelos, editor con los
// controles de diseño y vista previa en vivo sobre un documento de muestra. La zona fiscal de la
// factura (identificación, totales, QR y leyenda VERI*FACTU) no depende de la plantilla.
import React, { useMemo, useState } from 'react';
import { Palette, Plus, Trash2, Copy, Check, Star, Type, LayoutTemplate, FileText, BadgeEuro, Sparkles } from 'lucide-react';
import { CompanySettings, DocumentTemplate, DocumentBaseTemplate } from '../types';
import { DocumentRenderer, TEMPLATE_OPTIONS, FONT_OPTIONS, COLOR_PRESETS } from './DocumentRenderer';
import { DEFAULT_TEMPLATES, documentoDeMuestra } from '../data/plantillas';

interface Props {
  settings: CompanySettings; // configuración en edición (para la vista previa: logo, datos…)
  plantillas: DocumentTemplate[];
  plantillaPorDefecto: string;
  onChangePlantillas: (lista: DocumentTemplate[]) => void;
  onChangeDefecto: (id: string) => void;
}

export const TemplatesSettings: React.FC<Props> = ({ settings, plantillas, plantillaPorDefecto, onChangePlantillas, onChangeDefecto }) => {
  const [vista, setVista] = useState<'p' | 'f'>('p');
  const [seleccion, setSeleccion] = useState<string>(plantillaPorDefecto);
  const [editando, setEditando] = useState<DocumentTemplate | null>(null);
  const [esNueva, setEsNueva] = useState(false);

  const activa = editando || plantillas.find((t) => t.id === seleccion) || plantillas.find((t) => t.id === plantillaPorDefecto) || plantillas[0];
  const muestra = useMemo(() => documentoDeMuestra(settings), [settings.razonSocial, settings.nombreComercial, settings.cif, settings.tipoEntidad]); // eslint-disable-line react-hooks/exhaustive-deps
  const faltan = DEFAULT_TEMPLATES.filter((d) => !plantillas.some((t) => t.id === d.id));

  const nueva = () => {
    setEsNueva(true);
    setEditando({ id: `tpl-${Date.now()}`, nombre: 'Nueva plantilla', descripcion: '', colorPrimario: '', acento: '#1D4ED8', base: 'moderna', fuente: 'sans', condicionesPago: settings.condicionesPagoDefecto, notaFinal: settings.notaFinalPresupuestoDefecto, pieDePagina: '', esPersonalizada: true });
  };
  const duplicar = (t: DocumentTemplate) => {
    const copia: DocumentTemplate = { ...t, id: `tpl-${Date.now()}`, nombre: `${t.nombre} (copia)`, esPersonalizada: true };
    onChangePlantillas([...plantillas, copia]);
    setSeleccion(copia.id);
  };
  const borrar = (id: string) => {
    if (plantillas.length <= 1) return alert('Debe quedar al menos una plantilla.');
    const t = plantillas.find((x) => x.id === id);
    if (!confirm(`¿Eliminar la plantilla "${t?.nombre}"?`)) return;
    const resto = plantillas.filter((x) => x.id !== id);
    onChangePlantillas(resto);
    if (plantillaPorDefecto === id) onChangeDefecto(resto[0].id);
    if (seleccion === id) setSeleccion(resto[0].id);
  };
  const guardar = () => {
    if (!editando) return;
    if (!editando.nombre.trim()) return alert('La plantilla necesita un nombre.');
    onChangePlantillas(esNueva ? [...plantillas, editando] : plantillas.map((x) => (x.id === editando.id ? editando : x)));
    setSeleccion(editando.id);
    setEditando(null);
  };
  const upd = <K extends keyof DocumentTemplate>(k: K, v: DocumentTemplate[K]) => setEditando((e) => (e ? { ...e, [k]: v } : e));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
      {/* Columna izquierda: lista o editor */}
      <div className="lg:col-span-5 space-y-3">
        {editando ? (
          <div className="p-4 bg-white rounded-2xl border-2 border-blue-500 space-y-3 shadow-sm">
            <div className="flex items-center justify-between"><h4 className="font-black text-slate-900 flex items-center gap-1.5"><Palette size={15} className="text-blue-600" /> {esNueva ? 'Nueva plantilla' : `Editar: ${editando.nombre}`}</h4><span className="text-[10px] text-slate-400">La vista previa cambia al instante</span></div>
            <div><label className="block font-bold text-slate-700 mb-1">Nombre *</label><input value={editando.nombre} onChange={(e) => upd('nombre', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold" /></div>
            <div><label className="block font-bold text-slate-700 mb-1">Descripción</label><input value={editando.descripcion} onChange={(e) => upd('descripcion', e.target.value)} placeholder="Para qué tipo de cliente o trabajo" className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"><Palette size={12} /> Color corporativo</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => <button key={c.hex} type="button" onClick={() => upd('acento', c.hex)} className="w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center shadow-xs" style={{ backgroundColor: c.hex, borderColor: editando.acento === c.hex ? '#0f172a' : 'white' }} title={c.name}>{editando.acento === c.hex && <Check size={13} className="text-white" />}</button>)}
                <input type="color" value={editando.acento} onChange={(e) => upd('acento', e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 bg-white" title="Otro color" />
                <span className="font-mono text-slate-500">{editando.acento}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5"><LayoutTemplate size={12} /> Maquetación</label><select value={editando.base || 'moderna'} onChange={(e) => upd('base', e.target.value as DocumentBaseTemplate)} className="w-full border border-slate-200 rounded-xl px-2 py-2 bg-white">{TEMPLATE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.desc}</option>)}</select></div>
              <div><label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5"><Type size={12} /> Tipografía</label><select value={editando.fuente || 'sans'} onChange={(e) => upd('fuente', e.target.value)} className="w-full border border-slate-200 rounded-xl px-2 py-2 bg-white">{FONT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            </div>
            <div><label className="block font-bold text-slate-700 mb-1">Comentario al pie del presupuesto</label><textarea value={editando.notaFinal || ''} onChange={(e) => upd('notaFinal', e.target.value)} rows={3} placeholder="Ej.: Pago 50 % a la aceptación del presupuesto y 50 % al finalizar. Validez 30 días." className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
            <div><label className="block font-bold text-slate-700 mb-1">Condiciones al pie de la factura</label><textarea value={editando.condicionesPago || ''} onChange={(e) => upd('condicionesPago', e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
            <div><label className="block font-bold text-slate-700 mb-1">Pie de página (texto legal, lema…)</label><input value={editando.pieDePagina || ''} onChange={(e) => upd('pieDePagina', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
            <div className="flex gap-2 pt-2 border-t border-slate-100"><button type="button" onClick={() => setEditando(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer">Cancelar</button><button type="button" onClick={guardar} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5"><Check size={14} /> Aplicar a la plantilla</button></div>
            <p className="text-[10px] text-slate-400">Después pulsa "Guardar cambios" arriba para que se conserve en tu configuración.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-slate-700">{plantillas.length} modelos. Toca uno para verlo; la estrella lo fija como predeterminado.</p>
              <button type="button" onClick={nueva} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"><Plus size={14} /> Nueva</button>
            </div>
            <div className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
              {plantillas.map((t) => {
                const sel = seleccion === t.id;
                const def = plantillaPorDefecto === t.id;
                return (
                  <div key={t.id} onClick={() => setSeleccion(t.id)} className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-colors ${sel ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200/80 hover:border-slate-300 bg-white'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0"><div className="w-5 h-5 rounded-full border-2 border-white shadow-xs shrink-0" style={{ backgroundColor: t.acento }} /><span className="font-bold text-slate-900 text-sm truncate">{t.nombre}</span></div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onChangeDefecto(t.id); }} className={`p-1.5 rounded-lg cursor-pointer shrink-0 ${def ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:text-amber-500'}`} title={def ? 'Plantilla predeterminada' : 'Fijar como predeterminada'}><Star size={15} fill={def ? 'currentColor' : 'none'} /></button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{t.descripcion || `${TEMPLATE_OPTIONS.find((o) => o.id === t.base)?.name || 'Moderna'} · ${FONT_OPTIONS.find((o) => o.id === t.fuente)?.name || 'Jakarta'}`}</p>
                    <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center gap-3 text-[11px]">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setEsNueva(false); setEditando(t); setSeleccion(t.id); }} className="text-blue-700 font-bold flex items-center gap-1 cursor-pointer"><Palette size={12} /> Editar</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); duplicar(t); }} className="text-slate-600 font-bold flex items-center gap-1 cursor-pointer"><Copy size={12} /> Duplicar</button>
                      {plantillas.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); borrar(t.id); }} className="text-rose-500 font-bold flex items-center gap-1 cursor-pointer ml-auto"><Trash2 size={12} /> Quitar</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            {faltan.length > 0 && <button type="button" onClick={() => onChangePlantillas([...plantillas, ...faltan])} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"><Sparkles size={14} /> Añadir los {faltan.length} modelos nuevos que faltan</button>}
          </>
        )}
      </div>

      {/* Columna derecha: vista previa en vivo */}
      <div className="lg:col-span-7 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-bold text-slate-700 flex items-center gap-1.5">Vista previa · <span className="text-slate-500 font-normal">{activa?.nombre}</span></p>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button type="button" onClick={() => setVista('p')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1 ${vista === 'p' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}><FileText size={12} /> Presupuesto</button>
            <button type="button" onClick={() => setVista('f')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1 ${vista === 'f' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}><BadgeEuro size={12} /> Factura</button>
          </div>
        </div>
        <div className="bg-slate-200/70 rounded-2xl p-3 max-h-[70vh] overflow-y-auto border border-slate-200">
          <div style={{ zoom: 0.78 }}>
            {activa && (vista === 'p'
              ? <DocumentRenderer key={`p-${activa.id}`} tipo="p" doc={muestra.presupuesto} companySettings={settings} client={muestra.cliente} embebido plantillaForzada={activa} />
              : <DocumentRenderer key={`f-${activa.id}`} tipo="f" doc={muestra.factura} companySettings={settings} client={muestra.cliente} embebido plantillaForzada={activa} />)}
          </div>
        </div>
        <p className="text-[10px] text-slate-400">Documento de muestra con datos ficticios. Los materiales marcados como visibles salen con nombre y cantidad, nunca con su coste. En la factura, el QR y la leyenda VERI*FACTU aparecen siempre.</p>
      </div>
    </div>
  );
};
