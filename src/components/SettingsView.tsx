import React, { useEffect, useRef, useState } from 'react';
import { Settings, ShieldCheck, Building2, CheckCircle2, Save, Image, LayoutTemplate, Upload, Trash2, Plus, RefreshCw, AlertTriangle, Cloud, Link as LinkIcon, X, UserCheck, HardHat, Download, Database, Hash, FileText, CalendarDays, Info, Bell, Mail, Sparkles, Eye, EyeOff, Copy, Check, Lock } from 'lucide-react';
import { probarClaveGemini, ModeloGemini } from '../lib/gemini';
import { SCRIPT_AVISO_ACEPTACION, PASOS_SCRIPT } from '../data/appsScript';
import { CompanySettings, AppState, DisponibilidadTecnico } from '../types';
import { DEFAULT_TEMPLATES } from '../data/plantillas';
import { loginWithGoogle, logoutGoogleUser, guardarCopiaEnNube, cargarUltimaCopiaNube, tamanoDocumentoKB, LIMITE_FIRESTORE_KB, mensajeErrorAuth } from '../lib/cloudSync';
import { exportarCopia, importarCopia, leerCopiaAnterior, tamanoEstadoKB, anotarCopiaLocal, diasSinCopiaLocal } from '../lib/storage';
import { firebaseDisponible, configPendiente, claveMalCopiada, proyectoFirebase } from '../lib/firebase';
import { pedirPermisoGoogle, tieneToken, SCOPE_CALENDAR, SCOPE_GMAIL } from '../lib/googleToken';
import { TemplatesSettings } from './TemplatesSettings';
import { textoPrivacidad, ETIQUETA_CASILLA, ANIOS_CONSERVACION } from '../data/privacidad';
import { numeroDocumento } from '../utils/formatters';
import { fechaHoraES } from '../utils/dates';

interface Props {
  companySettings: CompanySettings;
  onSaveSettings: (s: CompanySettings) => void;
  onDeleteExamples: () => void;
  onCargarEjemplos: () => void;
  hayDemo: boolean;
  estadoCompleto: AppState;
  onRestaurarEstado: (st: AppState) => void;
  firebaseUser: any;
  estadoNube: string;
  errorNube: string | null;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<Props> = ({ companySettings, onSaveSettings, onDeleteExamples, onCargarEjemplos, hayDemo, estadoCompleto, onRestaurarEstado, firebaseUser, estadoNube, errorNube, onAviso }) => {
  const conPlantillas = (s: CompanySettings): CompanySettings => ({ ...s, plantillasPersonalizadas: s.plantillasPersonalizadas?.length ? s.plantillasPersonalizadas : DEFAULT_TEMPLATES });
  const [f, setF] = useState<CompanySettings>(conPlantillas(companySettings));
  const [guardado, setGuardado] = useState(false);
  // ¿hay ediciones sin guardar? Sirve para no pisarlas cuando llegan datos de la nube,
  // y para no subir un formulario obsoleto encima de lo que ya había en la cuenta.
  const [sinGuardar, setSinGuardar] = useState(false);
  const [llegaronCambios, setLlegaronCambios] = useState(false);

  // La configuración puede cambiar por debajo: al vincular la cuenta de Google, al sincronizar con
  // otro dispositivo o al restaurar una copia. Si no estás editando, el formulario se actualiza solo.
  useEffect(() => {
    if (sinGuardar) {
      setLlegaronCambios(true);
      return;
    }
    setF(conPlantillas(companySettings));
    setLlegaronCambios(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySettings]);
  const [nuevoTecnico, setNuevoTecnico] = useState('');
  const [permisoNotif, setPermisoNotif] = useState<'default' | 'granted' | 'denied' | 'no'>(typeof Notification === 'undefined' ? 'no' : (Notification.permission as any));
  const [copiadoScript, setCopiadoScript] = useState(false);
  const [claveVisible, setClaveVisible] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<{ ok: boolean; texto: string } | null>(null);
  const [modelosIA, setModelosIA] = useState<ModeloGemini[]>([]);
  const [dominioSinAutorizar, setDominioSinAutorizar] = useState(false);
  const dominioActual = typeof window !== 'undefined' ? window.location.hostname : '';
  const pedirNotif = async () => {
    try {
      const r = await Notification.requestPermission();
      setPermisoNotif(r as any);
      if (r === 'granted') new Notification('Avisos activados', { body: 'Así verás cuando un cliente acepte un presupuesto.' });
    } catch {
      // sin soporte
    }
  };
  const probarIA = async () => {
    setOcupado('ia');
    setResultadoIA(null);
    try {
      const r = await probarClaveGemini(f.geminiApiKey || '');
      setModelosIA(r.modelos);
      set('geminiModelo', r.modelo);
      setResultadoIA({ ok: true, texto: `${r.mensaje} Recuerda pulsar "Guardar cambios".` });
    } catch (e: any) {
      setResultadoIA({ ok: false, texto: e?.message || 'No funciona.' });
    } finally {
      setOcupado(null);
    }
  };
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState<{ st: AppState; origen: string } | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const certRef = useRef<HTMLInputElement>(null);
  const copiaRef = useRef<HTMLInputElement>(null);

  const autonomo = f.tipoEntidad === 'autonomo';
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => {
    setSinGuardar(true);
    setF((p) => ({ ...p, [k]: v }));
  };

  const disponibilidadDe = (t: string): DisponibilidadTecnico => (f.disponibilidadTecnicos || {})[t] || { manana: true, tarde: true };
  const anadirTecnico = () => {
    const n = nuevoTecnico.trim();
    if (!n) return;
    if ((f.tecnicos || []).some((x) => x.toLowerCase() === n.toLowerCase())) return onAviso?.(`Ya tienes un técnico llamado ${n}.`, 'error');
    set('tecnicos', [...(f.tecnicos || []), n]);
    set('disponibilidadTecnicos', { ...(f.disponibilidadTecnicos || {}), [n]: { manana: true, tarde: true } });
    setNuevoTecnico('');
  };

  const guardar = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSaveSettings(f);
    setSinGuardar(false);
    setLlegaronCambios(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  };

  // Descarta lo editado y recoge lo que haya llegado de la nube
  const recogerCambios = () => {
    setF(conPlantillas(companySettings));
    setSinGuardar(false);
    setLlegaronCambios(false);
    onAviso?.('Formulario actualizado con los datos de la cuenta.', 'ok');
  };

  const subirLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 300 * 1024) return alert('El logotipo debe pesar menos de 300 KB (se guarda dentro de la app y viaja a la nube con cada cambio).');
    const r = new FileReader();
    r.onload = () => set('logoUrl', r.result as string);
    r.readAsDataURL(file);
  };
  const subirCert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Solo se anota qué certificado se usará; el archivo .p12 no se guarda en el navegador
    const buf = await file.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':').substring(0, 59);
    setF((p) => ({ ...p, verifactuCertificado: { ...p.verifactuCertificado, instalado: false, archivoNombre: file.name, huellaSHA256: hash, nombreTitular: p.verifactuCertificado.nombreTitular || p.razonSocial } }));
    e.target.value = '';
  };

  const vincularGoogle = async () => {
    if (configPendiente) return onAviso?.('Falta completar firebase-config.json con los datos de tu proyecto de Firebase (apiKey, appId y messagingSenderId). Pasos en docs/PROYECTO-FIREBASE-PROPIO.md.', 'error');
    if (!firebaseDisponible) return onAviso?.('Firebase no está configurado en esta instalación.', 'error');
    setOcupado('google');
    try {
      const u = await loginWithGoogle();
      if (u) {
        const nuevo = { ...f, googleCalendarConectado: true, googleAccountEmail: u.email || '', email: f.email || u.email || '', nombreUsuario: f.nombreUsuario || u.displayName || '' };
        setF(nuevo);
        onSaveSettings(nuevo);
        onAviso?.(`Cuenta ${u.email} vinculada. Los datos se sincronizan con la nube.`, 'ok');
      }
    } catch (e: any) {
      if (e?.code === 'auth/unauthorized-domain') setDominioSinAutorizar(true);
      onAviso?.(mensajeErrorAuth(e), 'error');
    } finally {
      setOcupado(null);
    }
  };
  const desvincular = async () => {
    setOcupado('google');
    try {
      await logoutGoogleUser();
    } catch {
      // ignorar
    }
    const nuevo = { ...f, googleCalendarConectado: false };
    setF(nuevo);
    onSaveSettings(nuevo);
    setOcupado(null);
    onAviso?.('Sesión de Google cerrada. Los datos siguen guardados en este dispositivo.', 'info');
  };
  const permisoCalendar = async () => {
    setOcupado('calendar');
    try {
      const t = await pedirPermisoGoogle();
      onAviso?.(`Permiso de Google Calendar y Gmail concedido para ${t.email || 'tu cuenta'} (válido una hora).`, 'ok');
    } catch (e: any) {
      onAviso?.(mensajeErrorAuth(e), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const copiaLocal = () => {
    const nombre = exportarCopia(estadoCompleto);
    anotarCopiaLocal();
    const nuevo = { ...f, copias: { ...(f.copias || {}), ultimaLocal: new Date().toISOString() } };
    setF(nuevo);
    onSaveSettings(nuevo);
    onAviso?.(`Copia descargada: ${nombre}`, 'ok');
  };
  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const st = await importarCopia(file);
      setConfirmarRestaurar({ st, origen: file.name });
    } catch (err: any) {
      onAviso?.(err?.message || 'Archivo no válido.', 'error');
    }
    e.target.value = '';
  };
  const copiaNube = async () => {
    if (!firebaseUser) return onAviso?.('Vincula tu cuenta de Google para guardar copias en la nube.', 'error');
    setOcupado('nube');
    try {
      const r = await guardarCopiaEnNube(firebaseUser.uid, estadoCompleto, 'Copia manual desde Configuración');
      const nuevo = { ...f, copias: { ...(f.copias || {}), ultimaNube: r.fecha } };
      setF(nuevo);
      onSaveSettings(nuevo);
      onAviso?.('Copia guardada en la nube de tu cuenta.', 'ok');
    } catch (e: any) {
      onAviso?.(`No se pudo guardar la copia: ${e?.message || e}`, 'error');
    } finally {
      setOcupado(null);
    }
  };
  const restaurarNube = async () => {
    if (!firebaseUser) return;
    setOcupado('nube');
    try {
      const r = await cargarUltimaCopiaNube(firebaseUser.uid);
      if (!r) onAviso?.('No hay ninguna copia manual en la nube todavía.', 'info');
      else setConfirmarRestaurar({ st: r.estado, origen: `copia en la nube del ${fechaHoraES(r.fecha?.replace('Z', '') || '')}` });
    } finally {
      setOcupado(null);
    }
  };
  const restaurarAnterior = () => {
    const st = leerCopiaAnterior();
    if (!st) return onAviso?.('No hay una versión anterior guardada en este navegador.', 'info');
    setConfirmarRestaurar({ st, origen: `versión anterior de este dispositivo (${fechaHoraES(st.updatedAt.replace('Z', ''))})` });
  };

  const plantillas = f.plantillasPersonalizadas || DEFAULT_TEMPLATES;

  const priv = textoPrivacidad(f);

  const kb = tamanoEstadoKB(estadoCompleto);
  const kbNube = tamanoDocumentoKB(estadoCompleto);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Settings className="text-slate-700" size={28} /> Configuración</h1><p className="text-slate-500 text-sm mt-1">Datos de la empresa, numeración, plantillas, técnicos, Google, copias de seguridad y datos de ejemplo</p></div>
        <button onClick={() => guardar()} className="bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold px-5 py-2.5 rounded-2xl shadow-md flex items-center gap-2 cursor-pointer self-start"><Save size={16} /> {guardado ? 'Guardado' : 'Guardar cambios'}</button>
      </div>
      {guardado && <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold"><CheckCircle2 size={18} className="text-emerald-600" /> Configuración guardada.</div>}

      <form onSubmit={guardar} className="space-y-6">
        {/* 1. ENTIDAD Y DATOS FISCALES */}
        {llegaronCambios && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center gap-3">
            <AlertTriangle size={18} className="shrink-0" />
            <span className="flex-1">Han llegado datos de configuración de tu cuenta mientras editabas esta pantalla. Si guardas ahora, se conservará lo que ves aquí. Si prefieres los de la cuenta, recógelos antes de guardar.</span>
            <button type="button" onClick={recogerCambios} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer shrink-0">Recoger los datos de la cuenta</button>
          </div>
        )}

        <Seccion icono={<Building2 size={22} />} color="blue" titulo="Tu empresa o tu actividad como autónomo" sub="Estos datos se imprimen en presupuestos y facturas y deciden qué modelos de Hacienda te corresponden">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button type="button" onClick={() => set('tipoEntidad', 'empresa')} className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer ${!autonomo ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}><div className="flex items-center gap-2 font-black text-slate-900 text-sm"><Building2 size={16} className="text-blue-600" /> Empresa (S.L., S.L.U., S.A.)</div><p className="text-[11px] text-slate-500 mt-1">Impuesto sobre Sociedades (200/202), IVA 303, retenciones 111/115 si aplican.</p></button>
            <button type="button" onClick={() => set('tipoEntidad', 'autonomo')} className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer ${autonomo ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'}`}><div className="flex items-center gap-2 font-black text-slate-900 text-sm"><UserCheck size={16} className="text-emerald-600" /> Autónomo (persona física)</div><p className="text-[11px] text-slate-500 mt-1">IRPF 130 y Renta, IVA 303, retención en tus facturas a empresas.</p></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label={autonomo ? 'Nombre y apellidos *' : 'Razón social *'} value={f.razonSocial} onChange={(v) => set('razonSocial', v)} bold />
            <Campo label={autonomo ? 'NIF *' : 'CIF *'} value={f.cif} onChange={(v) => set('cif', v.toUpperCase())} mono />
            <Campo label="Nombre comercial (marca)" value={f.nombreComercial} onChange={(v) => set('nombreComercial', v)} />
            <Campo label="Epígrafe IAE / actividad" value={f.epigrafeIAE} onChange={(v) => set('epigrafeIAE', v)} placeholder="Ej.: 504.1 Instalaciones eléctricas" />
            <div className="md:col-span-2"><Campo label="Dirección fiscal" value={f.direccion} onChange={(v) => set('direccion', v)} /></div>
            <div className="grid grid-cols-3 gap-2"><Campo label="C. P." value={f.codigoPostal} onChange={(v) => set('codigoPostal', v)} /><div className="col-span-2"><Campo label="Ciudad" value={f.ciudad} onChange={(v) => set('ciudad', v)} /></div></div>
            <Campo label="Provincia" value={f.provincia || ''} onChange={(v) => set('provincia', v)} />
            <Campo label="Teléfono" value={f.telefono} onChange={(v) => set('telefono', v)} />
            <Campo label="Email" value={f.email} onChange={(v) => set('email', v)} />
            <Campo label="Web" value={f.web} onChange={(v) => set('web', v)} />
            <Campo label="Nombre del responsable (aparece en la bitácora)" value={f.nombreUsuario || ''} onChange={(v) => set('nombreUsuario', v)} />
            <Campo label="IBAN para cobros" value={f.ibanPrincipal} onChange={(v) => set('ibanPrincipal', v)} mono />
            <Campo label="Banco" value={f.bancoNombre} onChange={(v) => set('bancoNombre', v)} />
            {!autonomo && <div className="md:col-span-2"><Campo label="Datos registrales (Registro Mercantil)" value={f.registroMercantil} onChange={(v) => set('registroMercantil', v)} placeholder="Inscrita en el Registro Mercantil de …, tomo …, folio …, hoja …" /></div>}
          </div>
          <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-xs font-black text-slate-800">Situación fiscal (decide los modelos que se muestran)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {autonomo && <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer"><input type="checkbox" checked={!!f.aplicaRetencionIrpf} onChange={(e) => set('aplicaRetencionIrpf', e.target.checked)} className="rounded" /><span>Aplico retención de IRPF en facturas a empresas</span><select value={f.retencionIrpfPorcentaje || 15} onChange={(e) => set('retencionIrpfPorcentaje', Number(e.target.value))} className="ml-auto border border-slate-200 rounded-lg px-2 py-1 bg-white"><option value={7}>7 %</option><option value={15}>15 %</option></select></label>}
              <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer"><input type="checkbox" checked={!!f.tieneEmpleados} onChange={(e) => set('tieneEmpleados', e.target.checked)} className="rounded" /><span>Tengo empleados o retengo a profesionales (modelos 111 y 190)</span></label>
              <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer"><input type="checkbox" checked={!!f.pagaAlquiler} onChange={(e) => set('pagaAlquiler', e.target.checked)} className="rounded" /><span>Pago alquiler de local con retención (modelos 115 y 180)</span></label>
              <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer"><input type="checkbox" checked={!!f.operacionesIntracomunitarias} onChange={(e) => set('operacionesIntracomunitarias', e.target.checked)} className="rounded" /><span>Compro o vendo a empresas de la UE (modelo 349)</span></label>
            </div>
          </div>
        </Seccion>

        {/* 2. LOGO */}
        <Seccion icono={<Image size={22} />} color="blue" titulo="Logotipo" sub="Aparece en el menú, los presupuestos y las facturas">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0 p-2">{f.logoUrl ? <img src={f.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <Image size={32} className="text-slate-300" />}</div>
            <div className="space-y-2 flex-1"><input type="file" ref={logoRef} accept="image/*" onChange={subirLogo} className="hidden" /><div className="flex gap-2 flex-wrap"><button type="button" onClick={() => logoRef.current?.click()} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"><Upload size={15} /> Elegir imagen (PNG, JPG, SVG, máx. 300 KB)</button>{f.logoUrl && <button type="button" onClick={() => set('logoUrl', '')} className="px-3 py-2.5 text-rose-600 font-bold text-xs flex items-center gap-1 cursor-pointer"><Trash2 size={13} /> Quitar</button>}</div><p className="text-[11px] text-slate-500">Consejo: un PNG con fondo transparente de unos 600 px de ancho se ve bien en pantalla y en papel.</p></div>
          </div>
        </Seccion>

        {/* 3. NUMERACIÓN Y DOCUMENTOS */}
        <Seccion icono={<Hash size={22} />} color="indigo" titulo="Numeración y textos de los documentos" sub="Escribe {AAAA} donde quieras que aparezca el año. Las facturas deben ser correlativas dentro de cada serie.">
          <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
            <div className="flex-1"><p className="font-bold text-slate-800">Margen objetivo</p><p className="text-[11px] text-slate-500">Se usa para sugerir el precio de venta de materiales, kits y partidas. Siempre puedes escribir el precio a mano.</p></div>
            <div className="flex items-center gap-2 shrink-0"><input type="number" min="0" max="500" value={f.margenObjetivo ?? 40} onChange={(e) => set('margenObjetivo', Number(e.target.value))} className="w-24 border border-slate-200 rounded-xl px-3 py-2 font-black text-right" /><span className="font-bold text-slate-600">% sobre el coste</span></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
            {([['prefijoPresupuestos', 'siguienteNumeroPresupuesto', 'Presupuestos'], ['prefijoObras', 'siguienteNumeroObra', 'Obras'], ['prefijoFacturas', 'siguienteNumeroFactura', 'Facturas'], ['prefijoRectificativas', 'siguienteNumeroRectificativa', 'Rectificativas']] as Array<[keyof CompanySettings, keyof CompanySettings, string]>).map(([pk, nk, label]) => (
              <div key={label} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <p className="font-black text-slate-800">{label}</p>
                <div className="flex gap-2 min-w-0"><input value={f[pk] as string} onChange={(e) => set(pk, e.target.value as any)} title="Prefijo de la serie" className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 font-mono" /><input type="number" min={1} value={f[nk] as number} onChange={(e) => set(nk, Number(e.target.value) as any)} title="Siguiente número" className="w-16 shrink-0 border border-slate-200 rounded-xl px-2 py-2 font-mono text-center" /></div>
                <p className="text-[11px] text-slate-500">Siguiente: <strong className="font-mono">{numeroDocumento(f[pk] as string, f[nk] as number)}</strong></p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-2"><Info size={15} className="shrink-0 mt-0.5" /><span>La validez, el vencimiento, los textos al pie, la plantilla, el IVA y la forma de pago por defecto se ajustan desde el botón <b>Ajustes</b> de las pestañas <b>Presupuestos</b> y <b>Facturas</b>, cada uno en la suya.</span></div>
        </Seccion>

        {/* 4. TÉCNICOS Y FRANJAS */}
        <Seccion icono={<HardHat size={22} />} color="amber" titulo="Técnicos y franjas horarias" sub="Para asignar citas y calcular los huecos libres que se proponen al cliente. Cada técnico puede cubrir solo una franja y tener su propio horario.">
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-bold text-slate-800">Horario general de la empresa</p>
                <span className="text-[10px] text-slate-400">Es el que se aplica a quien no tenga horario propio</span>
              </div>
              {(['manana', 'tarde'] as const).map((k) => {
                const activa = f.franjasActivas?.[k] !== false;
                return (
                  <div key={k} className={`flex items-center gap-2 flex-wrap ${activa ? '' : 'opacity-60'}`}>
                    <label className="flex items-center gap-1.5 w-24 font-bold text-slate-600 cursor-pointer"><input type="checkbox" checked={activa} onChange={() => set('franjasActivas', { manana: true, tarde: true, ...(f.franjasActivas || {}), [k]: !activa })} className="accent-emerald-600" /> {k === 'manana' ? 'Mañana' : 'Tarde'}</label>
                    <input type="time" disabled={!activa} value={f.franjas[k].inicio} onChange={(e) => set('franjas', { ...f.franjas, [k]: { ...f.franjas[k], inicio: e.target.value } })} className="border border-slate-200 rounded-xl px-2 py-1.5" /><span>a</span><input type="time" disabled={!activa} value={f.franjas[k].fin} onChange={(e) => set('franjas', { ...f.franjas, [k]: { ...f.franjas[k], fin: e.target.value } })} className="border border-slate-200 rounded-xl px-2 py-1.5" />
                    {!activa && <span className="text-[10px] text-rose-600 font-bold">No se ofrece a los clientes</span>}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-800">Técnicos</p>
              {(f.tecnicos || []).map((t) => {
                const d = disponibilidadDe(t);
                const cambiar = (k: 'manana' | 'tarde', campos: Partial<DisponibilidadTecnico>) => set('disponibilidadTecnicos', { ...(f.disponibilidadTecnicos || {}), [t]: { ...d, ...campos } });
                const setHoras = (k: 'manana' | 'tarde', campo: 'inicio' | 'fin', v: string) => {
                  const base = { ...(d.horas || {}) };
                  base[k] = { ...(base[k] || f.franjas[k]), [campo]: v };
                  cambiar(k, { horas: base });
                };
                const propio = (k: 'manana' | 'tarde') => !!d.horas?.[k];
                return (
                  <div key={t} className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 font-black flex items-center justify-center shrink-0">{t.trim().charAt(0).toUpperCase()}</span>
                      <span className="font-black text-slate-900 flex-1 truncate">{t}</span>
                      <button type="button" onClick={() => { const disp = { ...(f.disponibilidadTecnicos || {}) }; delete disp[t]; set('disponibilidadTecnicos', disp); set('tecnicos', f.tecnicos.filter((x) => x !== t)); }} className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0" title="Quitar este técnico"><X size={15} /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(['manana', 'tarde'] as const).map((k) => {
                        const empresaActiva = f.franjasActivas?.[k] !== false;
                        const horas = d.horas?.[k] || f.franjas[k];
                        return (
                          <div key={k} className={`p-2.5 rounded-xl border ${d[k] && empresaActiva ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'} ${empresaActiva ? '' : 'opacity-50'}`}>
                            <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                              <input type="checkbox" checked={d[k] && empresaActiva} disabled={!empresaActiva} onChange={() => cambiar(k, { [k]: !d[k] } as any)} className="accent-emerald-600" />
                              {k === 'manana' ? 'Mañana' : 'Tarde'}
                              {!empresaActiva && <span className="text-[10px] font-normal text-slate-400">(desactivada para todos)</span>}
                            </label>
                            {d[k] && empresaActiva && (
                              <div className="mt-1.5 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input type="time" value={horas.inicio} onChange={(e) => setHoras(k, 'inicio', e.target.value)} className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white" />
                                  <span className="text-slate-400">a</span>
                                  <input type="time" value={horas.fin} onChange={(e) => setHoras(k, 'fin', e.target.value)} className="border border-slate-200 rounded-lg px-1.5 py-1 bg-white" />
                                </div>
                                <p className="text-[10px] text-slate-400">{propio(k) ? <>Horario propio. <button type="button" onClick={() => { const base = { ...(d.horas || {}) }; delete base[k]; cambiar(k, { horas: Object.keys(base).length ? base : undefined }); }} className="text-blue-600 font-bold hover:underline cursor-pointer">Usar el general</button></> : 'Sigue el horario general; cámbialo aquí si este técnico hace otro.'}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {(f.tecnicos || []).length === 0 && <p className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500">Sin técnicos: se usará tu nombre con el horario general.</p>}
            </div>

            <div className="p-3.5 bg-slate-900 rounded-2xl space-y-2">
              <p className="font-bold text-white">Añadir un técnico</p>
              <div className="flex gap-2">
                <input value={nuevoTecnico} onChange={(e) => setNuevoTecnico(e.target.value)} placeholder="Nombre del técnico" className="flex-1 border border-slate-700 bg-slate-800 text-white rounded-xl px-3 py-2 placeholder:text-slate-500" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); anadirTecnico(); } }} />
                <button type="button" onClick={anadirTecnico} className="px-4 py-2 bg-white text-slate-900 rounded-xl font-black cursor-pointer flex items-center gap-1.5"><Plus size={14} /> Añadir</button>
              </div>
              <p className="text-[11px] text-slate-400">Entra cubriendo las dos franjas con el horario general. Después ajustas en su tarjeta qué franjas hace y a qué horas.</p>
            </div>

            <p className="text-[10px] text-slate-400">Los huecos que se proponen al cliente se calculan de lunes a viernes con las franjas activas. Una franja se ofrece mientras quede algún técnico que la cubra y no tenga ya cita. Al confirmar la cita con un técnico asignado, se usan las horas de ese técnico.</p>
          </div>
        </Seccion>

        {/* 5. PLANTILLAS */}
        <Seccion icono={<LayoutTemplate size={22} />} color="indigo" titulo="Plantillas de presupuesto y factura" sub="Elige el modelo, el color y la tipografía aquí, con vista previa en vivo. Los documentos se imprimen siempre con la plantilla predeterminada. La zona fiscal de la factura (identificación, totales, QR y leyenda VERI*FACTU) no se puede ocultar.">
          <TemplatesSettings settings={f} plantillas={plantillas} plantillaPorDefecto={f.plantillaPorDefecto} onChangePlantillas={(lista) => set('plantillasPersonalizadas', lista)} onChangeDefecto={(id) => set('plantillaPorDefecto', id)} />
        </Seccion>

        {/* 6. GOOGLE Y NUBE */}
        <Seccion icono={<Cloud size={22} />} color="indigo" titulo="Cuenta de Google, nube y Google Calendar" sub="Opcional. Con la cuenta vinculada, los datos se guardan en la nube y se sincronizan en todos tus dispositivos en tiempo real.">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
            {configPendiente && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> {claveMalCopiada ? "La clave de Firebase está mal copiada" : "Falta completar firebase-config.json"}</p>
                <p>{claveMalCopiada ? "La apiKey del archivo firebase-config.json no tiene el formato de una clave de Google: seguramente se copió de la consola mientras estaba oculta y se copiaron los puntos de la máscara. Muéstrala con el icono del ojo y vuelve a copiarla. " : ""}El archivo tiene huecos sin rellenar o mal copiados, así que la nube y el enlace de aceptación están desactivados. En la consola de Firebase de tu proyecto, rueda dentada → <strong>Configuración del proyecto</strong> → apartado <strong>Tus apps</strong> → aplicación web → <strong>Configuración del SDK</strong>. Copia <strong>apiKey</strong>, <strong>appId</strong> y <strong>messagingSenderId</strong> y pégalos en <span className="font-mono">firebase-config.json</span>, en la raíz del proyecto. Todo lo demás de la app funciona mientras tanto, guardando en este dispositivo.</p>
              </div>
            )}
            {dominioSinAutorizar && !configPendiente && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> Falta autorizar este dominio en Firebase</p>
                <p>El navegador está en <strong className="font-mono">{dominioActual}</strong>. Añádelo en la consola de Firebase <strong>del proyecto {proyectoFirebase}</strong> → Authentication → Settings → Authorized domains → Add domain. Escríbelo tal cual, sin https:// y sin barra final. Comprueba que el proyecto es el correcto: si autorizaste el dominio en otro proyecto distinto, hay que cambiar <span className="font-mono">firebase-config.json</span>.</p>
                <div className="flex items-center gap-2 pt-1"><button type="button" onClick={() => { navigator.clipboard?.writeText(dominioActual); onAviso?.(`Dominio ${dominioActual} copiado.`, 'ok'); }} className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer flex items-center gap-1"><Copy size={12} /> Copiar el dominio</button><a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="px-2.5 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg font-bold">Abrir la consola de Firebase</a></div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-blue-600 shadow-xs">G</div><div><p className="font-bold text-slate-900">{firebaseUser ? `Vinculada: ${firebaseUser.email}` : 'Sin cuenta vinculada'}</p><p className="text-slate-500 text-[11px]">{firebaseUser ? (estadoNube === 'error' ? `Error de nube: ${errorNube}` : estadoNube === 'sincronizado' ? 'Datos sincronizados con la nube.' : 'Sincronizando…') : 'Los datos se guardan solo en este navegador.'}</p></div></div>
              {firebaseUser ? <button type="button" onClick={desvincular} disabled={ocupado === 'google'} className="px-4 py-2 rounded-xl font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center gap-2 cursor-pointer"><LinkIcon size={13} /> Cerrar sesión</button> : <button type="button" onClick={vincularGoogle} disabled={ocupado === 'google' || !firebaseDisponible} className="px-4 py-2 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 cursor-pointer disabled:opacity-50">{ocupado === 'google' ? <RefreshCw size={13} className="animate-spin" /> : <LinkIcon size={13} />} Vincular cuenta de Google</button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-slate-200">
              <div className="p-3 bg-white rounded-xl border border-slate-200"><p className="font-bold text-slate-800 flex items-center gap-1.5"><Database size={13} className="text-indigo-600" /> Nube</p><p className="text-[11px] text-slate-500 mt-1">Estado completo en Firestore de tu cuenta. Tamaño actual {kbNube} KB de {LIMITE_FIRESTORE_KB} KB{kbNube > LIMITE_FIRESTORE_KB * 0.8 ? ' · cerca del límite: reduce fotos incrustadas' : ''}.</p></div>
              <div className="p-3 bg-white rounded-xl border border-slate-200"><p className="font-bold text-slate-800 flex items-center gap-1.5"><CalendarDays size={13} className="text-emerald-600" /> Google Calendar y Gmail</p><p className="text-[11px] text-slate-500 mt-1">{tieneToken(SCOPE_CALENDAR) && tieneToken(SCOPE_GMAIL) ? 'Permiso activo (una hora): citas en tu calendario y envío de PDF desde tu Gmail.' : 'Permiso no concedido aún. También se pide al guardar una cita o al enviar un correo.'}</p><button type="button" onClick={permisoCalendar} disabled={!firebaseDisponible || ocupado === 'calendar'} className="mt-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px] cursor-pointer disabled:opacity-50">Conceder permiso</button><input value={f.googleCalendarId || 'primary'} onChange={(e) => set('googleCalendarId', e.target.value)} className="mt-1.5 w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono" title="ID del calendario (primary = principal)" /></div>
              <div className="p-3 bg-white rounded-xl border border-slate-200"><p className="font-bold text-slate-800 flex items-center gap-1.5"><Info size={13} className="text-slate-500" /> Aceptación desde el móvil del cliente</p><p className="text-[11px] text-slate-500 mt-1">Requiere la cuenta vinculada: el presupuesto se publica en la nube con un enlace único y la aceptación llega a la app al instante.</p></div>
            </div>
          </div>
        </Seccion>

        {/* 6b. AVISOS */}
        <Seccion icono={<Bell size={22} />} color="amber" titulo="Avisos cuando el cliente acepta" sub="Con la app abierta el aviso llega al instante, con sonido y el botón para proponer franjas. Para enterarte con la app cerrada, un script gratuito de tu cuenta de Google te envía un correo.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <p className="font-bold text-slate-800 flex items-center gap-1.5"><Bell size={13} className="text-amber-600" /> Aviso del navegador</p>
              <p className="text-[11px] text-slate-500">{permisoNotif === 'granted' ? 'Permitido: cuando llegue una aceptación verás una notificación aunque estés en otra pestaña o con la ventana detrás.' : permisoNotif === 'denied' ? 'Bloqueado en este navegador. Actívalo en los ajustes del sitio (icono del candado junto a la dirección).' : permisoNotif === 'no' ? 'Este navegador no admite notificaciones.' : 'Sin permiso todavía. Pídelo una vez en cada dispositivo.'}</p>
              {permisoNotif === 'default' && <button type="button" onClick={pedirNotif} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer flex items-center gap-1.5"><Bell size={13} /> Permitir avisos en este dispositivo</button>}
              <p className="text-[10px] text-slate-400">Si el cliente acepta con la app cerrada, la aceptación no se pierde: queda guardada en la nube y aparece en cuanto abres la app.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <p className="font-bold text-slate-800 flex items-center gap-1.5"><Mail size={13} className="text-blue-600" /> Correo automático con un script de Google (gratis)</p>
              <input value={f.avisoScriptUrl || ''} onChange={(e) => set('avisoScriptUrl', e.target.value.trim())} placeholder="https://script.google.com/macros/s/…/exec" className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono text-[11px]" />
              {f.avisoScriptUrl && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(f.avisoScriptUrl) && <p className="text-[11px] text-rose-600 font-bold">La dirección debe empezar por https://script.google.com/macros/s/ y terminar en /exec.</p>}
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-slate-600">{PASOS_SCRIPT.map((p) => <li key={p}>{p}</li>)}</ol>
              <div className="flex items-center gap-2"><button type="button" onClick={() => { navigator.clipboard?.writeText(SCRIPT_AVISO_ACEPTACION); setCopiadoScript(true); setTimeout(() => setCopiadoScript(false), 2000); }} className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer flex items-center gap-1.5">{copiadoScript ? <Check size={13} /> : <Copy size={13} />} {copiadoScript ? 'Copiado' : 'Copiar el código del script'}</button><span className="text-[10px] text-slate-400">Detalle en docs/AVISOS-Y-LECTOR-IA.md</span></div>
              <p className="text-[10px] text-slate-400">El correo sale de tu propia cuenta y Gmail te avisa en el móvil. WhatsApp o SMS necesitarían una pasarela de pago y no están incluidos.</p>
            </div>
          </div>
        </Seccion>

        {/* 6c. LECTOR CON IA */}
        <Seccion icono={<Sparkles size={22} />} color="indigo" titulo="Lector de tickets y facturas con IA" sub="En Gastos, al adjuntar la foto de un ticket o el PDF de una factura, la IA rellena proveedor, importes, fecha y categoría. Tú lo revisas antes de guardar: nada se guarda solo.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">Tu clave de la API de Gemini</label>
              <div className="flex gap-2">
                <input type={claveVisible ? 'text' : 'password'} value={f.geminiApiKey || ''} onChange={(e) => { set('geminiApiKey', e.target.value.trim()); setResultadoIA(null); }} placeholder="AIza…" className="flex-1 border border-slate-200 rounded-xl px-3 py-2 font-mono text-[11px]" autoComplete="off" />
                <button type="button" onClick={() => setClaveVisible(!claveVisible)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl cursor-pointer" title={claveVisible ? 'Ocultar' : 'Mostrar'}>{claveVisible ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                <button type="button" onClick={probarIA} disabled={!f.geminiApiKey || ocupado === 'ia'} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">{ocupado === 'ia' ? 'Probando…' : 'Probar'}</button>
              </div>
              {resultadoIA && <p className={`text-[11px] font-bold ${resultadoIA.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{resultadoIA.texto}</p>}
              {modelosIA.length > 0 && (
                <div><label className="block font-bold text-slate-700 mb-1">Modelo que se usará</label><select value={f.geminiModelo || ''} onChange={(e) => set('geminiModelo', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono text-[11px]">{modelosIA.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}</select><p className="text-[10px] text-slate-400 mt-1">Se ha elegido el más rápido y económico que lee imágenes. Puedes cambiarlo si prefieres otro.</p></div>
              )}
              {f.geminiModelo && modelosIA.length === 0 && <p className="text-[11px] text-slate-500">Modelo guardado: <span className="font-mono">{f.geminiModelo}</span></p>}
              {f.geminiApiKey && <button type="button" onClick={() => { set('geminiApiKey', ''); set('geminiModelo', ''); setModelosIA([]); setResultadoIA(null); }} className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer">Quitar la clave</button>}
              <p className="text-[10px] text-slate-400">Es tu clave, de tu cuenta de Google: no va en el código de la app. Se guarda en tu configuración y se sincroniza entre tus dispositivos por tu nube (solo tu cuenta puede leerla). No se incluye en las copias de seguridad que exportas.</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
              <p className="font-bold text-slate-800">Cómo conseguirla (gratis, 2 minutos)</p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                <li>Entra en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">aistudio.google.com/apikey</a> con tu cuenta de Google.</li>
                <li>Pulsa <strong>Create API key</strong>. Si te pide proyecto, elige el de la app o crea uno nuevo.</li>
                <li>Copia la clave (empieza por AIza) y pégala aquí. Pulsa <strong>Probar</strong> y luego <strong>Guardar cambios</strong>.</li>
                <li>En Gastos → Nuevo gasto → Adjuntar, aparecerá el botón <strong>Leer los datos con IA</strong>.</li>
              </ol>
              <p className="text-[10px] text-slate-400">La foto del ticket se envía a Google para leerla. El nivel gratuito da de sobra para el uso diario. La app pregunta a Google qué modelos admite tu clave y elige uno actual, así no se queda obsoleta cuando Google retira alguno.</p>
            </div>
          </div>
        </Seccion>

        {/* 7. COPIAS */}
        {(() => {
          const dias = diasSinCopiaLocal(f);
          const cada = f.copias?.recordarCadaDias ?? 7;
          if (dias !== null && dias < cada) return null;
          return (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center gap-3">
              <AlertTriangle size={18} className="shrink-0" />
              <span className="flex-1">{dias === null ? 'Todavía no has descargado ninguna copia a tu ordenador. La nube de Google es cómoda, pero si pierdes la cuenta lo pierdes todo: guarda un archivo tuyo.' : `Han pasado ${dias} días desde tu última copia local. Descarga una y guárdala en un disco aparte.`}</span>
              <button type="button" onClick={copiaLocal} className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer shrink-0 flex items-center gap-1.5"><Download size={14} /> Descargar copia ahora</button>
            </div>
          );
        })()}

        <Seccion icono={<Database size={22} />} color="emerald" titulo="Copias de seguridad" sub={`Todo lo que hay en la app ocupa ${kb} KB. Guarda una copia local (archivo) con regularidad, y otra en la nube si tienes Google vinculado.`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <p className="font-black text-slate-900 flex items-center gap-1.5"><Download size={14} /> Copia local (archivo JSON)</p>
              <p className="text-slate-500 text-[11px]">Se descarga a tu ordenador o móvil. Guárdala en tu Drive o disco. {f.copias?.ultimaLocal ? `Última: ${fechaHoraES(f.copias.ultimaLocal.replace('Z', ''))}.` : 'Aún no has hecho ninguna.'}</p>
              <div className="flex gap-2 flex-wrap"><button type="button" onClick={copiaLocal} className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer">Descargar copia</button><input type="file" ref={copiaRef} accept=".json" className="hidden" onChange={importar} /><button type="button" onClick={() => copiaRef.current?.click()} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">Restaurar desde archivo</button><button type="button" onClick={restaurarAnterior} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer" title="Versión guardada automáticamente antes de la última carga desde la nube o restauración">Versión anterior</button></div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <p className="font-black text-slate-900 flex items-center gap-1.5"><Cloud size={14} /> Nube de Google</p>
              {firebaseUser && (
                <p className={`text-[11px] font-bold ${estadoNube === 'error' ? 'text-rose-700' : estadoNube === 'sincronizado' ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {estadoNube === 'sincronizado' ? `Sincronización continua al día · último cambio guardado ${fechaHoraES(estadoCompleto.updatedAt.replace('Z', ''))}` : estadoNube === 'guardando' ? 'Guardando el último cambio en la nube…' : estadoNube === 'cargando' ? 'Cargando desde la nube…' : estadoNube === 'error' ? `No se ha podido guardar en la nube${errorNube ? `: ${errorNube}` : ''}` : 'Sin conexión con la nube.'}
                </p>
              )}
              <p className="text-slate-500 text-[11px]">Cada vez que guardas algo (también el botón «Guardar cambios» de arriba) se sube solo a tu cuenta. Aparte, puedes guardar una <b>foto manual</b> del estado completo, que se conserva aunque sigas trabajando y se puede restaurar. {f.copias?.ultimaNube ? `Última foto manual: ${fechaHoraES(f.copias.ultimaNube.replace('Z', ''))}.` : firebaseUser ? 'Aún no has guardado ninguna foto manual.' : 'Requiere Google vinculado.'}</p>
              <div className="flex gap-2 flex-wrap"><button type="button" onClick={copiaNube} disabled={!firebaseUser || ocupado === 'nube'} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">Guardar foto manual</button><button type="button" onClick={restaurarNube} disabled={!firebaseUser || ocupado === 'nube'} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer disabled:opacity-50">Restaurar la última foto</button></div>
            </div>
          </div>
        </Seccion>

        {/* 8. CERTIFICADO */}
        <Seccion icono={<ShieldCheck size={24} />} color="emerald" titulo="Certificado digital y envío a la AEAT" sub="La huella y el QR se generan aquí. El envío de los registros a la AEAT exige firmar con el certificado en un servidor.">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" /><span>No subas aquí tu certificado .p12: un navegador no puede custodiarlo con seguridad. Anota solo qué certificado usarás. La remisión a la AEAT se hace desde la versión con servidor o a través de tu gestoría; en cada factura puedes marcar "enviada" con el CSV que devuelve la AEAT. Obligatorio para sociedades desde el 1-1-2027 y para autónomos desde el 1-7-2027 (RDL 15/2025).</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-3">
            <Campo label="Titular del certificado" value={f.verifactuCertificado.nombreTitular} onChange={(v) => set('verifactuCertificado', { ...f.verifactuCertificado, nombreTitular: v })} />
            <Campo label="Emisor (FNMT, Camerfirma…)" value={f.verifactuCertificado.emisor} onChange={(v) => set('verifactuCertificado', { ...f.verifactuCertificado, emisor: v })} />
            <Campo label="Caducidad" value={f.verifactuCertificado.caducidad} onChange={(v) => set('verifactuCertificado', { ...f.verifactuCertificado, caducidad: v })} placeholder="DD/MM/AAAA" />
            <div><label className="block font-bold text-slate-700 mb-1">Huella del archivo (solo para identificarlo)</label><div className="flex gap-2"><input value={f.verifactuCertificado.huellaSHA256} readOnly className="flex-1 border border-slate-200 rounded-xl px-3 py-2 font-mono text-[10px] bg-slate-50" /><input type="file" ref={certRef} accept=".p12,.pfx,.cer,.crt,.pem" className="hidden" onChange={subirCert} /><button type="button" onClick={() => certRef.current?.click()} className="px-3 py-2 bg-slate-100 rounded-xl font-bold cursor-pointer" title="Calcula la huella del archivo sin guardarlo"><FileText size={14} /></button></div>{f.verifactuCertificado.archivoNombre && <p className="text-[10px] text-slate-400 mt-1">Archivo: {f.verifactuCertificado.archivoNombre} (no se ha guardado)</p>}</div>
          </div>
        </Seccion>

        {/* 8b. PROTECCIÓN DE DATOS */}
        <Seccion icono={<Lock size={22} />} color="indigo" titulo="Protección de datos (RGPD)" sub="Este es el texto exacto que ve el cliente antes de aceptar y firmar un presupuesto. Se genera con tus datos de empresa.">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-2">
            <Info size={15} className="shrink-0 mt-0.5" />
            <span>No se pide <b>consentimiento</b>, se <b>informa</b>. La base legal es ejecutar el contrato (art. 6.1.b) y cumplir la obligación de facturar (art. 6.1.c): si pidieras consentimiento, el cliente podría retirarlo y te quedarías sin poder facturar. Por eso la casilla dice «{ETIQUETA_CASILLA}», que es la prueba de que le informaste, y queda guardada con la aceptación.</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Resumen que se ve en pantalla</p>
            <p className="text-xs text-slate-600">{priv.resumen}</p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Información completa (se despliega al pulsar «Leer la información completa»)</p>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(priv.detalle.replace(/\*\*/g, '')); onAviso?.('Texto copiado. Puedes pegarlo en tu web o en un anexo en papel.', 'ok'); }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"><Copy size={13} /> Copiar texto</button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {priv.detalle.split('\n').map((l, i) => l.trim() === '' ? <div key={i} className="h-1" /> : (
                <p key={i} className="text-[11px] text-slate-600 leading-relaxed">
                  {l.split('**').map((trozo, j) => j % 2 ? <b key={j} className="text-slate-900">{trozo}</b> : <span key={j}>{trozo}</span>)}
                </p>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Los datos que aparecen (razón social, NIF, domicilio y correo) salen del apartado «Entidad y datos fiscales». Si los cambias, el texto se actualiza solo. Conservación fijada en {ANIOS_CONSERVACION} años (Código de Comercio); los datos de una factura emitida no se pueden borrar antes de ese plazo. Si algún día tratas datos de más de un puñado de clientes con empleados a tu cargo, revisa con tu gestoría el registro de actividades de tratamiento: es un documento interno de una página, no hay que presentarlo en ningún sitio.</p>
        </Seccion>

        {/* 9. EJEMPLOS */}
        <div className="bg-white p-6 rounded-3xl border border-rose-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center"><Trash2 size={22} /></div><div><h2 className="font-black text-slate-900 text-base">Datos de ejemplo</h2><p className="text-xs text-slate-500">{hayDemo ? 'La app contiene registros de muestra (clientes, obras, facturas, gastos, citas y movimientos bancarios).' : 'No hay datos de ejemplo cargados.'}</p></div></div>
            {hayDemo ? <button type="button" onClick={onDeleteExamples} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"><Trash2 size={15} /> Borrar todos los ejemplos</button> : <button type="button" onClick={onCargarEjemplos} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"><RefreshCw size={15} /> Cargar ejemplos para probar</button>}
          </div>
          <p className="text-[11px] text-slate-500">Al borrar los ejemplos también se desvincula la cuenta bancaria de muestra. Tus datos, el catálogo y los kits se conservan.</p>
        </div>
      </form>

      {/* EDITOR DE PLANTILLA */}

      {confirmarRestaurar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto"><AlertTriangle size={24} /></div>
            <div className="text-center space-y-1"><h3 className="font-black text-slate-900 text-base">¿Restaurar esta copia?</h3><p className="text-xs text-slate-500">Origen: {confirmarRestaurar.origen}. Contiene {confirmarRestaurar.st.clients.length} clientes, {confirmarRestaurar.st.projects.length} presupuestos/obras, {confirmarRestaurar.st.invoices.length} facturas y {confirmarRestaurar.st.expenses.length} gastos. Los datos actuales se sustituyen (queda una versión anterior recuperable en este dispositivo).</p></div>
            <div className="flex gap-2"><button onClick={() => setConfirmarRestaurar(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button><button onClick={() => { onRestaurarEstado(confirmarRestaurar.st); setF(confirmarRestaurar.st.companySettings); setConfirmarRestaurar(null); }} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs cursor-pointer">Sí, restaurar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const Seccion: React.FC<{ icono: React.ReactNode; color: string; titulo: string; sub: string; accion?: React.ReactNode; children: React.ReactNode }> = ({ icono, color, titulo, sub, accion, children }) => {
  const cls = { blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600' }[color] || 'bg-slate-50 text-slate-600';
  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${cls}`}>{icono}</div><div><h2 className="font-black text-slate-900 text-base">{titulo}</h2><p className="text-xs text-slate-500">{sub}</p></div></div>
        {accion}
      </div>
      {children}
    </div>
  );
};

const Campo: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; bold?: boolean; mono?: boolean }> = ({ label, value, onChange, placeholder, bold, mono }) => (
  <div><label className="block text-xs font-bold text-slate-700 mb-1">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-xs ${bold ? 'font-bold' : ''} ${mono ? 'font-mono' : ''}`} /></div>
);
