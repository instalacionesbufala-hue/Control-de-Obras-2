import React, { useMemo, useState } from 'react';
import { BarChart3, Download, CheckCircle2, Building2, UserCheck, AlertTriangle, PiggyBank, FileSpreadsheet, Settings as SettingsIcon, ShieldCheck, FileCode2, AlertCircle } from 'lucide-react';
import { Invoice, Expense, CompanySettings, BankTransaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { HaciendaCountdownWidget } from './HaciendaCountdownWidget';
import { modelosAplicables, cuotaSociedadesEstimada, tiposSociedadesMicro } from '../lib/fiscal';
import { aniosDisponibles, trimestreDe, anioActual, fechaES } from '../utils/dates';
import { csvLibroEmitidas, fechaAEAT, dec2 } from '../lib/verifactu';
import { xmlLote, xmlDeFactura, anteriorDe, pendientesDeEnvio, avisosPrevios, MAX_REGISTROS_LOTE } from '../lib/verifactuXml';
import { descargarArchivo } from '../lib/googleCalendar';

interface Props {
  invoices: Invoice[];
  expenses: Expense[];
  companySettings: CompanySettings;
  bankTransactions: BankTransaction[];
  onNavigate?: (tab: string) => void;
  onUpdateInvoice?: (id: string, campos: Partial<Invoice>) => void;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

type Q = 1 | 2 | 3 | 4 | 'ANUAL';

export const TaxClosingView: React.FC<Props> = ({ invoices, expenses, companySettings, bankTransactions, onNavigate, onUpdateInvoice, onAviso }) => {
  const anios = aniosDisponibles([...invoices.map((i) => i.fecha), ...expenses.map((e) => e.fecha)]);
  const [anio, setAnio] = useState<string>(String(anioActual()));
  const [q, setQ] = useState<Q>(trimestreDe(new Date().toISOString().split('T')[0]));
  const [entregados, setEntregados] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('obracontrol-trimestres-entregados') || '{}');
    } catch {
      return {};
    }
  });
  const isAutonomo = companySettings.tipoEntidad === 'autonomo';
  const modelos = modelosAplicables(companySettings);

  const stats = useMemo(() => {
    const calc = (qq: Q) => {
      const enQ = (f?: string) => !!f && f.startsWith(anio) && (qq === 'ANUAL' || trimestreDe(f) === qq);
      const inv = invoices.filter((i) => !['Anulada', 'Rectificada'].includes(i.estado) && i.estado !== 'Borrador' && enQ(i.fecha));
      const exp = expenses.filter((e) => enQ(e.fecha));
      const baseVentas = inv.reduce((a, b) => a + b.baseImponible, 0);
      const ivaVentas = inv.reduce((a, b) => a + b.ivaTotal, 0);
      const baseGastos = exp.reduce((a, b) => a + b.baseImponible, 0);
      const ivaGastos = exp.reduce((a, b) => a + b.ivaTotal, 0);
      const retenidoEnVentas = inv.reduce((a, b) => a + (b.irpfTotal || 0), 0); // lo que nos retienen a nosotros (autónomo)
      const retencionesSoportadasAGastos = exp.reduce((a, b) => a + (b.irpfRetencion || 0), 0); // lo que retenemos a profesionales (mod. 111)
      const rendimiento = baseVentas - baseGastos;
      const gastosSinFactura = exp.filter((e) => !e.numeroFactura).length;
      return { inv, exp, baseVentas, ivaVentas, baseGastos, ivaGastos, iva303: ivaVentas - ivaGastos, retenidoEnVentas, retencionesSoportadasAGastos, rendimiento, gastosSinFactura };
    };
    return { 1: calc(1), 2: calc(2), 3: calc(3), 4: calc(4), ANUAL: calc('ANUAL') } as Record<string, ReturnType<typeof calc>>;
  }, [invoices, expenses, anio]);

  const s = stats[String(q)];
  const anual = stats['ANUAL'];
  const tiposIS = tiposSociedadesMicro(Number(anio));
  const cuotaIS = cuotaSociedadesEstimada(anual.rendimiento, Number(anio));
  // Autónomo: pago fraccionado 130 = 20 % del rendimiento acumulado del año menos retenciones soportadas y pagos anteriores (aprox.)
  const acumuladoHasta = (qq: number) => [1, 2, 3, 4].filter((x) => x <= qq).reduce((a, x) => ({ rend: a.rend + stats[String(x)].rendimiento, ret: a.ret + stats[String(x)].retenidoEnVentas }), { rend: 0, ret: 0 });
  const mod130 = (qq: number) => {
    const acc = acumuladoHasta(qq);
    const prev = qq > 1 ? Math.max(0, acumuladoHasta(qq - 1).rend * 0.2 - acumuladoHasta(qq - 1).ret) : 0;
    return Math.max(0, acc.rend * 0.2 - acc.ret - prev);
  };
  const apartar = (q === 'ANUAL' ? anual.iva303 : s.iva303) + (isAutonomo ? (q === 'ANUAL' ? [1, 2, 3, 4].reduce((a, x) => a + mod130(x), 0) : mod130(q as number)) : cuotaIS / 4) + s.retencionesSoportadasAGastos;
  const claveEntrega = `${anio}-${q}`;
  const marcarEntregado = () => {
    const nuevo = { ...entregados, [claveEntrega]: new Date().toISOString() };
    setEntregados(nuevo);
    localStorage.setItem('obracontrol-trimestres-entregados', JSON.stringify(nuevo));
  };

  const descargarLibroEmitidas = () => descargarArchivo(`Libro_facturas_emitidas_${q}_${anio}.csv`, csvLibroEmitidas(s.inv), 'text/csv;charset=utf-8');
  const descargarLibroRecibidas = () => {
    const filas = [['Fecha', 'Proveedor', 'NIF', 'Nº factura', 'Concepto', 'Categoría', 'Obra', 'Base', 'Tipo IVA', 'Cuota IVA', 'Retención', 'Total', 'Pagado', 'Justificante'],
      ...s.exp.map((e) => [fechaAEAT(e.fecha), `"${e.proveedor.replace(/"/g, '""')}"`, e.cifProveedor, e.numeroFactura || '', `"${e.concepto.replace(/"/g, '""')}"`, e.categoria, `"${e.obraNombre || ''}"`, dec2(e.baseImponible).replace('.', ','), `${e.ivaPorcentaje}`, dec2(e.ivaTotal).replace('.', ','), dec2(e.irpfRetencion || 0).replace('.', ','), dec2(e.total).replace('.', ','), e.estadoPago, e.adjuntoNombre || (e.numeroFactura ? '' : 'sin factura')])];
    descargarArchivo(`Libro_facturas_recibidas_${q}_${anio}.csv`, '﻿' + filas.map((r) => r.join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  const descargarExtracto = () => {
    const tx = bankTransactions.filter((t) => t.fecha.startsWith(anio) && (q === 'ANUAL' || trimestreDe(t.fecha) === q));
    const filas = [['Fecha', 'Concepto', 'Importe', 'Saldo', 'Entidad', 'Conciliado con'], ...tx.map((t) => [fechaAEAT(t.fecha), `"${t.concepto.replace(/"/g, '""')}"`, dec2(t.importe).replace('.', ','), t.saldoPosterior !== undefined ? dec2(t.saldoPosterior).replace('.', ',') : '', t.entidad, t.conciliadoCon?.referenciaNombre || ''])];
    descargarArchivo(`Extracto_conciliado_${q}_${anio}.csv`, '﻿' + filas.map((r) => r.join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  };

  const etiquetaQ = q === 'ANUAL' ? `Año ${anio}` : `${q}T ${anio}`;

  // ---- Registros para la AEAT ----
  // El XML es el mismo lo remita la gestoría, un servidor propio o una pasarela. Aquí se
  // genera; el envío en sí necesita certificado digital y no puede hacerse desde el navegador.
  const registrosDelPeriodo = useMemo(() => s.inv.filter((i) => i.verifactu?.registrada && i.verifactu.cadena), [s.inv]);
  const listaPendientes = useMemo(() => pendientesDeEnvio(invoices), [invoices]);
  const avisosLote = useMemo(() => [...new Set(listaPendientes.flatMap((i) => avisosPrevios(i, companySettings)))], [listaPendientes, companySettings]);

  const descargarXmlPeriodo = () => {
    if (!registrosDelPeriodo.length) return onAviso?.('No hay registros con huella en este periodo.', 'info');
    descargarArchivo(`Registros_AEAT_${q}_${anio}.xml`, xmlLote(registrosDelPeriodo, invoices, companySettings), 'application/xml;charset=utf-8');
  };

  const descargarLotePendiente = () => {
    if (!listaPendientes.length) return;
    descargarArchivo(`Registros_AEAT_pendientes_${listaPendientes.length}.xml`, xmlLote(listaPendientes, invoices, companySettings), 'application/xml;charset=utf-8');
    onAviso?.(`Lote de ${listaPendientes.length} registros descargado. No se ha enviado nada: el fichero es para tu gestoría o para el envío con certificado.`, 'info');
  };

  const descargarXmlFactura = (inv: Invoice) => descargarArchivo(`Registro_AEAT_${inv.numero.replace(/[^\w-]/g, '_')}.xml`, xmlDeFactura(inv, anteriorDe(inv, invoices), companySettings), 'application/xml;charset=utf-8');

  // Marcar como enviado es una anotación manual: la app no envía nada por su cuenta.
  const marcarLoteEnviado = () => {
    if (!listaPendientes.length || !onUpdateInvoice) return;
    const csv = prompt(`Vas a marcar ${listaPendientes.length} ${listaPendientes.length === 1 ? 'registro' : 'registros'} como enviados a la AEAT. Esto solo anota lo que ya has hecho por otro medio: la app no envía nada.\n\nCSV o referencia que devolvió la AEAT (opcional):`);
    if (csv === null) return;
    const fecha = new Date().toISOString();
    listaPendientes.forEach((inv) => onUpdateInvoice(inv.id, { verifactu: { ...inv.verifactu, estadoEnvio: 'enviado', fechaEnvio: fecha, csvAEAT: csv || inv.verifactu.csvAEAT } }));
    onAviso?.(`${listaPendientes.length} ${listaPendientes.length === 1 ? 'registro anotado' : 'registros anotados'} como enviados.`, 'ok');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><BarChart3 className="text-blue-600" size={28} /> Trimestre e impuestos</h1>
            <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${isAutonomo ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{isAutonomo ? <UserCheck size={12} /> : <Building2 size={12} />}{isAutonomo ? 'Autónomo' : 'Sociedad'}</span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Arriba, cuánto apartar (estimación interna). Abajo, lo que entregas a la gestoría (solo datos reales, sin estimaciones).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={anio} onChange={(e) => setAnio(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 shadow-xs cursor-pointer">{anios.map((y) => <option key={y} value={y}>Año {y}</option>)}</select>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
            {([1, 2, 3, 4, 'ANUAL'] as Q[]).map((x) => <button key={String(x)} onClick={() => setQ(x)} className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer ${q === x ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{x === 'ANUAL' ? 'Anual' : `${x}T`}</button>)}
          </div>
        </div>
      </div>

      <HaciendaCountdownWidget companySettings={companySettings} />

      {/* PARA TI */}
      <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-black text-slate-900 text-base flex items-center gap-2"><PiggyBank className="text-amber-600" size={20} /> Para ti · cuánto apartar en {etiquetaQ}</h2>
          <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full border border-amber-200">Estimación interna · no es contabilidad oficial</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200"><p className="text-[10px] font-black uppercase text-slate-400">IVA · modelo 303</p><p className={`text-xl font-black mt-1 ${s.iva303 >= 0 ? 'text-slate-900' : 'text-emerald-700'}`}>{formatCurrency(s.iva303)}</p><p className="text-[11px] text-slate-500 mt-1">{formatCurrency(s.ivaVentas)} repercutido − {formatCurrency(s.ivaGastos)} soportado{s.iva303 < 0 ? ' · a compensar' : ''}</p></div>
          {isAutonomo ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200"><p className="text-[10px] font-black uppercase text-slate-400">IRPF · modelo 130</p><p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(q === 'ANUAL' ? [1, 2, 3, 4].reduce((a, x) => a + mod130(x), 0) : mod130(q as number))}</p><p className="text-[11px] text-slate-500 mt-1">20 % del rendimiento acumulado menos retenciones ({formatCurrency(s.retenidoEnVentas)}) y pagos anteriores</p></div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200"><p className="text-[10px] font-black uppercase text-slate-400">Sociedades · previsión anual</p><p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(cuotaIS)}</p><p className="text-[11px] text-slate-500 mt-1">{tiposIS.nota}. Base estimada {formatCurrency(anual.rendimiento)} (≈ {formatCurrency(cuotaIS / 4)} por trimestre)</p></div>
          )}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200"><p className="text-[10px] font-black uppercase text-slate-400">Retenciones · modelo 111</p><p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(s.retencionesSoportadasAGastos)}</p><p className="text-[11px] text-slate-500 mt-1">{companySettings.tieneEmpleados ? 'Retenido a profesionales en gastos (las nóminas las lleva la gestoría)' : 'Sin empleados: solo si retienes a profesionales'}</p></div>
          <div className="p-4 bg-slate-900 text-white rounded-2xl"><p className="text-[10px] font-black uppercase text-slate-400">Aparta este periodo</p><p className="text-xl font-black text-emerald-400 mt-1">{formatCurrency(Math.max(0, apartar))}</p><p className="text-[11px] text-slate-400 mt-1">Suma orientativa para no quedarte corto el día 20</p></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-slate-200"><span className="text-slate-500">Ventas (base)</span><p className="font-black text-slate-900">{formatCurrency(s.baseVentas)} <span className="text-slate-400 font-medium">· {s.inv.length} facturas</span></p></div>
          <div className="p-3 rounded-xl border border-slate-200"><span className="text-slate-500">Gastos (base)</span><p className="font-black text-slate-900">{formatCurrency(s.baseGastos)} <span className="text-slate-400 font-medium">· {s.exp.length} gastos</span></p></div>
          <div className="p-3 rounded-xl border border-slate-200"><span className="text-slate-500">Rendimiento neto</span><p className={`font-black ${s.rendimiento >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(s.rendimiento)}</p></div>
        </div>
        {(s.gastosSinFactura > 0 || s.inv.some((i) => !i.clienteNif)) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" /><span>Dato incompleto: {s.gastosSinFactura > 0 ? `${s.gastosSinFactura} gasto(s) sin número de factura` : ''}{s.gastosSinFactura > 0 && s.inv.some((i) => !i.clienteNif) ? ' y ' : ''}{s.inv.some((i) => !i.clienteNif) ? 'facturas sin NIF de cliente' : ''}. La gestoría te los pedirá.</span></div>
        )}
      </div>

      {/* TABLA ANUAL */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="font-black text-slate-900 text-base">Resumen por trimestres · {anio}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider"><tr><th className="p-3">Trimestre</th><th className="p-3 text-right">Facturas</th><th className="p-3 text-right">Base ventas</th><th className="p-3 text-right">IVA repercutido</th><th className="p-3 text-right">Gastos</th><th className="p-3 text-right">Base gastos</th><th className="p-3 text-right">IVA soportado</th><th className="p-3 text-right">303</th><th className="p-3 text-right">{isAutonomo ? '130 (est.)' : 'Rendimiento'}</th><th className="p-3 text-center">Entrega</th></tr></thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {[1, 2, 3, 4].map((x) => {
                const r = stats[String(x)];
                const ent = entregados[`${anio}-${x}`];
                return (
                  <tr key={x} onClick={() => setQ(x as Q)} className={`hover:bg-slate-50 cursor-pointer ${q === x ? 'bg-blue-50/50 font-bold' : ''}`}>
                    <td className="p-3 font-black text-slate-900">{x}T</td><td className="p-3 text-right">{r.inv.length}</td><td className="p-3 text-right">{formatCurrency(r.baseVentas)}</td><td className="p-3 text-right text-blue-700">{formatCurrency(r.ivaVentas)}</td><td className="p-3 text-right">{r.exp.length}</td><td className="p-3 text-right">{formatCurrency(r.baseGastos)}</td><td className="p-3 text-right text-amber-700">{formatCurrency(r.ivaGastos)}</td><td className={`p-3 text-right font-black ${r.iva303 > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>{formatCurrency(r.iva303)}</td><td className="p-3 text-right">{formatCurrency(isAutonomo ? mod130(x) : r.rendimiento)}</td>
                    <td className="p-3 text-center">{ent ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Entregado {fechaES(ent.split('T')[0])}</span> : <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Sin entregar</span>}</td>
                  </tr>
                );
              })}
              <tr onClick={() => setQ('ANUAL')} className={`bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200 cursor-pointer ${q === 'ANUAL' ? 'bg-blue-100/50' : ''}`}><td className="p-3 uppercase">Total {anio}</td><td className="p-3 text-right">{anual.inv.length}</td><td className="p-3 text-right">{formatCurrency(anual.baseVentas)}</td><td className="p-3 text-right text-blue-800">{formatCurrency(anual.ivaVentas)}</td><td className="p-3 text-right">{anual.exp.length}</td><td className="p-3 text-right">{formatCurrency(anual.baseGastos)}</td><td className="p-3 text-right text-amber-800">{formatCurrency(anual.ivaGastos)}</td><td className="p-3 text-right">{formatCurrency(anual.iva303)}</td><td className="p-3 text-right">{formatCurrency(isAutonomo ? [1, 2, 3, 4].reduce((a, x) => a + mod130(x), 0) : anual.rendimiento)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PARA LA GESTORÍA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-black text-slate-900 text-base flex items-center gap-2"><FileSpreadsheet className="text-blue-600" size={20} /> Para la gestoría · {etiquetaQ}</h2>
          {entregados[claveEntrega] ? <span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 size={14} /> Entregado el {fechaES(entregados[claveEntrega].split('T')[0])}</span> : <button onClick={marcarEntregado} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer">Marcar como entregado</button>}
        </div>
        <p className="text-xs text-slate-500">Cuatro archivos con datos reales: tres CSV que se abren en Excel y el XML de los registros VERI*FACTU. No incluyen ninguna estimación de impuestos.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={descargarLibroEmitidas} className="p-4 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
            <div className="flex items-center justify-between"><p className="font-bold text-slate-900 text-sm">1. Facturas emitidas</p><Download size={16} className="text-blue-600" /></div>
            <p className="text-[11px] text-slate-500 mt-1">{s.inv.length} facturas · base {formatCurrency(s.baseVentas)} · con huella VERI*FACTU</p>
          </button>
          <button onClick={descargarLibroRecibidas} className="p-4 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
            <div className="flex items-center justify-between"><p className="font-bold text-slate-900 text-sm">2. Facturas recibidas y gastos</p><Download size={16} className="text-blue-600" /></div>
            <p className="text-[11px] text-slate-500 mt-1">{s.exp.length} gastos · base {formatCurrency(s.baseGastos)}{s.gastosSinFactura ? ` · ${s.gastosSinFactura} sin factura` : ''}</p>
          </button>
          <button onClick={descargarExtracto} className="p-4 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
            <div className="flex items-center justify-between"><p className="font-bold text-slate-900 text-sm">3. Extracto conciliado</p><Download size={16} className="text-blue-600" /></div>
            <p className="text-[11px] text-slate-500 mt-1">Movimientos del banco con el documento al que se cruzó cada uno</p>
          </button>
          <button onClick={descargarXmlPeriodo} className="p-4 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-2xl cursor-pointer transition-colors">
            <div className="flex items-center justify-between"><p className="font-bold text-slate-900 text-sm">4. Registros VERI*FACTU (XML)</p><Download size={16} className="text-blue-600" /></div>
            <p className="text-[11px] text-slate-500 mt-1">{registrosDelPeriodo.length} {registrosDelPeriodo.length === 1 ? 'registro' : 'registros'} con huella · formato oficial de la AEAT</p>
          </button>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2"><ShieldCheck size={14} className="text-slate-500 shrink-0 mt-0.5" /><span>Los PDF de las facturas se generan desde la pestaña Facturas (Imprimir / PDF). Pregunta por escrito a tu gestoría qué formato prefiere y si acepta un programa de facturación propio con VERI*FACTU.</span></div>
      </div>


      {/* PENDIENTES DE ENVÍO A LA AEAT */}
      <div className={`bg-white p-6 rounded-3xl border shadow-xs space-y-4 ${listaPendientes.length ? 'border-amber-200' : 'border-slate-200/80'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${listaPendientes.length ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}><FileCode2 size={20} /></div>
          <div>
            <h2 className="font-black text-slate-900 text-base">{listaPendientes.length ? `${listaPendientes.length} ${listaPendientes.length === 1 ? 'registro pendiente' : 'registros pendientes'} de envío a la AEAT` : 'Nada pendiente de envío a la AEAT'}</h2>
            <p className="text-xs text-slate-500">Aquí se cuentan todos los periodos, no solo {etiquetaQ}: la remisión no va por trimestres, va factura a factura.</p>
          </div>
        </div>
        {listaPendientes.length > 0 && (
          <>
            {avisosLote.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><AlertCircle size={14} /> Corrige esto antes de entregar el fichero</p>
                {avisosLote.map((a, i) => <p key={i} className="text-[11px]">· {a}</p>)}
              </div>
            )}
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {listaPendientes.map((inv) => (
                <div key={inv.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{inv.numero} · {inv.clienteNombre}</p>
                    <p className="text-[11px] text-slate-500">{fechaES(inv.fecha)} · {formatCurrency(inv.total)} · {inv.estado === 'Anulada' ? 'registro de anulación' : `tipo ${inv.verifactu.tipoFactura}`}</p>
                  </div>
                  <button type="button" onClick={() => descargarXmlFactura(inv)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0"><Download size={12} /> XML</button>
                </div>
              ))}
            </div>
            {listaPendientes.length > MAX_REGISTROS_LOTE && <p className="text-[11px] text-slate-500">El lote se limita a {MAX_REGISTROS_LOTE} registros, que es el máximo que admite la AEAT por envío. Descarga, marca como enviados y repite.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={descargarLotePendiente} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer"><Download size={14} /> Descargar el lote pendiente en XML</button>
              {onUpdateInvoice && <button type="button" onClick={marcarLoteEnviado} className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer"><CheckCircle2 size={14} /> {listaPendientes.length === 1 ? 'Marcar el registro como enviado' : `Marcar los ${listaPendientes.length} como enviados`}</button>}
            </div>
          </>
        )}
        <p className="text-[11px] text-slate-500">La app genera el fichero, no lo envía: la remisión exige firmar con tu certificado digital y eso no puede hacerse desde el navegador. El XML sigue los esquemas SuministroLR de la AEAT y lleva la huella encadenada de cada factura; antes de usarlo contra producción conviene validarlo en el entorno de pruebas. Marcar como enviado solo anota lo que ya has hecho por otro medio.</p>
      </div>

      {/* MODELOS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-black text-slate-900 text-base">Modelos que te corresponden · {isAutonomo ? 'autónomo' : 'sociedad'}</h3>
          {onNavigate && <button onClick={() => onNavigate('ajustes')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"><SettingsIcon size={13} /> Ajustar (empleados, alquiler, UE)</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {modelos.map((m) => (
            <div key={m.codigo} className={`p-3 rounded-xl border flex items-start gap-3 ${m.aplica ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
              <span className={`font-black text-xs px-2 py-1 rounded-lg shrink-0 ${m.aplica ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{m.codigo}</span>
              <div className="text-xs"><p className="font-bold text-slate-900">{m.nombre} <span className="text-[10px] text-slate-400 font-medium">· {m.periodicidad}</span></p><p className="text-[11px] text-slate-500">{m.descripcion}</p>{m.condicion && <p className="text-[10px] text-slate-400 mt-0.5">{m.condicion}</p>}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
