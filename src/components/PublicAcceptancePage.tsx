import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, ShieldCheck, FileText, Clock, CalendarDays, Copy, Check, Phone, Mail } from 'lucide-react';
import { leerPropuesta, enviarAceptacion, PropuestaPublica } from '../lib/propuestas';
import { generarCodigoAceptacion, sha256Hex, validarDniCif } from '../utils/acceptanceCrypto';
import { formatCurrency, formatDate, telefonoWhatsApp } from '../utils/formatters';
import { textoHueco } from '../lib/agenda';
import { HuecoPropuesto } from '../types';
import { SignaturePad } from './SignaturePad';

// Página que ve el CLIENTE en su móvil al abrir el enlace ?aceptar=TOKEN. No requiere sesión.
export const PublicAcceptancePage: React.FC<{ token: string }> = ({ token }) => {
  const [propuesta, setPropuesta] = useState<PropuestaPublica | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [terminos, setTerminos] = useState(false);
  const [firma, setFirma] = useState<string | null>(null);
  const [hueco, setHueco] = useState<HuecoPropuesto | null>(null);
  const [ningunHueco, setNingunHueco] = useState(false);
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    leerPropuesta(token)
      .then((p) => {
        if (!p) setError('Este enlace no corresponde a ningún presupuesto o ha sido retirado.');
        else {
          setPropuesta(p);
          setNombre(p.presupuesto.clienteNombre || '');
          setDni(p.presupuesto.clienteNif || '');
        }
      })
      .catch((e) => setError(`No se ha podido cargar el presupuesto (${e?.code || e?.message || 'error'}). Comprueba tu conexión o pide al instalador que te reenvíe el enlace.`))
      .finally(() => setCargando(false));
  }, [token]);

  const aceptar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propuesta) return;
    setErrorForm(null);
    if (!nombre.trim()) return setErrorForm('Indica tu nombre y apellidos (o razón social).');
    const v = validarDniCif(dni);
    if (!v.valido) return setErrorForm(v.mensaje || 'Indica un DNI/CIF válido.');
    if (!terminos) return setErrorForm('Marca la casilla de conformidad con el presupuesto.');
    if (propuesta.exigirFirma && !firma) return setErrorForm('Falta la firma en el recuadro.');
    if (propuesta.huecos.length > 0 && !hueco && !ningunHueco) return setErrorForm('Elige un hueco para la instalación o marca que ninguno te viene bien.');
    setEnviando(true);
    try {
      const ahora = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const fechaFirma = `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}T${p(ahora.getHours())}:${p(ahora.getMinutes())}:${p(ahora.getSeconds())}`;
      const hash = await sha256Hex(`${propuesta.presupuesto.codigo}|${propuesta.presupuesto.total}|${nombre.trim()}|${dni.trim().toUpperCase()}|${fechaFirma}`);
      const cod = generarCodigoAceptacion({ v: 1, n: propuesta.presupuesto.codigo, h: hash.slice(0, 16), t: ahora.toISOString(), nm: nombre.trim(), d: dni.trim().toUpperCase(), f: firma ? 'si' : undefined });
      await enviarAceptacion(token, {
        firmadoPor: nombre.trim(),
        dni: dni.trim().toUpperCase(),
        fechaFirma,
        trazoFirma: firma || undefined,
        codigoAceptacion: cod,
        huecoElegido: hueco || undefined,
        notasCliente: [ningunHueco ? 'Ningún hueco propuesto me viene bien.' : '', notas.trim()].filter(Boolean).join(' ') || undefined,
        userAgent: navigator.userAgent.substring(0, 120),
      });
      setCodigo(cod);
      // Aviso instantáneo al instalador por su script de Google (opcional). No bloquea la aceptación.
      if (propuesta.empresa.avisoUrl) {
        try {
          fetch(propuesta.empresa.avisoUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ tipo: 'aceptacion', codigo: propuesta.presupuesto.codigo, nombre: propuesta.presupuesto.nombre, cliente: nombre.trim(), dni: dni.trim().toUpperCase(), total: formatCurrency(propuesta.presupuesto.total), hueco: hueco ? textoHueco(hueco) : '', notas: notas.trim(), fecha: fechaFirma, codigoAceptacion: cod }) }).catch(() => undefined);
        } catch {
          // sin aviso: la aceptación ya está guardada
        }
      }
    } catch (err: any) {
      setErrorForm(`No se ha podido registrar la aceptación (${err?.code || err?.message || 'error'}). Inténtalo de nuevo o avisa al instalador.`);
    } finally {
      setEnviando(false);
    }
  };

  const copiar = () => {
    navigator.clipboard?.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (cargando) return <Pantalla><p className="text-sm text-slate-500 text-center py-10">Cargando presupuesto…</p></Pantalla>;
  if (error || !propuesta) return <Pantalla><div className="p-6 text-center space-y-2"><AlertCircle size={36} className="mx-auto text-rose-500" /><p className="text-sm font-bold text-slate-800">{error}</p></div></Pantalla>;

  const emp = propuesta.empresa;
  const pr = propuesta.presupuesto;
  const cerrada = propuesta.estado !== 'abierta';

  return (
    <Pantalla>
      <div className="bg-slate-900 text-white p-5 flex items-center gap-3">
        {emp.logoUrl ? <img src={emp.logoUrl} alt="Logo" className="w-11 h-11 rounded-xl bg-white p-1 object-contain" /> : <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center"><FileText size={20} /></div>}
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block">Presupuesto para tu aceptación</span>
          <h1 className="text-lg font-black">{emp.nombre}</h1>
          <p className="text-[11px] text-slate-400">{emp.razonSocial} · NIF {emp.nif} · {emp.telefono}</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-blue-600">{pr.codigo} · {formatDate(pr.fecha)}</p>
              <p className="font-black text-slate-900 mt-0.5">{pr.nombre}</p>
              <p className="text-xs text-slate-600">{pr.direccion}</p>
            </div>
            <div className="text-right bg-white px-3 py-2 rounded-xl border border-blue-200 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 block">Total con IVA</span>
              <span className="text-lg font-black text-blue-700 font-mono">{formatCurrency(pr.total)}</span>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500"><tr><th className="p-3">Concepto</th><th className="p-3 text-center">Cant.</th><th className="p-3 text-right">Importe</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pr.lineas.map((l, i) => (
                <tr key={i}>
                  <td className="p-3 font-medium text-slate-800">
                    {l.concepto}
                    {l.materiales && l.materiales.length > 0 && <ul className="mt-1 text-[11px] text-slate-500 space-y-0.5">{l.materiales.map((m, j) => <li key={j}>· {m.nombre} ({m.cantidad} {m.unidad})</li>)}</ul>}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">{l.cantidad} {l.unidad}</td>
                  <td className="p-3 text-right font-mono font-bold whitespace-nowrap">{formatCurrency(l.cantidad * l.precioUnitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 bg-slate-50 text-xs space-y-1">
            {!pr.sinImpuestos && <div className="flex justify-between"><span>Base imponible</span><span className="font-mono font-bold">{formatCurrency(pr.baseImponible)}</span></div>}
            {!pr.sinImpuestos && <div className="flex justify-between"><span>IVA</span><span className="font-mono font-bold">{formatCurrency(pr.ivaTotal)}</span></div>}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200"><span>{pr.sinImpuestos ? 'TOTAL (sin impuestos)' : 'TOTAL'}</span><span className="font-mono">{formatCurrency(pr.total)}</span></div>
            {pr.sinImpuestos && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">{pr.motivoSinImpuestos || 'Importes sin impuestos. Los que correspondan se aplicarán en la factura.'}</p>}
          </div>
        </div>

        {pr.notaFinal && <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700 whitespace-pre-line"><span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Condiciones</span>{pr.notaFinal}</div>}

        {codigo ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><CheckCircle2 size={36} /></div>
            <h3 className="text-xl font-black text-slate-900">Presupuesto aceptado</h3>
            <p className="text-sm text-slate-600">Hemos registrado tu aceptación del presupuesto <strong>{pr.codigo}</strong>{hueco ? ` y tu preferencia de cita (${textoHueco(hueco)})` : ''}. Queda guardada con fecha y hora.</p>
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900"><p className="font-bold">Un último paso: avísanos por el mismo medio por el que recibiste este presupuesto</p><p className="mt-1">Así {emp.nombre} lo ve al momento y te confirma la fecha de instalación cuanto antes. El mensaje ya va escrito, solo tienes que enviarlo.</p></div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tu código de aceptación (guárdalo)</span>
              <div className="flex gap-2"><input readOnly value={codigo} className="w-full font-mono text-[11px] bg-white p-2 rounded-lg border border-slate-300 select-all" /><button onClick={copiar} className="p-2 bg-slate-200 rounded-lg cursor-pointer">{copiado ? <Check size={15} /> : <Copy size={15} />}</button></div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {emp.telefono && <a href={`https://wa.me/${telefonoWhatsApp(emp.telefono)}?text=${encodeURIComponent(`Hola, acabo de aceptar el presupuesto ${pr.codigo}${hueco ? ` y he elegido el hueco ${textoHueco(hueco)}` : ''}. Código de aceptación: ${codigo}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"><Phone size={14} /> Avisar por WhatsApp</a>}
              {emp.email && <a href={`mailto:${emp.email}?subject=${encodeURIComponent(`Presupuesto ${pr.codigo} aceptado`)}&body=${encodeURIComponent(`Hola, acabo de aceptar el presupuesto ${pr.codigo} (${pr.nombre}).${hueco ? `\nHueco elegido: ${textoHueco(hueco)}.` : ''}\nCódigo de aceptación: ${codigo}\n\nUn saludo,\n${nombre}`)}`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold"><Mail size={14} /> Avisar por correo</a>}
            </div>
          </div>
        ) : cerrada ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2"><Clock size={18} className="shrink-0 mt-0.5" /><span>Este presupuesto ya está {propuesta.estado === 'aceptada' ? 'aceptado' : propuesta.estado === 'rechazada' ? 'rechazado' : 'cerrado'}. Si necesitas cambios, contacta con {emp.nombre} ({emp.telefono}).</span></div>
        ) : (
          <form onSubmit={aceptar} className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2"><ShieldCheck size={15} className="text-blue-600" /> 1. Tus datos (necesarios para la obra y la factura)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div><label className="block font-bold text-slate-700 mb-1">Nombre y apellidos / Razón social *</label><input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl" /></div>
                <div><label className="block font-bold text-slate-700 mb-1">DNI / NIE / CIF *</label><input required value={dni} onChange={(e) => setDni(e.target.value.toUpperCase())} placeholder="12345678Z" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase" /></div>
              </div>
            </div>

            {propuesta.huecos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2"><CalendarDays size={15} className="text-blue-600" /> 2. ¿Cuándo te viene bien la instalación?</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {propuesta.huecos.map((h) => {
                    const sel = hueco && hueco.fecha === h.fecha && hueco.franja === h.franja;
                    return (
                      <button type="button" key={`${h.fecha}${h.franja}`} onClick={() => { setHueco(h); setNingunHueco(false); }} className={`p-3 rounded-xl border text-left text-xs cursor-pointer ${sel ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                        <span className="font-bold block">{textoHueco(h)}</span>
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"><input type="checkbox" checked={ningunHueco} onChange={(e) => { setNingunHueco(e.target.checked); if (e.target.checked) setHueco(null); }} className="rounded" /> Ninguno me viene bien, que me llamen para concretar</label>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">{propuesta.huecos.length > 0 ? '3' : '2'}. Firma {propuesta.exigirFirma ? '(obligatoria)' : '(opcional)'}</div>
              {!propuesta.exigirFirma && <p className="text-[11px] text-slate-500">Para tu empresa no se exige firma manuscrita: basta con aceptar indicando nombre y CIF.</p>}
              <SignaturePad onChange={setFirma} />
            </div>

            <div><label className="block text-xs font-bold text-slate-700 mb-1">Observaciones (acceso al garaje, horario, llaves…)</label><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs" /></div>

            <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <input type="checkbox" checked={terminos} onChange={(e) => setTerminos(e.target.checked)} className="mt-0.5 w-4 h-4 rounded" />
              <span>He leído y acepto el presupuesto <strong>{pr.codigo}</strong> por <strong>{formatCurrency(pr.total)}</strong> {pr.sinImpuestos ? '(sin impuestos)' : '(IVA incluido)'} y sus condiciones. Mis datos se usarán únicamente para ejecutar y facturar esta instalación.</span>
            </label>

            {errorForm && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle size={16} /> {errorForm}</div>}

            <button type="submit" disabled={enviando} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              {enviando ? 'Registrando…' : <><CheckCircle2 size={18} /> Aceptar el presupuesto</>}
            </button>
          </form>
        )}
      </div>
      <div className="p-4 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 text-center">Aceptación comercial registrada con fecha, hora y código de verificación. {emp.email}</div>
    </Pantalla>
  );
};

const Pantalla: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-100 flex items-start justify-center p-3 sm:p-6">
    <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200">{children}</div>
  </div>
);
