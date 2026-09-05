import React, { useMemo, useRef, useState } from 'react';
import { Wallet, Upload, CheckCircle2, ArrowUpRight, ArrowDownRight, Search, X, AlertCircle, Link as LinkIcon, Building2, Lock, Trash2, Undo2, Info, FileText, ExternalLink } from 'lucide-react';
import { BankTransaction, Invoice, Expense, CompanySettings, BancoProveedor } from '../types';
import { formatCurrency } from '../utils/formatters';
import { PeriodFilter } from './PeriodFilter';
import { PeriodoFiltro, periodoActual, coincidePeriodo, aniosDisponibles, fechaES, etiquetaPeriodo, fechaHoraES } from '../utils/dates';
import { leerExtracto, aTransacciones, ResultadoLectura } from '../lib/norma43';
import { proponerCruces, PropuestaCruce } from '../lib/conciliacion';

interface Props {
  bankTransactions: BankTransaction[];
  invoices: Invoice[];
  expenses: Expense[];
  companySettings: CompanySettings;
  onUpdateCompanySettings: (s: CompanySettings) => void;
  onReconcileTransaction: (txId: string, refId: string, tipo: 'factura_venta' | 'gasto_compra', nombre?: string) => void;
  onUnreconcileTransaction: (txId: string) => void;
  onImportTransactions: (nuevas: BankTransaction[]) => void;
  onDeleteTransaction: (id: string) => void;
}

const PROVEEDORES: Array<{ id: BancoProveedor; nombre: string; desc: string; servidor: boolean }> = [
  { id: 'manual', nombre: 'Importación manual del extracto', desc: 'Descargas el Norma 43 o CSV de tu banca online y lo importas aquí. Gratis, dos minutos al mes, sin dar credenciales a nadie.', servidor: false },
  { id: 'gocardless', nombre: 'GoCardless Bank Account Data', desc: 'Agregador PSD2 con plan gratuito. Te identificas en tu banco y devuelve un permiso de lectura de 90 a 180 días.', servidor: true },
  { id: 'enablebanking', nombre: 'Enable Banking', desc: 'Agregador PSD2 europeo con API sencilla y cuota mensual baja.', servidor: true },
  { id: 'arcopay', nombre: 'Afterbanks / Arcopay', desc: 'Agregador español regulado por el Banco de España, con widget de selección de banco. Contrato a medida.', servidor: true },
  { id: 'tink', nombre: 'Tink (Visa)', desc: 'Agregador PSD2 orientado a empresas grandes.', servidor: true },
];

export const ReconciliationView: React.FC<Props> = ({ bankTransactions, invoices, expenses, companySettings, onUpdateCompanySettings, onReconcileTransaction, onUnreconcileTransaction, onImportTransactions, onDeleteTransaction }) => {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoActual());
  const [filtro, setFiltro] = useState<'pendientes' | 'conciliados' | 'todos'>('pendientes');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<BankTransaction | null>(null);
  const [busquedaManual, setBusquedaManual] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [lectura, setLectura] = useState<{ res: ResultadoLectura; nuevas: BankTransaction[]; duplicadas: number; nombre: string } | null>(null);
  const [entidadImport, setEntidadImport] = useState(companySettings.bancoConexion?.entidad || companySettings.bancoNombre || '');
  const [showConexion, setShowConexion] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const anios = aniosDisponibles(bankTransactions.map((t) => t.fecha));
  const conexion = companySettings.bancoConexion || { conectado: false, proveedor: 'manual' as BancoProveedor, entidad: '' };

  const filtrados = useMemo(() => bankTransactions.filter((t) => {
    if (!coincidePeriodo(t.fecha, periodo)) return false;
    if (filtro === 'pendientes' && t.conciliado) return false;
    if (filtro === 'conciliados' && !t.conciliado) return false;
    const q = busqueda.toLowerCase();
    return !q || t.concepto.toLowerCase().includes(q) || String(Math.abs(t.importe)).includes(q) || (t.referencia || '').toLowerCase().includes(q);
  }).sort((a, b) => b.fecha.localeCompare(a.fecha)), [bankTransactions, periodo, filtro, busqueda]);

  const propuestas = useMemo(() => {
    const map = new Map<string, PropuestaCruce[]>();
    bankTransactions.filter((t) => !t.conciliado).forEach((t) => map.set(t.id, proponerCruces(t, invoices, expenses)));
    return map;
  }, [bankTransactions, invoices, expenses]);

  const ultimoConSaldo = [...bankTransactions].sort((a, b) => b.fecha.localeCompare(a.fecha)).find((t) => t.saldoPosterior !== undefined);
  const pendientes = bankTransactions.filter((t) => !t.conciliado).length;
  const conPropuestaAlta = bankTransactions.filter((t) => !t.conciliado && (propuestas.get(t.id) || [])[0]?.confianza === 'alta').length;

  const leerArchivo = async (file: File) => {
    const texto = await file.text();
    const res = leerExtracto(texto, file.name);
    const { nuevas, duplicadas } = aTransacciones(res, entidadImport || 'Banco', bankTransactions);
    setLectura({ res, nuevas, duplicadas, nombre: file.name });
  };
  const confirmarImport = () => {
    if (!lectura) return;
    onImportTransactions(lectura.nuevas);
    if (entidadImport && entidadImport !== conexion.entidad) onUpdateCompanySettings({ ...companySettings, bancoNombre: companySettings.bancoNombre || entidadImport, bancoConexion: { ...conexion, entidad: entidadImport } });
    setAviso(`Importados ${lectura.nuevas.length} movimientos de ${lectura.nombre}${lectura.duplicadas ? ` (${lectura.duplicadas} ya existían y se han omitido)` : ''}.`);
    setLectura(null);
    setShowImport(false);
    setTimeout(() => setAviso(null), 6000);
  };

  const candidatosManuales = useMemo(() => {
    if (!seleccion) return [];
    const q = busquedaManual.toLowerCase();
    if (seleccion.importe > 0) return invoices.filter((i) => !['Anulada', 'Rectificada'].includes(i.estado) && !i.bancoConciliado && (!q || i.numero.toLowerCase().includes(q) || i.clienteNombre.toLowerCase().includes(q))).slice(0, 8).map((i) => ({ tipo: 'factura_venta' as const, id: i.id, nombre: `${i.numero} · ${i.clienteNombre}`, importe: i.total, fecha: i.fecha }));
    return expenses.filter((e) => !e.bancoConciliado && (!q || e.proveedor.toLowerCase().includes(q) || (e.numeroFactura || '').toLowerCase().includes(q) || e.concepto.toLowerCase().includes(q))).slice(0, 8).map((e) => ({ tipo: 'gasto_compra' as const, id: e.id, nombre: `${e.numeroFactura || 'Gasto'} · ${e.proveedor}`, importe: e.total, fecha: e.fecha }));
  }, [seleccion, busquedaManual, invoices, expenses]);

  const guardarConexion = (proveedor: BancoProveedor, entidad: string, notas: string) => {
    onUpdateCompanySettings({ ...companySettings, bancoNombre: companySettings.bancoNombre || entidad, bancoConexion: { ...conexion, proveedor, entidad, notas, conectado: proveedor === 'manual' ? !!entidad : false } });
    setShowConexion(false);
  };

  const badgeConfianza = (c: PropuestaCruce['confianza']) => c === 'alta' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : c === 'media' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Wallet className="text-blue-600" size={28} /> Banco y conciliación</h1>
            <span className={`text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 ${conexion.entidad ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}><span className={`w-2 h-2 rounded-full ${conexion.entidad ? 'bg-emerald-500' : 'bg-slate-400'}`} />{conexion.entidad ? `${conexion.entidad} · ${PROVEEDORES.find((p) => p.id === conexion.proveedor)?.nombre.split(' ')[0] || 'manual'}` : 'Sin cuenta asociada'}</span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Importa el extracto y confirma los cruces propuestos. Nada se concilia sin tu confirmación · {etiquetaPeriodo(periodo)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter value={periodo} onChange={setPeriodo} anios={anios} totalFiltrado={filtrados.length} totalGlobal={bankTransactions.filter((t) => (filtro === 'todos') || (filtro === 'pendientes' ? !t.conciliado : t.conciliado)).length} />
          <button onClick={() => setShowConexion(true)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xs flex items-center gap-2 cursor-pointer"><LinkIcon size={16} /> {conexion.entidad ? 'Cuenta asociada' : 'Asociar cuenta'}</button>
          <button onClick={() => { setLectura(null); setShowImport(true); }} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"><Upload size={16} /> Importar extracto</button>
        </div>
      </div>

      {aviso && <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 text-xs font-bold"><span className="flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /> {aviso}</span><button onClick={() => setAviso(null)} className="cursor-pointer"><X size={16} /></button></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Saldo según extracto</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{ultimoConSaldo ? formatCurrency(ultimoConSaldo.saldoPosterior!) : '—'}</p>
          <p className="text-[11px] text-slate-500 mt-2">{ultimoConSaldo ? `Al ${fechaES(ultimoConSaldo.fecha)} · ${ultimoConSaldo.entidad}` : 'Importa un extracto con saldos para verlo aquí'}{conexion.ultimaImportacion ? ` · última importación ${fechaHoraES(conexion.ultimaImportacion)}` : ''}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pendientes de conciliar</p>
          <p className={`text-2xl font-black mt-1 ${pendientes ? 'text-amber-600' : 'text-emerald-600'}`}>{pendientes}</p>
          <p className="text-[11px] text-slate-500 mt-2">{conPropuestaAlta} con una propuesta de confianza alta</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Cómo se cruzan</p>
          <p className="text-sm font-black text-slate-900 mt-1">Importe, número de factura, nombre y fecha</p>
          <p className="text-[11px] text-slate-500 mt-2">Confianza alta: importe exacto y referencia. Media: importe y nombre. Baja: solo importe.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><Wallet size={16} className="text-indigo-600" /> Movimientos</h2>
            <div className="flex items-center gap-2">
              <div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-xs w-36" /></div>
              <div className="flex bg-slate-100/90 p-1 rounded-2xl">
                {(['pendientes', 'conciliados', 'todos'] as const).map((f) => <button key={f} onClick={() => setFiltro(f)} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${filtro === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>{f === 'pendientes' ? `Pendientes (${pendientes})` : f === 'conciliados' ? 'Conciliados' : 'Todos'}</button>)}
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {filtrados.length === 0 && <p className="text-xs text-slate-400 py-8 text-center">No hay movimientos {filtro === 'pendientes' ? 'pendientes' : ''} en {etiquetaPeriodo(periodo).toLowerCase()}.{bankTransactions.length === 0 && ' Importa el extracto de tu banco para empezar.'}</p>}
            {filtrados.map((tx) => {
              const props = propuestas.get(tx.id) || [];
              return (
                <div key={tx.id} className={`py-3.5 flex items-center justify-between gap-4 cursor-pointer rounded-xl px-2 -mx-2 ${seleccion?.id === tx.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`} onClick={() => { setSeleccion(tx); setBusquedaManual(''); }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${tx.tipo === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>{tx.tipo === 'ingreso' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}</div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs line-clamp-1">{tx.concepto}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{fechaES(tx.fecha)} · {tx.entidad}{tx.origen === 'demo' ? ' · ejemplo' : ''}{tx.conciliadoCon ? ` · ${tx.conciliadoCon.referenciaNombre}` : ''}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-black text-xs md:text-sm ${tx.tipo === 'ingreso' ? 'text-emerald-600' : 'text-slate-900'}`}>{tx.tipo === 'ingreso' ? '+' : ''}{formatCurrency(tx.importe)}</span>
                    <div>{tx.conciliado ? <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 justify-end"><CheckCircle2 size={11} /> Conciliado</span> : props[0] ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeConfianza(props[0].confianza)}`}>Propuesta {props[0].confianza}</span> : <span className="text-[10px] font-bold text-slate-400">Sin propuesta</span>}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100"><h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Cruzar movimiento</h2>{seleccion && <button onClick={() => setSeleccion(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={16} /></button>}</div>
          {!seleccion ? (
            <div className="text-center py-10 space-y-2 text-slate-400"><Info size={28} className="mx-auto" /><p className="text-xs font-bold text-slate-600">Selecciona un movimiento de la izquierda</p><p className="text-[11px]">Verás las propuestas de cruce y podrás buscar el documento a mano.</p></div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1">Movimiento</p>
                <div className="flex justify-between items-center gap-2"><span className="font-bold text-slate-900">{seleccion.concepto}</span><span className="font-black text-slate-900 text-sm shrink-0">{formatCurrency(seleccion.importe)}</span></div>
                <p className="text-[11px] text-slate-500 mt-1">{fechaES(seleccion.fecha)} · {seleccion.entidad}{seleccion.referencia ? ` · ref. ${seleccion.referencia}` : ''}</p>
                <div className="flex gap-2 mt-2">
                  {seleccion.conciliado && <button onClick={() => { onUnreconcileTransaction(seleccion.id); setSeleccion({ ...seleccion, conciliado: false, conciliadoCon: undefined }); }} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 cursor-pointer"><Undo2 size={12} /> Deshacer cruce</button>}
                  <button onClick={() => { if (confirm('¿Eliminar este movimiento del extracto?')) { onDeleteTransaction(seleccion.id); setSeleccion(null); } }} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-rose-600 flex items-center gap-1 cursor-pointer"><Trash2 size={12} /> Eliminar</button>
                </div>
              </div>

              {seleccion.conciliado ? (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900"><p className="font-bold flex items-center gap-1.5"><CheckCircle2 size={14} /> Conciliado con {seleccion.conciliadoCon?.referenciaNombre}</p></div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Propuestas</p>
                    {(propuestas.get(seleccion.id) || []).length === 0 && <p className="text-slate-400 text-[11px]">No hay ningún documento con importe parecido. Busca a mano abajo o registra primero la factura o el gasto.</p>}
                    {(propuestas.get(seleccion.id) || []).map((p) => (
                      <div key={p.referenciaId} className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                        <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900">{p.referenciaNombre}</p><p className="text-[11px] text-slate-500">{formatCurrency(p.importeDoc)} · {p.tipo === 'factura_venta' ? 'factura emitida' : 'gasto'}</p></div><span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeConfianza(p.confianza)}`}>Confianza {p.confianza}</span></div>
                        <ul className="text-[11px] text-slate-500 space-y-0.5">{p.motivos.map((m) => <li key={m}>· {m}</li>)}</ul>
                        <button onClick={() => { onReconcileTransaction(seleccion.id, p.referenciaId, p.tipo, p.referenciaNombre); setSeleccion(null); }} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer"><CheckCircle2 size={13} /> Confirmar este cruce</button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Buscar a mano</p>
                    <input value={busquedaManual} onChange={(e) => setBusquedaManual(e.target.value)} placeholder={seleccion.importe > 0 ? 'Número de factura o cliente…' : 'Proveedor, número o concepto…'} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50" />
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {candidatosManuales.length === 0 && <p className="p-3 text-slate-400 text-[11px]">Sin documentos pendientes que coincidan.</p>}
                      {candidatosManuales.map((c) => <div key={c.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50"><div className="min-w-0"><p className="font-bold text-slate-800 truncate">{c.nombre}</p><p className="text-[10px] text-slate-400">{fechaES(c.fecha)} · {formatCurrency(c.importe)}{Math.abs(c.importe - Math.abs(seleccion.importe)) > 0.01 ? ` (difiere ${formatCurrency(c.importe - Math.abs(seleccion.importe))})` : ''}</p></div><button onClick={() => { onReconcileTransaction(seleccion.id, c.id, c.tipo, c.nombre); setSeleccion(null); }} className="px-2.5 py-1 bg-slate-900 text-white rounded-lg font-bold text-[11px] shrink-0 cursor-pointer">Cruzar</button></div>)}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* IMPORTAR */}
      {showImport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center"><h3 className="font-bold text-slate-900 text-base flex items-center gap-2"><Upload size={18} className="text-blue-600" /> Importar extracto bancario</h3><button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <p className="text-xs text-slate-500">Descarga el extracto desde tu banca online en formato <strong>Norma 43</strong> (también llamado cuaderno 43, AEB43, .n43 o .q43) o en <strong>CSV/Excel guardado como CSV</strong>. El archivo se lee en tu navegador y no se envía a ningún sitio.</p>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Nombre del banco / cuenta</label><input value={entidadImport} onChange={(e) => setEntidadImport(e.target.value)} placeholder="Ej.: Banco X · cuenta empresa" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" /></div>
            <input type="file" ref={fileRef} accept=".n43,.q43,.aeb,.txt,.csv,.tsv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f); e.target.value = ''; }} />
            <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) leerArchivo(f); }} className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50 cursor-pointer">
              <Upload size={28} className="mx-auto text-blue-600 mb-2" /><p className="text-xs font-bold text-slate-700">Arrastra el archivo aquí o haz clic para elegirlo</p><p className="text-[10px] text-slate-400 mt-1">.n43 · .q43 · .txt · .csv</p>
            </div>
            {lectura && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <p className="font-bold text-slate-900 flex items-center gap-2"><FileText size={14} /> {lectura.nombre} · formato {lectura.res.formato === 'norma43' ? 'Norma 43' : 'CSV'}{lectura.res.cuenta ? ` · cuenta ${lectura.res.cuenta}` : ''}</p>
                <p>{lectura.res.movimientos.length} movimientos leídos · <strong className="text-emerald-700">{lectura.nuevas.length} nuevos</strong>{lectura.duplicadas ? ` · ${lectura.duplicadas} ya importados` : ''}</p>
                {lectura.res.avisos.map((a) => <p key={a} className="text-amber-800 flex items-start gap-1"><AlertCircle size={12} className="shrink-0 mt-0.5" /> {a}</p>)}
                {lectura.nuevas.length > 0 && <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">{lectura.nuevas.slice(0, 50).map((t) => <div key={t.id} className="p-2 flex justify-between gap-2"><span className="truncate">{fechaES(t.fecha)} · {t.concepto}</span><span className={`font-bold shrink-0 ${t.importe > 0 ? 'text-emerald-700' : ''}`}>{formatCurrency(t.importe)}</span></div>)}{lectura.nuevas.length > 50 && <p className="p-2 text-slate-400">… y {lectura.nuevas.length - 50} más</p>}</div>}
              </div>
            )}
            <div className="flex gap-2"><button onClick={() => setShowImport(false)} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 cursor-pointer">Cancelar</button><button disabled={!lectura || lectura.nuevas.length === 0} onClick={confirmarImport} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer">Importar {lectura?.nuevas.length || ''} movimientos</button></div>
          </div>
        </div>
      )}

      {/* CONEXIÓN */}
      {showConexion && <ModalConexion conexion={conexion} onClose={() => setShowConexion(false)} onGuardar={guardarConexion} onImportar={() => { setShowConexion(false); setShowImport(true); }} />}
    </div>
  );
};

const ModalConexion: React.FC<{ conexion: NonNullable<CompanySettings['bancoConexion']>; onClose: () => void; onGuardar: (p: BancoProveedor, entidad: string, notas: string) => void; onImportar: () => void }> = ({ conexion, onClose, onGuardar, onImportar }) => {
  const [proveedor, setProveedor] = useState<BancoProveedor>(conexion.proveedor || 'manual');
  const [entidad, setEntidad] = useState(conexion.entidad || '');
  const [notas, setNotas] = useState(conexion.notas || '');
  const info = PROVEEDORES.find((p) => p.id === proveedor)!;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400"><Building2 size={22} /></div><div><h3 className="font-black text-base">Asociar cuenta bancaria</h3><p className="text-xs text-slate-400">Cómo llegan los movimientos a la app</p></div></div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div><label className="block font-bold text-slate-700 mb-1">Banco y cuenta (para identificar los movimientos)</label><input value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="Ej.: Banco X · cuenta empresa ····1234" className="w-full border border-slate-200 rounded-xl px-3 py-2" /><p className="text-[10px] text-slate-400 mt-1">No escribas aquí usuarios ni contraseñas de tu banca online.</p></div>
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Método de lectura</label>
            <div className="space-y-2">
              {PROVEEDORES.map((p) => (
                <label key={p.id} className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer ${proveedor === p.id ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="prov" checked={proveedor === p.id} onChange={() => setProveedor(p.id)} className="mt-0.5" />
                  <div><p className="font-bold text-slate-900 flex items-center gap-2">{p.nombre}{p.servidor && <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Requiere servidor</span>}{!p.servidor && <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Disponible ya</span>}</p><p className="text-[11px] text-slate-500 mt-0.5">{p.desc}</p></div>
                </label>
              ))}
            </div>
          </div>
          {info.servidor && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5"><Lock size={14} /> Por qué no se puede conectar desde aquí</p>
              <p className="text-[11px]">Los agregadores PSD2 exigen guardar un secreto de API y recibir la redirección del banco en un servidor. En una web estática como esta el secreto quedaría a la vista de cualquiera. Guarda aquí tu elección y, mientras tanto, importa el extracto a mano. El estudio completo está en <code>docs/ESTUDIO-SINCRONIZACION-BANCARIA.md</code>.</p>
              <a href="https://bankaccountdata.gocardless.com/" target="_blank" rel="noreferrer" className="text-[11px] font-bold underline flex items-center gap-1">Más información <ExternalLink size={11} /></a>
            </div>
          )}
          <div><label className="block font-bold text-slate-700 mb-1">Notas</label><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Ej.: descargar el Norma 43 el día 1 de cada mes desde Banca online > Cuentas > Exportar" className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">Cancelar</button>
            {proveedor === 'manual' && <button onClick={() => { onGuardar(proveedor, entidad, notas); onImportar(); }} className="flex-1 py-2.5 bg-white border border-blue-200 text-blue-700 rounded-xl font-bold cursor-pointer">Guardar e importar ahora</button>}
            <button onClick={() => onGuardar(proveedor, entidad, notas)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
