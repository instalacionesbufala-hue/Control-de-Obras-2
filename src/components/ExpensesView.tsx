import React, { useMemo, useRef, useState } from 'react';
import { Receipt, Plus, Search, HardHat, Building2, CheckCircle2, X, Eye, RefreshCw, Edit3, Trash2, Paperclip, Download, AlertCircle, Info, Sparkles } from 'lucide-react';
import { extraerDatosTicket, comprimirImagen, DatosTicket } from '../lib/gemini';
import { Expense, Project, Supplier, CompanySettings, ExpenseCategoria } from '../types';
import { formatCurrency, formatDate, uid, redondear2 } from '../utils/formatters';
import { PeriodFilter } from './PeriodFilter';
import { PeriodoFiltro, periodoActual, coincidePeriodo, aniosDisponibles, hoyISO, etiquetaPeriodo } from '../utils/dates';

interface Props {
  expenses: Expense[];
  projects: Project[];
  suppliers?: Supplier[];
  companySettings: CompanySettings;
  onCreateExpense: (expense: Expense) => void;
  onCreateSupplier?: (supplier: Supplier) => void;
  onUpdateExpense: (id: string, campos: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => void;
  showNewExpenseModal: boolean;
  setShowNewExpenseModal: (v: boolean) => void;
  preselectedProject?: Project | null;
}

const CATEGORIAS: ExpenseCategoria[] = ['Materiales', 'Subcontratas', 'Alquiler Maquinaria', 'Herramientas', 'Vehículo / Combustible', 'Gestoría / Asesoría', 'Seguros y PRL', 'Suministros / Taller', 'Software y Comunicaciones', 'Marketing', 'Otros'];
const METODOS = ['Tarjeta', 'Transferencia Bancaria', 'Domiciliación', 'Efectivo', 'Bizum'];
const LIMITE_ADJUNTO = 400 * 1024;

type Form = { proveedor: string; cifProveedor: string; numeroFactura: string; concepto: string; tipo: 'SL' | 'Obra'; categoria: ExpenseCategoria; obraId: string; baseImponible: number; ivaPorcentaje: number; irpfRetencion: number; fecha: string; metodoPago: string; estadoPago: 'Pagado' | 'Pendiente'; esRecurrente: boolean; adjuntoNombre?: string; adjuntoDataUrl?: string };
const formVacio = (p?: Project | null): Form => ({ proveedor: '', cifProveedor: '', numeroFactura: '', concepto: '', tipo: p ? 'Obra' : 'SL', categoria: 'Materiales', obraId: p?.id || '', baseImponible: 0, ivaPorcentaje: 21, irpfRetencion: 0, fecha: hoyISO(), metodoPago: 'Tarjeta', estadoPago: 'Pagado', esRecurrente: false });

export const ExpensesView: React.FC<Props> = ({ expenses, projects, suppliers = [], companySettings, onCreateExpense, onCreateSupplier, onUpdateExpense, onDeleteExpense, showNewExpenseModal, setShowNewExpenseModal, preselectedProject }) => {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoActual());
  const [tab, setTab] = useState<'todos' | 'SL' | 'Obra' | 'recurrentes'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('todas');
  const [verDetalle, setVerDetalle] = useState<Expense | null>(null);
  const [editando, setEditando] = useState<Expense | null>(null);
  const [aBorrar, setABorrar] = useState<Expense | null>(null);
  const [form, setForm] = useState<Form>(formVacio(preselectedProject));
  const [altaProveedor, setAltaProveedor] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Lector con IA: el archivo se guarda aparte (puede ser más grande que lo que cabe en el gasto) y solo se envía al pulsar el botón
  const [archivoIA, setArchivoIA] = useState<string | null>(null);
  const [leyendoIA, setLeyendoIA] = useState(false);
  const [avisoIA, setAvisoIA] = useState<{ texto: string; tipo: 'ok' | 'aviso' } | null>(null);
  const hayIA = !!companySettings.geminiApiKey?.trim();
  const fileRef = useRef<HTMLInputElement>(null);
  const anios = aniosDisponibles(expenses.map((e) => e.fecha));

  React.useEffect(() => {
    if (showNewExpenseModal) {
      setForm(formVacio(preselectedProject));
      setError(null);
      setArchivoIA(null);
      setAvisoIA(null);
    }
  }, [showNewExpenseModal, preselectedProject]);

  const filtrados = useMemo(() => expenses.filter((e) => {
    if (!coincidePeriodo(e.fecha, periodo)) return false;
    if (tab === 'SL' && e.tipo !== 'SL') return false;
    if (tab === 'Obra' && e.tipo !== 'Obra') return false;
    if (tab === 'recurrentes' && !e.esRecurrente) return false;
    if (catFiltro !== 'todas' && e.categoria !== catFiltro) return false;
    const q = busqueda.toLowerCase();
    return !q || e.proveedor.toLowerCase().includes(q) || e.concepto.toLowerCase().includes(q) || (e.obraNombre || '').toLowerCase().includes(q) || (e.numeroFactura || '').toLowerCase().includes(q);
  }).sort((a, b) => b.fecha.localeCompare(a.fecha)), [expenses, periodo, tab, catFiltro, busqueda]);

  const enPeriodo = expenses.filter((e) => coincidePeriodo(e.fecha, periodo));
  const totalSL = enPeriodo.filter((e) => e.tipo === 'SL').reduce((a, b) => a + b.baseImponible, 0);
  const totalObra = enPeriodo.filter((e) => e.tipo === 'Obra').reduce((a, b) => a + b.baseImponible, 0);
  const totalRec = enPeriodo.filter((e) => e.esRecurrente).reduce((a, b) => a + b.baseImponible, 0);
  const ivaSoportado = enPeriodo.reduce((a, b) => a + b.ivaTotal, 0);
  const sinFactura = enPeriodo.filter((e) => !e.numeroFactura).length;

  const detectaRecurrente = (txt: string) => /gestor|asesor|renting|cuota|seguro|prevenci|prl|fibra|m[oó]vil|mensual|software|alquiler|suscripci/i.test(txt);

  const adjuntar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setAvisoIA(null);
    const leer = (file: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error('No se pudo leer el archivo.')); r.readAsDataURL(file); });
    try {
      let dataUrl: string;
      if (f.type.startsWith('image/')) {
        // Las fotos del móvil pesan varios MB: se reducen a 1.600 px para guardarlas y para la IA
        dataUrl = await comprimirImagen(f);
        if (dataUrl.length > LIMITE_ADJUNTO * 1.37) dataUrl = await comprimirImagen(f, 1200, 0.72);
      } else {
        dataUrl = await leer(f);
      }
      setArchivoIA(dataUrl.length < 6_000_000 ? dataUrl : null);
      if (dataUrl.length > LIMITE_ADJUNTO * 1.37) {
        setForm((x) => ({ ...x, adjuntoNombre: f.name, adjuntoDataUrl: undefined }));
        setError(`El archivo supera ${LIMITE_ADJUNTO / 1024} KB: se guarda solo el nombre. Guarda el original en tu Drive.${hayIA ? ' La IA sí puede leerlo.' : ''}`);
      } else {
        setForm((x) => ({ ...x, adjuntoNombre: f.name, adjuntoDataUrl: dataUrl }));
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo adjuntar el archivo.');
    }
    e.target.value = '';
  };

  const leerConIA = async () => {
    if (!archivoIA) return setError('Adjunta primero la foto del ticket o el PDF de la factura.');
    setLeyendoIA(true);
    setError(null);
    setAvisoIA(null);
    try {
      const { datos: d } = await extraerDatosTicket(companySettings.geminiApiKey || '', archivoIA, companySettings.geminiModelo || undefined);
      const prov = suppliers.find((s) => (d.cif && s.cif && s.cif.replace(/\W/g, '').toUpperCase() === d.cif) || (d.proveedor && s.nombre.toLowerCase() === d.proveedor.toLowerCase()));
      const metodo = METODOS.find((m) => m.toLowerCase() === (d.metodoPago || '').toLowerCase());
      setForm((x) => ({
        ...x,
        proveedor: prov?.nombre || d.proveedor || x.proveedor,
        cifProveedor: d.cif || prov?.cif || x.cifProveedor,
        numeroFactura: d.esTicketSinFactura ? '' : d.numeroFactura || x.numeroFactura,
        fecha: d.fecha || x.fecha,
        concepto: d.concepto || x.concepto,
        baseImponible: d.baseImponible ?? x.baseImponible,
        ivaPorcentaje: d.ivaPorcentaje ?? x.ivaPorcentaje,
        irpfRetencion: d.irpfPorcentaje || 0,
        metodoPago: metodo || x.metodoPago,
        categoria: (d.categoria as ExpenseCategoria) || (prov?.categoria as ExpenseCategoria) || x.categoria,
        esRecurrente: x.esRecurrente || detectaRecurrente(d.concepto || ''),
      }));
      const nuevoProv = !prov && !!d.proveedor;
      if (nuevoProv) setAltaProveedor(true);
      const total = d.total !== undefined ? ` Total leído: ${formatCurrency(d.total)}.` : '';
      setAvisoIA({
        texto: `Datos leídos${d.confianza === 'baja' ? ' con poca seguridad: revisa los importes' : d.confianza === 'media' ? ', revísalos' : ''}.${total}${d.observaciones ? ` ${d.observaciones}` : ''}${nuevoProv ? ' El proveedor no existe: se dará de alta al guardar, corrige lo que veas mal.' : ''} Nada se guarda hasta que pulses Guardar.`,
        tipo: d.confianza === 'baja' ? 'aviso' : 'ok',
      });
    } catch (err: any) {
      setError(err?.message || 'La IA no pudo leer el documento.');
    } finally {
      setLeyendoIA(false);
    }
  };

  const elegirProveedor = (nombre: string) => {
    const s = suppliers.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    setForm((x) => ({ ...x, proveedor: nombre, cifProveedor: s?.cif || x.cifProveedor, categoria: (s?.categoria as ExpenseCategoria) && CATEGORIAS.includes(s?.categoria as ExpenseCategoria) ? (s!.categoria as ExpenseCategoria) : x.categoria, esRecurrente: x.esRecurrente || detectaRecurrente(nombre) }));
  };

  const construir = (f: Form, id?: string): Expense => {
    const ivaTotal = redondear2(f.baseImponible * (f.ivaPorcentaje / 100));
    const ret = redondear2(f.baseImponible * (f.irpfRetencion / 100));
    const proj = projects.find((p) => p.id === f.obraId);
    const esObra = f.tipo === 'Obra' && !!proj;
    return {
      id: id || uid('exp'),
      numeroFactura: f.numeroFactura.trim() || undefined,
      proveedor: f.proveedor.trim(),
      cifProveedor: f.cifProveedor.trim().toUpperCase(),
      concepto: f.concepto.trim(),
      tipo: esObra ? 'Obra' : 'SL',
      categoria: f.categoria,
      obraId: esObra ? proj!.id : undefined,
      obraNombre: esObra ? proj!.nombre : undefined,
      baseImponible: redondear2(f.baseImponible),
      ivaPorcentaje: f.ivaPorcentaje,
      ivaTotal,
      irpfRetencion: ret > 0 ? ret : undefined,
      total: redondear2(f.baseImponible + ivaTotal - ret),
      fecha: f.fecha,
      estadoPago: f.estadoPago,
      metodoPago: f.metodoPago,
      adjuntoNombre: f.adjuntoNombre,
      adjuntoDataUrl: f.adjuntoDataUrl,
      bancoConciliado: false,
      esRecurrente: f.esRecurrente,
    };
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.proveedor.trim() || !form.concepto.trim()) return setError('Proveedor y concepto son obligatorios.');
    if (form.baseImponible <= 0) return setError('La base imponible debe ser mayor que cero.');
    if (form.tipo === 'Obra' && !form.obraId) return setError('Elige la obra a la que imputar el gasto.');
    if (editando) {
      const nuevo = construir(form, editando.id);
      onUpdateExpense(editando.id, nuevo);
      setEditando(null);
    } else {
      const nuevo = construir(form);
      onCreateExpense(nuevo);
      if (altaProveedor && onCreateSupplier && !suppliers.some((s) => s.nombre.toLowerCase() === nuevo.proveedor.toLowerCase())) {
        onCreateSupplier({ id: uid('sup'), nombre: nuevo.proveedor, cif: nuevo.cifProveedor, categoria: nuevo.categoria, fechaAlta: hoyISO() });
      }
      setShowNewExpenseModal(false);
    }
  };

  const abrirEditar = (x: Expense) => {
    setForm({ proveedor: x.proveedor, cifProveedor: x.cifProveedor, numeroFactura: x.numeroFactura || '', concepto: x.concepto, tipo: x.tipo, categoria: x.categoria, obraId: x.obraId || '', baseImponible: x.baseImponible, ivaPorcentaje: x.ivaPorcentaje, irpfRetencion: x.irpfRetencion ? Math.round((x.irpfRetencion / x.baseImponible) * 100) : 0, fecha: x.fecha, metodoPago: x.metodoPago, estadoPago: x.estadoPago, esRecurrente: !!x.esRecurrente, adjuntoNombre: x.adjuntoNombre, adjuntoDataUrl: x.adjuntoDataUrl });
    setError(null);
    setEditando(x);
  };

  const descargarAdjunto = (x: Expense) => {
    if (!x.adjuntoDataUrl) return;
    const a = document.createElement('a');
    a.href = x.adjuntoDataUrl;
    a.download = x.adjuntoNombre || 'justificante';
    a.click();
  };

  const modalAbierto = showNewExpenseModal || !!editando;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Receipt className="text-blue-600" size={28} /> Gastos y compras</h1>
          <p className="text-slate-500 text-sm mt-1">Facturas de proveedor y tickets. Imputa a una obra lo que sea de obra: alimenta la rentabilidad · {etiquetaPeriodo(periodo)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter value={periodo} onChange={setPeriodo} anios={anios} totalFiltrado={filtrados.length} totalGlobal={expenses.length} />
          <button onClick={() => setShowNewExpenseModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"><Plus size={16} /> Registrar gasto</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Pod titulo="Gastos del periodo (base)" valor={formatCurrency(totalSL + totalObra)} pie={`${enPeriodo.length} justificantes${sinFactura ? ` · ${sinFactura} sin nº de factura` : ''}`} icono={<Receipt size={22} />} cls="bg-slate-50 text-slate-600" />
        <Pod titulo="Estructura (fijos)" valor={formatCurrency(totalSL)} pie={`${formatCurrency(totalRec)} recurrentes`} icono={<Building2 size={22} />} cls="bg-indigo-50 text-indigo-600" />
        <Pod titulo="Imputados a obras" valor={formatCurrency(totalObra)} pie="Materiales, subcontratas, maquinaria" icono={<HardHat size={22} />} cls="bg-blue-50 text-blue-600" />
        <Pod titulo="IVA soportado" valor={formatCurrency(ivaSoportado)} pie="Deducible en el modelo 303" icono={<CheckCircle2 size={22} />} cls="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="relative w-full lg:w-72"><Search className="absolute left-4 top-3 text-slate-400" size={18} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl bg-slate-50/80 text-xs font-medium outline-none" placeholder="Proveedor, concepto, obra, nº factura…" /></div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex bg-slate-100/90 p-1.5 rounded-2xl">
            {([['todos', 'Todos'], ['recurrentes', 'Recurrentes'], ['SL', 'Estructura'], ['Obra', 'Obras']] as const).map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 ${tab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>{id === 'recurrentes' && <RefreshCw size={12} />}{l}</button>)}
          </div>
          <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium bg-slate-50 text-slate-700 cursor-pointer"><option value="todas">Todas las categorías</option>{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filtrados.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">No hay gastos en {etiquetaPeriodo(periodo).toLowerCase()}.{expenses.length > 0 && <> <button onClick={() => setPeriodo({ mes: 'todos', anio: 'todos' })} className="text-blue-600 font-bold hover:underline cursor-pointer">Ver todos</button></>}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 text-[11px] font-black uppercase tracking-wider"><tr><th className="p-4">Fecha</th><th className="p-4">Proveedor</th><th className="p-4">Concepto e imputación</th><th className="p-4">Categoría</th><th className="p-4 text-right">Base</th><th className="p-4 text-right">IVA</th><th className="p-4 text-right">Total</th><th className="p-4 text-center">Pago</th><th className="p-4 text-center"></th></tr></thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtrados.map((x) => (
                  <tr key={x.id} className="hover:bg-slate-50/80">
                    <td className="p-4 text-xs font-bold text-slate-800">{formatDate(x.fecha)}</td>
                    <td className="p-4"><p className="font-bold text-slate-800 text-xs">{x.proveedor}</p><p className="text-[11px] text-slate-400 font-mono">{x.cifProveedor || '—'}{x.numeroFactura ? ` · ${x.numeroFactura}` : ''}</p>{!x.numeroFactura && <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">sin factura</span>}</td>
                    <td className="p-4"><p className="font-bold text-slate-800 text-xs">{x.concepto}</p><div className="flex items-center gap-1.5 mt-0.5 flex-wrap">{x.tipo === 'Obra' ? <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1"><HardHat size={10} /> {x.obraNombre}</span> : <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded flex items-center gap-1"><Building2 size={10} /> Estructura</span>}{x.adjuntoNombre && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Paperclip size={10} /> {x.adjuntoNombre}</span>}</div></td>
                    <td className="p-4"><span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full whitespace-nowrap">{x.categoria}</span>{x.esRecurrente && <span className="ml-1 text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"><RefreshCw size={9} /> fijo</span>}</td>
                    <td className="p-4 text-right text-xs font-medium text-slate-600">{formatCurrency(x.baseImponible)}</td>
                    <td className="p-4 text-right text-xs text-slate-500">{formatCurrency(x.ivaTotal)} <span className="text-[10px]">({x.ivaPorcentaje} %)</span></td>
                    <td className="p-4 text-right"><span className="font-black text-slate-900 text-sm">{formatCurrency(x.total)}</span></td>
                    <td className="p-4 text-center"><button onClick={() => onUpdateExpense(x.id, { estadoPago: x.estadoPago === 'Pagado' ? 'Pendiente' : 'Pagado' })} className={`text-[10px] font-black px-2 py-1 rounded-full cursor-pointer ${x.estadoPago === 'Pagado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`} title="Cambiar estado de pago">{x.estadoPago}{x.bancoConciliado ? ' ✓' : ''}</button></td>
                    <td className="p-4 text-center"><div className="flex items-center justify-center gap-1"><button onClick={() => setVerDetalle(x)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded-lg cursor-pointer" title="Ver"><Eye size={14} /></button><button onClick={() => abrirEditar(x)} className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer" title="Editar"><Edit3 size={14} /></button><button onClick={() => setABorrar(x)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer" title="Eliminar"><Trash2 size={14} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETALLE */}
      {verDetalle && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100"><div><h3 className="text-lg font-black text-slate-900">{verDetalle.proveedor}</h3><p className="text-xs text-slate-500">{verDetalle.numeroFactura ? `Nº ${verDetalle.numeroFactura} · ` : ''}{formatDate(verDetalle.fecha)} · NIF {verDetalle.cifProveedor || '—'}</p></div><button onClick={() => setVerDetalle(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={20} /></button></div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
              <div className="flex justify-between gap-4"><div><span className="text-[10px] uppercase font-black text-slate-400">Receptor</span><p className="font-bold text-slate-900">{companySettings.razonSocial || 'Tu empresa'}</p><p className="font-mono text-slate-500">{companySettings.cif}</p></div><div className="text-right"><span className="text-[10px] uppercase font-black text-slate-400">Imputación</span><p className="font-bold text-slate-900">{verDetalle.tipo === 'Obra' ? verDetalle.obraNombre : 'Estructura'}</p><p className="text-slate-500">{verDetalle.categoria}{verDetalle.esRecurrente ? ' · gasto fijo' : ''}</p></div></div>
              <div className="p-3 bg-white rounded-xl border border-slate-200"><p className="font-bold text-slate-900">{verDetalle.concepto}</p></div>
              <div className="flex justify-end"><div className="w-56 space-y-1 text-right"><div className="flex justify-between text-slate-500"><span>Base</span><span className="font-bold text-slate-800">{formatCurrency(verDetalle.baseImponible)}</span></div><div className="flex justify-between text-slate-500"><span>IVA {verDetalle.ivaPorcentaje} %</span><span className="font-bold text-slate-800">{formatCurrency(verDetalle.ivaTotal)}</span></div>{verDetalle.irpfRetencion ? <div className="flex justify-between text-slate-500"><span>Retención</span><span className="font-bold">−{formatCurrency(verDetalle.irpfRetencion)}</span></div> : null}<div className="flex justify-between text-base font-black pt-1 border-t border-slate-200"><span>Total</span><span>{formatCurrency(verDetalle.total)}</span></div></div></div>
              <div className="flex items-center justify-between text-[11px] text-slate-500"><span>{verDetalle.metodoPago} · {verDetalle.estadoPago}{verDetalle.bancoConciliado ? ' · conciliado con el banco' : ''}</span>{verDetalle.adjuntoNombre && <span className="flex items-center gap-1"><Paperclip size={12} /> {verDetalle.adjuntoNombre}</span>}</div>
              {verDetalle.adjuntoDataUrl && verDetalle.adjuntoDataUrl.startsWith('data:image') && <img src={verDetalle.adjuntoDataUrl} alt="Justificante" className="max-h-64 rounded-xl border border-slate-200 mx-auto" />}
            </div>
            <div className="flex gap-2">{verDetalle.adjuntoDataUrl && <button onClick={() => descargarAdjunto(verDetalle)} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"><Download size={14} /> Descargar justificante</button>}<button onClick={() => { abrirEditar(verDetalle); setVerDetalle(null); }} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Editar</button><button onClick={() => setVerDetalle(null)} className="ml-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs cursor-pointer">Cerrar</button></div>
          </div>
        </div>
      )}

      {/* NUEVO / EDITAR */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl space-y-4 my-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100"><h3 className="font-black text-slate-900 text-base flex items-center gap-2">{editando ? <Edit3 size={18} className="text-indigo-600" /> : <Plus size={18} className="text-blue-600" />} {editando ? 'Editar gasto' : 'Registrar gasto o factura de proveedor'}</h3><button onClick={() => { setShowNewExpenseModal(false); setEditando(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <form onSubmit={guardar} className="space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-indigo-900 min-w-0"><Paperclip size={16} className="shrink-0" /><div className="min-w-0"><p className="font-bold truncate">{form.adjuntoNombre || 'Adjunta la foto del ticket o el PDF de la factura'}</p><p className="text-[10px] text-indigo-700">{hayIA ? 'La IA puede leer los datos por ti; después los revisas y guardas.' : `Se guarda con el gasto (hasta ${LIMITE_ADJUNTO / 1024} KB). Rellena los datos a mano o activa el lector con IA en Configuración.`}</p></div></div>
                <input type="file" ref={fileRef} accept="image/*,.pdf" className="hidden" onChange={adjuntar} />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer">{form.adjuntoNombre ? 'Cambiar' : 'Adjuntar'}</button>
                  {hayIA && archivoIA && !editando && <button type="button" onClick={leerConIA} disabled={leyendoIA} className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-60"><Sparkles size={13} className={leyendoIA ? 'animate-pulse' : ''} /> {leyendoIA ? 'Leyendo…' : 'Leer los datos con IA'}</button>}
                </div>
              </div>
              {avisoIA && <div className={`p-3 rounded-xl border flex items-start gap-2 ${avisoIA.tipo === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}><Sparkles size={14} className="shrink-0 mt-0.5" /> <span>{avisoIA.texto}</span></div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Proveedor *</label><input list="proveedores" value={form.proveedor} onChange={(e) => elegirProveedor(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold" required /><datalist id="proveedores">{suppliers.map((s) => <option key={s.id} value={s.nombre} />)}</datalist></div>
                <div><label className="block font-bold text-slate-700 mb-1">NIF del proveedor</label><input value={form.cifProveedor} onChange={(e) => setForm({ ...form, cifProveedor: e.target.value.toUpperCase() })} placeholder="B12345678" className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Nº de factura <span className="text-slate-400 font-normal">(vacío si es ticket sin factura)</span></label><input value={form.numeroFactura} onChange={(e) => setForm({ ...form, numeroFactura: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono" /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2" required /></div>
              </div>
              <div><label className="block font-bold text-slate-700 mb-1">Concepto *</label><input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value, esRecurrente: form.esRecurrente || detectaRecurrente(e.target.value) })} className="w-full border border-slate-200 rounded-xl px-3 py-2" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Categoría</label><select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as ExpenseCategoria })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white">{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="block font-bold text-slate-700 mb-1">Imputación</label><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as any })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"><option value="SL">Estructura (gasto general)</option><option value="Obra">A una obra</option></select></div>
              </div>
              {form.tipo === 'Obra' && <div><label className="block font-bold text-slate-700 mb-1">Obra</label><select value={form.obraId} onChange={(e) => setForm({ ...form, obraId: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold" required><option value="">Elige la obra…</option>{projects.filter((p) => p.estado !== 'Rechazado').map((p) => <option key={p.id} value={p.id}>{p.obraCodigo || p.codigo} · {p.nombre} ({p.clienteNombre})</option>)}</select></div>}
              <div className="grid grid-cols-4 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Base (€)</label><input type="number" step="0.01" min="0" value={form.baseImponible || ''} onChange={(e) => setForm({ ...form, baseImponible: Number(e.target.value) })} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold" required /></div>
                <div><label className="block font-bold text-slate-700 mb-1">IVA</label><select value={form.ivaPorcentaje} onChange={(e) => setForm({ ...form, ivaPorcentaje: Number(e.target.value) })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"><option value={21}>21 %</option><option value={10}>10 %</option><option value={4}>4 %</option><option value={0}>0 %</option></select></div>
                <div><label className="block font-bold text-slate-700 mb-1">Retención</label><select value={form.irpfRetencion} onChange={(e) => setForm({ ...form, irpfRetencion: Number(e.target.value) })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"><option value={0}>No</option><option value={7}>7 %</option><option value={15}>15 %</option><option value={19}>19 % (alquiler)</option></select></div>
                <div><label className="block font-bold text-slate-700 mb-1">Total</label><div className="py-2 px-3 bg-slate-100 rounded-xl font-black text-slate-900">{formatCurrency(form.baseImponible * (1 + form.ivaPorcentaje / 100) - form.baseImponible * (form.irpfRetencion / 100))}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Forma de pago</label><select value={form.metodoPago} onChange={(e) => setForm({ ...form, metodoPago: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white">{METODOS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="block font-bold text-slate-700 mb-1">Estado</label><select value={form.estadoPago} onChange={(e) => setForm({ ...form, estadoPago: e.target.value as any })} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"><option value="Pagado">Pagado</option><option value="Pendiente">Pendiente de pago</option></select></div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="flex items-center justify-between cursor-pointer"><span className="font-bold text-slate-800">Gasto fijo recurrente (gestoría, seguros, renting, telefonía…)</span><input type="checkbox" checked={form.esRecurrente} onChange={(e) => setForm({ ...form, esRecurrente: e.target.checked, tipo: e.target.checked ? 'SL' : form.tipo })} className="w-4 h-4 rounded" /></label>
                {!editando && form.proveedor && !suppliers.some((s) => s.nombre.toLowerCase() === form.proveedor.trim().toLowerCase()) && <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200"><span className="text-slate-700">Dar de alta a <strong>{form.proveedor}</strong> como proveedor</span><input type="checkbox" checked={altaProveedor} onChange={(e) => setAltaProveedor(e.target.checked)} className="w-4 h-4 rounded" /></label>}
              </div>
              {error && <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-2"><AlertCircle size={14} /> {error}</div>}
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => { setShowNewExpenseModal(false); setEditando(null); }} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer">Cancelar</button><button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md cursor-pointer">{editando ? 'Guardar cambios' : 'Guardar gasto'}</button></div>
            </form>
          </div>
        </div>
      )}

      {aBorrar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto"><Trash2 size={24} /></div>
            <div className="text-center space-y-1"><h3 className="font-black text-slate-900 text-base">¿Eliminar este gasto?</h3><p className="text-xs text-slate-500">{aBorrar.proveedor} · {formatCurrency(aBorrar.total)}. Si estaba imputado a una obra, se descuenta de su coste.</p></div>
            <div className="flex gap-2 pt-2"><button onClick={() => setABorrar(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button><button onClick={() => { onDeleteExpense(aBorrar.id); setABorrar(null); }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer">Eliminar</button></div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><Info size={12} /> La lectura automática de tickets (OCR) no está incluida en esta versión: adjunta el justificante y teclea los importes.</p>
    </div>
  );
};

const Pod: React.FC<{ titulo: string; valor: string; pie: string; icono: React.ReactNode; cls: string }> = ({ titulo, valor, pie, icono, cls }) => (
  <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
    <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{titulo}</p><p className="text-2xl font-black text-slate-900 mt-1">{valor}</p><p className="text-[11px] text-slate-500 mt-1">{pie}</p></div>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${cls}`}>{icono}</div>
  </div>
);
