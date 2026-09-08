// Ajustes propios de cada tipo de documento, editables desde su pestaña (Presupuestos o Facturas).
// Configuración se queda para lo general de la app; aquí va lo que cambia cómo nace un
// presupuesto o una factura: validez o vencimiento, plantilla, texto al pie, IVA, forma de pago…
import React, { useEffect, useState } from 'react';
import { X, Settings, Save, Info } from 'lucide-react';
import { CompanySettings, DocumentTemplate, Invoice } from '../types';
import { DEFAULT_TEMPLATES } from '../data/plantillas';
import { rellenarTexto } from '../lib/textos';

type Tipo = 'presupuesto' | 'factura';

interface Props {
  tipo: Tipo;
  settings: CompanySettings;
  onSave: (cambios: Partial<CompanySettings>) => void;
  onClose: () => void;
}

const METODOS_PAGO: Invoice['metodoPago'][] = ['Transferencia Bancaria', 'Bizum', 'TPV', 'Efectivo', 'Domiciliación', 'Pagaré'];
const DIAS_RAPIDOS: Record<Tipo, number[]> = { presupuesto: [7, 15, 30, 60], factura: [7, 15, 30, 60, 90] };
const IVAS = [21, 10, 4, 0];

export const DocumentSettingsModal: React.FC<Props> = ({ tipo, settings, onSave, onClose }) => {
  const esPresupuesto = tipo === 'presupuesto';
  const plantillas: DocumentTemplate[] = settings.plantillasPersonalizadas?.length ? settings.plantillasPersonalizadas : DEFAULT_TEMPLATES;

  const [dias, setDias] = useState(esPresupuesto ? settings.diasValidezPresupuesto || 30 : settings.diasVencimientoFactura || 30);
  const [plantilla, setPlantilla] = useState(esPresupuesto ? settings.plantillaPorDefecto : settings.plantillaFacturaPorDefecto || settings.plantillaPorDefecto);
  const [texto, setTexto] = useState(esPresupuesto ? settings.notaFinalPresupuestoDefecto || '' : settings.condicionesPagoDefecto || '');
  const [iva, setIva] = useState(settings.ivaPorDefecto ?? 21);
  const [metodoPago, setMetodoPago] = useState<Invoice['metodoPago']>(settings.metodoPagoPorDefecto || 'Transferencia Bancaria');
  const [margen, setMargen] = useState(settings.margenObjetivo ?? 40);

  // Si llegan cambios de otro dispositivo mientras el panel está abierto, se recogen
  useEffect(() => {
    setDias(esPresupuesto ? settings.diasValidezPresupuesto || 30 : settings.diasVencimientoFactura || 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.diasValidezPresupuesto, settings.diasVencimientoFactura]);

  const comodin = esPresupuesto ? '{validez}' : '{vencimiento}';
  const vistaPrevia = rellenarTexto(texto, { validez: esPresupuesto ? dias : settings.diasValidezPresupuesto, vencimiento: esPresupuesto ? settings.diasVencimientoFactura : dias });
  const textoSinComodin = texto.trim() !== '' && !texto.includes(comodin) && /\d+\s*d[ií]as/i.test(texto);

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    const d = Math.max(1, Math.round(Number(dias) || 30));
    const cambios: Partial<CompanySettings> = esPresupuesto
      ? { diasValidezPresupuesto: d, plantillaPorDefecto: plantilla, notaFinalPresupuestoDefecto: texto, ivaPorDefecto: iva, margenObjetivo: margen }
      : { diasVencimientoFactura: d, plantillaFacturaPorDefecto: plantilla, condicionesPagoDefecto: texto, ivaPorDefecto: iva, metodoPagoPorDefecto: metodoPago };
    onSave(cambios);
    onClose();
  };

  const campo = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <form onSubmit={guardar} className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center"><Settings size={20} /></div>
            <div>
              <h3 className="font-black text-base">{esPresupuesto ? 'Ajustes de los presupuestos' : 'Ajustes de las facturas'}</h3>
              <p className="text-xs text-slate-400">Con qué valores nace cada {esPresupuesto ? 'presupuesto' : 'factura'} nuevo. Los ya emitidos no cambian.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 cursor-pointer"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Días */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">{esPresupuesto ? 'Validez del presupuesto' : 'Vencimiento de la factura'}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {DIAS_RAPIDOS[tipo].map((d) => (
                <button key={d} type="button" onClick={() => setDias(d)} className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${dias === d ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{d} días</button>
              ))}
              <div className="flex items-center gap-1.5">
                <input type="number" min={1} max={365} value={dias} onChange={(e) => setDias(parseInt(e.target.value) || 0)} className="w-20 border border-slate-200 rounded-xl px-3 py-1.5 text-right font-mono font-bold" />
                <span className="text-slate-500">días</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{esPresupuesto ? 'Se calcula desde la fecha del presupuesto y aparece como «Válido hasta» en el documento y en la página donde acepta el cliente.' : 'Se propone como fecha de vencimiento al emitir; puedes cambiarla factura a factura. Marca desde cuándo una factura cuenta como vencida.'}</p>
          </div>

          {/* Plantilla */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Plantilla por defecto</label>
            <select value={plantilla} onChange={(e) => setPlantilla(e.target.value)} className={campo}>
              {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.esPersonalizada ? ' · personalizada' : ''}</option>)}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">{esPresupuesto ? 'La factura hereda la plantilla del presupuesto del que nace; si no viene de ninguno, usa la suya.' : 'Solo para facturas que no nacen de un presupuesto; las demás heredan la del presupuesto.'} Los diseños se editan en Configuración → Plantillas.</p>
          </div>

          {/* Texto al pie */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">{esPresupuesto ? 'Comentario al pie del presupuesto' : 'Condiciones al pie de la factura'}</label>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} className={campo} />
            <p className="text-[11px] text-slate-500 mt-1">Escribe <code className="bg-slate-100 px-1 rounded">{comodin}</code> donde vaya el número de días y se rellenará solo con el valor de arriba.</p>
            {textoSinComodin && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2"><Info size={14} className="shrink-0 mt-0.5" /><span>El texto lleva un número de días escrito a mano. Si cambias los días de arriba, ese texto no cambiará. Sustitúyelo por <b>{comodin}</b>.</span></div>
            )}
            {vistaPrevia && <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Así se verá</span>{vistaPrevia}</div>}
          </div>

          {/* IVA y otros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">IVA de las líneas nuevas</label>
              <div className="flex gap-2 flex-wrap">
                {IVAS.map((v) => <button key={v} type="button" onClick={() => setIva(v)} className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${iva === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{v} %</button>)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Cada línea se puede cambiar después. El 10 % aplica a ciertas obras en vivienda; consúltalo con la gestoría.</p>
            </div>
            {esPresupuesto ? (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Margen objetivo sobre coste</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} max={500} value={margen} onChange={(e) => setMargen(parseInt(e.target.value) || 0)} className="w-20 border border-slate-200 rounded-xl px-3 py-1.5 text-right font-mono font-bold" />
                  <span className="text-slate-500">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Con él se sugiere el precio de venta de materiales y kits y se resalta en el selector de margen de cada partida.</p>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Forma de pago habitual</label>
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as Invoice['metodoPago'])} className={campo}>
                  {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Se propone al emitir; se puede cambiar en cada factura.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl cursor-pointer">Cancelar</button>
          <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer"><Save size={15} /> Guardar ajustes</button>
        </div>
      </form>
    </div>
  );
};
