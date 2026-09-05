import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileCheck2, Plus, Search, Calendar, FileText, CheckCircle2, Trash2, Clock, User, MapPin, X, Upload, HardHat, XCircle, Sparkles, Check, ShieldCheck, Send, Phone, Mail, Eye, CalendarDays, Calculator, Lock, PenTool, PackagePlus, Copy, Link as LinkIcon, AlertCircle, EyeOff, Edit3, Image as ImageIcon, Info } from 'lucide-react';
import { Project, Client, ProjectDocument, ProjectPhoto, ProjectLog, PresupuestoPartida, CatalogCategory, CatalogItem, MaterialCostComponent, CalendarInstallation, CompanySettings, Kit, FirmaCliente, HuecoPropuesto, Invoice } from '../types';
import { formatCurrency, formatDate, uid, telefonoWhatsApp, redondear2 } from '../utils/formatters';
import { PeriodFilter } from './PeriodFilter';
import { PeriodoFiltro, periodoActual, coincidePeriodo, aniosDisponibles, hoyISO, addDays, etiquetaPeriodo, fechaES } from '../utils/dates';
import { DocumentRenderer } from './DocumentRenderer';
import { ClientAcceptancePortal } from './ClientAcceptancePortal';
import { huecosLibres, textoHueco } from '../lib/agenda';
import { construirPropuesta, publicarPropuesta, generarToken, enlacePropuesta } from '../lib/propuestas';
import { leerCodigoAceptacion } from '../utils/acceptanceCrypto';
import { firebaseDisponible } from '../lib/firebase';

interface Props {
  projects: Project[];
  clients: Client[];
  selectedProjectId: string | null;
  companySettings: CompanySettings;
  catalogCategories: CatalogCategory[];
  catalogItems: CatalogItem[];
  kits: Kit[];
  calendarEvents: CalendarInstallation[];
  invoices: Invoice[];
  firebaseUid: string | null;
  siguienteCodigo: string;
  modo: 'presupuestos' | 'obras';
  abrirCitaDe?: string | null; // App pide abrir "Proponer franjas" para este proyecto (aviso de aceptación)
  onCitaAbierta?: () => void;
  onSelectProject: (id: string | null) => void;
  onCreateProject: (p: Omit<Project, 'id' | 'fotos' | 'documentos' | 'bitacora' | 'desgloseGastos'>) => Project;
  onUpdateProject: (id: string, campos: Partial<Project>) => void;
  onUpdateProjectStatus: (id: string, estado: Project['estado'], motivo?: string) => void;
  onUpdateClient: (id: string, campos: Partial<Client>) => void;
  onAcceptBudgetAndConvertToObra: (id: string, firma: FirmaCliente, hueco?: HuecoPropuesto) => void;
  onConfirmarCita: (id: string, hueco: HuecoPropuesto, tecnicos: string[], notas?: string) => CalendarInstallation | null;
  onDeleteProject: (id: string) => void;
  onAddCalendarEvent: (e: Omit<CalendarInstallation, 'id'>) => CalendarInstallation;
  onUpdateCalendarEvent: (id: string, campos: Partial<CalendarInstallation>) => void;
  onAddLog: (id: string, texto: string, tipo: ProjectLog['tipo']) => void;
  onAddDocument: (id: string, doc: Omit<ProjectDocument, 'id'>) => void;
  onAddPhoto: (id: string, photo: Omit<ProjectPhoto, 'id'>) => void;
  onOpenNewInvoiceForProject: (p: Project) => void;
  onOpenNewExpenseForProject: (p: Project) => void;
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

const LIMITE_ADJUNTO = 400 * 1024;
const ES_OBRA = (e: Project['estado']) => ['Aceptado', 'En ejecución', 'En legalización CIE', 'Finalizada', 'Facturada', 'Pausada'].includes(e);

// Ciclo de vida en colores: gris borrador · azul enviado · ámbar en ejecución · índigo terminada
// lista para facturar · verde facturada (ciclo cerrado) · rojo apagado rechazado.
const COLOR_ESTADO: Record<string, { badge: string; barra: string }> = {
  Borrador: { badge: 'bg-slate-100 text-slate-700 border-slate-200', barra: 'border-l-slate-300' },
  Enviado: { badge: 'bg-blue-50 text-blue-700 border-blue-200', barra: 'border-l-blue-500' },
  Aceptado: { badge: 'bg-amber-50 text-amber-800 border-amber-200', barra: 'border-l-amber-500' },
  'En ejecución': { badge: 'bg-amber-100 text-amber-900 border-amber-300', barra: 'border-l-amber-500' },
  'En legalización CIE': { badge: 'bg-amber-50 text-amber-800 border-amber-200', barra: 'border-l-amber-400' },
  Finalizada: { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', barra: 'border-l-indigo-500' },
  Facturada: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', barra: 'border-l-emerald-500' },
  Rechazado: { badge: 'bg-rose-50 text-rose-600 border-rose-200', barra: 'border-l-rose-300' },
  Pausada: { badge: 'bg-slate-100 text-slate-600 border-slate-300', barra: 'border-l-slate-400' },
};

const recalcPartida = (p: PresupuestoPartida): PresupuestoPartida => {
  const mats = (p.materiales || []).map((m) => ({ ...m, totalCoste: redondear2(m.cantidad * m.costeUnitario) }));
  const coste = redondear2(mats.reduce((a, m) => a + m.totalCoste, 0));
  return { ...p, materiales: mats, costeInternoTotal: coste, margenPorcentaje: coste > 0 ? redondear2(((p.precioUnitario - coste) / coste) * 100) : p.margenPorcentaje, total: redondear2(p.cantidad * p.precioUnitario * (1 + p.ivaPorcentaje / 100)) };
};

export const ProjectsView: React.FC<Props> = (props) => {
  const { projects, clients, selectedProjectId, companySettings, catalogCategories, catalogItems, kits, calendarEvents, invoices, firebaseUid, siguienteCodigo, modo, abrirCitaDe, onCitaAbierta, onSelectProject, onCreateProject, onUpdateProject, onUpdateProjectStatus, onAcceptBudgetAndConvertToObra, onConfirmarCita, onDeleteProject, onAddLog, onAddDocument, onAddPhoto, onOpenNewInvoiceForProject, onOpenNewExpenseForProject, onAviso } = props;

  const [periodo, setPeriodo] = useState<PeriodoFiltro>(periodoActual());
  const [busqueda, setBusqueda] = useState('');
  const esPresupuestos = modo === 'presupuestos';
  type SubFiltro = 'activos' | 'aceptados' | 'rechazados' | 'todos' | 'curso' | 'facturadas' | 'todas';
  const [sub, setSub] = useState<SubFiltro>(esPresupuestos ? 'activos' : 'curso');
  useEffect(() => { setSub(esPresupuestos ? 'activos' : 'curso'); }, [esPresupuestos]);
  const [tab, setTab] = useState<'resumen' | 'partidas' | 'documentos' | 'fotos' | 'bitacora'>('resumen');
  const [showCreate, setShowCreate] = useState(false);
  const [editandoPartidas, setEditandoPartidas] = useState(false);
  const [preview, setPreview] = useState<Project | null>(null);
  const [previewCorreo, setPreviewCorreo] = useState(false);
  const [enviar, setEnviar] = useState<Project | null>(null);
  const [portal, setPortal] = useState<Project | null>(null);
  const [rechazar, setRechazar] = useState<Project | null>(null);
  const [motivo, setMotivo] = useState('');
  const [citaModal, setCitaModal] = useState<Project | null>(null);
  const [cerrar, setCerrar] = useState<Project | null>(null);
  const [codigoModal, setCodigoModal] = useState<Project | null>(null);
  const [codigoInput, setCodigoInput] = useState('');
  const [dniInput, setDniInput] = useState('');
  const [nombreInput, setNombreInput] = useState('');
  const [aBorrar, setABorrar] = useState<Project | null>(null);
  const [logTexto, setLogTexto] = useState('');
  const [logTipo, setLogTipo] = useState<ProjectLog['tipo']>('avance');
  const [showKits, setShowKits] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  // Formulario de presupuesto (crear / editar partidas)
  const [fNombre, setFNombre] = useState('');
  const [fClienteId, setFClienteId] = useState('');
  const [fDireccion, setFDireccion] = useState('');
  const [fPlantilla, setFPlantilla] = useState(companySettings.plantillaPorDefecto);
  const [fNota, setFNota] = useState(companySettings.notaFinalPresupuestoDefecto);
  const [fFechaFin, setFFechaFin] = useState(addDays(hoyISO(), 30));
  const [partidas, setPartidas] = useState<PresupuestoPartida[]>([]);
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Cita
  const [citaHuecos, setCitaHuecos] = useState<HuecoPropuesto[]>([]);
  const [citaTecnicos, setCitaTecnicos] = useState<string[]>([]);
  const [citaNotas, setCitaNotas] = useState('');
  const [citaModo, setCitaModo] = useState<'proponer' | 'confirmar'>('proponer');
  const [huecoConfirmar, setHuecoConfirmar] = useState<HuecoPropuesto | null>(null);

  // Envío
  const [publicando, setPublicando] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [huecosEnvio, setHuecosEnvio] = useState<HuecoPropuesto[]>([]);
  const [copiado, setCopiado] = useState(false);

  const [cierreChecks, setCierreChecks] = useState({ pruebas: true, cie: false, fotos: true, factura: true });

  const anios = aniosDisponibles(projects.map((p) => p.fechaInicio));
  const tecnicos = companySettings.tecnicos?.length ? companySettings.tecnicos : [companySettings.nombreUsuario || 'Yo'];
  const selected = projects.find((p) => p.id === selectedProjectId) || null;
  const clienteDe = (p: Project) => clients.find((c) => c.id === p.clienteId);

  const filtrados = useMemo(() => projects.filter((p) => {
    if (!coincidePeriodo(p.fechaInicio, periodo)) return false;
    const obra = ES_OBRA(p.estado);
    if (esPresupuestos) {
      // Vista por defecto: solo lo que sigue vivo como presupuesto. Lo aceptado ya está en Obras
      // y lo rechazado tiene su propio filtro, así que desaparecen de la vista inicial.
      if (sub === 'activos' && (obra || p.estado === 'Rechazado')) return false;
      if (sub === 'aceptados' && !obra) return false;
      if (sub === 'rechazados' && p.estado !== 'Rechazado') return false;
    } else {
      if (!obra) return false;
      if (sub === 'curso' && p.estado === 'Facturada') return false;
      if (sub === 'facturadas' && p.estado !== 'Facturada') return false;
    }
    const q = busqueda.toLowerCase();
    return !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || (p.obraCodigo || '').toLowerCase().includes(q) || p.clienteNombre.toLowerCase().includes(q) || p.direccion.toLowerCase().includes(q);
  }).sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)), [projects, periodo, sub, busqueda, esPresupuestos]);

  // Recuentos de cada filtro, sobre el periodo elegido
  const cuenta = useMemo(() => {
    const enPeriodo = projects.filter((p) => coincidePeriodo(p.fechaInicio, periodo));
    return {
      activos: enPeriodo.filter((p) => !ES_OBRA(p.estado) && p.estado !== 'Rechazado').length,
      aceptados: enPeriodo.filter((p) => ES_OBRA(p.estado)).length,
      rechazados: enPeriodo.filter((p) => p.estado === 'Rechazado').length,
      todos: enPeriodo.length,
      curso: enPeriodo.filter((p) => ES_OBRA(p.estado) && p.estado !== 'Facturada').length,
      facturadas: enPeriodo.filter((p) => p.estado === 'Facturada').length,
      todasObras: enPeriodo.filter((p) => ES_OBRA(p.estado)).length,
    };
  }, [projects, periodo]);

  // ---- Totales del formulario ----
  const tot = useMemo(() => {
    const base = partidas.reduce((a, p) => a + p.cantidad * p.precioUnitario, 0);
    const coste = partidas.reduce((a, p) => a + (p.costeInternoTotal || 0) * p.cantidad, 0);
    const iva = partidas.reduce((a, p) => a + p.cantidad * p.precioUnitario * (p.ivaPorcentaje / 100), 0);
    return { base: redondear2(base), coste: redondear2(coste), iva: redondear2(iva), beneficio: redondear2(base - coste), margen: base > 0 ? ((base - coste) / base) * 100 : 0 };
  }, [partidas]);

  const abrirCrear = () => {
    setFNombre('');
    setFClienteId(clients[0]?.id || '');
    setFDireccion(clients[0]?.direccion || '');
    setFPlantilla(companySettings.plantillaPorDefecto);
    setFNota(companySettings.notaFinalPresupuestoDefecto);
    setFFechaFin(addDays(hoyISO(), 30));
    setPartidas([]);
    setExpandidas({});
    setErrorForm(null);
    setEditandoPartidas(false);
    setShowCreate(true);
  };
  const abrirEditarPartidas = (p: Project) => {
    setFNombre(p.nombre);
    setFClienteId(p.clienteId);
    setFDireccion(p.direccion);
    setFPlantilla(p.plantillaPresupuesto || companySettings.plantillaPorDefecto);
    setFNota(p.notaFinal || companySettings.notaFinalPresupuestoDefecto);
    setFFechaFin(p.fechaFinPrevista);
    setPartidas((p.partidas || []).map(recalcPartida));
    setEditandoPartidas(true);
    setErrorForm(null);
    setShowCreate(true);
  };

  const addCatalogo = (item: CatalogItem) => {
    const cat = catalogCategories.find((c) => c.id === item.categoriaId);
    setPartidas((prev) => [...prev, recalcPartida({ id: uid('par'), categoria: cat?.nombre || item.categoriaNombre, concepto: item.concepto, descripcion: item.descripcionDetallada, cantidad: 1, unidad: item.unidad, precioUnitario: item.precioUnitario, ivaPorcentaje: item.ivaPorcentaje || 21, total: 0, materiales: (item.materiales || []).map((m) => ({ ...m, id: uid('m') })) })]);
  };
  const addKit = (kit: Kit) => {
    setPartidas((prev) => [...prev, recalcPartida({ id: uid('par'), categoria: kit.categoria, concepto: kit.nombre, descripcion: kit.descripcion, cantidad: 1, unidad: 'ud', precioUnitario: kit.precioVentaTotal, ivaPorcentaje: 21, total: 0, kitId: kit.id, materiales: kit.partidas.map((k) => ({ id: uid('m'), nombre: k.concepto, cantidad: k.cantidad, unidad: k.unidad, costeUnitario: k.precioCoste, totalCoste: redondear2(k.cantidad * k.precioCoste), proveedor: k.proveedor, visibleCliente: false })) })]);
    setShowKits(false);
  };
  const addLibre = () => setPartidas((prev) => [...prev, recalcPartida({ id: uid('par'), categoria: 'Otros', concepto: '', cantidad: 1, unidad: 'ud', precioUnitario: 0, ivaPorcentaje: 21, total: 0, materiales: [] })]);
  const updPartida = (id: string, campos: Partial<PresupuestoPartida>) => setPartidas((prev) => prev.map((p) => (p.id === id ? recalcPartida({ ...p, ...campos }) : p)));
  const updMargen = (id: string, margen: number) => setPartidas((prev) => prev.map((p) => (p.id === id ? recalcPartida({ ...p, precioUnitario: redondear2((p.costeInternoTotal || 0) * (1 + margen / 100)), margenPorcentaje: margen }) : p)));
  const updMat = (pid: string, mid: string, campos: Partial<MaterialCostComponent>) => setPartidas((prev) => prev.map((p) => (p.id === pid ? recalcPartida({ ...p, materiales: (p.materiales || []).map((m) => (m.id === mid ? { ...m, ...campos } : m)) }) : p)));
  const addMat = (pid: string) => setPartidas((prev) => prev.map((p) => (p.id === pid ? recalcPartida({ ...p, materiales: [...(p.materiales || []), { id: uid('m'), nombre: '', cantidad: 1, unidad: 'ud', costeUnitario: 0, totalCoste: 0, visibleCliente: false }] }) : p)));
  const delMat = (pid: string, mid: string) => setPartidas((prev) => prev.map((p) => (p.id === pid ? recalcPartida({ ...p, materiales: (p.materiales || []).filter((m) => m.id !== mid) }) : p)));

  const guardarPresupuesto = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    const client = clients.find((c) => c.id === fClienteId);
    if (!client) return setErrorForm('Elige un cliente (o créalo en la pestaña Clientes).');
    if (!fNombre.trim()) return setErrorForm('Ponle un título al presupuesto.');
    if (partidas.length === 0 || partidas.some((p) => !p.concepto.trim())) return setErrorForm('Añade al menos una partida y ponles concepto.');
    const limpias = partidas.map(recalcPartida);
    if (editandoPartidas && selected) {
      onUpdateProject(selected.id, { nombre: fNombre.trim(), direccion: fDireccion || client.direccion, plantillaPresupuesto: fPlantilla, notaFinal: fNota, fechaFinPrevista: fFechaFin, partidas: limpias, presupuestoAceptado: tot.base });
      onAddLog(selected.id, 'Partidas del presupuesto modificadas.', 'avance');
    } else {
      onCreateProject({ codigo: siguienteCodigo, nombre: fNombre.trim(), clienteId: client.id, clienteNombre: client.nombre, clienteEmail: client.email, clienteTelefono: client.telefono, direccion: fDireccion || client.direccion, estado: 'Borrador', fechaInicio: hoyISO(), fechaFinPrevista: fFechaFin, presupuestoAceptado: tot.base, totalFacturado: 0, totalGastos: 0, porcentajeAvance: 0, partidas: limpias, plantillaPresupuesto: fPlantilla, notaFinal: fNota });
    }
    setShowCreate(false);
  };

  // ---- Envío al cliente ----
  const abrirEnviar = async (p: Project) => {
    setEnviar(p);
    setCopiado(false);
    const libres = huecosLibres(calendarEvents, companySettings).slice(0, 6);
    setHuecosEnvio(p.huecosPropuestos?.length ? p.huecosPropuestos : libres);
    if (p.propuestaToken) setEnlace(enlacePropuesta(p.propuestaToken));
    else setEnlace('');
  };
  const publicar = async (p: Project, huecos: HuecoPropuesto[]): Promise<string | null> => {
    if (!firebaseUid || !firebaseDisponible) return null;
    setPublicando(true);
    try {
      const token = p.propuestaToken || generarToken();
      const c = clienteDe(p);
      await publicarPropuesta(construirPropuesta(p, companySettings, firebaseUid, token, c?.exigirFirma !== false, huecos, c?.nif));
      onUpdateProject(p.id, { propuestaToken: token, propuestaPublicadaEl: new Date().toISOString(), huecosPropuestos: huecos });
      const url = enlacePropuesta(token);
      setEnlace(url);
      return url;
    } catch (e: any) {
      onAviso?.(`No se pudo publicar el enlace: ${e?.message || e}`, 'error');
      return null;
    } finally {
      setPublicando(false);
    }
  };
  const textoEnvio = (p: Project, url: string | null) => {
    const total = (p.partidas || []).reduce((a, x) => a + x.cantidad * x.precioUnitario * (1 + x.ivaPorcentaje / 100), 0) || p.presupuestoAceptado * 1.21;
    const empresa = companySettings.nombreComercial || companySettings.razonSocial;
    const base = `Hola ${p.clienteNombre}, te enviamos el presupuesto ${p.codigo} (${p.nombre}) por ${formatCurrency(total)} IVA incluido.`;
    if (url) return `${base}\n\nPuedes revisarlo y aceptarlo desde tu móvil indicando tu nombre y DNI${clienteDe(p)?.exigirFirma === false ? '' : ' y firmando en pantalla'}, y elegir el día que te venga mejor para la instalación:\n${url}\n\nGracias, ${empresa}${companySettings.telefono ? ` · ${companySettings.telefono}` : ''}`;
    return `${base}\n\nTe adjuntamos el PDF. Para aceptarlo, respóndenos con tu nombre completo y DNI (o firma el documento) y te confirmamos la fecha de instalación.\n\nGracias, ${empresa}${companySettings.telefono ? ` · ${companySettings.telefono}` : ''}`;
  };
  const enviarPor = async (p: Project, canal: 'whatsapp' | 'email') => {
    let url = enlace || null;
    if (!url && firebaseUid) url = await publicar(p, huecosEnvio);
    const msg = textoEnvio(p, url);
    if (canal === 'whatsapp') {
      const tel = telefonoWhatsApp(p.clienteTelefono || clienteDe(p)?.telefono);
      window.open(tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.location.href = `mailto:${p.clienteEmail || clienteDe(p)?.email || ''}?subject=${encodeURIComponent(`Presupuesto ${p.codigo} · ${companySettings.nombreComercial || companySettings.razonSocial}`)}&body=${encodeURIComponent(msg)}`;
    }
    if (p.estado === 'Borrador') onUpdateProjectStatus(p.id, 'Enviado');
    onAddLog(p.id, `Presupuesto enviado por ${canal === 'whatsapp' ? 'WhatsApp' : 'correo'}${url ? ' con enlace de aceptación' : ''}.`, 'avance');
    setEnviar(null);
  };

  // ---- Cita ----
  const abrirCita = (p: Project, modo: 'proponer' | 'confirmar') => {
    setCitaModal(p);
    setCitaModo(modo);
    setCitaTecnicos(p.tecnicosAsignados?.length ? p.tecnicosAsignados : tecnicos.slice(0, 1));
    setCitaNotas('');
    const libres = huecosLibres(calendarEvents, companySettings);
    setCitaHuecos(p.huecosPropuestos?.length ? p.huecosPropuestos : libres.slice(0, 4));
    setHuecoConfirmar(p.huecoElegido || null);
  };
  useEffect(() => {
    if (!abrirCitaDe) return;
    const p = projects.find((x) => x.id === abrirCitaDe);
    if (p) { onSelectProject(p.id); setTab('resumen'); abrirCita(p, 'proponer'); }
    onCitaAbierta?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirCitaDe]);
  const proponerHuecos = (p: Project) => {
    if (citaHuecos.length === 0) return;
    onUpdateProject(p.id, { huecosPropuestos: citaHuecos, tecnicosAsignados: citaTecnicos });
    const msg = `Hola ${p.clienteNombre}, gracias por aceptar el presupuesto ${p.codigo}. Tenemos estos huecos para la instalación:\n${citaHuecos.map((h, i) => `${i + 1}. ${textoHueco(h)}`).join('\n')}\n\nDinos cuál te viene bien y te lo confirmamos. ${companySettings.nombreComercial || companySettings.razonSocial}`;
    const tel = telefonoWhatsApp(p.clienteTelefono || clienteDe(p)?.telefono);
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    onAddLog(p.id, `Huecos propuestos al cliente: ${citaHuecos.map(textoHueco).join(' · ')}.`, 'avance');
    setCitaModal(null);
  };
  const confirmarCita = (p: Project) => {
    if (!huecoConfirmar) return;
    const ev = onConfirmarCita(p.id, huecoConfirmar, citaTecnicos, citaNotas);
    if (ev) {
      const msg = `Hola ${p.clienteNombre}, te confirmamos la instalación el ${textoHueco(huecoConfirmar)} en ${p.direccion}.${citaTecnicos.length ? ` Irá ${citaTecnicos.join(' y ')}.` : ''} Por favor, deja despejada la zona de trabajo y el acceso al cuadro eléctrico. ${companySettings.nombreComercial || companySettings.razonSocial}`;
      const tel = telefonoWhatsApp(p.clienteTelefono || clienteDe(p)?.telefono);
      if (tel) window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
      onAviso?.('Cita confirmada. Envíala a Google Calendar desde la Agenda.', 'ok');
    }
    setCitaModal(null);
  };

  // ---- Código de aceptación recibido ----
  const aplicarCodigo = (p: Project) => {
    const parsed = leerCodigoAceptacion(codigoInput);
    const dni = (dniInput || parsed?.d || '').trim().toUpperCase();
    const nombre = (nombreInput || parsed?.nm || p.clienteNombre).trim();
    if (!dni) return onAviso?.('Hace falta el DNI/CIF del cliente.', 'error');
    onAcceptBudgetAndConvertToObra(p.id, { firmadoPor: nombre, dni, fechaFirma: parsed?.t ? parsed.t.replace('Z', '').substring(0, 19) : new Date().toISOString().substring(0, 19), codigoAceptacion: codigoInput.trim() || undefined, metodo: 'codigo' });
    setCodigoModal(null);
  };

  // ---- Cierre ----
  const cerrarObra = (p: Project) => {
    onUpdateProjectStatus(p.id, cierreChecks.cie ? 'Finalizada' : 'En legalización CIE');
    onAddLog(p.id, `Obra terminada${cierreChecks.pruebas ? ' con pruebas ITC-BT-52 realizadas' : ''}${cierreChecks.cie ? ' y certificado CIE tramitado' : ' · CIE pendiente de tramitar'}.`, 'certificacion');
    setCerrar(null);
    if (cierreChecks.factura) onOpenNewInvoiceForProject(p);
  };

  // ---- Adjuntos ----
  const leer = (file: File): Promise<string | undefined> => new Promise((res) => {
    if (file.size > LIMITE_ADJUNTO) return res(undefined);
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(file);
  });
  const subirDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !selected) return;
    const dataUrl = await leer(f);
    const n = f.name.toLowerCase();
    onAddDocument(selected.id, { nombre: f.name, tipo: n.includes('cie') || n.includes('boletin') || n.includes('boletín') ? 'CIE' : n.includes('memoria') ? 'Memoria' : n.includes('plano') ? 'Planos' : 'Otro', fecha: hoyISO(), tamano: `${Math.round(f.size / 1024)} KB`, estado: 'Aprobado', dataUrl, notas: dataUrl ? undefined : 'Archivo grande: solo se guarda el nombre.' });
    e.target.value = '';
  };
  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !selected) return;
    const dataUrl = await leer(f);
    if (!dataUrl) return alert(`La foto supera ${LIMITE_ADJUNTO / 1024} KB. Reduce su tamaño.`);
    onAddPhoto(selected.id, { titulo: f.name.replace(/\.[^/.]+$/, ''), url: dataUrl, fecha: hoyISO(), tipo: 'durante' });
    e.target.value = '';
  };

  const badge = (estado: Project['estado']) => <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${(COLOR_ESTADO[estado] || COLOR_ESTADO.Borrador).badge}`}>{estado}</span>;

  const facturasDe = (p: Project) => invoices.filter((i) => i.obraId === p.id && !['Anulada', 'Rectificada'].includes(i.estado));

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">{esPresupuestos ? <><FileText className="text-blue-600" size={28} /> Presupuestos</> : <><HardHat className="text-amber-600" size={28} /> Obras</>}</h1>
          <p className="text-slate-500 text-sm mt-1">{esPresupuestos ? 'Preparar, enviar y esperar la aceptación firmada del cliente. Al aceptarse pasa a Obras.' : 'Trabajos en marcha. Al terminar, se convierten en factura y el ciclo se cierra en verde.'} · {etiquetaPeriodo(periodo)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodFilter value={periodo} onChange={setPeriodo} anios={anios} totalFiltrado={filtrados.length} totalGlobal={projects.length} />
          {esPresupuestos && <button onClick={abrirCrear} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"><Plus size={16} /> Nuevo presupuesto {siguienteCodigo}</button>}
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80"><Search className="absolute left-4 top-3 text-slate-400" size={18} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl bg-slate-50/80 text-xs outline-none" placeholder="Cliente, código, dirección…" /></div>
        <div className="flex bg-slate-100/90 p-1.5 rounded-2xl">
          {(esPresupuestos
            ? ([['activos', `Activos (${cuenta.activos})`], ['aceptados', `Aceptados (${cuenta.aceptados})`], ['rechazados', `Rechazados (${cuenta.rechazados})`], ['todos', `Todos (${cuenta.todos})`]] as const)
            : ([['curso', `En curso (${cuenta.curso})`], ['facturadas', `Facturadas (${cuenta.facturadas})`], ['todas', `Todas (${cuenta.todasObras})`]] as const)
          ).map(([id, l]) => <button key={id} onClick={() => setSub(id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${sub === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>{l}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LISTA */}
        <div className="lg:col-span-5 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">{filtrados.length} registros</span>
          {filtrados.length === 0 && <div className="p-8 bg-white rounded-3xl border border-dashed border-slate-200 text-center text-xs text-slate-400">{esPresupuestos && sub === 'activos' ? 'Ningún presupuesto pendiente de respuesta' : 'Nada'} en {etiquetaPeriodo(periodo).toLowerCase()}. {projects.length > 0 && <button onClick={() => setPeriodo({ mes: 'todos', anio: 'todos' })} className="text-blue-600 font-bold hover:underline cursor-pointer">Ver todo</button>}</div>}
          {filtrados.map((p) => {
            const sel = p.id === selectedProjectId;
            const obra = ES_OBRA(p.estado);
            return (
              <div key={p.id} onClick={() => { onSelectProject(p.id); setTab('resumen'); }} className={`p-4 rounded-3xl border border-l-4 cursor-pointer space-y-2.5 ${(COLOR_ESTADO[p.estado] || COLOR_ESTADO.Borrador).barra} ${sel ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20' : 'bg-white border-slate-200/80 hover:border-slate-300'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] font-mono font-bold text-slate-500">{obra && p.obraCodigo ? p.obraCodigo : p.codigo}</span>{obra ? <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1"><HardHat size={10} /> Obra</span> : <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded flex items-center gap-1"><FileText size={10} /> Presupuesto</span>}{p.fechaCitaCalendario && <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-amber-200"><Calendar size={10} /> {fechaES(p.fechaCitaCalendario.split('T')[0])}</span>}</div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1 line-clamp-1">{p.nombre}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><User size={12} className="text-slate-400" /> {p.clienteNombre}</p>
                    {p.firmaCliente && <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 mt-1"><PenTool size={10} /> Firmado por {p.firmaCliente.firmadoPor}</p>}
                  </div>
                  {badge(p.estado)}
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <div><span className="text-[10px] text-slate-400">Base imponible</span><p className="font-black text-slate-900 text-sm">{formatCurrency(p.presupuestoAceptado)}</p></div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button title="Enviar al cliente" onClick={() => abrirEnviar(p)} className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"><Send size={14} /></button>
                    <button title="Ver documento" onClick={() => setPreview(p)} className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"><Eye size={14} /></button>
                    {!p.firmaCliente && <button title="Eliminar" onClick={() => setABorrar(p)} className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 cursor-pointer"><Trash2 size={14} /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* DETALLE */}
        <div className="lg:col-span-7">
          {!selected ? (
            <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-3 text-slate-400"><FileCheck2 size={36} className="mx-auto text-slate-300" /><p className="font-bold text-sm text-slate-600">Selecciona {esPresupuestos ? 'un presupuesto' : 'una obra'} de la lista</p></div>
          ) : (() => {
            const p = selected;
            const c = clienteDe(p);
            const obra = ES_OBRA(p.estado);
            const costePrevisto = (p.partidas || []).reduce((a, x) => a + (x.costeInternoTotal || 0) * x.cantidad, 0);
            const fact = facturasDe(p);
            const pendienteFacturar = p.presupuestoAceptado - p.totalFacturado;
            return (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">{p.codigo}{p.obraCodigo ? ` → ${p.obraCodigo}` : ''}</span>{badge(p.estado)}{p.firmaCliente && <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1"><Check size={10} /> Aceptado por {p.firmaCliente.firmadoPor} ({p.firmaCliente.dni})</span>}</div>
                    <h2 className="text-xl font-black text-slate-900 mt-2">{p.nombre}</h2>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1"><MapPin size={13} className="text-slate-400" /> {p.direccion} · {p.clienteNombre}{c?.exigirFirma === false ? ' · cliente sin firma' : ''}</p>
                  </div>
                </div>

                {/* ACCIONES SEGÚN ESTADO */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(p.estado === 'Borrador' || p.estado === 'Enviado') && <>
                    <button onClick={() => abrirEnviar(p)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Send size={14} /> Enviar al cliente</button>
                    <button onClick={() => setPortal(p)} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer" title="El cliente acepta y firma en tu móvil o tableta"><PenTool size={14} /> Aceptar aquí (presencial)</button>
                    <button onClick={() => { setCodigoModal(p); setCodigoInput(''); setDniInput(c?.nif || ''); setNombreInput(p.clienteNombre); }} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer" title="Si el cliente te ha respondido por WhatsApp o correo"><CheckCircle2 size={14} /> Registrar aceptación recibida</button>
                    <button onClick={() => abrirEditarPartidas(p)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Edit3 size={14} /> Editar partidas</button>
                    <button onClick={() => setRechazar(p)} className="px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-xl text-xs font-bold cursor-pointer">Rechazado</button>
                  </>}
                  {p.estado === 'Aceptado' && <>
                    {p.huecoElegido && !p.fechaCitaCalendario && <button onClick={() => abrirCita(p, 'confirmar')} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><CheckCircle2 size={14} /> Confirmar hueco elegido ({fechaES(p.huecoElegido.fecha)})</button>}
                    <button onClick={() => abrirCita(p, 'proponer')} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><CalendarDays size={14} /> Proponer huecos al cliente</button>
                    <button onClick={() => abrirCita(p, 'confirmar')} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Calendar size={14} /> Fijar cita directamente</button>
                  </>}
                  {(p.estado === 'En ejecución') && <>
                    <button onClick={() => { setCierreChecks({ pruebas: true, cie: p.documentos.some((d) => d.tipo === 'CIE'), fotos: p.fotos.length > 0, factura: true }); setCerrar(p); }} className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><ShieldCheck size={14} /> Terminar obra</button>
                    <button onClick={() => abrirCita(p, 'confirmar')} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Calendar size={14} /> Cambiar cita</button>
                    <button onClick={() => onOpenNewInvoiceForProject(p)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Factura de anticipo</button>
                  </>}
                  {(p.estado === 'En legalización CIE' || p.estado === 'Finalizada') && pendienteFacturar > 0.01 && <button onClick={() => onOpenNewInvoiceForProject(p)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><FileText size={14} /> Convertir en factura ({formatCurrency(pendienteFacturar)} pendiente)</button>}
                  {p.estado === 'En legalización CIE' && <button onClick={() => { onUpdateProjectStatus(p.id, 'Finalizada'); onAddLog(p.id, 'Certificado CIE tramitado. Obra finalizada.', 'certificacion'); }} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">CIE tramitado</button>}
                  {obra && <button onClick={() => onOpenNewExpenseForProject(p)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">Imputar gasto</button>}
                  <button onClick={() => setPreview(p)} className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Eye size={14} /> Ver PDF</button>
                  <button onClick={() => setABorrar(p)} className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ml-auto"><Trash2 size={14} /></button>
                </div>

                {/* AVISOS DE FLUJO */}
                {p.estado === 'Enviado' && p.propuestaToken && <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-center gap-2"><LinkIcon size={14} /> Enlace de aceptación publicado el {formatDate(p.propuestaPublicadaEl?.substring(0, 19))}. Cuando el cliente acepte, la obra se crea sola.</div>}
                {p.estado === 'Aceptado' && p.huecoElegido && !p.fechaCitaCalendario && <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-center gap-2"><Clock size={14} /> El cliente eligió <strong>{textoHueco(p.huecoElegido)}</strong>. Confírmalo para pasar la obra a ejecución y avisarle.</div>}
                {p.estado === 'Aceptado' && !p.huecoElegido && p.huecosPropuestos?.length ? <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700">Huecos propuestos: {p.huecosPropuestos.map(textoHueco).join(' · ')}. Esperando respuesta del cliente.</div> : null}
                {p.solicitudCitaCliente?.notasCliente && <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 italic">Nota del cliente: “{p.solicitudCitaCliente.notasCliente}”</div>}
                {p.estado === 'Rechazado' && p.motivoRechazo && <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900">Motivo del rechazo: {p.motivoRechazo}</div>}

                {/* TABS */}
                <div className="flex gap-1.5 border-b border-slate-100 pb-2 overflow-x-auto">
                  {([['resumen', 'Resumen y margen'], ['partidas', `Partidas (${p.partidas?.length || 0})`], ['documentos', `Documentos (${p.documentos.length})`], ['fotos', `Fotos (${p.fotos.length})`], ['bitacora', `Bitácora (${p.bitacora.length})`]] as const).map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${tab === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{l}</button>)}
                </div>

                {tab === 'resumen' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80"><p className="text-[11px] font-bold text-slate-400 uppercase">Presupuesto (base)</p><p className="text-xl font-black text-slate-900 mt-0.5">{formatCurrency(p.presupuestoAceptado)}</p><p className="text-[10px] text-slate-500 mt-1">{formatCurrency((p.partidas || []).reduce((a, x) => a + x.total, 0) || p.presupuestoAceptado * 1.21)} con IVA</p></div>
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80"><p className="text-[11px] font-bold text-emerald-800 uppercase">Facturado</p><p className="text-xl font-black text-emerald-700 mt-0.5">{formatCurrency(p.totalFacturado)}</p><p className="text-[10px] text-emerald-600 mt-1">{fact.length ? fact.map((f) => f.numero).join(', ') : 'Sin facturas'}</p></div>
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200/80"><p className="text-[11px] font-bold text-blue-800 uppercase">Coste real (gastos)</p><p className="text-xl font-black text-blue-900 mt-0.5">{formatCurrency(p.totalGastos)}</p><p className="text-[10px] text-blue-600 mt-1">Previsto en escandallo: {formatCurrency(costePrevisto)}</p></div>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl space-y-3">
                      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Lock size={16} className="text-amber-400" /><h4 className="font-black text-sm">Margen interno (nunca se imprime)</h4></div><span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded">Privado</span></div>
                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
                        <div><span className="text-slate-400 text-[10px] uppercase font-bold">Venta</span><p className="text-base font-black">{formatCurrency(p.presupuestoAceptado)}</p></div>
                        <div><span className="text-slate-400 text-[10px] uppercase font-bold">Coste {p.totalGastos > 0 ? 'real' : 'previsto'}</span><p className="text-base font-black text-amber-400">{formatCurrency(p.totalGastos > 0 ? p.totalGastos : costePrevisto)}</p></div>
                        <div><span className="text-slate-400 text-[10px] uppercase font-bold">Beneficio</span><p className="text-base font-black text-emerald-400">{formatCurrency(p.presupuestoAceptado - (p.totalGastos > 0 ? p.totalGastos : costePrevisto))} <span className="text-xs">({p.presupuestoAceptado > 0 ? (((p.presupuestoAceptado - (p.totalGastos > 0 ? p.totalGastos : costePrevisto)) / p.presupuestoAceptado) * 100).toFixed(0) : 0} %)</span></p></div>
                      </div>
                    </div>
                    {p.fechaCitaCalendario && <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs flex items-center justify-between gap-3"><div><span className="font-black text-amber-900 flex items-center gap-1.5"><Calendar size={14} /> Cita de instalación: {formatDate(p.fechaCitaCalendario)}</span>{p.tecnicosAsignados?.length ? <p className="text-slate-600 mt-0.5">Técnicos: {p.tecnicosAsignados.join(', ')}</p> : null}</div></div>}
                    {p.firmaCliente && (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div><p className="font-bold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={14} /> Aceptación del cliente</p><p className="text-slate-700 mt-0.5">{p.firmaCliente.firmadoPor} · NIF {p.firmaCliente.dni} · {formatDate(p.firmaCliente.fechaFirma)} · {p.firmaCliente.metodo === 'portal' ? 'desde su móvil' : p.firmaCliente.metodo === 'codigo' ? 'código recibido' : 'presencial'}</p><p className="text-[10px] text-slate-400 mt-0.5">Esta aceptación se incluye en las facturas de la obra.</p></div>
                        {p.firmaCliente.trazoFirma && <img src={p.firmaCliente.trazoFirma} alt="Firma" className="max-h-14 bg-white rounded-lg border border-slate-200 p-1" />}
                      </div>
                    )}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1"><h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Cliente</h4><p className="font-bold text-slate-800">{p.clienteNombre} <span className="font-mono text-slate-500">{c?.nif || 'sin NIF'}</span></p><p className="text-slate-600">{p.clienteTelefono || c?.telefono || '—'} · {p.clienteEmail || c?.email || '—'}</p></div>
                  </div>
                )}

                {tab === 'partidas' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><p className="text-[11px] text-slate-400">Los costes y márgenes solo los ves tú. El ojo indica qué materiales verá el cliente (solo nombre y cantidad).</p>{(p.estado === 'Borrador' || p.estado === 'Enviado') && <button onClick={() => abrirEditarPartidas(p)} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"><Edit3 size={13} /> Editar</button>}</div>
                    {(p.partidas || []).map((par) => (
                      <div key={par.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-white">
                          <div className="space-y-1 flex-1"><span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{par.categoria}</span>{par.kitId && <span className="ml-1 text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded">Kit</span>}<p className="font-bold text-slate-900 text-sm">{par.concepto}</p><p className="text-slate-400 text-[11px]">{par.cantidad} {par.unidad} × {formatCurrency(par.precioUnitario)} · IVA {par.ivaPorcentaje} %</p></div>
                          <div className="text-right"><p className="font-black text-slate-900 text-base">{formatCurrency(par.cantidad * par.precioUnitario)}</p><span className="text-[10px] text-slate-400">base</span></div>
                        </div>
                        {par.materiales && par.materiales.length > 0 && (
                          <div className="p-3.5 bg-slate-100/70 border-t border-slate-200/80 text-[11px] space-y-2">
                            <div className="flex items-center justify-between font-bold text-slate-700"><span className="flex items-center gap-1 text-slate-500"><Lock size={12} className="text-amber-500" /> Escandallo ({par.materiales.length})</span><span className="text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded">Coste {formatCurrency(par.costeInternoTotal || 0)}/ud · margen {par.margenPorcentaje?.toFixed(0) || 0} %</span></div>
                            <div className="divide-y divide-slate-200/60 bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                              {par.materiales.map((m) => (
                                <div key={m.id} className="p-2 flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-2 text-slate-700 min-w-0"><button onClick={() => (p.estado === 'Borrador' || p.estado === 'Enviado') && onUpdateProject(p.id, { partidas: (p.partidas || []).map((x) => (x.id === par.id ? { ...x, materiales: (x.materiales || []).map((y) => (y.id === m.id ? { ...y, visibleCliente: !y.visibleCliente } : y)) } : x)) })} className={`p-1 rounded-md cursor-pointer ${m.visibleCliente ? 'text-emerald-600 bg-emerald-50' : 'text-slate-300 hover:text-slate-500'}`} title={m.visibleCliente ? 'Visible para el cliente (nombre y cantidad)' : 'Oculto para el cliente'}>{m.visibleCliente ? <Eye size={13} /> : <EyeOff size={13} />}</button><span className="truncate">{m.nombre} <span className="text-slate-400">({m.proveedor || 'sin proveedor'})</span></span></span>
                                  <span className="font-mono text-slate-600 shrink-0">{m.cantidad} {m.unidad} × {formatCurrency(m.costeUnitario)} = <strong>{formatCurrency(m.totalCoste)}</strong></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {(p.partidas || []).length === 0 && <p className="text-xs text-slate-400 text-center py-6">Sin partidas.</p>}
                  </div>
                )}

                {tab === 'documentos' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><h4 className="font-bold text-xs uppercase text-slate-400">Documentos y CIE</h4><input type="file" ref={docRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={subirDoc} /><button onClick={() => docRef.current?.click()} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"><Upload size={12} /> Subir</button></div>
                    {p.documentos.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Sin documentos. El presupuesto aceptado se archiva aquí automáticamente.</p>}
                    {p.documentos.map((d) => (
                      <div key={d.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs gap-3">
                        <div className="flex items-center gap-3 min-w-0"><FileText size={18} className="text-blue-600 shrink-0" /><div className="min-w-0"><p className="font-bold text-slate-800 truncate">{d.nombre}</p><p className="text-[10px] text-slate-400">{d.tipo} · {d.fecha} · {d.tamano}{d.notas ? ` · ${d.notas}` : ''}</p></div></div>
                        <div className="flex items-center gap-2 shrink-0"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${d.estado === 'Aprobado' || d.estado === 'Firmado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{d.estado}</span>{d.dataUrl && <a href={d.dataUrl} download={d.nombre} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500" title="Descargar"><Upload size={13} className="rotate-180" /></a>}<button onClick={() => onUpdateProject(p.id, { documentos: p.documentos.filter((x) => x.id !== d.id) })} className="p-1.5 hover:bg-rose-100 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 size={13} /></button></div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'fotos' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center"><h4 className="font-bold text-xs uppercase text-slate-400">Fotos de la obra</h4><input type="file" ref={fotoRef} className="hidden" accept="image/*" onChange={subirFoto} /><button onClick={() => fotoRef.current?.click()} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"><ImageIcon size={12} /> Subir foto</button></div>
                    {p.fotos.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Sin fotos. Sube el antes, durante y después (máx. {LIMITE_ADJUNTO / 1024} KB cada una).</p>}
                    <div className="grid grid-cols-2 gap-3">{p.fotos.map((f) => <div key={f.id} className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-slate-100"><img src={f.url} alt={f.titulo} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent p-3 flex flex-col justify-end text-white"><p className="text-xs font-bold leading-tight">{f.titulo}</p><span className="text-[10px] opacity-80 uppercase">{f.tipo} · {f.fecha}</span></div><button onClick={() => onUpdateProject(p.id, { fotos: p.fotos.filter((x) => x.id !== f.id) })} className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 size={12} /></button></div>)}</div>
                  </div>
                )}

                {tab === 'bitacora' && (
                  <div className="space-y-3">
                    <form onSubmit={(e) => { e.preventDefault(); if (logTexto.trim()) { onAddLog(p.id, logTexto.trim(), logTipo); setLogTexto(''); } }} className="flex gap-2"><select value={logTipo} onChange={(e) => setLogTipo(e.target.value as any)} className="border border-slate-200 rounded-xl px-2 py-2 text-xs bg-white">{['avance', 'incidencia', 'material', 'subcontrata', 'certificacion'].map((t) => <option key={t} value={t}>{t}</option>)}</select><input value={logTexto} onChange={(e) => setLogTexto(e.target.value)} placeholder="Nota de obra…" className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs" /><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer">Añadir</button></form>
                    {p.bitacora.map((l) => <div key={l.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1"><div className="flex justify-between items-center"><span className="font-bold text-slate-800">{l.autor} <span className="text-[10px] font-normal text-slate-400 uppercase">· {l.tipo}</span></span><span className="text-[10px] text-slate-400">{fechaES(l.fecha)}</span></div><p className="text-slate-600">{l.texto}</p></div>)}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ===== MODAL CREAR / EDITAR PRESUPUESTO ===== */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-5xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100"><div><h3 className="font-black text-slate-900 text-lg flex items-center gap-2"><Plus size={20} className="text-blue-600" /> {editandoPartidas ? `Editar presupuesto ${selected?.codigo}` : `Nuevo presupuesto ${siguienteCodigo}`}</h3><p className="text-[11px] text-slate-500">Partidas del catálogo o kits, con escandallo interno. El coste nunca se imprime.</p></div><button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <form onSubmit={guardarPresupuesto} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2"><label className="block font-bold text-slate-700 mb-1">Título *</label><input value={fNombre} onChange={(e) => setFNombre(e.target.value)} placeholder="Ej.: Instalación punto de recarga 7,4 kW en garaje" className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold" required /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Cliente *</label><select value={fClienteId} onChange={(e) => { setFClienteId(e.target.value); const c = clients.find((x) => x.id === e.target.value); if (c && !fDireccion) setFDireccion(c.direccion); }} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold bg-white" disabled={editandoPartidas}>{clients.length === 0 && <option value="">Primero crea un cliente</option>}{clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.exigirFirma === false ? ' (sin firma)' : ''}</option>)}</select></div>
                <div className="md:col-span-2"><label className="block font-bold text-slate-700 mb-1">Dirección de la instalación</label><input value={fDireccion} onChange={(e) => setFDireccion(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="block font-bold text-slate-700 mb-1">Plantilla</label><select value={fPlantilla} onChange={(e) => setFPlantilla(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2 py-2 bg-white">{(companySettings.plantillasPersonalizadas || []).map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div><div><label className="block font-bold text-slate-700 mb-1">Fin previsto</label><input type="date" value={fFechaFin} onChange={(e) => setFFechaFin(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2 py-2" /></div></div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center flex-wrap gap-2"><h4 className="font-black text-slate-900 text-sm">Añadir partidas</h4><div className="flex gap-2"><button type="button" onClick={() => setShowKits(true)} className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><PackagePlus size={13} /> Desde un kit ({kits.length})</button><button type="button" onClick={addLibre} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold cursor-pointer">+ Partida libre</button></div></div>
                <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-44 overflow-y-auto">
                  {catalogCategories.map((g) => {
                    const items = catalogItems.filter((it) => it.categoriaId === g.id);
                    if (!items.length) return null;
                    return <div key={g.id}><p className="font-bold text-slate-800 text-[11px] mb-1">{g.nombre}</p><div className="flex flex-wrap gap-1.5">{items.map((it) => <button key={it.id} type="button" onClick={() => addCatalogo(it)} className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] text-slate-700 text-left cursor-pointer flex items-center gap-1.5">+ {it.concepto}<span className="font-bold text-slate-900 bg-slate-100 px-1 rounded text-[10px]">{formatCurrency(it.precioUnitario)}/{it.unidad}</span></button>)}</div></div>;
                  })}
                  {catalogItems.length === 0 && <p className="text-slate-400">El catálogo está vacío. Añade conceptos en Materiales o usa partidas libres.</p>}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center"><h4 className="font-black text-slate-900 text-xs uppercase">Partidas ({partidas.length})</h4><span className="text-[10px] text-slate-400">Pulsa Escandallo para ver costes y elegir qué materiales ve el cliente</span></div>
                {partidas.map((par) => {
                  const exp = !!expandidas[par.id];
                  return (
                    <div key={par.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-2.5">
                        <div className="flex-1 space-y-1 w-full"><input value={par.concepto} onChange={(e) => updPartida(par.id, { concepto: e.target.value })} className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 font-bold" placeholder="Concepto visible para el cliente" /><input value={par.descripcion || ''} onChange={(e) => updPartida(par.id, { descripcion: e.target.value })} className="w-full border border-slate-100 bg-white rounded-lg px-3 py-1 text-[11px]" placeholder="Descripción adicional (opcional)" /></div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1"><label className="text-[10px] text-slate-400">Cant.</label><input type="number" min="0.01" step="any" value={par.cantidad} onChange={(e) => updPartida(par.id, { cantidad: Number(e.target.value) })} className="w-16 border border-slate-200 bg-white rounded-xl px-2 py-1.5 text-center font-bold" /><input value={par.unidad} onChange={(e) => updPartida(par.id, { unidad: e.target.value })} className="w-10 border border-slate-200 bg-white rounded-xl px-1 py-1.5 text-center text-[10px]" /></div>
                          <div className="flex items-center gap-1"><label className="text-[10px] text-slate-400">Precio</label><input type="number" step="0.01" value={par.precioUnitario} onChange={(e) => updPartida(par.id, { precioUnitario: Number(e.target.value) })} className="w-24 border border-slate-200 bg-white rounded-xl px-2 py-1.5 text-right font-black" /><span className="text-[11px] text-slate-400">€</span></div>
                          <select value={par.ivaPorcentaje} onChange={(e) => updPartida(par.id, { ivaPorcentaje: Number(e.target.value) })} className="border border-slate-200 bg-white rounded-xl px-1 py-1.5 text-[11px]"><option value={21}>21 %</option><option value={10}>10 %</option><option value={4}>4 %</option><option value={0}>0 %</option></select>
                          <div className="text-right pl-2 min-w-[80px]"><span className="text-[10px] text-slate-400 block leading-none">Base</span><span className="font-black text-blue-700">{formatCurrency(par.cantidad * par.precioUnitario)}</span></div>
                          <button type="button" onClick={() => setExpandidas((x) => ({ ...x, [par.id]: !x[par.id] }))} className={`px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer ${exp ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}><Calculator size={13} /> Escandallo</button>
                          <button type="button" onClick={() => setPartidas((prev) => prev.filter((x) => x.id !== par.id))} className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 size={15} /></button>
                        </div>
                      </div>
                      {exp && (
                        <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-amber-900 font-bold"><Lock size={13} className="text-amber-600" /> Materiales y mano de obra (interno)</div><div className="flex items-center gap-3"><div className="flex items-center gap-1.5"><span className="text-slate-500 text-[11px]">Margen sobre coste</span><input type="number" value={par.margenPorcentaje?.toFixed(0) || 0} onChange={(e) => updMargen(par.id, Number(e.target.value))} className="w-16 border border-amber-300 bg-white rounded-lg px-2 py-1 text-center font-bold" /><span className="font-bold">%</span></div><span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">Coste {formatCurrency(par.costeInternoTotal || 0)}/ud · beneficio {formatCurrency(par.precioUnitario - (par.costeInternoTotal || 0))}/ud</span></div></div>
                          <div className="space-y-2">
                            {(par.materiales || []).map((m) => (
                              <div key={m.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-200">
                                <button type="button" onClick={() => updMat(par.id, m.id, { visibleCliente: !m.visibleCliente })} className={`col-span-1 p-1.5 rounded-lg flex justify-center cursor-pointer ${m.visibleCliente ? 'bg-emerald-50 text-emerald-600' : 'text-slate-300 hover:text-slate-500'}`} title={m.visibleCliente ? 'El cliente ve este material (sin precio)' : 'Oculto para el cliente'}>{m.visibleCliente ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                                <input value={m.nombre} onChange={(e) => updMat(par.id, m.id, { nombre: e.target.value })} placeholder="Material o mano de obra" className="col-span-4 border border-slate-100 rounded-lg px-2 py-1" />
                                <input value={m.proveedor || ''} onChange={(e) => updMat(par.id, m.id, { proveedor: e.target.value })} placeholder="Proveedor" className="col-span-2 border border-slate-100 rounded-lg px-2 py-1 text-[11px] text-slate-500" />
                                <div className="col-span-2 flex items-center gap-1"><input type="number" step="any" value={m.cantidad} onChange={(e) => updMat(par.id, m.id, { cantidad: Number(e.target.value) })} className="w-full border border-slate-100 rounded-lg px-1.5 py-1 text-center" /><input value={m.unidad} onChange={(e) => updMat(par.id, m.id, { unidad: e.target.value })} className="w-9 border border-slate-100 rounded-lg px-1 py-1 text-[10px] text-center" /></div>
                                <div className="col-span-2 flex items-center gap-1"><input type="number" step="0.01" value={m.costeUnitario} onChange={(e) => updMat(par.id, m.id, { costeUnitario: Number(e.target.value) })} className="w-full border border-slate-100 rounded-lg px-1.5 py-1 text-right font-mono" /><span className="text-[10px] text-slate-400">€</span></div>
                                <button type="button" onClick={() => delMat(par.id, m.id)} className="col-span-1 text-slate-400 hover:text-rose-600 flex justify-center cursor-pointer"><Trash2 size={13} /></button>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={() => addMat(par.id)} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"><Plus size={12} /> Añadir material</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {partidas.length === 0 && <p className="text-slate-400 text-center py-4">Añade partidas desde el catálogo, un kit o una partida libre.</p>}
              </div>

              <div><label className="block font-bold text-slate-700 mb-1">Comentario al pie del presupuesto</label><textarea value={fNota} onChange={(e) => setFNota(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2" placeholder="Forma de pago, validez, garantía…" /></div>

              <div className="p-4 bg-slate-900 text-white rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div><span className="text-[10px] text-slate-400 uppercase font-bold">Base imponible</span><p className="text-lg font-black">{formatCurrency(tot.base)}</p><span className="text-[10px] text-slate-400">{formatCurrency(tot.base + tot.iva)} con IVA</span></div>
                <div><span className="text-[10px] text-slate-400 uppercase font-bold">Coste previsto</span><p className="text-lg font-black text-amber-400">{formatCurrency(tot.coste)}</p></div>
                <div><span className="text-[10px] text-slate-400 uppercase font-bold">Beneficio</span><p className="text-lg font-black text-emerald-400">{formatCurrency(tot.beneficio)}</p></div>
                <div><span className="text-[10px] text-slate-400 uppercase font-bold">Margen sobre venta</span><p className={`text-lg font-black ${tot.margen >= 30 ? 'text-emerald-400' : tot.margen >= 15 ? 'text-amber-400' : 'text-rose-400'}`}>{tot.margen.toFixed(0)} %</p></div>
              </div>
              {errorForm && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2"><AlertCircle size={14} /> {errorForm}</div>}
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer">Cancelar</button><button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md cursor-pointer">{editandoPartidas ? 'Guardar cambios' : 'Guardar presupuesto'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showKits && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center"><h3 className="font-black text-slate-900 flex items-center gap-2"><PackagePlus size={18} className="text-purple-600" /> Insertar un kit como partida</h3><button onClick={() => setShowKits(false)} className="text-slate-400 cursor-pointer"><X size={18} /></button></div>
            {kits.length === 0 && <p className="text-xs text-slate-400">No hay kits. Créalos en la pestaña Kits.</p>}
            {kits.map((k) => <button key={k.id} type="button" onClick={() => addKit(k)} className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/40 cursor-pointer"><div className="flex justify-between items-start gap-3"><div><p className="font-bold text-slate-900 text-sm">{k.nombre}</p><p className="text-[11px] text-slate-500">{k.descripcion}</p><p className="text-[10px] text-slate-400 mt-1">{k.partidas.length} materiales · coste {formatCurrency(k.precioCosteTotal)}</p></div><span className="font-black text-purple-700 shrink-0">{formatCurrency(k.precioVentaTotal)}</span></div></button>)}
          </div>
        </div>
      )}

      {/* ===== ENVIAR ===== */}
      {enviar && (() => {
        const p = projects.find((x) => x.id === enviar.id) || enviar;
        const c = clienteDe(p);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100"><div className="flex items-center gap-2"><div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Send size={20} /></div><div><h3 className="font-black text-slate-900 text-base">Enviar {p.codigo} a {p.clienteNombre}</h3><p className="text-xs text-slate-500">{c?.exigirFirma === false ? 'Este cliente acepta sin firma (nombre y CIF).' : 'El cliente indica nombre y DNI y firma en pantalla.'}</p></div></div><button onClick={() => setEnviar(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
              {firebaseUid ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-blue-900 space-y-1.5"><p className="font-bold flex items-center gap-1.5"><Sparkles size={14} /> Con enlace de aceptación</p><ul className="list-disc pl-4 space-y-0.5 text-[11px]"><li>El cliente abre el enlace en su móvil, ve el presupuesto y lo acepta.</li><li>Elige uno de los huecos libres que le propones.</li><li>La aceptación llega aquí al instante y se crea la obra.</li></ul></div>
                  <div><p className="font-bold text-slate-700 mb-1.5">Huecos que se le ofrecen (según tu agenda)</p><div className="grid grid-cols-2 gap-1.5">{huecosLibres(calendarEvents, companySettings).slice(0, 10).map((h) => { const sel = huecosEnvio.some((x) => x.fecha === h.fecha && x.franja === h.franja); return <button key={`${h.fecha}${h.franja}`} type="button" onClick={() => setHuecosEnvio(sel ? huecosEnvio.filter((x) => !(x.fecha === h.fecha && x.franja === h.franja)) : [...huecosEnvio, h])} className={`p-2 rounded-lg border text-left text-[11px] cursor-pointer ${sel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200'}`}>{textoHueco(h)}</button>; })}</div></div>
                  {enlace ? <div className="space-y-1"><label className="text-[11px] font-bold text-slate-600">Enlace publicado</label><div className="flex gap-2"><input readOnly value={enlace} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-[11px] select-all" /><button type="button" onClick={() => { navigator.clipboard?.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className="px-3 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer flex items-center gap-1">{copiado ? <Check size={13} /> : <Copy size={13} />}</button></div><button type="button" onClick={() => publicar(p, huecosEnvio)} disabled={publicando} className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer">Volver a publicar con estos huecos</button></div> : <button type="button" onClick={() => publicar(p, huecosEnvio)} disabled={publicando} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"><LinkIcon size={14} /> {publicando ? 'Publicando…' : 'Crear enlace de aceptación'}</button>}
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2"><Info size={15} className="shrink-0 mt-0.5" /><span>Sin la cuenta de Google vinculada no se puede publicar el enlace para que el cliente acepte desde su móvil. Se enviará el mensaje con el PDF y podrás registrar la aceptación cuando te responda, o usar "Aceptar aquí" en persona.</span></div>
              )}
              <div className="space-y-2 pt-2">
                <button type="button" onClick={() => enviarPor(p, 'whatsapp')} disabled={publicando} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"><Phone size={16} /> Enviar por WhatsApp</button>
                <button type="button" onClick={async () => { if (!enlace && firebaseUid) await publicar(p, huecosEnvio); setEnviar(null); setPreviewCorreo(true); setPreview(p); }} disabled={publicando} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"><Mail size={16} /> Enviar por correo con el PDF adjunto</button>
                <button type="button" onClick={() => { setEnviar(null); setPreview(p); }} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"><Eye size={15} /> Ver / descargar el PDF</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== CITA ===== */}
      {citaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100"><div><h3 className="font-black text-slate-900 text-base flex items-center gap-2"><CalendarDays className="text-blue-600" size={18} /> {citaModo === 'proponer' ? 'Proponer huecos al cliente' : 'Fijar la cita de instalación'}</h3><p className="text-[11px] text-slate-500">{citaModal.obraCodigo || citaModal.codigo} · {citaModal.clienteNombre}</p></div><button onClick={() => setCitaModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs"><button onClick={() => setCitaModo('proponer')} className={`flex-1 py-1.5 rounded-lg font-bold cursor-pointer ${citaModo === 'proponer' ? 'bg-white shadow-xs' : 'text-slate-500'}`}>Proponer varios huecos</button><button onClick={() => setCitaModo('confirmar')} className={`flex-1 py-1.5 rounded-lg font-bold cursor-pointer ${citaModo === 'confirmar' ? 'bg-white shadow-xs' : 'text-slate-500'}`}>Confirmar una fecha</button></div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-500">Huecos libres de tu agenda (lunes a viernes, dos franjas). Los ocupados no aparecen.</p>
              <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
                {huecosLibres(calendarEvents, companySettings, undefined, 21).map((h) => {
                  const sel = citaModo === 'proponer' ? citaHuecos.some((x) => x.fecha === h.fecha && x.franja === h.franja) : huecoConfirmar?.fecha === h.fecha && huecoConfirmar?.franja === h.franja;
                  const elegidoCliente = citaModal.huecoElegido?.fecha === h.fecha && citaModal.huecoElegido?.franja === h.franja;
                  return <button key={`${h.fecha}${h.franja}`} type="button" onClick={() => (citaModo === 'proponer' ? setCitaHuecos(sel ? citaHuecos.filter((x) => !(x.fecha === h.fecha && x.franja === h.franja)) : [...citaHuecos, h]) : setHuecoConfirmar(h))} className={`p-2 rounded-lg border text-left text-[11px] cursor-pointer ${sel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>{textoHueco(h)}{elegidoCliente && <span className="block text-[9px] font-black">★ elegido por el cliente</span>}</button>;
                })}
              </div>
              <div><p className="font-bold text-slate-700 mb-1.5">Técnicos</p><div className="flex flex-wrap gap-2">{tecnicos.map((t) => <label key={t} className={`px-3 py-1.5 rounded-xl border cursor-pointer font-bold ${citaTecnicos.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}><input type="checkbox" className="hidden" checked={citaTecnicos.includes(t)} onChange={(e) => setCitaTecnicos(e.target.checked ? [...citaTecnicos, t] : citaTecnicos.filter((x) => x !== t))} />{t}</label>)}</div></div>
              {citaModo === 'confirmar' && <div><label className="block font-bold text-slate-700 mb-1">Notas para la cita</label><textarea value={citaNotas} onChange={(e) => setCitaNotas(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2" placeholder="Material a llevar, llaves, acceso…" /></div>}
            </div>
            <div className="flex gap-2 pt-2"><button onClick={() => setCitaModal(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button>{citaModo === 'proponer' ? <button onClick={() => proponerHuecos(citaModal)} disabled={citaHuecos.length === 0} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"><Phone size={14} /> Enviar {citaHuecos.length} huecos por WhatsApp</button> : <button onClick={() => confirmarCita(citaModal)} disabled={!huecoConfirmar} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"><CheckCircle2 size={14} /> Confirmar y avisar al cliente</button>}</div>
          </div>
        </div>
      )}

      {/* ===== CÓDIGO / ACEPTACIÓN RECIBIDA ===== */}
      {codigoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100"><h3 className="font-black text-slate-900 text-base flex items-center gap-2"><CheckCircle2 className="text-emerald-600" size={20} /> Registrar aceptación recibida</h3><button onClick={() => setCodigoModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <p className="text-xs text-slate-600">Si el cliente te ha confirmado por WhatsApp o correo, anota aquí su nombre, su DNI/CIF (obligatorio) y, si lo tienes, el código de aceptación que le dio la app. El presupuesto pasa a obra.</p>
            <div className="space-y-3 text-xs">
              <div><label className="block font-bold text-slate-700 mb-1">Nombre de quien acepta</label><input value={nombreInput} onChange={(e) => setNombreInput(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
              <div><label className="block font-bold text-slate-700 mb-1">DNI / CIF *</label><input value={dniInput} onChange={(e) => setDniInput(e.target.value.toUpperCase())} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono uppercase" /></div>
              <div><label className="block font-bold text-slate-700 mb-1">Código de aceptación (opcional)</label><input value={codigoInput} onChange={(e) => setCodigoInput(e.target.value)} placeholder="ACP1.…" className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono" /></div>
            </div>
            <div className="flex gap-2 pt-2"><button onClick={() => setCodigoModal(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button><button onClick={() => aplicarCodigo(codigoModal)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer">Aceptar y crear obra</button></div>
          </div>
        </div>
      )}

      {/* ===== CIERRE ===== */}
      {cerrar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100"><div><h3 className="font-black text-slate-900 text-base flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-600" /> Terminar la obra</h3><p className="text-[11px] text-slate-500">{cerrar.nombre}</p></div><button onClick={() => setCerrar(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={cierreChecks.pruebas} onChange={(e) => setCierreChecks({ ...cierreChecks, pruebas: e.target.checked })} className="rounded" /><span className="font-bold text-slate-800">Pruebas ITC-BT-52 realizadas (diferencial, tierra, carga)</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={cierreChecks.cie} onChange={(e) => setCierreChecks({ ...cierreChecks, cie: e.target.checked })} className="rounded" /><span className="font-bold text-slate-800">Certificado de instalación (CIE) ya tramitado</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={cierreChecks.fotos} onChange={(e) => setCierreChecks({ ...cierreChecks, fotos: e.target.checked })} className="rounded" /><span className="font-bold text-slate-800">Fotos finales subidas</span></label>
              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-200"><input type="checkbox" checked={cierreChecks.factura} onChange={(e) => setCierreChecks({ ...cierreChecks, factura: e.target.checked })} className="rounded" /><span className="font-bold text-blue-700">Abrir la factura al terminar (con la aceptación del cliente)</span></label>
            </div>
            <p className="text-[11px] text-slate-500">{cierreChecks.cie ? 'La obra pasará a "Finalizada".' : 'Sin el CIE la obra queda "En legalización CIE"; podrás facturar igualmente y marcar el CIE cuando llegue.'}</p>
            <div className="flex gap-2"><button onClick={() => setCerrar(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button><button onClick={() => cerrarObra(cerrar)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"><Check size={14} /> Terminar obra</button></div>
          </div>
        </div>
      )}

      {/* ===== RECHAZO ===== */}
      {rechazar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100"><h3 className="font-black text-rose-900 text-base flex items-center gap-2"><XCircle size={18} className="text-rose-600" /> Marcar como rechazado</h3><button onClick={() => setRechazar(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional): precio, plazos, pospuesto…" className="w-full border border-slate-200 rounded-xl p-3 text-xs min-h-[80px]" />
            <div className="flex gap-2"><button onClick={() => setRechazar(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button><button onClick={() => { onUpdateProjectStatus(rechazar.id, 'Rechazado', motivo || 'Sin motivo indicado'); setRechazar(null); setMotivo(''); }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer">Confirmar</button></div>
          </div>
        </div>
      )}

      {preview && (() => { const actual = projects.find((x) => x.id === preview.id) || preview; return <DocumentRenderer tipo="p" doc={actual} companySettings={companySettings} client={clienteDe(preview)} abrirCorreo={previewCorreo} enlaceAceptacion={actual.propuestaToken ? enlacePropuesta(actual.propuestaToken) : undefined} onClose={() => { setPreview(null); setPreviewCorreo(false); }} onSendWhatsApp={() => { setPreview(null); abrirEnviar(preview); }} onCorreoEnviado={(canal) => { onAddLog(preview.id, `Presupuesto enviado por correo (${canal}) con el PDF adjunto${actual.propuestaToken ? ' y enlace de aceptación' : ''}.`, 'avance'); if (actual.estado === 'Borrador') onUpdateProjectStatus(preview.id, 'Enviado'); }} onAceptarFirmar={(p) => { setPreview(null); setPortal(p); }} onCambiarPlantilla={(id) => onUpdateProject(preview.id, { plantillaPresupuesto: id })} />; })()}

      {portal && <ClientAcceptancePortal project={projects.find((x) => x.id === portal.id) || portal} companySettings={companySettings} client={clienteDe(portal)} calendarEvents={calendarEvents} onClose={() => setPortal(null)} onAcceptBudget={(id, firma, hueco) => { onAcceptBudgetAndConvertToObra(id, firma, hueco); setPortal(null); onSelectProject(id); }} />}

      {aBorrar && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4"><Trash2 size={24} /></div>
            <h3 className="text-base font-black text-slate-900">¿Eliminar {aBorrar.codigo}?</h3>
            <p className="text-xs text-slate-500 mt-1.5">Se borran sus partidas, documentos, fotos, bitácora y citas asociadas.{facturasDe(aBorrar).length ? ' Las facturas emitidas se conservan.' : ''}</p>
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => setABorrar(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">Cancelar</button><button onClick={() => { onDeleteProject(aBorrar.id); setABorrar(null); }} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer">Eliminar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
