import React, { useState } from 'react';
import { Sparkles, CheckCircle2, ChevronRight, X, Building2, FileCheck2, Receipt, TrendingUp, Zap, CalendarDays, Cloud } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToTab?: (tab: string) => void;
  tipoEntidad?: 'empresa' | 'autonomo';
}

const STEPS = [
  { title: '1. Tu empresa o tu alta de autónomo', subtitle: 'Datos fiscales, logotipo, series y plantillas', icon: Building2, color: 'bg-blue-500', tab: 'ajustes',
    texto: 'Indica si eres sociedad o autónomo: cambian los modelos de Hacienda que te aparecen (303, 130 o 202…) y los datos que se imprimen en presupuestos y facturas. Sube tu logotipo, define la numeración y el comentario al pie de los presupuestos.',
    puntos: ['Empresa o autónomo con retención IRPF', 'Numeración de presupuestos, obras, facturas y rectificativas', 'Comentario al pie (forma de pago, validez)', 'Técnicos y franjas horarias'] },
  { title: '2. Materiales, conceptos y kits', subtitle: 'Precios de venta con coste interno oculto', icon: Zap, color: 'bg-amber-500', tab: 'catalogo',
    texto: 'Cada concepto del catálogo lleva su escandallo de materiales y mano de obra con coste. Los kits agrupan varios materiales en una sola partida. El coste nunca sale en el presupuesto; solo tú ves el margen.',
    puntos: ['Margen por partida y por presupuesto', 'Kits de instalación en un clic', 'Elige qué materiales ve el cliente', 'Duplica y adapta con rapidez'] },
  { title: '3. Presupuesto → aceptación → obra → factura', subtitle: 'El cliente acepta desde su móvil y el ciclo se cierra en verde', icon: FileCheck2, color: 'bg-emerald-500', tab: 'presupuestos',
    texto: 'Envía el presupuesto por WhatsApp o correo con un enlace. El cliente indica nombre y DNI, firma en pantalla (salvo grandes empresas que no la exigen) y elige un hueco entre los que le propones. Al aceptar se crea la obra con su código propio; nunca se emite factura sola.',
    puntos: ['DNI obligatorio y guardado en la ficha', 'Interruptor "exigir firma" por cliente', 'Huecos libres calculados con tu agenda', 'La firma pasa a la obra y a la factura'] },
  { title: '4. Agenda y Google Calendar', subtitle: 'Todas las citas en una vista propia', icon: CalendarDays, color: 'bg-indigo-500', tab: 'agenda',
    texto: 'Confirma la cita, asigna técnicos y envíala a Google Calendar (enlace directo, archivo .ics o inserción en la cuenta vinculada). La obra pasa a "En ejecución" y al terminar generas la factura con la firma del cliente.',
    puntos: ['Vista mes, semana y lista', 'Confirmación por WhatsApp con un clic', 'Inserción real en Google Calendar', 'Cierre de obra → factura'] },
  { title: '5. Facturas VERI*FACTU, gastos y banco', subtitle: 'Huella encadenada, extracto y conciliación', icon: Receipt, color: 'bg-purple-500', tab: 'ventas',
    texto: 'Cada factura genera su registro con huella SHA-256 encadenada y QR de cotejo (solo las facturas, nunca los presupuestos). Importa el extracto del banco (Norma 43 o CSV) y confirma los cruces que la app te propone.',
    puntos: ['QR y leyenda solo en facturas', 'Numeración correlativa automática', 'Importación Norma 43 / CSV real', 'Rectificativas R1-R4 y envío del PDF desde tu Gmail'] },
  { title: '6. Rentabilidad, impuestos y copias', subtitle: 'Cuánto ganas, cuánto apartar y dónde está todo', icon: TrendingUp, color: 'bg-rose-500', tab: 'rentabilidad',
    texto: 'Rentabilidad real por obra con el filtro de mes y año. Cuenta atrás de Hacienda con los modelos que te tocan. Copia de seguridad en archivo local y en la nube de tu cuenta de Google, con sincronización entre dispositivos.',
    puntos: ['Filtro mes/año en cada sección', 'Estimaciones marcadas como internas', 'Copia local (archivo) y en la nube', 'Sincronización en tiempo real'] },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onGoToTab, tipoEntidad }) => {
  const [idx, setIdx] = useState(0);
  if (!isOpen) return null;
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white p-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center"><Sparkles size={22} /></div>
            <div>
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Guía de inicio</span>
              <h2 className="text-xl font-black tracking-tight">Bienvenido a Control de Obra</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl cursor-pointer" title="Cerrar"><X size={20} /></button>
        </div>

        <div className="px-6 pt-4 flex gap-1.5">
          {STEPS.map((s, i) => <button key={s.title} type="button" onClick={() => setIdx(i)} className={`h-1.5 flex-1 rounded-full cursor-pointer ${i === idx ? 'bg-blue-600' : i < idx ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
        </div>

        <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl ${step.color} text-white flex items-center justify-center shrink-0 shadow-md`}><step.icon size={26} /></div>
            <div>
              <span className="text-xs font-bold text-slate-400">Paso {idx + 1} de {STEPS.length}</span>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">{step.title}</h3>
              <p className="text-xs font-semibold text-blue-600">{step.subtitle}</p>
            </div>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">{step.texto}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold text-slate-700">
            {step.puntos.map((p) => <div key={p} className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-800 rounded-xl"><CheckCircle2 size={15} className="text-emerald-600 shrink-0" /><span>{p}</span></div>)}
          </div>
          {idx === 0 && tipoEntidad && <p className="text-[11px] text-slate-500">Ahora mismo la app está configurada como <strong>{tipoEntidad === 'autonomo' ? 'autónomo' : 'empresa (sociedad)'}</strong>. Puedes cambiarlo en Configuración.</p>}
          {idx === 5 && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Cloud size={13} /> Google es opcional: sin vincular la cuenta, todo se guarda en este dispositivo y puedes exportar una copia cuando quieras.</p>}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button type="button" onClick={() => idx > 0 && setIdx(idx - 1)} disabled={idx === 0} className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40 cursor-pointer px-3 py-2">Anterior</button>
          <div className="flex items-center gap-2">
            {onGoToTab && <button type="button" onClick={() => onGoToTab(step.tab)} className="text-xs font-bold text-blue-600 hover:underline px-3 py-2 cursor-pointer">Ir a esta sección</button>}
            <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 cursor-pointer">Saltar</button>
            <button type="button" onClick={() => (isLast ? onClose() : setIdx(idx + 1))} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-md flex items-center gap-1.5 cursor-pointer">
              <span>{isLast ? 'Empezar' : 'Siguiente'}</span><ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
