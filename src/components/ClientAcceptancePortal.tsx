import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, FileText, ShieldCheck, ArrowLeft, CalendarDays } from 'lucide-react';
import { Project, Client, CompanySettings, FirmaCliente, HuecoPropuesto, CalendarInstallation } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { generarCodigoAceptacion, sha256Hex, validarDniCif } from '../utils/acceptanceCrypto';
import { huecosLibres, textoHueco } from '../lib/agenda';
import { SignaturePad } from './SignaturePad';
import { ahoraISO } from '../utils/dates';

interface Props {
  project: Project;
  companySettings: CompanySettings;
  client?: Client | null;
  calendarEvents?: CalendarInstallation[];
  onAcceptBudget: (projectId: string, firma: FirmaCliente, hueco?: HuecoPropuesto) => void;
  onClose?: () => void;
}

// Aceptación presencial: el instalador enseña esta pantalla al cliente en su propio móvil o tableta.
export const ClientAcceptancePortal: React.FC<Props> = ({ project, companySettings, client, calendarEvents = [], onAcceptBudget, onClose }) => {
  const [nombre, setNombre] = useState(project.clienteNombre || client?.nombre || '');
  const [dni, setDni] = useState(client?.nif || '');
  const [terminos, setTerminos] = useState(false);
  const [firma, setFirma] = useState<string | null>(null);
  const [hueco, setHueco] = useState<HuecoPropuesto | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const exigeFirma = client?.exigirFirma !== false;
  const yaAceptado = Boolean(project.firmaCliente);

  const total = useMemo(() => {
    const partidas = project.partidas || [];
    if (partidas.length === 0) return project.presupuestoAceptado * 1.21;
    return partidas.reduce((a, p) => a + p.cantidad * p.precioUnitario * (1 + p.ivaPorcentaje / 100), 0);
  }, [project]);

  const huecos = useMemo(() => (project.huecosPropuestos && project.huecosPropuestos.length > 0 ? project.huecosPropuestos : huecosLibres(calendarEvents, companySettings).slice(0, 6)), [project, calendarEvents, companySettings]);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!nombre.trim()) return setErrorMsg('Indica el nombre y apellidos del cliente.');
    const v = validarDniCif(dni);
    if (!v.valido) return setErrorMsg(v.mensaje || 'DNI/CIF no válido.');
    if (!terminos) return setErrorMsg('El cliente debe marcar la casilla de conformidad.');
    if (exigeFirma && !firma) return setErrorMsg('Falta la firma del cliente en el recuadro.');
    setEnviando(true);
    try {
      const fechaFirma = ahoraISO();
      const hash = await sha256Hex(`${project.codigo}|${total.toFixed(2)}|${nombre.trim()}|${dni.trim().toUpperCase()}|${fechaFirma}`);
      const codigo = generarCodigoAceptacion({ v: 1, n: project.codigo, h: hash.slice(0, 16), t: new Date().toISOString(), nm: nombre.trim(), d: dni.trim().toUpperCase(), f: firma ? 'si' : undefined });
      onAcceptBudget(project.id, { firmadoPor: nombre.trim(), dni: dni.trim().toUpperCase(), fechaFirma, trazoFirma: firma || undefined, codigoAceptacion: codigo, metodo: 'presencial' }, hueco || undefined);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al registrar la aceptación.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400"><FileText size={20} /></div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block">Aceptación presencial del presupuesto</span>
              <h2 className="text-lg font-black">{companySettings.nombreComercial || companySettings.razonSocial || 'Tu empresa'}</h2>
            </div>
          </div>
          {onClose && <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"><ArrowLeft size={18} /></button>}
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">Presupuesto</span>
              <p className="text-base font-black text-slate-900">{project.nombre}</p>
              <p className="text-xs text-slate-500">Ref. <strong className="font-mono">{project.codigo}</strong> · {formatDate(project.fechaInicio)} · {project.direccion}</p>
            </div>
            <div className="sm:text-right bg-white px-4 py-2.5 rounded-xl border border-blue-200/60 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 block">Total con IVA</span>
              <span className="text-lg font-black text-blue-700 font-mono">{formatCurrency(total)}</span>
            </div>
          </div>

          {yaAceptado ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-2">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span>Este presupuesto ya fue aceptado por <strong>{project.firmaCliente?.firmadoPor}</strong> ({project.firmaCliente?.dni}) el {formatDate(project.firmaCliente?.fechaFirma)}.</span>
            </div>
          ) : (
            <form onSubmit={confirmar} className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2"><ShieldCheck size={16} className="text-blue-600" /> 1. Identificación del cliente</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div><label className="block font-bold text-slate-700 mb-1">Nombre y apellidos / Razón social *</label><input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl" /></div>
                  <div><label className="block font-bold text-slate-700 mb-1">DNI / NIE / CIF *</label><input required value={dni} onChange={(e) => setDni(e.target.value.toUpperCase())} placeholder="12345678Z" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase" /><span className="text-[10px] text-slate-400 block mt-1">Se guarda en la ficha del cliente y se usa en la factura.</span></div>
                </div>
              </div>

              {huecos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2"><CalendarDays size={16} className="text-blue-600" /> 2. Hueco preferido para la instalación (opcional)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {huecos.map((h) => {
                      const sel = hueco && hueco.fecha === h.fecha && hueco.franja === h.franja;
                      return <button type="button" key={`${h.fecha}${h.franja}`} onClick={() => setHueco(sel ? null : h)} className={`p-3 rounded-xl border text-left text-xs cursor-pointer ${sel ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{textoHueco(h)}</button>;
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">3. Firma del cliente {exigeFirma ? '(obligatoria)' : '(opcional: este cliente no la exige)'}</div>
                <SignaturePad onChange={setFirma} />
              </div>

              <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <input type="checkbox" checked={terminos} onChange={(e) => setTerminos(e.target.checked)} className="mt-0.5 w-4 h-4 rounded" />
                <span>El cliente acepta el presupuesto <strong>{project.codigo}</strong> por <strong>{formatCurrency(total)}</strong> (IVA incluido) y sus condiciones.</span>
              </label>

              {errorMsg && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle size={16} /> {errorMsg}</div>}

              <button type="submit" disabled={enviando} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                <CheckCircle2 size={18} /> Registrar aceptación y crear la obra
              </button>
              <p className="text-[10px] text-slate-400 text-center">Aceptar no emite ninguna factura. La factura se genera cuando la obra termina.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
