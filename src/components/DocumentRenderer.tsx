import React, { useEffect, useMemo, useState } from 'react';
import { Printer, X, ShieldCheck, CheckCircle2, FileText, Phone, Mail, Palette, Type, Sliders, Check, PenTool, Download, Share2, Send, AlertCircle } from 'lucide-react';
import { generarPDFDesdeElemento, descargarBlob, puedeCompartirArchivos, compartirPDF, nombreArchivoPDF } from '../lib/pdf';
import { enviarConGmail, correoValido } from '../lib/gmail';
import { firebaseDisponible } from '../lib/firebase';
import QRCode from 'qrcode';
import { Project, Invoice, Client, CompanySettings, DocumentBaseTemplate, DocumentTemplate } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { addDays } from '../utils/dates';

export const TEMPLATE_OPTIONS: Array<{ id: DocumentBaseTemplate; name: string; desc: string }> = [
  { id: 'moderna', name: 'Moderna', desc: 'Banda superior con color corporativo' },
  { id: 'clasica', name: 'Clásica', desc: 'Cabecera formal con línea divisoria' },
  { id: 'tecnica', name: 'Técnica', desc: 'Barra lateral y numeración monoespaciada' },
  { id: 'compacta', name: 'Compacta', desc: 'Alta densidad, letra pequeña' },
  { id: 'editorial', name: 'Editorial', desc: 'Tipografía serif y mucho aire' },
  { id: 'oscura', name: 'Oscura', desc: 'Fondo oscuro con acento cian (pantalla)' },
  { id: 'lateral', name: 'Lateral', desc: 'Tarjeta de cliente con borde de color' },
  { id: 'bloques', name: 'Bloques', desc: 'Tarjetas sobre fondo gris claro' },
];

export const FONT_OPTIONS = [
  { id: 'sans', name: 'Moderna (Jakarta)', family: '"Plus Jakarta Sans", system-ui, sans-serif' },
  { id: 'helvetica', name: 'Neutra (Helvetica)', family: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'serif', name: 'Clásica (Serif)', family: '"Source Serif 4", Georgia, serif' },
  { id: 'mono', name: 'Técnica (Mono)', family: '"JetBrains Mono", monospace' },
];

export const COLOR_PRESETS = [
  { hex: '#2563EB', name: 'Azul' },
  { hex: '#059669', name: 'Verde' },
  { hex: '#0284C7', name: 'Cian' },
  { hex: '#D97706', name: 'Ámbar' },
  { hex: '#7C3AED', name: 'Púrpura' },
  { hex: '#0F172A', name: 'Grafito' },
  { hex: '#DC2626', name: 'Rojo' },
];

interface LineaDoc {
  concepto: string;
  descripcion?: string;
  cantidad: number;
  unidad?: string;
  precioUnitario: number;
  ivaPorcentaje: number;
  total: number;
  materiales?: Array<{ nombre: string; cantidad: number; unidad: string }>;
}

interface DocumentRendererProps {
  tipo: 'p' | 'f';
  doc: Project | Invoice;
  companySettings: CompanySettings;
  client?: Client | null;
  onClose?: () => void;
  onSendWhatsApp?: (doc: Project | Invoice) => void;
  onSendEmail?: (doc: Project | Invoice) => void;
  abrirCorreo?: boolean; // abre directamente el panel de envío por correo
  enlaceAceptacion?: string; // presupuestos: enlace público para que el cliente acepte
  onCorreoEnviado?: (canal: 'gmail' | 'compartir' | 'programa de correo') => void;
  onAceptarFirmar?: (project: Project) => void;
  onCambiarPlantilla?: (plantillaId: string) => void;
}

export function plantillaDe(settings: CompanySettings, id?: string): DocumentTemplate | undefined {
  const lista = settings.plantillasPersonalizadas || [];
  return lista.find((t) => t.id === id) || lista.find((t) => t.id === settings.plantillaPorDefecto) || lista[0];
}

export const DocumentRenderer: React.FC<DocumentRendererProps> = ({ tipo, doc, companySettings, client, onClose, onSendWhatsApp, onSendEmail, onAceptarFirmar, onCambiarPlantilla, abrirCorreo = false, enlaceAceptacion, onCorreoEnviado }) => {
  void onSendEmail; // el correo se gestiona dentro (panel con PDF adjunto)
  const isInvoice = tipo === 'f';
  const invoice = isInvoice ? (doc as Invoice) : null;
  const project = !isInvoice ? (doc as Project) : null;

  const plantillaInicial = plantillaDe(companySettings, isInvoice ? invoice?.plantillaFactura : project?.plantillaPresupuesto);
  const [plantillaId, setPlantillaId] = useState<string>(plantillaInicial?.id || 'moderna');
  const plantilla = plantillaDe(companySettings, plantillaId) || plantillaInicial;
  const [currentTemplate, setCurrentTemplate] = useState<DocumentBaseTemplate>(plantilla?.base || 'moderna');
  const [accentColor, setAccentColor] = useState<string>(plantilla?.acento || '#2563EB');
  const [fontChoice, setFontChoice] = useState<string>(plantilla?.fuente || 'sans');
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [mostrarMateriales, setMostrarMateriales] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [panelCorreo, setPanelCorreo] = useState(abrirCorreo);
  const [correoPara, setCorreoPara] = useState('');
  const [correoAsunto, setCorreoAsunto] = useState('');
  const [correoCuerpo, setCorreoCuerpo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [avisoCorreo, setAvisoCorreo] = useState<{ texto: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!plantilla) return;
    setCurrentTemplate(plantilla.base || 'moderna');
    setAccentColor(plantilla.acento || '#2563EB');
    setFontChoice(plantilla.fuente || 'sans');
  }, [plantillaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Líneas y totales ----
  const { lineas, baseImponible, ivasPorTipo, ivaTotal, irpfTotal, totalDoc } = useMemo(() => {
    let lineas: LineaDoc[] = [];
    if (invoice) {
      lineas = (invoice.lineas || []).map((l) => ({ concepto: l.concepto, cantidad: l.cantidad, unidad: l.unidad || 'ud', precioUnitario: l.precioUnitario, ivaPorcentaje: invoice.inversionSujetoPasivo ? 0 : l.ivaPorcentaje, total: l.cantidad * l.precioUnitario * (1 + (invoice.inversionSujetoPasivo ? 0 : l.ivaPorcentaje) / 100), materiales: l.materialesVisibles }));
    } else if (project) {
      lineas = (project.partidas || []).map((p) => ({
        concepto: p.concepto,
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        unidad: p.unidad,
        precioUnitario: p.precioUnitario,
        ivaPorcentaje: p.ivaPorcentaje,
        total: p.cantidad * p.precioUnitario * (1 + p.ivaPorcentaje / 100),
        materiales: (p.materiales || []).filter((m) => m.visibleCliente).map((m) => ({ nombre: m.nombre, cantidad: Math.round(m.cantidad * p.cantidad * 100) / 100, unidad: m.unidad })),
      }));
      if (lineas.length === 0) lineas = [{ concepto: project.nombre, cantidad: 1, unidad: 'ud', precioUnitario: project.presupuestoAceptado, ivaPorcentaje: 21, total: project.presupuestoAceptado * 1.21 }];
    }
    const base = lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0);
    const ivasPorTipo = new Map<number, { base: number; cuota: number }>();
    lineas.forEach((l) => {
      const e = ivasPorTipo.get(l.ivaPorcentaje) || { base: 0, cuota: 0 };
      e.base += l.cantidad * l.precioUnitario;
      e.cuota += l.cantidad * l.precioUnitario * (l.ivaPorcentaje / 100);
      ivasPorTipo.set(l.ivaPorcentaje, e);
    });
    const ivaTotal = Array.from(ivasPorTipo.values()).reduce((a, e) => a + e.cuota, 0);
    const irpfTotal = invoice?.irpfTotal || 0;
    return { lineas, baseImponible: base, ivasPorTipo, ivaTotal, irpfTotal, totalDoc: base + ivaTotal - irpfTotal };
  }, [invoice, project]);

  // ---- Datos de cabecera ----
  const docNumero = invoice ? invoice.numero : project?.codigo || '';
  const docFecha = invoice ? invoice.fecha : project?.fechaInicio || '';
  const docValidez = invoice ? invoice.fechaVencimiento : project?.fechaInicio ? addDays(project.fechaInicio, companySettings.diasValidezPresupuesto || 30) : undefined;
  const docTitulo = isInvoice ? (invoice?.estado === 'Anulada' ? 'FACTURA ANULADA' : invoice?.rectificaA ? 'FACTURA RECTIFICATIVA' : 'FACTURA') : 'PRESUPUESTO';
  const clienteNombre = invoice ? invoice.clienteNombre : project?.clienteNombre || client?.nombre || 'Cliente';
  const clienteNif = invoice ? invoice.clienteNif : project?.firmaCliente?.dni || client?.nif || '';
  const clienteDireccion = invoice ? invoice.clienteDireccion : [project?.direccion || client?.direccion, client?.codigoPostal, client?.ciudad].filter(Boolean).join(', ');
  const notaFinal = invoice ? invoice.notaFinal || plantilla?.condicionesPago || companySettings.condicionesPagoDefecto : project?.notaFinal || plantilla?.notaFinal || companySettings.notaFinalPresupuestoDefecto;
  const firma = invoice ? invoice.firmaCliente : project?.firmaCliente;
  const esAutonomo = companySettings.tipoEntidad === 'autonomo';
  const etiquetaNif = esAutonomo ? 'NIF' : 'CIF';
  const activeFont = FONT_OPTIONS.find((f) => f.id === fontChoice)?.family || 'inherit';
  const isDark = currentTemplate === 'oscura';
  const urlQR = invoice?.verifactu?.codigoQR || '';
  const esRectificativa = !!invoice?.rectificaA;
  const empresa = companySettings.nombreComercial || companySettings.razonSocial || 'Tu empresa';
  const nombrePDF = nombreArchivoPDF(isInvoice ? 'factura' : 'presupuesto', docNumero, clienteNombre);

  // Textos por defecto del correo (editables en el panel)
  useEffect(() => {
    setCorreoPara(invoice ? client?.email || '' : project?.clienteEmail || client?.email || '');
    setCorreoAsunto(isInvoice ? `${esRectificativa ? 'Factura rectificativa' : 'Factura'} ${docNumero} · ${empresa}` : `Presupuesto ${docNumero} · ${empresa}`);
    const firmaCorreo = [companySettings.razonSocial, companySettings.telefono, companySettings.email].filter(Boolean).join(' · ');
    if (isInvoice) {
      setCorreoCuerpo(`Estimado/a ${clienteNombre},\n\nLe adjuntamos la ${esRectificativa ? 'factura rectificativa' : 'factura'} ${docNumero} de fecha ${formatDate(docFecha)} por importe de ${formatCurrency(totalDoc)} (IVA incluido).${invoice?.metodoPago ? `\nForma de pago: ${invoice.metodoPago}.` : ''}${companySettings.ibanPrincipal ? `\nIBAN: ${companySettings.ibanPrincipal}.` : ''}${docValidez ? `\nVencimiento: ${formatDate(docValidez)}.` : ''}\n\nGracias por su confianza.\n\n${firmaCorreo}`);
    } else {
      const aceptar = enlaceAceptacion
        ? `\n\nPuede revisarlo y aceptarlo desde su móvil indicando su nombre y DNI${client?.exigirFirma === false ? '' : ' y firmando en pantalla'}, y elegir el día que mejor le venga para la instalación:\n${enlaceAceptacion}`
        : '\n\nPara aceptarlo, respóndanos a este correo con su nombre completo y DNI, o firme el documento adjunto, y le confirmamos la fecha de instalación.';
      setCorreoCuerpo(`Estimado/a ${clienteNombre},\n\nLe adjuntamos el presupuesto ${docNumero}${project?.nombre ? ` (${project.nombre})` : ''} por importe de ${formatCurrency(totalDoc)} (IVA incluido)${docValidez ? `, válido hasta el ${formatDate(docValidez)}` : ''}.${aceptar}\n\nQuedamos a su disposición.\n\n${firmaCorreo}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docNumero, enlaceAceptacion]);

  const generarPDF = async (): Promise<Blob> => {
    const el = document.getElementById('documento-imprimible');
    if (!el) throw new Error('No se encuentra el documento en pantalla.');
    return generarPDFDesdeElemento(el);
  };
  const descargarPDF = async () => {
    setOcupado('pdf');
    setAvisoCorreo(null);
    try {
      descargarBlob(await generarPDF(), nombrePDF);
    } catch (e: any) {
      setAvisoCorreo({ texto: e?.message || 'No se pudo generar el PDF.', ok: false });
      setPanelCorreo(true);
    } finally {
      setOcupado(null);
    }
  };
  const compartir = async () => {
    setOcupado('compartir');
    setAvisoCorreo(null);
    try {
      if (await compartirPDF(await generarPDF(), nombrePDF, correoAsunto, correoCuerpo)) onCorreoEnviado?.('compartir');
    } catch (e: any) {
      setAvisoCorreo({ texto: e?.message || 'No se pudo compartir.', ok: false });
      setPanelCorreo(true);
    } finally {
      setOcupado(null);
    }
  };
  const enviarGmail = async () => {
    if (!correoValido(correoPara)) return setAvisoCorreo({ texto: 'Indica un correo de destino válido.', ok: false });
    setOcupado('gmail');
    setAvisoCorreo(null);
    try {
      const blob = await generarPDF();
      await enviarConGmail({ para: correoPara, asunto: correoAsunto, cuerpo: correoCuerpo, adjunto: { nombre: nombrePDF, blob } });
      setAvisoCorreo({ texto: `Correo enviado a ${correoPara} desde tu Gmail con el PDF adjunto. Lo tienes en tu carpeta Enviados.`, ok: true });
      onCorreoEnviado?.('gmail');
    } catch (e: any) {
      setAvisoCorreo({ texto: e?.code === 'auth/popup-closed-by-user' ? 'Se cerró la ventana de Google sin conceder el permiso.' : e?.message || 'No se pudo enviar.', ok: false });
    } finally {
      setOcupado(null);
    }
  };
  const abrirProgramaCorreo = async () => {
    setOcupado('mailto');
    try {
      descargarBlob(await generarPDF(), nombrePDF);
    } catch {
      // si falla el PDF se abre el correo igualmente
    } finally {
      setOcupado(null);
    }
    window.location.href = `mailto:${encodeURIComponent(correoPara)}?subject=${encodeURIComponent(correoAsunto)}&body=${encodeURIComponent(correoCuerpo)}`;
    setAvisoCorreo({ texto: 'Se ha descargado el PDF y se ha abierto tu programa de correo: adjunta el archivo descargado.', ok: true });
    onCorreoEnviado?.('programa de correo');
  };

  useEffect(() => {
    if (!isInvoice || !urlQR) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(urlQR, { errorCorrectionLevel: 'M', margin: 1, width: 180 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [isInvoice, urlQR]);

  const cambiarPlantilla = (id: string) => {
    setPlantillaId(id);
    onCambiarPlantilla?.(id);
  };

  // ---- Bloques comunes ----
  const cabeceraEmpresa = (claro = true) => (
    <div className="flex items-start gap-3">
      {companySettings.logoUrl && <img src={companySettings.logoUrl} alt="Logo" className="h-14 w-14 object-contain rounded-xl bg-white p-1 shrink-0" />}
      <div>
        <h2 className={`text-xl font-black tracking-tight ${claro ? '' : 'text-white'}`}>{companySettings.nombreComercial || companySettings.razonSocial || 'Tu empresa'}</h2>
        {companySettings.nombreComercial && companySettings.razonSocial && <p className="text-[11px] opacity-90">{companySettings.razonSocial}</p>}
        <p className="text-[11px] opacity-90 mt-0.5">{[companySettings.cif ? `${etiquetaNif}: ${companySettings.cif}` : '', [companySettings.direccion, companySettings.codigoPostal, companySettings.ciudad].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Completa tus datos en Configuración'}</p>
        <p className="text-[11px] opacity-80">{[companySettings.email, companySettings.telefono, companySettings.web].filter(Boolean).join(' · ')}</p>
        {!esAutonomo && companySettings.registroMercantil && <p className="text-[10px] opacity-70 mt-0.5">{companySettings.registroMercantil}</p>}
      </div>
    </div>
  );

  const tarjetaCliente = (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border text-xs ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200/80'}`} style={currentTemplate === 'lateral' ? { borderLeft: `4px solid ${accentColor}` } : {}}>
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">{isInvoice ? 'Facturar a' : 'Cliente'}</span>
        <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{clienteNombre}</p>
        <p className={`font-mono mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>NIF/CIF: {clienteNif || (isInvoice ? '—' : 'se recoge al aceptar')}</p>
        <p className={`mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{clienteDireccion}</p>
        {project && project.direccion && client?.direccion && project.direccion !== client.direccion && <p className="text-[11px] text-slate-500 mt-1">Lugar de la instalación: {project.direccion}</p>}
      </div>
      <div className="sm:text-right">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">{isInvoice ? 'Pago' : 'Referencia'}</span>
        {isInvoice ? (
          <>
            <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{invoice?.metodoPago}</p>
            {companySettings.ibanPrincipal && <p className={`text-[11px] font-mono mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>IBAN: {companySettings.ibanPrincipal}</p>}
            {companySettings.bancoNombre && <p className="text-slate-400 text-[10px]">{companySettings.bancoNombre}</p>}
            {invoice?.obraCodigo && <p className="text-[11px] text-slate-500 mt-1">Obra {invoice.obraCodigo}{invoice.obraNombre ? ` · ${invoice.obraNombre}` : ''}</p>}
          </>
        ) : (
          <>
            <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{project?.nombre}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Validez hasta {formatDate(docValidez)}</p>
          </>
        )}
      </div>
    </div>
  );

  const tablaLineas = (
    <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
      <table className="w-full text-left text-xs">
        <thead className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'bg-slate-900 text-cyan-400' : 'bg-slate-50 text-slate-500'}`}>
          <tr>
            <th className="p-3">Concepto</th>
            <th className="p-3 text-center">Cant.</th>
            <th className="p-3 text-right">Precio</th>
            <th className="p-3 text-center">IVA</th>
            <th className="p-3 text-right">Importe</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-200' : 'divide-slate-100 text-slate-800'}`}>
          {lineas.map((l, idx) => (
            <React.Fragment key={idx}>
              <tr>
                <td className="p-3 font-medium">
                  {l.concepto}
                  {l.descripcion && <p className="text-[11px] opacity-70 mt-0.5">{l.descripcion}</p>}
                  {mostrarMateriales && l.materiales && l.materiales.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] opacity-80">
                      {l.materiales.map((m, i) => (
                        <li key={i}>· {m.nombre} <span className="opacity-70">({m.cantidad} {m.unidad})</span></li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="p-3 text-center whitespace-nowrap">{l.cantidad} {l.unidad || 'ud'}</td>
                <td className="p-3 text-right font-mono whitespace-nowrap">{formatCurrency(l.precioUnitario)}</td>
                <td className="p-3 text-center font-mono">{l.ivaPorcentaje > 0 ? `${l.ivaPorcentaje} %` : '—'}</td>
                <td className="p-3 text-right font-mono font-bold whitespace-nowrap">{formatCurrency(l.cantidad * l.precioUnitario)}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  const bloqueTotales = (
    <div className="flex justify-end pt-2">
      <div className={`w-full sm:w-80 p-4 rounded-xl border space-y-1.5 text-xs ${isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
        <div className="flex justify-between"><span>Base imponible</span><span className="font-mono font-bold">{formatCurrency(baseImponible)}</span></div>
        {Array.from(ivasPorTipo.entries()).map(([tipoIva, e]) => (
          <div key={tipoIva} className="flex justify-between"><span>{tipoIva > 0 ? `IVA ${tipoIva} %` : invoice?.inversionSujetoPasivo ? 'IVA (inversión del sujeto pasivo)' : 'IVA 0 %'}{ivasPorTipo.size > 1 ? ` sobre ${formatCurrency(e.base)}` : ''}</span><span className="font-mono font-bold">{formatCurrency(e.cuota)}</span></div>
        ))}
        {irpfTotal > 0 && <div className="flex justify-between"><span>Retención IRPF {invoice?.irpfPorcentaje} %</span><span className="font-mono font-bold">−{formatCurrency(irpfTotal)}</span></div>}
        <div className={`flex justify-between text-sm font-black pt-2 border-t ${isDark ? 'border-slate-800 text-cyan-400' : 'border-slate-200'}`} style={!isDark ? { color: accentColor } : {}}>
          <span>TOTAL</span><span className="font-mono">{formatCurrency(totalDoc)}</span>
        </div>
      </div>
    </div>
  );

  const avisoISP = invoice?.inversionSujetoPasivo ? (
    <div className={`p-3.5 rounded-xl border text-[11px] ${isDark ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
      <strong>Inversión del sujeto pasivo.</strong> Operación con inversión del sujeto pasivo conforme al artículo 84.Uno.2º.f) de la Ley 37/1992 del IVA. El destinatario es el sujeto pasivo del impuesto.
    </div>
  ) : null;

  const bloqueNota = notaFinal ? (
    <div className={`p-4 rounded-2xl border text-[11px] leading-relaxed whitespace-pre-line ${isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">{isInvoice ? 'Condiciones' : 'Condiciones y observaciones'}</span>
      {notaFinal}
    </div>
  ) : null;

  const bloqueFirma = (
    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">{isInvoice ? 'Aceptación del presupuesto por el cliente' : 'Aceptación del cliente'}</span>
      {firma ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-0.5 text-xs">
            <p className="font-bold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-600" /> {isInvoice ? `Presupuesto ${project?.codigo || invoice?.obraCodigo || ''} aceptado por el cliente` : 'Presupuesto aceptado'}</p>
            <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>Aceptado por <strong>{firma.firmadoPor}</strong> · NIF {firma.dni}</p>
            <p className="font-mono text-slate-500 text-[11px]">Fecha y hora: {formatDate(firma.fechaFirma)}{firma.metodo === 'portal' ? ' · desde el dispositivo del cliente' : ''}</p>
            {firma.codigoAceptacion && <p className="font-mono text-slate-400 text-[10px] break-all">Código de aceptación: {firma.codigoAceptacion.substring(0, 40)}{firma.codigoAceptacion.length > 40 ? '…' : ''}</p>}
          </div>
          {firma.trazoFirma && (
            <div className="p-2 bg-white rounded-xl border border-slate-200 shrink-0">
              <img src={firma.trazoFirma} alt="Firma del cliente" className="max-h-16 max-w-[180px] object-contain" />
              <span className="block text-[9px] text-center text-slate-400 font-mono">Firma del cliente</span>
            </div>
          )}
        </div>
      ) : isInvoice ? (
        <p className="text-[11px] text-slate-500">Esta factura no procede de un presupuesto aceptado en la app.</p>
      ) : (
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 text-slate-500 text-xs py-1">
          <div className="space-y-0.5">
            <p className="font-medium text-slate-700">Pendiente de aceptación.</p>
            <p className="text-[11px] text-slate-400">El cliente acepta desde el enlace enviado indicando nombre y NIF{client?.exigirFirma === false ? '' : ', y firmando en pantalla'}.</p>
          </div>
          <div className="w-48 h-12 border-b-2 border-dashed border-slate-300 flex items-end justify-center pb-1"><span className="text-[10px] text-slate-400 font-mono">Nombre, NIF y firma</span></div>
        </div>
      )}
    </div>
  );

  // Zona fiscal de la factura: no depende de la plantilla. Solo en facturas.
  const pieVerifactu = isInvoice ? (
    <div className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2 ${isDark ? 'border-slate-700 bg-slate-900/60 text-slate-300' : 'border-slate-300 bg-white text-slate-700'}`} data-zona-fiscal>
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-white rounded-xl border border-slate-200 shrink-0">
          {qrDataUrl ? <img src={qrDataUrl} alt="Código QR de la factura" className="w-24 h-24" /> : <div className="w-24 h-24 flex items-center justify-center text-[10px] text-slate-400 text-center">{invoice?.verifactu?.registrada ? 'Generando QR…' : 'Sin registro'}</div>}
        </div>
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5 font-black text-sm">
            <ShieldCheck size={15} className="text-emerald-600" />
            <span>VERI*FACTU</span>
          </div>
          <p className="font-bold">Factura verificable en la sede electrónica de la AEAT</p>
          {urlQR && <p className="text-[9px] font-mono break-all opacity-70">{urlQR}</p>}
          {invoice?.verifactu?.huellaHash && <p className="text-[9px] font-mono opacity-60">Huella: {invoice.verifactu.huellaHash.substring(0, 24)}…</p>}
        </div>
      </div>
      <div className="text-right text-[10px] opacity-70 shrink-0">
        <p>{invoice?.numero}</p>
        <p>{formatDate(invoice?.fecha)}</p>
        {plantilla?.pieDePagina && <p className="mt-1">{plantilla.pieDePagina}</p>}
      </div>
    </div>
  ) : plantilla?.pieDePagina ? (
    <p className="text-[10px] text-slate-400 text-center pt-2">{plantilla.pieDePagina}</p>
  ) : null;

  const bloqueRectificativa = invoice?.rectificaA ? (
    <div className={`p-3.5 rounded-xl border text-[11px] ${isDark ? 'bg-purple-950/40 border-purple-500/40 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'}`}>
      <strong>Factura rectificativa {invoice.verifactu?.tipoFactura} {invoice.verifactu?.tipoRectificativa === 'S' ? 'por sustitución' : 'por diferencias'}.</strong> Rectifica a la factura <strong>{invoice.rectificaA.numero}</strong> de fecha {formatDate(invoice.rectificaA.fecha)}{invoice.verifactu?.importeRectificacion ? ` (base ${formatCurrency(invoice.verifactu.importeRectificacion.baseRectificada)}, cuota de IVA ${formatCurrency(invoice.verifactu.importeRectificacion.cuotaRectificada)})` : ''}.{invoice.motivoRectificacion ? ` Motivo: ${invoice.motivoRectificacion}.` : ''}
    </div>
  ) : invoice?.rectificadaPor ? (
    <div className={`p-3.5 rounded-xl border text-[11px] ${isDark ? 'bg-slate-900/60 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
      <strong>Factura sustituida</strong> por la rectificativa <strong>{invoice.rectificadaPor.numero}</strong>. Conserve ambas.
    </div>
  ) : null;

  const cuerpo = (
    <>
      {bloqueRectificativa}
      {tarjetaCliente}
      {tablaLineas}
      {bloqueTotales}
      {avisoISP}
      {bloqueNota}
      {bloqueFirma}
      {pieVerifactu}
    </>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="bg-slate-100 rounded-3xl max-w-5xl w-full max-h-[96vh] flex flex-col shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:rounded-none print:bg-white">
        {/* Barra de controles */}
        <div className="p-3 sm:p-4 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-blue-600 rounded-xl text-white"><FileText size={18} /></span>
            <div>
              <h3 className="font-black text-sm text-white flex items-center gap-2">{docTitulo} · <span className="font-mono text-cyan-400">{docNumero}</span></h3>
              <p className="text-[11px] text-slate-400">{clienteNombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <select value={plantillaId} onChange={(e) => cambiarPlantilla(e.target.value)} className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 rounded-xl px-2 py-2 cursor-pointer" title="Plantilla">
              {(companySettings.plantillasPersonalizadas || []).map((t) => <option key={t.id} value={t.id} className="bg-slate-900">{t.nombre}</option>)}
            </select>
            <button onClick={() => setShowConfigDrawer(!showConfigDrawer)} className={`p-2 rounded-xl text-xs font-bold border cursor-pointer flex items-center gap-1.5 ${showConfigDrawer ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'}`} title="Ajustes de diseño"><Sliders size={14} /><span className="hidden sm:inline">Diseño</span></button>
            {onSendWhatsApp && <button onClick={() => onSendWhatsApp(doc)} className="p-2 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"><Phone size={14} /><span className="hidden sm:inline">WhatsApp</span></button>}
            <button onClick={() => { setPanelCorreo(!panelCorreo); setShowConfigDrawer(false); }} className={`p-2 sm:px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer ${panelCorreo ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`} title="Enviar por correo con el PDF adjunto"><Mail size={14} /><span className="hidden sm:inline">Correo</span></button>
            <button onClick={descargarPDF} disabled={!!ocupado} className="p-2 sm:px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50" title="Descargar como archivo PDF"><Download size={14} className={ocupado === 'pdf' ? 'animate-bounce' : ''} /><span className="hidden sm:inline">{ocupado === 'pdf' ? 'Generando…' : 'PDF'}</span></button>
            {puedeCompartirArchivos() && <button onClick={compartir} disabled={!!ocupado} className="p-2 sm:px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50" title="Compartir el PDF (WhatsApp, correo…)"><Share2 size={14} /><span className="hidden sm:inline">Compartir</span></button>}
            {project && !firma && (project.estado === 'Enviado' || project.estado === 'Borrador') && onAceptarFirmar && (
              <button onClick={() => onAceptarFirmar(project)} className="p-2 sm:px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer"><PenTool size={14} /><span>Aceptar aquí</span></button>
            )}
            <button onClick={() => window.print()} className="p-2 sm:px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer" title="Imprimir o guardar como PDF"><Printer size={14} /><span className="hidden sm:inline">Imprimir / PDF</span></button>
            {onClose && <button onClick={onClose} title="Cerrar" aria-label="Cerrar" className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"><X size={18} /></button>}
          </div>
        </div>

        {showConfigDrawer && (
          <div className="bg-slate-900 border-b border-slate-800 p-4 text-xs text-slate-300 grid grid-cols-1 sm:grid-cols-4 gap-4 print:hidden">
            <div>
              <label className="block font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Palette size={13} className="text-blue-400" /> Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button key={c.hex} onClick={() => setAccentColor(c.hex)} className="w-6 h-6 rounded-full border-2 cursor-pointer flex items-center justify-center" style={{ backgroundColor: c.hex, borderColor: accentColor === c.hex ? '#fff' : 'transparent' }} title={c.name}>{accentColor === c.hex && <Check size={12} className="text-white" />}</button>
                ))}
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0" />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Type size={13} className="text-blue-400" /> Tipografía</label>
              <select value={fontChoice} onChange={(e) => setFontChoice(e.target.value)} className="w-full bg-slate-800 text-white rounded-xl px-3 py-1.5 border border-slate-700 cursor-pointer">
                {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-2">Maquetación</label>
              <select value={currentTemplate} onChange={(e) => setCurrentTemplate(e.target.value as DocumentBaseTemplate)} className="w-full bg-slate-800 text-white rounded-xl px-3 py-1.5 border border-slate-700 cursor-pointer">
                {TEMPLATE_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.desc}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-400 mb-2">Materiales</label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                <input type="checkbox" checked={mostrarMateriales} onChange={(e) => setMostrarMateriales(e.target.checked)} className="rounded text-blue-600" />
                <span>Mostrar los materiales marcados como visibles (nunca sus costes)</span>
              </label>
            </div>
          </div>
        )}

        {panelCorreo && (
          <div className="bg-slate-900 border-b border-slate-800 p-4 text-xs text-slate-300 space-y-3 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block font-bold text-slate-400 mb-1">Para</label><input value={correoPara} onChange={(e) => setCorreoPara(e.target.value)} placeholder="cliente@correo.es" className="w-full bg-slate-800 text-white rounded-xl px-3 py-2 border border-slate-700" /></div>
              <div><label className="block font-bold text-slate-400 mb-1">Asunto</label><input value={correoAsunto} onChange={(e) => setCorreoAsunto(e.target.value)} className="w-full bg-slate-800 text-white rounded-xl px-3 py-2 border border-slate-700" /></div>
            </div>
            <div><label className="block font-bold text-slate-400 mb-1">Mensaje</label><textarea value={correoCuerpo} onChange={(e) => setCorreoCuerpo(e.target.value)} rows={5} className="w-full bg-slate-800 text-white rounded-xl px-3 py-2 border border-slate-700 font-sans" /></div>
            <div className="flex flex-wrap items-center gap-2">
              {firebaseDisponible && <button onClick={enviarGmail} disabled={!!ocupado} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"><Send size={14} className={ocupado === 'gmail' ? 'animate-pulse' : ''} /> {ocupado === 'gmail' ? 'Generando el PDF y enviando…' : 'Enviar desde mi Gmail con el PDF adjunto'}</button>}
              {puedeCompartirArchivos() && <button onClick={compartir} disabled={!!ocupado} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"><Share2 size={14} /> Compartir el PDF (WhatsApp, Gmail…)</button>}
              <button onClick={abrirProgramaCorreo} disabled={!!ocupado} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"><Mail size={14} /> Descargar el PDF y abrir mi programa de correo</button>
            </div>
            {avisoCorreo && <div className={`p-3 rounded-xl border flex items-start gap-2 ${avisoCorreo.ok ? 'bg-emerald-900/40 border-emerald-700 text-emerald-200' : 'bg-rose-900/40 border-rose-700 text-rose-200'}`}>{avisoCorreo.ok ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}<span>{avisoCorreo.texto}</span></div>}
            <p className="text-[10px] text-slate-500">El envío desde Gmail usa tu propia cuenta de Google (pide permiso la primera vez; dura una hora) y el correo queda en tus Enviados. El PDF se genera con la plantilla y el color que ves aquí.</p>
          </div>
        )}

        {/* Documento */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/80 print:p-0 print:bg-white print:overflow-visible">
          <div id="documento-imprimible" className={`w-full max-w-[800px] shadow-2xl print:shadow-none print:max-w-none ${isDark ? 'bg-slate-950 text-slate-100 border border-slate-800' : 'bg-white text-slate-900'}`} style={{ fontFamily: activeFont, borderRadius: currentTemplate === 'compacta' ? '4px' : '16px' }}>
            {currentTemplate === 'moderna' && (
              <div className="space-y-6">
                <div className="p-8 text-white flex flex-col sm:flex-row justify-between items-start gap-4 rounded-t-2xl" style={{ backgroundColor: accentColor }}>
                  {cabeceraEmpresa(false)}
                  <div className="text-right shrink-0">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-mono font-bold">{docNumero}</span>
                    <p className="text-sm font-black mt-2">{docTitulo}</p>
                    <p className="text-xs opacity-90">Fecha: <strong>{formatDate(docFecha)}</strong></p>
                    {docValidez && <p className="text-xs opacity-80">{isInvoice ? 'Vence' : 'Válido hasta'}: {formatDate(docValidez)}</p>}
                  </div>
                </div>
                <div className="px-8 space-y-5 pb-8">{cuerpo}</div>
              </div>
            )}

            {currentTemplate === 'clasica' && (
              <div className="p-8 sm:p-10 space-y-5 text-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 pb-6 gap-4" style={{ borderColor: accentColor }}>
                  {cabeceraEmpresa()}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">{docNumero}</span>
                    <p className="text-slate-700 mt-2 font-bold">{docTitulo}</p>
                    <p className="text-slate-500">Fecha: {formatDate(docFecha)}</p>
                    {docValidez && <p className="text-slate-500">{isInvoice ? 'Vencimiento' : 'Validez'}: {formatDate(docValidez)}</p>}
                  </div>
                </div>
                {cuerpo}
              </div>
            )}

            {currentTemplate === 'tecnica' && (
              <div className="p-8 sm:p-10 space-y-5 text-xs" style={{ borderLeft: `8px solid ${accentColor}` }}>
                <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-300 pb-4 gap-4">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 block">{isInvoice ? 'Factura' : 'Presupuesto técnico'} · Instalación eléctrica</span>
                    {cabeceraEmpresa()}
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <p className="text-lg font-black" style={{ color: accentColor }}>{docNumero}</p>
                    <p className="text-[11px] text-slate-600">{formatDate(docFecha)}</p>
                    {docValidez && <p className="text-[11px] text-slate-500">{isInvoice ? 'Vence' : 'Válido hasta'} {formatDate(docValidez)}</p>}
                  </div>
                </div>
                {cuerpo}
              </div>
            )}

            {currentTemplate === 'oscura' && (
              <div className="p-8 sm:p-10 space-y-5 text-xs bg-slate-950 text-slate-100 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-800 pb-6 gap-4">
                  {cabeceraEmpresa(false)}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-mono font-bold text-cyan-400 px-3 py-1 bg-slate-900 border border-slate-700 rounded-full">{docNumero}</span>
                    <p className="text-slate-300 mt-2 font-bold">{docTitulo}</p>
                    <p className="text-slate-400 font-mono">{formatDate(docFecha)}</p>
                  </div>
                </div>
                {cuerpo}
              </div>
            )}

            {['compacta', 'geometrica', 'editorial', 'bloques', 'cotizacion', 'lateral'].includes(currentTemplate) && (
              <div className={`p-6 sm:p-8 space-y-4 ${currentTemplate === 'compacta' ? 'text-[11px]' : 'text-xs'} ${currentTemplate === 'bloques' ? 'bg-slate-50 rounded-2xl' : ''}`}>
                <div className={`flex flex-col sm:flex-row justify-between items-start pb-4 border-b gap-4 ${currentTemplate === 'editorial' ? 'border-slate-400' : 'border-slate-200'}`}>
                  <div className={currentTemplate === 'editorial' ? 'font-serif' : ''}>{cabeceraEmpresa()}</div>
                  <div className="text-right shrink-0">
                    <span className="px-3 py-1 rounded-md text-white font-mono font-bold text-xs" style={{ backgroundColor: accentColor }}>{docNumero}</span>
                    <p className="text-slate-600 font-bold mt-1.5">{docTitulo}</p>
                    <p className="text-slate-400">{formatDate(docFecha)}</p>
                    {docValidez && <p className="text-slate-400">{isInvoice ? 'Vence' : 'Válido hasta'} {formatDate(docValidez)}</p>}
                  </div>
                </div>
                {cuerpo}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
