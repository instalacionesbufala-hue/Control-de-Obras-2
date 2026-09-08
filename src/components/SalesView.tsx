import React, { useMemo, useState, useEffect } from 'react';
import { BadgeEuro, Plus, Download, Search, ShieldCheck, Eye, MessageSquare, X, AlertCircle, Send, Trash2, CheckCircle2, Copy, Check, FileText, Ban, RefreshCcw, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { DocumentRenderer } from './DocumentRenderer';
import { PeriodFilter } from './PeriodFilter';
import { Invoice, Client, Project, CompanySettings, InvoiceLine, TipoFacturaVerifactu, CobroFactura } from '../types';
import { formatCurrency, formatDate, uid, telefonoWhatsApp, redondear2 } from '../utils/formatters';
import { PeriodoFiltro, periodoActual, coincidePeriodo, aniosDisponibles, hoyISO, addDays, etiquetaPeriodo } from '../utils/dates';
import { generarRegistroAlta, verificarCadena, csvLibroEmitidas, autocomprobarAlgoritmo, TIPOS_RECTIFICATIVA } from '../lib/verifactu';
import { totalCobrado, pendienteDe, situacionDe, diasVencida, textoReclamacion } from '../lib/cobros';
import { xmlDeFactura, anteriorDe, pendientesDeEnvio } from '../lib/verifactuXml';
import { descargarArchivo } from '../lib/googleCalendar';
import { DocumentSettingsModal } from './DocumentSettingsModal';

interface Props {
  invoices: Invoice[];
  clients: Client[];
  projects: Project[];
  companySettings: CompanySettings;
  siguienteNumero: string;
  siguienteNumeroRectificativa: string;
  onCreateInvoice: (inv: Invoice, opciones?: { serie?: 'factura' | 'rectificativa'; original?: Invoice }) => void;
  onRegistrarCobro: (invoiceId: string, cobro: CobroFactura) => void;
  onQuitarCobro: (invoiceId: string, cobroId: string) => void;
  onIrABanco?: () => void;
  onIrAGestoria?: () => void;
  onSaveSettings?: (cambios: Partial<CompanySettings>) => void;
  onUpdateInvoiceStatus: (id: string, estado: Invoice['estado']) => void;
  onUpdateInvoice: (id: string, campos: Partial<Invoice>) => void;
  showNewInvoiceModal: boolean;
  setShowNewInvoiceModal: (v: boolean) => void;
  preselectedProject?: Project | null;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

type LineaForm = { id: string; concepto: string; cantidad: number; unidad: string; precioUnitario: number; ivaPorcentaje: number; materialesVisibles?: InvoiceLine['materialesVisibles'] };

export const SalesView: React.FC<Props> = ({ invoices, clients, projects, companySettings, siguienteNumero, siguienteNumeroRectificativa, onCreateInvoice, onRegistrarCobro, onQuitarCobro, onIrABanco, onIrAGestoria, onSaveSettings, onUpdateInvoiceStatus, onUpdateInvoice, showNewInvoiceModal, setShowNewInvoiceModal, preselectedProject, onAviso }) => {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoActual());
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [verPDF, setVerPDF] = useState<Invoice | null>(null);
  const [verVerifactu, setVerVerifactu] = useState<Invoice | null>(null);
  const [whatsapp, setWhatsapp] = useState<Invoice | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [aAnular, setAAnular] = useState<Invoice | null>(null);
  const [verificacion, setVerificacion] = useState<{ ok: boolean; errores: string[] } | null>(null);
  const [algoritmoOk, setAlgoritmoOk] = useState<boolean | null>(null);
  const [verPDFCorreo, setVerPDFCorreo] = useState(false);
  // Cobros de una factura: los del banco no se tocan desde aquí, los de efectivo o Bizum sí
  const [cobrosDe, setCobrosDe] = useState<Invoice | null>(null);
  const [nuevoCobro, setNuevoCobro] = useState({ importe: 0, fecha: hoyISO(), metodo: 'Transferencia Bancaria', nota: '' });
  const [rectificar, setRectificar] = useState<Invoice | null>(null);
  const [rectTipo, setRectTipo] = useState<TipoFacturaVerifactu>('R1');
  const [rectModo, setRectModo] = useState<'S' | 'I'>('S');
  const [rectMotivo, setRectMotivo] = useState('');
  const [rectLineas, setRectLineas] = useState<LineaForm[]>([]);
  const [rectFecha, setRectFecha] = useState(hoyISO());
  const [rectError, setRectError] = useState<string | null>(null);

  // ---- Formulario nueva factura ----
  const [clienteId, setClienteId] = useState('');
  const [obraId, setObraId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [fechaVencimiento, setFechaVencimiento] = useState(addDays(hoyISO(), companySettings.diasVencimientoFactura || 30));
  const [metodoPago, setMetodoPago] = useState<Invoice['metodoPago']>('Transferencia Bancaria');
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [irpf, setIrpf] = useState(0);
  const [notaFinal, setNotaFinal] = useState('');
  const [isp, setIsp] = useState(false);
  const [modoImporte, setModoImporte] = useState<'completo' | 'porcentaje' | 'resto'>('completo');
  const [porcentaje, setPorcentaje] = useState(50);
  const [emitiendo, setEmitiendo] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const anios = aniosDisponibles(invoices.map((i) => i.fecha));
  const esAutonomo = companySettings.tipoEntidad === 'autonomo';

  useEffect(() => {
    autocomprobarAlgoritmo().then(setAlgoritmoOk).catch(() => setAlgoritmoOk(false));
  }, []);

  const lineasDesdeProyecto = (p: Project, modo: 'completo' | 'porcentaje' | 'resto', pct: number): LineaForm[] => {
    const partidas = p.partidas || [];
    if (modo === 'completo' && partidas.length > 0) {
      return partidas.map((x) => ({ id: uid('l'), concepto: x.concepto, cantidad: x.cantidad, unidad: x.unidad, precioUnitario: x.precioUnitario, ivaPorcentaje: x.ivaPorcentaje, materialesVisibles: (x.materiales || []).filter((m) => m.visibleCliente).map((m) => ({ nombre: m.nombre, cantidad: redondear2(m.cantidad * x.cantidad), unidad: m.unidad })) }));
    }
    const base = p.presupuestoAceptado;
    const importe = modo === 'resto' ? Math.max(0, base - p.totalFacturado) : modo === 'porcentaje' ? base * (pct / 100) : base;
    const etiqueta = modo === 'resto' ? 'Resto pendiente' : modo === 'porcentaje' ? `${pct} %` : 'Total';
    return [{ id: uid('l'), concepto: `${etiqueta} · ${p.nombre} (presupuesto ${p.codigo}${p.obraCodigo ? `, obra ${p.obraCodigo}` : ''})`, cantidad: 1, unidad: 'ud', precioUnitario: redondear2(importe), ivaPorcentaje: companySettings.ivaPorDefecto ?? 21 }];
  };

  // Precarga al abrir el modal
  useEffect(() => {
    if (!showNewInvoiceModal) return;
    setErrorForm(null);
    setFecha(hoyISO());
    setFechaVencimiento(addDays(hoyISO(), companySettings.diasVencimientoFactura || 30));
    setNotaFinal(companySettings.condicionesPagoDefecto || '');
    setMetodoPago(companySettings.metodoPagoPorDefecto || 'Transferencia Bancaria');
    setIsp(!!preselectedProject?.sinImpuestos && /inversi[óo]n del sujeto pasivo/i.test(preselectedProject?.motivoSinImpuestos || ''));
    const p = preselectedProject ? projects.find((x) => x.id === preselectedProject.id) || preselectedProject : null;
    if (p) {
      setClienteId(p.clienteId);
      setObraId(p.id);
      const modo = p.totalFacturado > 0 ? 'resto' : 'completo';
      setModoImporte(modo);
      setLineas(lineasDesdeProyecto(p, modo, porcentaje));
    } else {
      setClienteId(clients[0]?.id || '');
      setObraId('');
      setModoImporte('completo');
      setLineas([{ id: uid('l'), concepto: '', cantidad: 1, unidad: 'ud', precioUnitario: 0, ivaPorcentaje: companySettings.ivaPorDefecto ?? 21 }]);
    }
    const c = clients.find((x) => x.id === (p?.clienteId || clients[0]?.id));
    setIrpf(esAutonomo && companySettings.aplicaRetencionIrpf && c && c.tipoCliente !== 'particular' ? companySettings.retencionIrpfPorcentaje || 15 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNewInvoiceModal]);

  const cambiarObra = (id: string) => {
    setObraId(id);
    const p = projects.find((x) => x.id === id);
    if (p) {
      setClienteId(p.clienteId);
      const modo = p.totalFacturado > 0 ? 'resto' : 'completo';
      setModoImporte(modo);
      setLineas(lineasDesdeProyecto(p, modo, porcentaje));
    }
  };
  const cambiarModo = (m: 'completo' | 'porcentaje' | 'resto', pct = porcentaje) => {
    setModoImporte(m);
    const p = projects.find((x) => x.id === obraId);
    if (p) setLineas(lineasDesdeProyecto(p, m, pct));
  };

  const totales = useMemo(() => {
    let base = 0;
    let iva = 0;
    lineas.forEach((l) => {
      const b = l.cantidad * l.precioUnitario;
      base += b;
      iva += isp ? 0 : b * (l.ivaPorcentaje / 100);
    });
    const ret = base * (irpf / 100);
    return { base: redondear2(base), iva: redondear2(iva), irpf: redondear2(ret), total: redondear2(base + iva - ret) };
  }, [lineas, irpf, isp]);

  const ultimaHuella = () => {
    const registradas = invoices.filter((i) => i.verifactu?.registrada && i.verifactu.cadena).sort((a, b) => a.verifactu.fechaHoraHuso.localeCompare(b.verifactu.fechaHoraHuso));
    return registradas.length ? registradas[registradas.length - 1].verifactu.huellaHash : '';
  };

  const emitir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    const client = clients.find((c) => c.id === clienteId);
    if (!client) return setErrorForm('Elige un cliente.');
    if (!client.nif) return setErrorForm('El cliente no tiene NIF. Añádelo en su ficha antes de facturar (es obligatorio en la factura).');
    if (!companySettings.cif || !companySettings.razonSocial) return setErrorForm('Faltan tus datos fiscales (razón social y NIF/CIF) en Configuración.');
    if (lineas.length === 0 || lineas.some((l) => !l.concepto.trim())) return setErrorForm('Todas las líneas necesitan un concepto.');
    if (totales.base <= 0) return setErrorForm('El importe debe ser mayor que cero.');
    if (invoices.some((i) => i.numero === siguienteNumero)) return setErrorForm(`Ya existe una factura con el número ${siguienteNumero}. Ajusta el siguiente número en Configuración → Numeración.`);
    const ultimaFecha = invoices.filter((i) => i.verifactu?.registrada).map((i) => i.fecha).sort().pop();
    if (ultimaFecha && fecha < ultimaFecha) return setErrorForm(`La fecha no puede ser anterior a la última factura emitida (${formatDate(ultimaFecha)}).`);
    setEmitiendo(true);
    try {
      const project = projects.find((p) => p.id === obraId);
      const registro = await generarRegistroAlta({ nifEmisor: companySettings.cif, numero: siguienteNumero, fecha, cuotaTotal: totales.iva, importeTotal: totales.total, huellaAnterior: ultimaHuella() });
      const inv: Invoice = {
        id: uid('inv'),
        numero: siguienteNumero,
        fecha,
        fechaVencimiento,
        clienteId: client.id,
        clienteNombre: client.nombre,
        clienteNif: client.nif,
        clienteDireccion: [client.direccion, client.codigoPostal, client.ciudad].filter(Boolean).join(', '),
        obraId: project?.id,
        obraNombre: project?.nombre,
        obraCodigo: project?.obraCodigo || project?.codigo,
        lineas: lineas.map((l) => ({ id: l.id, concepto: l.concepto.trim(), cantidad: Number(l.cantidad), unidad: l.unidad, precioUnitario: Number(l.precioUnitario), ivaPorcentaje: isp ? 0 : Number(l.ivaPorcentaje), total: redondear2(Number(l.cantidad) * Number(l.precioUnitario) * (1 + (isp ? 0 : Number(l.ivaPorcentaje)) / 100)), materialesVisibles: l.materialesVisibles })),
        baseImponible: totales.base,
        ivaTotal: totales.iva,
        irpfPorcentaje: irpf > 0 ? irpf : undefined,
        irpfTotal: irpf > 0 ? totales.irpf : undefined,
        total: totales.total,
        estado: 'Pendiente',
        metodoPago,
        plantillaFactura: project?.plantillaPresupuesto || companySettings.plantillaFacturaPorDefecto || companySettings.plantillaPorDefecto,
        notaFinal: notaFinal || undefined,
        inversionSujetoPasivo: isp || undefined,
        firmaCliente: project?.firmaCliente,
        verifactu: registro,
        bancoConciliado: false,
      };
      onCreateInvoice(inv);
      setShowNewInvoiceModal(false);
      onAviso?.(`Factura ${inv.numero} emitida con huella VERI*FACTU.`, 'ok');
      setVerPDF(inv);
    } catch (err: any) {
      setErrorForm(err?.message || 'No se pudo generar el registro.');
    } finally {
      setEmitiendo(false);
    }
  };

  // ---- Rectificativas (R1-R4) ----
  const lineasDesde = (inv: Invoice): LineaForm[] => inv.lineas.map((l) => ({ id: uid('l'), concepto: l.concepto, cantidad: l.cantidad, unidad: l.unidad || 'ud', precioUnitario: l.precioUnitario, ivaPorcentaje: l.ivaPorcentaje, materialesVisibles: l.materialesVisibles }));
  const abrirCobros = (inv: Invoice) => {
    setCobrosDe(inv);
    setNuevoCobro({ importe: pendienteDe(inv), fecha: hoyISO(), metodo: inv.metodoPago || 'Transferencia Bancaria', nota: '' });
  };
  const anotarCobro = () => {
    if (!cobrosDe) return;
    if (nuevoCobro.importe <= 0) return onAviso?.('El importe del cobro debe ser mayor que cero.', 'error');
    onRegistrarCobro(cobrosDe.id, { id: uid('cob'), fecha: nuevoCobro.fecha, importe: redondear2(nuevoCobro.importe), metodo: nuevoCobro.metodo, nota: nuevoCobro.nota.trim() || undefined });
    onAviso?.(`Cobro de ${formatCurrency(nuevoCobro.importe)} anotado en ${cobrosDe.numero}.`, 'ok');
    setCobrosDe(null);
  };
  const reclamar = (inv: Invoice) => {
    const texto = textoReclamacion(inv, companySettings.nombreComercial || companySettings.razonSocial, companySettings.ibanPrincipal);
    const tel = telefonoWhatsApp(clients.find((c) => c.id === inv.clienteId)?.telefono);
    window.open(tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const abrirRectificar = (inv: Invoice) => {
    setRectificar(inv);
    setRectTipo('R1');
    setRectModo('S');
    setRectMotivo('');
    setRectFecha(hoyISO());
    setRectError(null);
    setRectLineas(lineasDesde(inv));
  };
  const cambiarRectModo = (m: 'S' | 'I') => {
    if (!rectificar) return;
    setRectModo(m);
    setRectLineas(m === 'S' ? lineasDesde(rectificar) : [{ id: uid('l'), concepto: `Rectificación de la factura ${rectificar.numero}: `, cantidad: 1, unidad: 'ud', precioUnitario: 0, ivaPorcentaje: rectificar.lineas[0]?.ivaPorcentaje ?? 21 }]);
  };
  const rectTotales = useMemo(() => {
    const isp = !!rectificar?.inversionSujetoPasivo;
    const base = rectLineas.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0);
    const iva = rectLineas.reduce((a, l) => a + l.cantidad * l.precioUnitario * (isp ? 0 : l.ivaPorcentaje / 100), 0);
    const pct = rectificar?.irpfPorcentaje || 0;
    const ret = base * (pct / 100);
    return { base: redondear2(base), iva: redondear2(iva), irpf: redondear2(ret), total: redondear2(base + iva - ret), pct };
  }, [rectLineas, rectificar]);
  const emitirRectificativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rectificar) return;
    setRectError(null);
    if (!rectMotivo.trim()) return setRectError('Indica el motivo de la rectificación (aparece en la factura).');
    if (rectLineas.length === 0 || rectLineas.some((l) => !l.concepto.trim())) return setRectError('Todas las líneas necesitan concepto.');
    if (rectModo === 'I' && Math.abs(rectTotales.base) < 0.01) return setRectError('En una rectificativa por diferencias el importe no puede ser cero (puede ser negativo).');
    if (invoices.some((i) => i.numero === siguienteNumeroRectificativa)) return setRectError(`Ya existe ${siguienteNumeroRectificativa}. Ajusta la numeración en Configuración.`);
    const ultimaFecha = invoices.filter((i) => i.verifactu?.registrada).map((i) => i.fecha).sort().pop();
    if (ultimaFecha && rectFecha < ultimaFecha) return setRectError(`La fecha no puede ser anterior a la última factura emitida (${formatDate(ultimaFecha)}).`);
    setEmitiendo(true);
    try {
      const isp = !!rectificar.inversionSujetoPasivo;
      const registro = await generarRegistroAlta({ nifEmisor: companySettings.cif, numero: siguienteNumeroRectificativa, fecha: rectFecha, cuotaTotal: rectTotales.iva, importeTotal: rectTotales.total, huellaAnterior: ultimaHuella(), tipoFactura: rectTipo, rectificativa: { tipo: rectModo, rectificadas: [{ numero: rectificar.numero, fecha: rectificar.fecha }], baseRectificada: rectificar.baseImponible, cuotaRectificada: rectificar.ivaTotal } });
      const nueva: Invoice = {
        ...rectificar,
        id: uid('inv'),
        numero: siguienteNumeroRectificativa,
        fecha: rectFecha,
        fechaVencimiento: addDays(rectFecha, companySettings.diasVencimientoFactura || 30),
        lineas: rectLineas.map((l) => ({ id: l.id, concepto: l.concepto.trim(), cantidad: Number(l.cantidad), unidad: l.unidad, precioUnitario: Number(l.precioUnitario), ivaPorcentaje: isp ? 0 : Number(l.ivaPorcentaje), total: redondear2(Number(l.cantidad) * Number(l.precioUnitario) * (1 + (isp ? 0 : Number(l.ivaPorcentaje)) / 100)), materialesVisibles: l.materialesVisibles })),
        baseImponible: rectTotales.base,
        ivaTotal: rectTotales.iva,
        irpfPorcentaje: rectTotales.pct || undefined,
        irpfTotal: rectTotales.pct ? rectTotales.irpf : undefined,
        total: rectTotales.total,
        estado: rectTotales.total <= 0 ? 'Pagada' : 'Pendiente',
        bancoConciliado: false,
        transaccionId: undefined,
        rectificaA: { id: rectificar.id, numero: rectificar.numero, fecha: rectificar.fecha },
        rectificadaPor: undefined,
        motivoRectificacion: rectMotivo.trim(),
        verifactu: registro,
        esDemo: false,
      };
      onCreateInvoice(nueva, { serie: 'rectificativa', original: rectificar });
      setRectificar(null);
      onAviso?.(`Rectificativa ${nueva.numero} emitida${rectModo === 'S' ? `; la factura ${rectificar.numero} queda sustituida` : ''}.`, 'ok');
      setVerPDF(nueva);
    } catch (err: any) {
      setRectError(err?.message || 'No se pudo generar el registro.');
    } finally {
      setEmitiendo(false);
    }
  };

  const filtradas = invoices.filter((inv) => {
    if (!coincidePeriodo(inv.fecha, periodo)) return false;
    if (estadoFiltro !== 'todos' && inv.estado !== estadoFiltro) return false;
    const q = busqueda.toLowerCase();
    return !q || inv.numero.toLowerCase().includes(q) || inv.clienteNombre.toLowerCase().includes(q) || inv.clienteNif.toLowerCase().includes(q) || (inv.obraNombre || '').toLowerCase().includes(q);
  }).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero));

  const activas = filtradas.filter((i) => i.estado !== 'Anulada' && i.estado !== 'Rectificada');
  const totalFacturado = activas.reduce((a, i) => a + i.total, 0);
  const totalIva = activas.reduce((a, i) => a + i.ivaTotal, 0);
  const pendiente = activas.filter((i) => i.estado === 'Pendiente' || i.estado === 'Vencida').reduce((a, i) => a + i.total, 0);
  const registradas = invoices.filter((i) => i.verifactu?.registrada && i.verifactu.cadena).length;
  // Mismo criterio que el panel de abajo: solo cuenta lo que tiene registro generado de verdad.
  const pendientesEnvio = pendientesDeEnvio(invoices).length;


  const mensajeWhatsApp = (inv: Invoice) => `Hola ${inv.clienteNombre}, le enviamos la factura ${inv.numero} por ${formatCurrency(inv.total)} (IVA incluido)${inv.obraNombre ? ` correspondiente a "${inv.obraNombre}"` : ''}.\nForma de pago: ${inv.metodoPago}${companySettings.ibanPrincipal ? `\nIBAN: ${companySettings.ibanPrincipal}` : ''}\nVencimiento: ${formatDate(inv.fechaVencimiento)}\n\nGracias por su confianza.\n${companySettings.nombreComercial || companySettings.razonSocial}`;

  const exportarCSV = () => descargarArchivo(`Facturas_emitidas_${periodo.mes}_${periodo.anio}.csv`, csvLibroEmitidas(activas), 'text/csv;charset=utf-8');
  const verificar = async () => setVerificacion(await verificarCadena(invoices));

  // Registros con huella generada que todavía no constan enviados a la AEAT.
  const listaPendientes = useMemo(() => pendientesDeEnvio(invoices), [invoices]);

  const descargarXmlFactura = (inv: Invoice) => {
    const xml = xmlDeFactura(inv, anteriorDe(inv, invoices), companySettings);
    descargarArchivo(`Registro_AEAT_${inv.numero.replace(/[^\w-]/g, '_')}.xml`, xml, 'application/xml;charset=utf-8');
  };
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {ajustesAbiertos && onSaveSettings && <DocumentSettingsModal tipo="factura" settings={companySettings} onSave={(c) => { onSaveSettings(c); onAviso?.('Ajustes de facturas guardados. Se aplican a las facturas nuevas.', 'ok'); }} onClose={() => setAjustesAbiertos(false)} />}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><BadgeEuro className="text-blue-600" size={28} /> Facturas</h1>
          <p className="text-slate-500 text-sm mt-1">Numeración correlativa, huella SHA-256 encadenada y QR de cotejo conforme al RD 1007/2023. Una factura emitida no se borra: se anula o se rectifica · {etiquetaPeriodo(periodo)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter value={periodo} onChange={setPeriodo} anios={anios} totalFiltrado={filtradas.length} totalGlobal={invoices.filter((i) => estadoFiltro === 'todos' || i.estado === estadoFiltro).length} />
          <button onClick={exportarCSV} className="bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xs flex items-center gap-2 cursor-pointer"><Download size={16} /> CSV del periodo</button>
          {onSaveSettings && <button type="button" onClick={() => setAjustesAbiertos(true)} title="Vencimiento, plantilla, condiciones, IVA y forma de pago de las facturas nuevas" className="bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-2xl shadow-xs flex items-center gap-2 cursor-pointer"><SlidersHorizontal size={15} /> Ajustes</button>}
          <button onClick={() => setShowNewInvoiceModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"><Plus size={16} /> Nueva factura {siguienteNumero}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Pod titulo="Facturado (con IVA)" valor={formatCurrency(totalFacturado)} pie={`${activas.length} facturas en el periodo`} icono={<BadgeEuro size={16} />} color="blue" />
        <Pod titulo="IVA repercutido" valor={formatCurrency(totalIva)} pie="Va al modelo 303" icono={<FileText size={16} />} color="indigo" />
        <Pod titulo="Pendiente de cobro" valor={formatCurrency(pendiente)} pie={`${activas.filter((i) => i.estado === 'Pendiente' || i.estado === 'Vencida').length} facturas`} icono={<AlertCircle size={16} />} color="amber" />
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">VERI*FACTU</span><span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck size={16} /></span></div>
          <p className="text-xl font-black text-emerald-900">{registradas} <span className="text-sm text-slate-400 font-bold">con huella</span></p>
          <p className="text-[11px] mt-1 font-medium text-slate-500">{pendientesEnvio > 0 ? `${pendientesEnvio} ${pendientesEnvio === 1 ? 'pendiente' : 'pendientes'} de envío a la AEAT` : 'Nada pendiente de envío'}{algoritmoOk === false ? ' · ⚠ algoritmo no verificado' : ''}</p>
          <div className="flex flex-col items-start gap-0.5 mt-1">
            <button onClick={verificar} className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">Comprobar encadenamiento</button>
            {pendientesEnvio > 0 && onIrAGestoria && <button onClick={onIrAGestoria} className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer flex items-center gap-1">Generar el XML en Trimestre e impuestos <ArrowRight size={11} /></button>}
          </div>
        </div>
      </div>

      {verificacion && (
        <div className={`p-4 rounded-2xl border text-xs flex items-start gap-2 ${verificacion.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
          {verificacion.ok ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          <div><p className="font-bold">{verificacion.ok ? 'La cadena de huellas es correcta: cada factura enlaza con la anterior y ninguna se ha modificado.' : 'Se han detectado incidencias en la cadena:'}</p>{verificacion.errores.map((e) => <p key={e}>· {e}</p>)}{algoritmoOk !== null && <p className="text-[11px] opacity-70 mt-1">Algoritmo de huella comprobado con los vectores oficiales de la AEAT: {algoritmoOk ? 'correcto' : 'ERROR'}.</p>}<button onClick={() => setVerificacion(null)} className="text-[11px] underline mt-1 cursor-pointer">Cerrar</button></div>
        </div>
      )}


      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96"><Search className="absolute left-4 top-3 text-slate-400" size={18} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl bg-slate-50/80 text-xs font-medium outline-none" placeholder="Buscar por número, cliente, NIF u obra…" /></div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {['todos', 'Pendiente', 'Pagada', 'Vencida', 'Anulada', 'Rectificada'].map((st) => <button key={st} onClick={() => setEstadoFiltro(st)} className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap cursor-pointer ${estadoFiltro === st ? 'bg-slate-900 text-white' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'}`}>{st === 'todos' ? 'Todas' : st === 'Pendiente' ? 'Por cobrar' : st === 'Pagada' ? 'Cobradas' : st === 'Rectificada' ? 'Sustituidas' : st + 's'}</button>)}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filtradas.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">No hay facturas en {etiquetaPeriodo(periodo).toLowerCase()}. {invoices.length > 0 && <button onClick={() => setPeriodo({ mes: 'todos', anio: 'todos' })} className="text-blue-600 font-bold hover:underline cursor-pointer">Ver todas</button>}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 text-[11px] font-black uppercase tracking-wider"><tr><th className="p-4">Número</th><th className="p-4">Fecha / vence</th><th className="p-4">Cliente / obra</th><th className="p-4 text-right">Base / IVA</th><th className="p-4 text-right">Total</th><th className="p-4 text-center">Cobro</th><th className="p-4 text-center">VERI*FACTU</th><th className="p-4 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtradas.map((inv) => {
                  const vencida = (inv.estado === 'Pendiente' || inv.estado === 'Vencida') && inv.fechaVencimiento < hoyISO();
                  return (
                    <tr key={inv.id} className={`hover:bg-slate-50/80 ${inv.estado === 'Anulada' || inv.estado === 'Rectificada' ? 'opacity-60' : ''}`}>
                      <td className="p-4"><span className="font-black text-blue-600 hover:underline cursor-pointer" onClick={() => setVerPDF(inv)}>{inv.numero}</span>{inv.rectificaA && <span className="ml-1.5 text-[9px] font-black uppercase bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">{inv.verifactu?.tipoFactura} · rectifica {inv.rectificaA.numero}</span>}<p className="text-[10px] text-slate-400 mt-0.5">{inv.metodoPago}{inv.firmaCliente ? ' · con aceptación firmada' : ''}{inv.rectificadaPor ? ` · sustituida por ${inv.rectificadaPor.numero}` : ''}</p></td>
                      <td className="p-4 text-xs"><p className="font-bold text-slate-800">{formatDate(inv.fecha)}</p><p className={`text-[11px] ${vencida ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>Vence {formatDate(inv.fechaVencimiento)}</p></td>
                      <td className="p-4"><p className="font-bold text-slate-800 text-xs">{inv.clienteNombre}</p><div className="text-[11px] text-slate-400 mt-0.5">{inv.clienteNif}{inv.obraCodigo ? <span className="text-blue-600 font-semibold"> · {inv.obraCodigo}</span> : ''}</div></td>
                      <td className="p-4 text-right text-xs"><p className="font-medium text-slate-600">{formatCurrency(inv.baseImponible)}</p><p className="text-[10px] text-slate-400">+ {formatCurrency(inv.ivaTotal)} IVA{inv.irpfTotal ? ` − ${formatCurrency(inv.irpfTotal)} IRPF` : ''}</p></td>
                      <td className="p-4 text-right"><span className="font-black text-slate-900 text-sm">{formatCurrency(inv.total)}</span></td>
                      <td className="p-4 text-center">
                        {inv.estado === 'Anulada' || inv.estado === 'Rectificada' ? <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-200 text-slate-600">{inv.estado}</span> : (() => {
                          const cobrado = totalCobrado(inv);
                          const pend = pendienteDe(inv);
                          const sit = situacionDe(inv);
                          const dias = diasVencida(inv);
                          return (
                            <button onClick={() => abrirCobros(inv)} className={`w-full inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border cursor-pointer ${sit === 'cobrada' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' : sit === 'parcial' ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' : dias > 0 ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100' : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'}`} title="Ver y registrar cobros">
                              <span className="text-[11px] font-black uppercase">{sit === 'cobrada' ? 'Cobrada' : sit === 'parcial' ? 'A medias' : dias > 0 ? `${dias} d de retraso` : 'Por cobrar'}</span>
                              {sit !== 'cobrada' && <span className="text-[10px] font-bold">Faltan {formatCurrency(pend)}</span>}
                              {sit === 'parcial' && <span className="text-[9px] opacity-80">cobrado {formatCurrency(cobrado)}</span>}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => setVerVerifactu(inv)} className={`inline-flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl border cursor-pointer ${inv.verifactu?.cadena ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`} title="Ver registro de facturación">
                          <ShieldCheck size={16} /><span className="text-[9px] font-black tracking-tighter">{inv.verifactu?.cadena ? (inv.verifactu.estadoEnvio === 'enviado' ? 'ENVIADA' : 'HUELLA OK') : 'SIN REGISTRO'}</span>
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1 text-slate-400">
                          <button onClick={() => setWhatsapp(inv)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer" title="WhatsApp"><MessageSquare size={16} /></button>
                          <button onClick={() => { setVerPDFCorreo(true); setVerPDF(inv); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer" title="Enviar por correo con el PDF adjunto"><Send size={16} /></button>
                          {inv.verifactu?.cadena && inv.estado !== 'Anulada' && inv.estado !== 'Rectificada' && <button onClick={() => abrirRectificar(inv)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg cursor-pointer" title="Emitir factura rectificativa (R1-R4)"><RefreshCcw size={16} /></button>}
                          <button onClick={() => setVerPDF(inv)} className="p-2 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer" title="Ver / imprimir"><Eye size={16} /></button>
                          {inv.estado !== 'Anulada' && inv.estado !== 'Rectificada' && inv.verifactu?.cadena && <button onClick={() => setAAnular(inv)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer" title="Anular (registro de anulación)"><Ban size={16} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {verPDF && <DocumentRenderer tipo="f" doc={invoices.find((i) => i.id === verPDF.id) || verPDF} companySettings={companySettings} client={clients.find((c) => c.id === verPDF.clienteId)} abrirCorreo={verPDFCorreo} onRectificar={(inv) => { setVerPDF(null); setVerPDFCorreo(false); abrirRectificar(inv as Invoice); }} onClose={() => { setVerPDF(null); setVerPDFCorreo(false); }} onSendWhatsApp={(d) => { setVerPDF(null); setWhatsapp(d as Invoice); }} onCorreoEnviado={(canal) => onAviso?.(`Factura ${verPDF.numero} enviada por correo (${canal}).`, 'ok')} onCambiarPlantilla={(id) => onUpdateInvoice(verPDF.id, { plantillaFactura: id })} />}

      {/* REGISTRO VERIFACTU */}
      {verVerifactu && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2"><div className="p-2 rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck size={24} /></div><div><h2 className="text-lg font-black text-slate-900">Registro de facturación · {verVerifactu.numero}</h2><p className="text-xs text-slate-500">Orden HAC/1177/2024 · huella SHA-256 encadenada</p></div></div>
              <button onClick={() => setVerVerifactu(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={20} /></button>
            </div>
            {!verVerifactu.verifactu?.cadena ? <p className="text-xs text-slate-500 p-4 bg-slate-50 rounded-xl">Esta factura (de ejemplo o antigua) no tiene registro de facturación generado.</p> : (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-500">Tipo de factura</span><span className="font-bold">{verVerifactu.verifactu.tipoFactura}{verVerifactu.verifactu.tipoFactura === 'F1' ? ' (completa)' : ` (rectificativa ${verVerifactu.verifactu.tipoRectificativa === 'S' ? 'por sustitución' : 'por diferencias'})`}</span></div>
                  {verVerifactu.verifactu.facturasRectificadas && <div className="flex justify-between gap-4"><span className="text-slate-500 shrink-0">Rectifica a</span><span className="font-bold text-right">{verVerifactu.verifactu.facturasRectificadas.map((r) => `${r.numero} (${formatDate(r.fecha)})`).join(', ')}{verVerifactu.verifactu.importeRectificacion ? ` · base rectificada ${formatCurrency(verVerifactu.verifactu.importeRectificacion.baseRectificada)}, cuota ${formatCurrency(verVerifactu.verifactu.importeRectificacion.cuotaRectificada)}` : ''}</span></div>}
                  <div className="flex justify-between"><span className="text-slate-500">Fecha y hora de generación</span><span className="font-mono font-bold">{verVerifactu.verifactu.fechaHoraHuso}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Envío a la AEAT</span><span className={`font-bold ${verVerifactu.verifactu.estadoEnvio === 'enviado' ? 'text-emerald-700' : 'text-amber-700'}`}>{verVerifactu.verifactu.estadoEnvio === 'enviado' ? `Enviada ${verVerifactu.verifactu.fechaEnvio ? formatDate(verVerifactu.verifactu.fechaEnvio) : ''}${verVerifactu.verifactu.csvAEAT ? ` · CSV ${verVerifactu.verifactu.csvAEAT}` : ''}` : 'Pendiente'}</span></div>
                </div>
                <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Cadena sobre la que se calcula la huella</p><div className="p-3 bg-slate-100 text-slate-700 rounded-xl font-mono text-[10px] break-all border border-slate-200">{verVerifactu.verifactu.cadena}</div></div>
                <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Huella de esta factura</p><div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] break-all">{verVerifactu.verifactu.huellaHash}</div></div>
                <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Huella de la factura anterior</p><div className="p-3 bg-slate-100 text-slate-600 rounded-xl font-mono text-[11px] break-all border border-slate-200">{verVerifactu.verifactu.hashAnterior || '(primera factura de la cadena)'}</div></div>
                <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">URL de cotejo del QR</p><a href={verVerifactu.verifactu.codigoQR} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-mono text-[10px] break-all">{verVerifactu.verifactu.codigoQR}</a></div>
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-2">
                  <p className="font-bold">Envío a la AEAT</p>
                  <p className="text-[11px]">La app genera el fichero XML oficial del registro, que es lo que hay que remitir. El envío en sí requiere firmar la petición con el certificado digital de la empresa: no puede hacerse desde el navegador. Descarga el XML, remítelo por el medio que uses (gestoría o servidor propio) y márcalo aquí con el CSV que devuelva la AEAT.</p>
                  <button onClick={() => descargarXmlFactura(verVerifactu)} className="px-3.5 py-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"><Download size={13} /> Descargar el XML de esta factura</button>
                  {verVerifactu.verifactu.estadoEnvio !== 'enviado' && (
                    <button onClick={() => { const csv = prompt('CSV o referencia de la AEAT (opcional):') ?? ''; onUpdateInvoice(verVerifactu.id, { verifactu: { ...verVerifactu.verifactu, estadoEnvio: 'enviado', fechaEnvio: hoyISO(), csvAEAT: csv || undefined } }); setVerVerifactu(null); }} className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs font-bold cursor-pointer">Marcar como enviada</button>
                  )}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end"><button onClick={() => setVerVerifactu(null)} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer">Cerrar</button></div>
          </div>
        </div>
      )}

      {/* WHATSAPP */}
      {whatsapp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-900 text-base flex items-center gap-2"><MessageSquare className="text-emerald-600" size={20} /> Enviar {whatsapp.numero} por WhatsApp</h3><button onClick={() => setWhatsapp(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <p className="text-xs text-slate-500 mb-3">Descarga antes el PDF (Ver / imprimir) para adjuntarlo en la conversación. Mensaje:</p>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 whitespace-pre-line mb-4">{mensajeWhatsApp(whatsapp)}</div>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(mensajeWhatsApp(whatsapp)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">{copiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar texto'}</button>
              <button onClick={() => { const tel = telefonoWhatsApp(clients.find((c) => c.id === whatsapp.clienteId)?.telefono); window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensajeWhatsApp(whatsapp))}`, '_blank'); setWhatsapp(null); }} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"><Send size={14} /> Abrir WhatsApp</button>
            </div>
          </div>
        </div>
      )}

      {/* NUEVA FACTURA */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div><span className="text-[10px] font-black uppercase tracking-wider bg-blue-500 text-white px-2 py-0.5 rounded">Registro VERI*FACTU al emitir</span><h2 className="text-xl font-black mt-1">Nueva factura {siguienteNumero}</h2></div>
              <button onClick={() => setShowNewInvoiceModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            </div>
            <form onSubmit={emitir} className="p-6 md:p-8 flex-1 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block font-bold text-slate-700 mb-1">Obra / presupuesto (opcional)</label>
                  <select value={obraId} onChange={(e) => cambiarObra(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white">
                    <option value="">Sin obra (servicio directo)</option>
                    {projects.filter((p) => ['Aceptado', 'En ejecución', 'En legalización CIE', 'Finalizada', 'Facturada'].includes(p.estado)).map((p) => <option key={p.id} value={p.id}>{p.obraCodigo || p.codigo} · {p.nombre} · {p.estado}{p.totalFacturado > 0 ? ` (facturado ${formatCurrency(p.totalFacturado)} de ${formatCurrency(p.presupuestoAceptado)})` : ''}</option>)}
                  </select>
                </div>
                <div><label className="block font-bold text-slate-700 mb-1">Cliente *</label>
                  <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold bg-white" required disabled={!!obraId}>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.nif ? ` · ${c.nif}` : ' · SIN NIF'}</option>)}
                  </select>
                </div>
              </div>

              {obraId && (() => {
                const p = projects.find((x) => x.id === obraId);
                if (!p) return null;
                return (
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-bold text-blue-900">Qué facturar de la obra {p.obraCodigo || p.codigo} ({formatCurrency(p.presupuestoAceptado)} base{p.totalFacturado > 0 ? `, ya facturado ${formatCurrency(p.totalFacturado)}` : ''})</p>
                      {p.firmaCliente ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={11} /> Aceptación de {p.firmaCliente.firmadoPor} incluida</span> : <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Sin aceptación firmada</span>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" onClick={() => cambiarModo('completo')} className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${modoImporte === 'completo' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>Todas las partidas</button>
                      <button type="button" onClick={() => cambiarModo('porcentaje')} className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${modoImporte === 'porcentaje' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>Un porcentaje (anticipo)</button>
                      {p.totalFacturado > 0 && <button type="button" onClick={() => cambiarModo('resto')} className={`px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${modoImporte === 'resto' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>Resto pendiente ({formatCurrency(Math.max(0, p.presupuestoAceptado - p.totalFacturado))})</button>}
                      {modoImporte === 'porcentaje' && <div className="flex items-center gap-1"><input type="number" min={1} max={100} value={porcentaje} onChange={(e) => { const v = Number(e.target.value); setPorcentaje(v); cambiarModo('porcentaje', v); }} className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold" /><span>%</span></div>}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="block font-bold text-slate-700 mb-1">Fecha de emisión</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" required /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Vencimiento</label><input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" required /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Forma de pago</label><select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as any)} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white">{['Transferencia Bancaria', 'Bizum', 'TPV', 'Efectivo', 'Domiciliación', 'Pagaré'].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center"><h3 className="font-black uppercase tracking-wider text-slate-700">Líneas</h3><button type="button" onClick={() => setLineas([...lineas, { id: uid('l'), concepto: '', cantidad: 1, unidad: 'ud', precioUnitario: 0, ivaPorcentaje: companySettings.ivaPorDefecto ?? 21 }])} className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"><Plus size={14} /> Añadir línea</button></div>
                {lineas.map((l) => (
                  <div key={l.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-12 gap-2 items-center">
                    <input value={l.concepto} onChange={(e) => setLineas(lineas.map((x) => (x.id === l.id ? { ...x, concepto: e.target.value } : x)))} placeholder="Concepto" className="col-span-12 sm:col-span-5 bg-white border border-slate-200 rounded-xl px-3 py-1.5" required />
                    <input type="number" value={l.cantidad} onChange={(e) => setLineas(lineas.map((x) => (x.id === l.id ? { ...x, cantidad: Number(e.target.value) } : x)))} className="col-span-3 sm:col-span-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center" min="0.01" step="any" />
                    <input type="number" value={l.precioUnitario} onChange={(e) => setLineas(lineas.map((x) => (x.id === l.id ? { ...x, precioUnitario: Number(e.target.value) } : x)))} className="col-span-4 sm:col-span-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-right font-bold" min="0" step="0.01" />
                    <select value={l.ivaPorcentaje} onChange={(e) => setLineas(lineas.map((x) => (x.id === l.id ? { ...x, ivaPorcentaje: Number(e.target.value) } : x)))} className="col-span-3 sm:col-span-2 bg-white border border-slate-200 rounded-xl px-1 py-1.5 text-center" disabled={isp}><option value={21}>21 %</option><option value={10}>10 %</option><option value={4}>4 %</option><option value={0}>0 %</option></select>
                    <button type="button" onClick={() => lineas.length > 1 && setLineas(lineas.filter((x) => x.id !== l.id))} className="col-span-2 sm:col-span-1 text-slate-400 hover:text-red-600 cursor-pointer flex justify-center"><X size={16} /></button>
                    {l.materialesVisibles && l.materialesVisibles.length > 0 && <p className="col-span-12 text-[10px] text-slate-500">Materiales visibles en la factura: {l.materialesVisibles.map((m) => `${m.nombre} (${m.cantidad} ${m.unidad})`).join(', ')}</p>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block font-bold text-slate-700 mb-1">Condiciones (pie de la factura)</label><textarea value={notaFinal} onChange={(e) => setNotaFinal(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
                <div className="space-y-2">
                  {esAutonomo && <div><label className="block font-bold text-slate-700 mb-1">Retención IRPF (solo si el cliente es empresa o profesional)</label><select value={irpf} onChange={(e) => setIrpf(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"><option value={0}>Sin retención (particulares)</option><option value={7}>7 % (primeros años)</option><option value={15}>15 %</option></select></div>}
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"><input type="checkbox" checked={isp} onChange={(e) => setIsp(e.target.checked)} className="rounded" /><span><strong>Inversión del sujeto pasivo</strong> (obra para promotor/contratista, art. 84.Uno.2º.f LIVA): factura sin IVA</span></label>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-1.5">
                <div className="flex justify-between text-slate-300"><span>Base imponible</span><span className="font-bold">{formatCurrency(totales.base)}</span></div>
                <div className="flex justify-between text-slate-300"><span>IVA</span><span className="font-bold">{formatCurrency(totales.iva)}</span></div>
                {irpf > 0 && <div className="flex justify-between text-slate-300"><span>Retención IRPF {irpf} %</span><span className="font-bold">−{formatCurrency(totales.irpf)}</span></div>}
                <div className="flex justify-between text-base font-black pt-2 border-t border-slate-800"><span>TOTAL</span><span className="text-blue-400">{formatCurrency(totales.total)}</span></div>
              </div>

              {errorForm && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2"><AlertCircle size={15} /> {errorForm}</div>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowNewInvoiceModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">Cancelar</button>
                <button type="submit" disabled={emitiendo} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"><ShieldCheck size={16} /> {emitiendo ? 'Generando huella…' : 'Emitir factura'}</button>
              </div>
              <p className="text-[10px] text-slate-400 text-center">Al emitir se asigna el número {siguienteNumero} y se calcula la huella encadenada. Después solo se puede corregir con una anulación o una rectificativa.</p>
            </form>
          </div>
        </div>
      )}

      {cobrosDe && (() => {
        const inv = invoices.find((i) => i.id === cobrosDe.id) || cobrosDe;
        const cobrado = totalCobrado(inv);
        const pend = pendienteDe(inv);
        const dias = diasVencida(inv);
        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl my-6 overflow-hidden">
              <div className="p-5 bg-slate-900 text-white flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500 px-2 py-0.5 rounded">Cobros</span>
                  <h3 className="text-lg font-black mt-1">{inv.numero}</h3>
                  <p className="text-[11px] text-slate-400">{inv.clienteNombre} · {formatCurrency(inv.total)} · vence {formatDate(inv.fechaVencimiento)}{dias > 0 ? ` · ${dias} días de retraso` : ''}</p>
                </div>
                <button onClick={() => setCobrosDe(null)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200"><p className="text-[10px] uppercase font-black text-slate-400">Total</p><p className="font-black text-slate-900 text-sm">{formatCurrency(inv.total)}</p></div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200"><p className="text-[10px] uppercase font-black text-emerald-600">Cobrado</p><p className="font-black text-emerald-800 text-sm">{formatCurrency(cobrado)}</p></div>
                  <div className={`p-3 rounded-2xl border ${pend > 0.01 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}><p className="text-[10px] uppercase font-black text-amber-600">Pendiente</p><p className="font-black text-amber-800 text-sm">{formatCurrency(pend)}</p></div>
                </div>

                <div className="space-y-1.5">
                  <p className="font-black text-slate-800">Cobros registrados</p>
                  {(inv.cobros || []).length === 0 && <p className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500">Todavía no consta ningún cobro. Los ingresos que concilies en la pestaña del banco aparecerán aquí solos.</p>}
                  {(inv.cobros || []).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${c.transaccionId ? 'bg-emerald-500' : 'bg-slate-400'}`} title={c.transaccionId ? 'Conciliado con el banco' : 'Anotado a mano'} />
                      <span className="flex-1 min-w-0"><span className="font-bold text-slate-800 block">{formatCurrency(c.importe)} · {formatDate(c.fecha)}</span><span className="text-[10px] text-slate-500 block truncate">{c.transaccionId ? 'Desde el extracto del banco' : c.metodo || 'A mano'}{c.nota ? ` · ${c.nota}` : ''}</span></span>
                      {c.transaccionId
                        ? <button onClick={() => { setCobrosDe(null); onIrABanco?.(); }} className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer shrink-0">Ver en el banco</button>
                        : <button onClick={() => onQuitarCobro(inv.id, c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0" title="Quitar este cobro"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                </div>

                {pend > 0.01 && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <p className="font-black text-slate-800">Anotar un cobro que no pasa por el extracto</p>
                    <p className="text-[11px] text-slate-500">Efectivo, Bizum o un banco que no importas. Si el ingreso llega por transferencia, es mejor concíliarlo en la pestaña del banco: así queda enlazado al movimiento.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div><label className="block font-bold text-slate-600 mb-1">Importe</label><input type="number" step="0.01" min="0" value={nuevoCobro.importe || ''} onChange={(e) => setNuevoCobro({ ...nuevoCobro, importe: Number(e.target.value) })} className="w-full border border-slate-200 rounded-xl px-2.5 py-2 font-black bg-white" /></div>
                      <div><label className="block font-bold text-slate-600 mb-1">Fecha</label><input type="date" value={nuevoCobro.fecha} onChange={(e) => setNuevoCobro({ ...nuevoCobro, fecha: e.target.value })} className="w-full border border-slate-200 rounded-xl px-2.5 py-2 bg-white" /></div>
                      <div><label className="block font-bold text-slate-600 mb-1">Forma</label><select value={nuevoCobro.metodo} onChange={(e) => setNuevoCobro({ ...nuevoCobro, metodo: e.target.value })} className="w-full border border-slate-200 rounded-xl px-2 py-2 bg-white">{['Transferencia Bancaria', 'Efectivo', 'Bizum', 'TPV', 'Pagaré', 'Domiciliación'].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setNuevoCobro({ ...nuevoCobro, importe: redondear2(inv.total / 2) })} className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold cursor-pointer">50 %</button>
                      <button type="button" onClick={() => setNuevoCobro({ ...nuevoCobro, importe: pend })} className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold cursor-pointer">Todo lo que falta</button>
                      <button type="button" onClick={anotarCobro} className="ml-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black cursor-pointer">Anotar cobro</button>
                    </div>
                  </div>
                )}

                {pend > 0.01 && (
                  <button onClick={() => reclamar(inv)} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black flex items-center justify-center gap-2 cursor-pointer"><MessageSquare size={15} /> Reclamar por WhatsApp</button>
                )}
                <p className="text-[10px] text-slate-400 text-center">El estado de cobro sale de sumar estos cobros. No cambia el registro fiscal de la factura ni su huella.</p>
              </div>
            </div>
          </div>
        );
      })()}

      {rectificar && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center"><div><span className="text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white px-2 py-0.5 rounded">Factura rectificativa</span><h2 className="text-xl font-black mt-1">{siguienteNumeroRectificativa} · rectifica a {rectificar.numero}</h2><p className="text-xs text-slate-400">{rectificar.clienteNombre} · original de {formatDate(rectificar.fecha)} por {formatCurrency(rectificar.total)}</p></div><button onClick={() => setRectificar(null)} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button></div>
            <form onSubmit={emitirRectificativa} className="p-6 md:p-8 flex-1 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block font-bold text-slate-700 mb-1">Tipo (según la causa)</label><select value={rectTipo} onChange={(e) => setRectTipo(e.target.value as TipoFacturaVerifactu)} className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold">{TIPOS_RECTIFICATIVA.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}</select><p className="text-[10px] text-slate-400 mt-1">{TIPOS_RECTIFICATIVA.find((t) => t.codigo === rectTipo)?.descripcion}</p></div>
                <div><label className="block font-bold text-slate-700 mb-1">Fecha</label><input type="date" value={rectFecha} onChange={(e) => setRectFecha(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => cambiarRectModo('S')} className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer ${rectModo === 'S' ? 'border-purple-600 bg-purple-50/50' : 'border-slate-200'}`}><p className="font-black text-slate-900">Por sustitución</p><p className="text-[11px] text-slate-500 mt-0.5">La nueva factura recoge los importes correctos completos. La original queda sustituida (deja de contar en totales y en la obra).</p></button>
                <button type="button" onClick={() => cambiarRectModo('I')} className={`p-3.5 rounded-2xl border-2 text-left cursor-pointer ${rectModo === 'I' ? 'border-purple-600 bg-purple-50/50' : 'border-slate-200'}`}><p className="font-black text-slate-900">Por diferencias</p><p className="text-[11px] text-slate-500 mt-0.5">Solo se factura la diferencia (positiva o negativa). La original sigue válida.</p></button>
              </div>
              <div><label className="block font-bold text-slate-700 mb-1">Motivo (se imprime en la factura) *</label><input value={rectMotivo} onChange={(e) => setRectMotivo(e.target.value)} placeholder="Ej.: Error en el tipo de IVA aplicado · Descuento pactado no aplicado · Abono por material devuelto" className="w-full border border-slate-200 rounded-xl px-3 py-2" required /></div>
              <div className="space-y-2">
                <div className="flex justify-between items-center"><h3 className="font-black uppercase tracking-wider text-slate-700">Líneas {rectModo === 'S' ? '(importes correctos)' : '(diferencias; usa negativo para abonar)'}</h3><button type="button" onClick={() => setRectLineas([...rectLineas, { id: uid('l'), concepto: '', cantidad: 1, unidad: 'ud', precioUnitario: 0, ivaPorcentaje: companySettings.ivaPorDefecto ?? 21 }])} className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"><Plus size={14} /> Añadir línea</button></div>
                {rectLineas.map((l) => (
                  <div key={l.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-12 gap-2 items-center">
                    <input value={l.concepto} onChange={(e) => setRectLineas(rectLineas.map((x) => (x.id === l.id ? { ...x, concepto: e.target.value } : x)))} placeholder="Concepto" className="col-span-12 sm:col-span-5 bg-white border border-slate-200 rounded-xl px-3 py-1.5" required />
                    <input type="number" value={l.cantidad} onChange={(e) => setRectLineas(rectLineas.map((x) => (x.id === l.id ? { ...x, cantidad: Number(e.target.value) } : x)))} className="col-span-3 sm:col-span-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center" step="any" title="Cantidad" />
                    <input type="number" value={l.precioUnitario} onChange={(e) => setRectLineas(rectLineas.map((x) => (x.id === l.id ? { ...x, precioUnitario: Number(e.target.value) } : x)))} className="col-span-4 sm:col-span-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-right font-bold" step="0.01" title="Precio unitario sin IVA" />
                    <select value={l.ivaPorcentaje} onChange={(e) => setRectLineas(rectLineas.map((x) => (x.id === l.id ? { ...x, ivaPorcentaje: Number(e.target.value) } : x)))} className="col-span-3 sm:col-span-2 bg-white border border-slate-200 rounded-xl px-1 py-1.5 text-center"><option value={21}>21 %</option><option value={10}>10 %</option><option value={4}>4 %</option><option value={0}>0 %</option></select>
                    <button type="button" onClick={() => rectLineas.length > 1 && setRectLineas(rectLineas.filter((x) => x.id !== l.id))} className="col-span-2 sm:col-span-1 text-slate-400 hover:text-red-600 cursor-pointer flex justify-center"><X size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-1.5">
                <div className="flex justify-between text-slate-300"><span>Base imponible</span><span className="font-bold">{formatCurrency(rectTotales.base)}</span></div>
                <div className="flex justify-between text-slate-300"><span>IVA</span><span className="font-bold">{formatCurrency(rectTotales.iva)}</span></div>
                {rectTotales.pct > 0 && <div className="flex justify-between text-slate-300"><span>Retención IRPF {rectTotales.pct} %</span><span className="font-bold">−{formatCurrency(rectTotales.irpf)}</span></div>}
                <div className="flex justify-between text-base font-black pt-2 border-t border-slate-800"><span>TOTAL {rectModo === 'S' ? 'de la nueva factura' : 'de la diferencia'}</span><span className="text-purple-300">{formatCurrency(rectTotales.total)}</span></div>
                {rectModo === 'S' && <p className="text-[11px] text-slate-400 pt-1">Diferencia respecto a la original: {formatCurrency(rectTotales.total - rectificar.total)}</p>}
              </div>
              {rectError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2"><AlertCircle size={15} /> {rectError}</div>}
              <div className="flex gap-3"><button type="button" onClick={() => setRectificar(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">Cancelar</button><button type="submit" disabled={emitiendo} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"><ShieldCheck size={16} /> {emitiendo ? 'Generando huella…' : 'Emitir rectificativa'}</button></div>
              <p className="text-[10px] text-slate-400 text-center">La rectificativa entra en la misma cadena de huellas y referencia a la factura original (art. 80 LIVA y art. 15 RD 1619/2012).</p>
            </form>
          </div>
        </div>
      )}

      {aAnular && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4"><Ban size={24} /></div>
            <h3 className="text-base font-black text-slate-900">¿Anular la factura {aAnular.numero}?</h3>
            <p className="text-xs text-slate-500 mt-1.5">La factura queda marcada como anulada (no se borra: el registro debe conservarse). Para corregir importes, emite después una nueva factura. El registro de anulación queda pendiente de envío a la AEAT igual que el de alta.</p>
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => setAAnular(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">Cancelar</button><button onClick={() => { onUpdateInvoice(aAnular.id, { estado: 'Anulada' }); setAAnular(null); }} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer">Anular</button></div>
          </div>
        </div>
      )}

    </div>
  );
};

const Pod: React.FC<{ titulo: string; valor: string; pie: string; icono: React.ReactNode; color: 'blue' | 'indigo' | 'amber' }> = ({ titulo, valor, pie, icono, color }) => {
  const cls = { blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600', amber: 'bg-amber-50 text-amber-600' }[color];
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{titulo}</span><span className={`p-2 rounded-xl ${cls}`}>{icono}</span></div>
      <p className="text-xl font-black text-slate-900">{valor}</p>
      <p className="text-[11px] text-slate-500 mt-1 font-medium">{pie}</p>
    </div>
  );
};
