// Cierre de obra pensado para el móvil, a pie de instalación.
// El material del presupuesto viene ya listado: solo hay que corregir lo que sobró o faltó,
// añadir lo imprevisto y subir las fotos. De ahí sale la rentabilidad real de la obra.
import React, { useMemo, useState } from 'react';
import { Camera, Plus, Minus, X, Check, TrendingDown, TrendingUp, Lock, Trash2, Boxes, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Project, ConsumoObra, ProjectPhoto, CatalogItem } from '../types';
import { formatCurrency, uid } from '../utils/formatters';
import { hoyISO } from '../utils/dates';
import { consumoActualizado, costePrevistoMateriales, costeRealMateriales, desviaciones, redondear2 } from '../lib/consumo';
import { costeDe } from '../lib/catalogo';
import { prepararMedia, tamanoLegible } from '../lib/drive';

interface Props {
  project: Project;
  catalogItems: CatalogItem[];
  limiteFoto: number;
  hayDrive: boolean; // cuenta de Google vinculada: los archivos van a su Drive
  onGuardarConsumo: (projectId: string, consumo: ConsumoObra[], cerrado: boolean) => void;
  onAddPhoto: (projectId: string, photo: Omit<ProjectPhoto, 'id'>) => void;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

export const CierreObraMovil: React.FC<Props> = ({ project, catalogItems, limiteFoto, hayDrive, onGuardarConsumo, onAddPhoto, onAviso }) => {
  const [lista, setLista] = useState<ConsumoObra[]>(() => consumoActualizado(project));
  const [buscarMaterial, setBuscarMaterial] = useState('');
  const [anadiendo, setAnadiendo] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const fotoRef = React.useRef<HTMLInputElement>(null);

  const previsto = costePrevistoMateriales(lista);
  const real = costeRealMateriales(lista);
  const dif = redondear2(real - previsto);
  const desv = useMemo(() => desviaciones(lista), [lista]);
  const venta = project.presupuestoAceptado || 0;
  const margenReal = venta > 0 ? redondear2(((venta - real) / venta) * 100) : 0;

  const cambiar = (id: string, cantidad: number) => setLista((prev) => prev.map((c) => (c.id === id ? { ...c, cantidadReal: Math.max(0, redondear2(cantidad)) } : c)));
  const quitar = (id: string) => setLista((prev) => prev.filter((c) => c.id !== id));

  const anadirDelCatalogo = (m: CatalogItem) => {
    setLista((prev) => [...prev, { id: uid('con'), nombre: m.concepto, unidad: m.unidad, cantidadPrevista: 0, cantidadReal: 1, costeUnitario: costeDe(m), extra: true, materialId: m.id }]);
    setBuscarMaterial('');
    setAnadiendo(false);
  };
  const anadirLibre = () => {
    if (!buscarMaterial.trim()) return;
    setLista((prev) => [...prev, { id: uid('con'), nombre: buscarMaterial.trim(), unidad: 'ud', cantidadPrevista: 0, cantidadReal: 1, costeUnitario: 0, extra: true }]);
    setBuscarMaterial('');
    setAnadiendo(false);
  };

  const candidatos = useMemo(() => {
    const q = buscarMaterial.toLowerCase().trim();
    if (q.length < 2) return [];
    return catalogItems.filter((m) => m.concepto.toLowerCase().includes(q)).slice(0, 6);
  }, [buscarMaterial, catalogItems]);

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setSubiendo(true);
    try {
      // Con Drive: se comprime, se sube a la carpeta de la obra y aquí solo queda la miniatura
      const m = await prepararMedia(f, { codigo: project.obraCodigo || project.codigo, nombre: project.nombre }, { hayDrive, limiteSinDrive: limiteFoto });
      onAddPhoto(project.id, { url: m.url, titulo: m.titulo, fecha: hoyISO(), tipo: 'durante', driveFileId: m.driveFileId, driveEnlace: m.driveEnlace, nombreArchivo: m.nombreArchivo, tamano: m.tamano, esVideo: m.esVideo });
      onAviso?.(`${m.esVideo ? 'Vídeo' : 'Foto'} de ${tamanoLegible(m.tamano)} añadido. ${m.aviso || ''}`, 'ok');
    } catch (err: any) {
      onAviso?.(err?.message || 'No se pudo guardar el archivo.', 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = (cerrar: boolean) => {
    onGuardarConsumo(project.id, lista, cerrar);
    onAviso?.(cerrar ? 'Consumo cerrado. La rentabilidad de esta obra ya usa el material real.' : 'Consumo guardado. Puedes seguir corrigiéndolo.', 'ok');
  };

  return (
    <div className="space-y-4">
      {/* Resumen pegado arriba: siempre visible mientras corriges cantidades */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-white/95 backdrop-blur-sm">
        <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl space-y-2">
          <div className="flex items-center gap-2"><Lock size={14} className="text-amber-400" /><span className="text-[11px] font-black uppercase tracking-wider text-slate-300">Solo tú ves esto</span></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[9px] uppercase font-bold text-slate-400">Previsto</p><p className="text-sm font-black">{formatCurrency(previsto)}</p></div>
            <div><p className="text-[9px] uppercase font-bold text-slate-400">Real</p><p className="text-sm font-black text-amber-400">{formatCurrency(real)}</p></div>
            <div><p className="text-[9px] uppercase font-bold text-slate-400">Desvío</p><p className={`text-sm font-black ${dif > 0 ? 'text-rose-400' : dif < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>{dif > 0 ? '+' : ''}{formatCurrency(dif)}</p></div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Venta {formatCurrency(venta)}</span>
            <span className={`font-black ${margenReal >= 30 ? 'text-emerald-400' : margenReal >= 15 ? 'text-amber-400' : 'text-rose-400'}`}>Margen real {margenReal} %</span>
          </div>
        </div>
      </div>

      {/* Fotos, con la cámara del móvil */}
      <div className="flex gap-2">
        <input type="file" ref={fotoRef} accept={hayDrive ? 'image/*,video/*' : 'image/*'} capture="environment" className="hidden" onChange={subirFoto} />
        <button type="button" onClick={() => fotoRef.current?.click()} disabled={subiendo} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60">
          <Camera size={18} /> {subiendo ? 'Subiendo…' : hayDrive ? 'Hacer foto o vídeo' : 'Hacer foto de la obra'}
        </button>
        {project.fotos.length > 0 && <span className="px-3 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs flex items-center gap-1.5"><ImageIcon size={15} /> {project.fotos.length}</span>}
      </div>

      <p className="text-[10px] text-slate-400 -mt-2">{hayDrive ? 'Las fotos se comprimen y se guardan en tu Google Drive, en la carpeta «Control de Obra / ' + (project.obraCodigo || project.codigo) + '». Aquí queda solo una miniatura.' : 'Sin Google Drive vinculado las fotos se guardan dentro de la app y ocupan del limitado espacio de la nube. Vincula tu cuenta en Configuración para usar los 15 GB de Drive.'}</p>

      {/* Material: lo presupuestado ya está, solo se corrige */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5"><Boxes size={16} className="text-blue-600" /> Material gastado</h4>
          <span className="text-[11px] text-slate-400">{lista.length} líneas</span>
        </div>
        <p className="text-[11px] text-slate-500">Viene puesto lo que presupuestaste. Corrige solo lo que sobró o faltó.</p>

        {lista.length === 0 && <p className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500 text-center">Este presupuesto no llevaba escandallo, así que no hay material que corregir. Puedes añadirlo abajo.</p>}

        {lista.map((c) => {
          const difLinea = redondear2((c.cantidadReal - c.cantidadPrevista) * c.costeUnitario);
          return (
            <div key={c.id} className={`p-3 rounded-2xl border ${c.extra ? 'bg-amber-50/70 border-amber-200' : difLinea !== 0 ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-xs leading-tight">{c.nombre}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {c.extra ? <span className="font-bold text-amber-700">Imprevisto</span> : `Previsto ${c.cantidadPrevista} ${c.unidad}`}
                    {c.costeUnitario > 0 ? ` · ${formatCurrency(c.costeUnitario)}/${c.unidad}` : ' · sin coste'}
                    {c.partidaConcepto ? ` · ${c.partidaConcepto.substring(0, 28)}` : ''}
                  </p>
                </div>
                {c.extra && <button onClick={() => quitar(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"><Trash2 size={14} /></button>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button type="button" onClick={() => cambiar(c.id, c.cantidadReal - 1)} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer shrink-0"><Minus size={16} /></button>
                <input type="number" step="any" min="0" inputMode="decimal" value={c.cantidadReal} onChange={(e) => cambiar(c.id, Number(e.target.value))} className="w-20 h-10 text-center border border-slate-200 rounded-xl font-black text-slate-900 bg-white" />
                <span className="text-xs font-bold text-slate-500 w-10">{c.unidad}</span>
                <button type="button" onClick={() => cambiar(c.id, c.cantidadReal + 1)} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black flex items-center justify-center cursor-pointer shrink-0"><Plus size={16} /></button>
                <span className={`ml-auto text-xs font-black shrink-0 ${difLinea > 0 ? 'text-rose-600' : difLinea < 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{difLinea !== 0 ? `${difLinea > 0 ? '+' : ''}${formatCurrency(difLinea)}` : '='}</span>
              </div>
            </div>
          );
        })}

        {/* Añadir un imprevisto */}
        {anadiendo ? (
          <div className="p-3 bg-white border-2 border-blue-400 rounded-2xl space-y-2">
            <input autoFocus value={buscarMaterial} onChange={(e) => setBuscarMaterial(e.target.value)} placeholder="Buscar en el catálogo o escribir uno nuevo" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs" />
            {candidatos.map((m) => (
              <button key={m.id} type="button" onClick={() => anadirDelCatalogo(m)} className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-xs cursor-pointer flex justify-between items-center">
                <span className="font-bold text-slate-800 truncate">{m.concepto}</span>
                <span className="text-slate-500 shrink-0 ml-2">{formatCurrency(costeDe(m))}/{m.unidad}</span>
              </button>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setAnadiendo(false); setBuscarMaterial(''); }} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button>
              {buscarMaterial.trim() && candidatos.length === 0 && <button type="button" onClick={anadirLibre} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs cursor-pointer">Añadir «{buscarMaterial.trim().substring(0, 18)}»</button>}
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAnadiendo(true)} className="w-full py-3 bg-white border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-600 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"><Plus size={15} /> Añadir material imprevisto</button>
        )}
      </div>

      {/* Dónde se ha ido el dinero */}
      {desv.length > 0 && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
          <p className="font-black text-slate-800 text-xs flex items-center gap-1.5">{dif > 0 ? <TrendingUp size={14} className="text-rose-600" /> : <TrendingDown size={14} className="text-emerald-600" />} Dónde se desvía</p>
          {desv.slice(0, 5).map((d) => (
            <div key={d.consumo.id} className="flex items-center justify-between text-[11px] gap-2">
              <span className="text-slate-600 truncate">{d.consumo.nombre}</span>
              <span className={`font-black shrink-0 ${d.diferenciaEuros > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{d.diferenciaCantidad > 0 ? '+' : ''}{d.diferenciaCantidad} {d.consumo.unidad} · {d.diferenciaEuros > 0 ? '+' : ''}{formatCurrency(d.diferenciaEuros)}</span>
            </div>
          ))}
        </div>
      )}

      {project.consumoCerrado && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 flex items-start gap-2"><Check size={14} className="shrink-0 mt-0.5" /> El consumo está cerrado: la rentabilidad de esta obra se calcula con el material real. Puedes seguir corrigiéndolo si hace falta.</div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pb-2">
        <button type="button" onClick={() => guardar(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs cursor-pointer">Guardar y seguir</button>
        <button type="button" onClick={() => guardar(true)} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer"><Check size={15} /> {project.consumoCerrado ? 'Guardar cambios' : 'Cerrar consumo de la obra'}</button>
      </div>
      <p className="text-[10px] text-slate-400 flex items-start gap-1.5"><AlertCircle size={12} className="shrink-0 mt-0.5" /> Nada de esto sale en el presupuesto ni en la factura del cliente. Es tu control interno de coste.</p>
    </div>
  );
};
