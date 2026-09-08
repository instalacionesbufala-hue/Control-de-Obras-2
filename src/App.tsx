import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LayoutDashboard, BadgeEuro, Receipt, Users, Wallet,
  BarChart3, Settings, Zap, Boxes, Menu, X, Trash2, Sparkles,
  CheckCircle2, AlertTriangle, CalendarDays, User as UserIcon, Cloud, RefreshCw, TrendingUp, HelpCircle, CloudOff, Save, FileText, HardHat,
} from 'lucide-react';

import {
  INITIAL_CLIENTS, INITIAL_PROJECTS, INITIAL_INVOICES, INITIAL_EXPENSES, INITIAL_BANK_TRANSACTIONS,
  INITIAL_CALENDAR_EVENTS, INITIAL_CATALOG_CATEGORIES, INITIAL_CATALOG_ITEMS, INITIAL_SUPPLIERS, INITIAL_KITS, esRegistroDemo,
} from './data/initialData';

import {
  Client, Project, Invoice, CobroFactura, ConsumoObra, Expense, BankTransaction, CalendarInstallation, CompanySettings, ProjectLog, ProjectDocument, ProjectPhoto,
  CatalogCategory, CatalogItem, Supplier, Kit, AppState, FirmaCliente, HuecoPropuesto,
} from './types';

import { auth, onAuthStateChanged, firebaseDisponible } from './lib/firebase';
import { guardarEstadoEnNube, cargarEstadoDeNube, escucharEstadoNube } from './lib/cloudSync';
import { diasSinCopiaLocal, cargarLocal, guardarLocal, guardarCopiaAnterior, tieneDatosPropios, DEFAULT_COMPANY_SETTINGS, migrarSettings, STATE_VERSION, deviceId } from './lib/storage';
import { horasDeTecnico } from './lib/agenda';
import { actualizarCosteEnKits, catalogoDemoSeparado } from './lib/catalogo';
import { conCobro, sinCobro } from './lib/cobros';
import { escucharAceptaciones, firmaDesdeAceptacion, cerrarPropuesta, AceptacionPublica } from './lib/propuestas';
import { numeroDocumento, uid } from './utils/formatters';
import { hoyISO, ahoraISO } from './utils/dates';

import { DashboardView } from './components/DashboardView';
import { ProjectsView } from './components/ProjectsView';
import { MaterialsAndKitsView } from './components/MaterialsAndKitsView';
import { SalesView } from './components/SalesView';
import { ExpensesView } from './components/ExpensesView';
import { ReconciliationView } from './components/ReconciliationView';
import { ClientsView } from './components/ClientsView';
import { TaxClosingView } from './components/TaxClosingView';
import { SettingsView } from './components/SettingsView';
import { RentabilityView } from './components/RentabilityView';
import { CalendarAgendaView } from './components/CalendarAgendaView';
import { OnboardingModal } from './components/OnboardingModal';
import { VoiceAIBudgetAssistant } from './components/VoiceAIBudgetAssistant';
import { ClientAcceptancePortal } from './components/ClientAcceptancePortal';
import { PublicAcceptancePage } from './components/PublicAcceptancePage';

const TAB_TITULOS: Record<string, string> = {
  dashboard: 'Resumen', presupuestos: 'Presupuestos', obras: 'Obras', agenda: 'Agenda', catalogo: 'Materiales y kits', kits: 'Materiales y kits',
  ventas: 'Facturas', gastos: 'Gastos y compras', bancos: 'Banco y conciliación', contactos: 'Clientes', rentabilidad: 'Rentabilidad',
  gestoria: 'Trimestre e impuestos', ajustes: 'Configuración',
};

export default function App() {
  // Enlace público de aceptación: la app se comporta como página del cliente
  const tokenPublico = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('aceptar');
    } catch {
      return null;
    }
  }, []);
  if (tokenPublico) return <PublicAcceptancePage token={tokenPublico} />;
  return <AppPrincipal />;
}

function AppPrincipal() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showGlobalAIAssistant, setShowGlobalAIAssistant] = useState(false);
  const [showDeleteDemoModal, setShowDeleteDemoModal] = useState(false);
  const [portalProjectId, setPortalProjectId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'error' | 'info'; accion?: { texto: string; onClick: () => void }; fijo?: boolean } | null>(null);
  // Datos propios a ambos lados al vincular un equipo nuevo: lo elige el usuario, no la app
  const [conflictoInicial, setConflictoInicial] = useState<{ remoto: AppState; resumenNube: string; resumenLocal: string } | null>(null);
  const [avisoCopiaCerrado, setAvisoCopiaCerrado] = useState(false);
  const [citaPendienteDe, setCitaPendienteDe] = useState<string | null>(null); // abre "Proponer franjas" en Obras

  // ---------- Estado principal (se carga de localStorage o de los ejemplos) ----------
  const inicial = useMemo<AppState>(() => {
    const local = cargarLocal();
    if (local) return local;
    // Los ejemplos vienen con el modelo antiguo: se separan en materiales y kits al cargarlos
    const demo = catalogoDemoSeparado(INITIAL_CATALOG_ITEMS, INITIAL_KITS, INITIAL_CATALOG_CATEGORIES);
    return {
      version: STATE_VERSION,
      updatedAt: new Date().toISOString(),
      // Con los ejemplos cargados, la numeración continúa detrás de ellos
      companySettings: { ...DEFAULT_COMPANY_SETTINGS, siguienteNumeroPresupuesto: 4, siguienteNumeroObra: 2, siguienteNumeroFactura: 2 },
      clients: INITIAL_CLIENTS,
      projects: INITIAL_PROJECTS,
      invoices: INITIAL_INVOICES,
      expenses: INITIAL_EXPENSES,
      bankTransactions: INITIAL_BANK_TRANSACTIONS,
      calendarEvents: INITIAL_CALENDAR_EVENTS,
      catalogCategories: demo.categorias,
      catalogItems: demo.materiales,
      suppliers: INITIAL_SUPPLIERS,
      kits: demo.kits,
      demoCargada: true,
      guiaVista: false,
    };
  }, []);

  const [companySettings, setCompanySettings] = useState<CompanySettings>(inicial.companySettings);
  const [clients, setClients] = useState<Client[]>(inicial.clients);
  const [projects, setProjects] = useState<Project[]>(inicial.projects);
  const [invoices, setInvoices] = useState<Invoice[]>(inicial.invoices);
  const [expenses, setExpenses] = useState<Expense[]>(inicial.expenses);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(inicial.bankTransactions);
  const [calendarEvents, setCalendarEvents] = useState<CalendarInstallation[]>(inicial.calendarEvents);
  const [suppliers, setSuppliers] = useState<Supplier[]>(inicial.suppliers);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>(inicial.catalogCategories);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(inicial.catalogItems);
  const [kits, setKits] = useState<Kit[]>(inicial.kits);
  const [demoCargada, setDemoCargada] = useState<boolean>(inicial.demoCargada);
  const [guiaVista, setGuiaVista] = useState<boolean>(inicial.guiaVista);
  const [syncUid, setSyncUid] = useState<string | undefined>(inicial.syncUid);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(!inicial.guiaVista);

  const estadoCompleto = useMemo<AppState>(() => ({
    version: STATE_VERSION,
    updatedAt: '',
    deviceId: deviceId(),
    syncUid,
    companySettings, clients, projects, invoices, expenses, bankTransactions, calendarEvents, catalogCategories, catalogItems, suppliers, kits, demoCargada, guiaVista,
  }), [syncUid, companySettings, clients, projects, invoices, expenses, bankTransactions, calendarEvents, catalogCategories, catalogItems, suppliers, kits, demoCargada, guiaVista]);

  const aplicarEstado = useCallback((st: AppState) => {
    setCompanySettings(migrarSettings(st.companySettings));
    setClients(st.clients);
    setProjects(st.projects);
    setInvoices(st.invoices);
    setExpenses(st.expenses);
    setBankTransactions(st.bankTransactions);
    setCalendarEvents(st.calendarEvents);
    setCatalogCategories(st.catalogCategories);
    setCatalogItems(st.catalogItems);
    setSuppliers(st.suppliers);
    setKits(st.kits);
    setDemoCargada(st.demoCargada);
    setGuiaVista(st.guiaVista);
  }, []);

  // ---------- Persistencia local (siempre) ----------
  const primeraCarga = useRef(true);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const ultimoGuardadoLocal = useRef<string>('');
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    const t = setTimeout(() => {
      const st = { ...estadoCompleto, updatedAt: new Date().toISOString() };
      const r = guardarLocal(st);
      setErrorLocal(r.ok ? null : r.error || 'Error al guardar');
      if (r.ok) ultimoGuardadoLocal.current = st.updatedAt;
    }, 400);
    return () => clearTimeout(t);
  }, [estadoCompleto]);

  // ---------- Nube: Firebase Auth + Firestore en tiempo real ----------
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [estadoNube, setEstadoNube] = useState<'desconectado' | 'cargando' | 'sincronizado' | 'guardando' | 'error'>('desconectado');
  const [errorNube, setErrorNube] = useState<string | null>(null);
  const ultimoRemotoAplicado = useRef<string>('');
  const pendienteSubida = useRef(false);

  useEffect(() => {
    if (!firebaseDisponible) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setEstadoNube('desconectado');
        return;
      }
      setEstadoNube('cargando');
      setCompanySettings((prev) => ({
        ...prev,
        googleCalendarConectado: true,
        googleAccountEmail: prev.googleAccountEmail || user.email || '',
        email: prev.email || user.email || '',
        nombreUsuario: prev.nombreUsuario || user.displayName || '',
      }));
      try {
        const remoto = await cargarEstadoDeNube(user.uid);
        const local = cargarLocal();
        setSyncUid(user.uid);
        const nubeConDatos = tieneDatosPropios(remoto);
        const localConDatos = tieneDatosPropios(local);
        // Este dispositivo ya venía sincronizando con esta misma cuenta: manda la fecha, como siempre.
        const yaVinculado = !!local?.syncUid && local.syncUid === user.uid;
        const traerNube = () => {
          guardarCopiaAnterior(local || estadoCompleto);
          ultimoRemotoAplicado.current = remoto!.updatedAt;
          aplicarEstado({ ...remoto!, syncUid: user.uid });
          setAviso({ texto: 'Datos cargados desde la nube (versión más reciente).', tipo: 'ok' });
        };

        if (!remoto) {
          // Primera vez con esta cuenta: lo que haya aquí pasa a ser el origen
          pendienteSubida.current = true;
        } else if (yaVinculado) {
          if ((remoto.updatedAt || '') > (local!.updatedAt || '')) traerNube();
          else pendienteSubida.current = true;
        } else if (nubeConDatos && !localConDatos) {
          // Dispositivo nuevo, aún con los ejemplos: la nube gana siempre, sin mirar fechas.
          // Antes ganaba lo local por tener la fecha más reciente y borraba los datos de la cuenta.
          traerNube();
        } else if (nubeConDatos && localConDatos) {
          // Hay trabajo real en los dos lados y este equipo no estaba vinculado: decide el usuario.
          guardarCopiaAnterior(local || estadoCompleto);
          setConflictoInicial({ remoto, resumenNube: resumenEstado(remoto), resumenLocal: resumenEstado(local!) });
        } else {
          pendienteSubida.current = true;
        }
        setEstadoNube('sincronizado');
      } catch (e: any) {
        setEstadoNube('error');
        setErrorNube(e?.message || 'No se pudo leer la nube');
      }
    });
    return () => unsub();
  }, [aplicarEstado]);

  // Escucha en tiempo real cuando hay sesión
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = escucharEstadoNube(
      firebaseUser.uid,
      (st, meta) => {
        if (meta.deviceId === deviceId()) return; // eco propio
        if (meta.updatedAt && meta.updatedAt <= ultimoRemotoAplicado.current) return;
        ultimoRemotoAplicado.current = meta.updatedAt;
        guardarCopiaAnterior(estadoCompleto);
        aplicarEstado(st);
        setAviso({ texto: 'Otro dispositivo ha guardado cambios. Datos actualizados.', tipo: 'info' });
      },
      (e) => {
        setEstadoNube('error');
        setErrorNube(e.message);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  // Subida de cambios (con retardo)
  const primeraSubida = useRef(true);
  useEffect(() => {
    if (!firebaseUser) return;
    if (primeraSubida.current) {
      primeraSubida.current = false;
      if (!pendienteSubida.current) return;
    }
    const t = setTimeout(async () => {
      try {
        setEstadoNube('guardando');
        const st = { ...estadoCompleto, updatedAt: new Date().toISOString() };
        ultimoRemotoAplicado.current = st.updatedAt;
        await guardarEstadoEnNube(firebaseUser.uid, st);
        pendienteSubida.current = false;
        setEstadoNube('sincronizado');
        setErrorNube(null);
      } catch (e: any) {
        setEstadoNube('error');
        setErrorNube(e?.message?.includes('exceeds') ? 'El estado supera el tamaño máximo de Firestore (1 MB). Reduce fotos o documentos incrustados.' : e?.message || 'Error al guardar en la nube');
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoCompleto, firebaseUser]);

  // Avisos temporales
  useEffect(() => {
    if (!aviso || aviso.fijo) return;
    const id = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(id);
  }, [aviso]);

  // Portal de aceptación local (misma sesión): ?aceptarPresupuesto=ID
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const directBudgetId = params.get('aceptarPresupuesto') || params.get('presupuesto');
      if (directBudgetId) setPortalProjectId(directBudgetId);
      const obra = params.get('obra');
      if (obra) {
        setSelectedProjectId(obra);
        setActiveTab('obras');
      }
    } catch {
      // ignorar
    }
  }, []);

  // ---------- Numeración ----------
  const siguienteCodigoPresupuesto = () => numeroDocumento(companySettings.prefijoPresupuestos, companySettings.siguienteNumeroPresupuesto);
  const siguienteCodigoObra = () => numeroDocumento(companySettings.prefijoObras, companySettings.siguienteNumeroObra);
  const siguienteNumeroFactura = () => numeroDocumento(companySettings.prefijoFacturas, companySettings.siguienteNumeroFactura);
  const siguienteNumeroRectificativa = () => numeroDocumento(companySettings.prefijoRectificativas || 'REC-{AAAA}-', companySettings.siguienteNumeroRectificativa || 1);

  // ---------- Proveedores ----------
  const handleCreateSupplier = (nuevo: Supplier) => {
    setSuppliers((prev) => {
      const existe = prev.some((s) => s.id === nuevo.id || (s.cif && nuevo.cif && s.cif.replace(/\W/g, '').toUpperCase() === nuevo.cif.replace(/\W/g, '').toUpperCase()));
      return existe ? prev : [nuevo, ...prev];
    });
  };

  // ---------- Catálogo ----------
  const handleAddCatalogItem = (data: Omit<CatalogItem, 'id'>) => setCatalogItems((prev) => [{ ...data, id: uid('mat') }, ...prev]);
  const handleClearAllCatalogItems = () => setCatalogItems([]);
  const handleUpdateCatalogItem = (id: string, data: Partial<CatalogItem>) => setCatalogItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
  const handleDeleteCatalogItem = (id: string) => setCatalogItems((prev) => prev.filter((it) => it.id !== id));
  // Aplica el nuevo coste de un material a los kits que el usuario haya marcado
  const handlePropagarCoste = (materialId: string, nuevoCoste: number, idsKits: string[]) => setKits((prev) => actualizarCosteEnKits(materialId, nuevoCoste, prev, idsKits));
  // Precios de compra puestos al día desde una factura de proveedor leída con la IA
  const handleActualizarPrecios = (cambios: Array<{ id: string; precioCompra: number; origen: string }>) => {
    const hoy = hoyISO();
    setCatalogItems((prev) => prev.map((m) => { const c = cambios.find((x) => x.id === m.id); return c ? { ...m, precioCompra: c.precioCompra, fechaUltimoPrecio: hoy, origenUltimoPrecio: c.origen } : m; }));
    setAviso({ texto: `Precio de compra actualizado en ${cambios.length} material${cambios.length > 1 ? 'es' : ''}. Al editarlos podrás aplicar el cambio a los kits que los usan.`, tipo: 'ok' });
  };
  const handleAddCatalogCategory = (data: Omit<CatalogCategory, 'id'>) => setCatalogCategories((prev) => [...prev, { ...data, id: uid('cat') }]);
  // Disponible para la pantalla de materiales; hoy solo se crean categorías desde el formulario
  const handleUpdateCatalogCategory = (id: string, data: Partial<CatalogCategory>) => {
    setCatalogCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    if (data.nombre) setCatalogItems((prev) => prev.map((it) => (it.categoriaId === id ? { ...it, categoriaNombre: data.nombre! } : it)));
  };
  // Disponible para la pantalla de materiales; hoy solo se crean categorías desde el formulario
  const handleDeleteCatalogCategory = (id: string) => {
    const restantes = catalogCategories.filter((c) => c.id !== id);
    setCatalogCategories(restantes);
    if (restantes.length > 0) {
      const f = restantes[0];
      setCatalogItems((prev) => prev.map((it) => (it.categoriaId === id ? { ...it, categoriaId: f.id, categoriaNombre: f.nombre } : it)));
    }
  };
  const handleResetCatalogToDefaults = () => {
    const demo = catalogoDemoSeparado(INITIAL_CATALOG_ITEMS, INITIAL_KITS, INITIAL_CATALOG_CATEGORIES);
    setCatalogCategories(demo.categorias);
    setCatalogItems(demo.materiales);
  };

  // ---------- Kits ----------
  const handleSaveKit = (kit: Kit) => setKits((prev) => (prev.some((k) => k.id === kit.id) ? prev.map((k) => (k.id === kit.id ? { ...kit, esDemo: false } : k)) : [{ ...kit, esDemo: false }, ...prev]));
  const handleDeleteKit = (id: string) => setKits((prev) => prev.filter((k) => k.id !== id));
  const handleDuplicateKit = (kit: Kit) => setKits((prev) => [{ ...kit, id: uid('kit'), nombre: `${kit.nombre} (copia)`, codigo: kit.codigo ? `${kit.codigo}-CP` : undefined, esDemo: false, partidas: kit.partidas.map((p) => ({ ...p, id: uid('ki') })) }, ...prev]);

  // ---------- Navegación ----------
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
  const [preselectedProjectForInvoice, setPreselectedProjectForInvoice] = useState<Project | null>(null);

  const resumenEstado = (st: AppState) => {
    const n = (l?: unknown[]) => (l || []).length;
    const f = st.updatedAt ? new Date(st.updatedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'sin fecha';
    return `${n(st.clients)} clientes · ${n(st.projects)} presupuestos y obras · ${n(st.invoices)} facturas · ${n(st.expenses)} gastos · guardado el ${f}`;
  };

  const irA = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };
  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    if (projectId) setActiveTab('obras');
  };

  // ---------- Presupuestos y obras ----------
  const handleCreateProject = (data: Omit<Project, 'id' | 'fotos' | 'documentos' | 'bitacora' | 'desgloseGastos'>) => {
    const codigo = data.codigo || siguienteCodigoPresupuesto();
    const nuevo: Project = {
      ...data,
      codigo,
      id: uid('obr'),
      fotos: [],
      documentos: [],
      bitacora: [{ id: uid('log'), fecha: hoyISO(), autor: companySettings.nombreUsuario || 'Oficina', tipo: 'avance', texto: `Presupuesto ${codigo} creado.` }],
      desgloseGastos: { materiales: 0, manoDeObra: 0, subcontratas: 0, maquinaria: 0, otros: 0 },
      notaFinal: data.notaFinal ?? companySettings.notaFinalPresupuestoDefecto,
      esDemo: false,
    };
    setProjects((prev) => [nuevo, ...prev]);
    setCompanySettings((prev) => ({ ...prev, siguienteNumeroPresupuesto: (prev.siguienteNumeroPresupuesto || 1) + 1 }));
    setClients((prev) => prev.map((c) => (c.id === nuevo.clienteId ? { ...c, obrasCount: (c.obrasCount || 0) + 1, obraPrincipal: c.obraPrincipal || nuevo.nombre } : c)));
    setSelectedProjectId(nuevo.id);
    return nuevo;
  };

  const handleUpdateProject = (projectId: string, campos: Partial<Project>) => setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...campos } : p)));

  const handleUpdateProjectStatus = (projectId: string, estado: Project['estado'], motivoRechazo?: string) => {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p;
      const u: Project = { ...p, estado };
      if (motivoRechazo) u.motivoRechazo = motivoRechazo;
      if (estado === 'En ejecución') u.porcentajeAvance = Math.max(p.porcentajeAvance, 10);
      if (estado === 'Finalizada') {
        u.porcentajeAvance = 100;
        u.fechaFinReal = u.fechaFinReal || hoyISO();
      }
      return u;
    }));
    if (estado === 'Rechazado') {
      const p = projects.find((x) => x.id === projectId);
      if (p?.propuestaToken) cerrarPropuesta(p.propuestaToken, 'rechazada');
    }
  };

  const handleAddProjectLog = (projectId: string, texto: string, tipo: ProjectLog['tipo']) => {
    const log: ProjectLog = { id: uid('log'), fecha: hoyISO(), autor: companySettings.nombreUsuario || 'Oficina', tipo, texto };
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, bitacora: [log, ...p.bitacora] } : p)));
  };
  const handleAddProjectDocument = (projectId: string, doc: Omit<ProjectDocument, 'id'>) => setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, documentos: [{ ...doc, id: uid('doc') }, ...p.documentos] } : p)));
  // Consumo real de material de una obra. Al cerrarlo, la rentabilidad pasa a usarlo.
  const handleGuardarConsumo = (projectId: string, consumo: ConsumoObra[], cerrado: boolean) => {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p;
      const coste = Math.round(consumo.reduce((a, c) => a + c.cantidadReal * c.costeUnitario, 0) * 100) / 100;
      const previsto = Math.round(consumo.reduce((a, c) => a + c.cantidadPrevista * c.costeUnitario, 0) * 100) / 100;
      const dif = Math.round((coste - previsto) * 100) / 100;
      return {
        ...p,
        consumoReal: consumo,
        consumoCerrado: cerrado,
        bitacora: cerrado
          ? [{ id: uid('log'), fecha: hoyISO(), autor: companySettings.nombreUsuario || 'Oficina', tipo: 'material' as const, texto: `Consumo de material cerrado: ${coste.toFixed(2)} € frente a ${previsto.toFixed(2)} € previstos (${dif >= 0 ? '+' : ''}${dif.toFixed(2)} €).` }, ...p.bitacora]
          : p.bitacora,
      };
    }));
  };

  const handleAddProjectPhoto = (projectId: string, photo: Omit<ProjectPhoto, 'id'>) => setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, fotos: [{ ...photo, id: uid('f') }, ...p.fotos] } : p)));
  const handleDeleteProject = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    if (p?.propuestaToken) cerrarPropuesta(p.propuestaToken, 'caducada');
    setProjects((prev) => prev.filter((x) => x.id !== projectId));
    setCalendarEvents((prev) => prev.filter((e) => e.obraId !== projectId));
    if (selectedProjectId === projectId) setSelectedProjectId(null);
  };

  // Aceptación del presupuesto -> se crea la OBRA (código propio). No emite factura.
  const handleAcceptBudgetAndConvertToObra = (projectId: string, firma: FirmaCliente, huecoElegido?: HuecoPropuesto) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (project.firmaCliente && project.estado !== 'Enviado' && project.estado !== 'Borrador') return; // ya aceptado
    const fecha = hoyISO();
    const obraCodigo = project.obraCodigo || siguienteCodigoObra();
    const docFirmado: ProjectDocument = {
      id: uid('doc'),
      nombre: `Presupuesto_${project.codigo}_aceptado.pdf`,
      tipo: 'Presupuesto',
      fecha,
      tamano: firma.trazoFirma ? `${Math.round(firma.trazoFirma.length / 1024)} KB` : '—',
      estado: 'Firmado',
      notas: `Aceptado por ${firma.firmadoPor} (${firma.dni}) el ${firma.fechaFirma.replace('T', ' ').substring(0, 16)}${firma.codigoAceptacion ? ` · código ${firma.codigoAceptacion.substring(0, 24)}…` : ''}`,
      dataUrl: firma.trazoFirma,
    };
    const log: ProjectLog = {
      id: uid('log'),
      fecha,
      autor: firma.metodo === 'portal' ? 'Portal de aceptación' : companySettings.nombreUsuario || 'Oficina',
      tipo: 'avance',
      texto: `Presupuesto ${project.codigo} aceptado por ${firma.firmadoPor} (${firma.dni})${firma.trazoFirma ? ' con firma' : ' sin firma (cliente que no la exige)'}. Se crea la obra ${obraCodigo}.${huecoElegido ? ` El cliente ha elegido el hueco ${huecoElegido.fecha} (${huecoElegido.franja === 'manana' ? 'mañana' : 'tarde'}); falta confirmarlo.` : ''}`,
    };
    setProjects((prev) => prev.map((p) => (p.id === projectId ? {
      ...p,
      estado: 'Aceptado',
      obraCodigo,
      fechaAceptacion: fecha,
      firmaCliente: firma,
      huecoElegido: huecoElegido || p.huecoElegido,
      documentos: [docFirmado, ...p.documentos],
      bitacora: [log, ...p.bitacora],
      porcentajeAvance: Math.max(p.porcentajeAvance, 5),
    } : p)));
    if (!project.obraCodigo) setCompanySettings((prev) => ({ ...prev, siguienteNumeroObra: (prev.siguienteNumeroObra || 1) + 1 }));
    if (project.clienteId) {
      setClients((prev) => prev.map((c) => (c.id === project.clienteId ? {
        ...c,
        nif: c.nif && c.nif !== 'Pendiente' ? c.nif : firma.dni,
        documentos: [docFirmado, ...(c.documentos || [])],
        documentosCount: (c.documentos?.length || 0) + 1,
        obraPrincipal: project.nombre,
      } : c)));
    }
    if (project.propuestaToken) cerrarPropuesta(project.propuestaToken, 'aceptada');
    setAviso({ texto: `Presupuesto ${project.codigo} aceptado. Obra ${obraCodigo} creada.`, tipo: 'ok' });
  };

  // Aviso sonoro, del navegador y en pantalla cuando el cliente acepta desde su móvil
  const avisarAceptacion = (p: Project, a: AceptacionPublica) => {
    const texto = `${a.firmadoPor} ha aceptado el presupuesto ${p.codigo} (${p.nombre})${a.huecoElegido ? `. Prefiere el ${a.huecoElegido.fecha} por la ${a.huecoElegido.franja === 'manana' ? 'mañana' : 'tarde'}` : ''}.`;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, 0.18].forEach((t, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = i ? 1046 : 784; g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18); });
    } catch {
      // sin audio
    }
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification('Presupuesto aceptado', { body: texto, tag: `acept-${p.id}` });
        n.onclick = () => { window.focus(); setSelectedProjectId(p.id); setActiveTab('obras'); setCitaPendienteDe(p.id); n.close(); };
      }
    } catch {
      // sin notificaciones
    }
    setAviso({ texto, tipo: 'ok', fijo: true, accion: { texto: 'Proponer franjas al cliente', onClick: () => { setSelectedProjectId(p.id); setActiveTab('obras'); setCitaPendienteDe(p.id); setAviso(null); } } });
  };

  // Escucha de aceptaciones públicas de presupuestos enviados con enlace
  const tokensEscuchados = useRef<Record<string, () => void>>({});
  useEffect(() => {
    if (!firebaseUser) return;
    const abiertos = projects.filter((p) => p.propuestaToken && (p.estado === 'Enviado' || p.estado === 'Borrador') && !p.firmaCliente);
    abiertos.forEach((p) => {
      const token = p.propuestaToken!;
      if (tokensEscuchados.current[token]) return;
      tokensEscuchados.current[token] = escucharAceptaciones(token, (a: AceptacionPublica) => {
        handleAcceptBudgetAndConvertToObra(p.id, firmaDesdeAceptacion(a), a.huecoElegido);
        avisarAceptacion(p, a);
        if (a.notasCliente) handleUpdateProject(p.id, { solicitudCitaCliente: { fechaSugerida: a.huecoElegido?.fecha || '', franjaHoraria: a.huecoElegido ? (a.huecoElegido.franja === 'manana' ? 'Mañana' : 'Tarde') : '', horaInicio: a.huecoElegido?.horaInicio, horaFin: a.huecoElegido?.horaFin, estado: 'Pendiente confirmación', notasCliente: a.notasCliente, fechaSolicitud: ahoraISO() } });
      });
    });
    // Deja de escuchar los que ya no estén abiertos
    Object.keys(tokensEscuchados.current).forEach((token) => {
      if (!abiertos.some((p) => p.propuestaToken === token)) {
        tokensEscuchados.current[token]();
        delete tokensEscuchados.current[token];
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, projects]);

  useEffect(() => () => Object.values(tokensEscuchados.current).forEach((u) => (u as () => void)()), []);

  // ---------- Facturas ----------
  // Emite una factura (serie normal) o una rectificativa (serie propia). Si la rectificativa es
  // sustitutiva ('S'), la original pasa a 'Rectificada' y deja de contar en totales y en la obra.
  const handleCreateInvoice = (inv: Invoice, opciones?: { serie?: 'factura' | 'rectificativa'; original?: Invoice }) => {
    const original = opciones?.original;
    const sustituye = !!original && inv.verifactu?.tipoRectificativa === 'S';
    setInvoices((prev) => [{ ...inv, esDemo: false }, ...prev.map((i) => (original && i.id === original.id ? { ...i, rectificadaPor: { id: inv.id, numero: inv.numero }, estado: sustituye ? ('Rectificada' as const) : i.estado } : i))]);
    setCompanySettings((prev) => (opciones?.serie === 'rectificativa' ? { ...prev, siguienteNumeroRectificativa: (prev.siguienteNumeroRectificativa || 1) + 1 } : { ...prev, siguienteNumeroFactura: (prev.siguienteNumeroFactura || 1) + 1 }));
    if (sustituye && original?.obraId) setProjects((prev) => prev.map((p) => (p.id === original.obraId ? { ...p, totalFacturado: Math.max(0, p.totalFacturado - original.baseImponible), facturaIds: (p.facturaIds || []).filter((x) => x !== original.id) } : p)));
    if (sustituye && original) setClients((prev) => prev.map((c) => (c.id === original.clienteId ? { ...c, totalFacturado: Math.max(0, (c.totalFacturado || 0) - original.total) } : c)));
    if (inv.obraId) {
      setProjects((prev) => prev.map((p) => {
        if (p.id !== inv.obraId) return p;
        const facturado = p.totalFacturado + inv.baseImponible;
        const completa = facturado >= p.presupuestoAceptado - 0.01;
        return {
          ...p,
          totalFacturado: facturado,
          facturaIds: [...(p.facturaIds || []), inv.id],
          estado: completa && (p.estado === 'Finalizada' || p.estado === 'En legalización CIE') ? 'Facturada' : p.estado,
          bitacora: [{ id: uid('log'), fecha: hoyISO(), autor: companySettings.nombreUsuario || 'Oficina', tipo: 'certificacion' as const, texto: original ? `Emitida la rectificativa ${inv.numero} (${inv.verifactu?.tipoFactura}) de la factura ${original.numero} por ${inv.total.toFixed(2)} €.` : `Emitida la factura ${inv.numero} por ${inv.total.toFixed(2)} € (${completa ? 'obra facturada al completo' : 'certificación parcial'}).` }, ...p.bitacora],
        };
      }));
    }
    setClients((prev) => prev.map((c) => (c.id === inv.clienteId ? { ...c, totalFacturado: (c.totalFacturado || 0) + inv.total, nif: c.nif || inv.clienteNif } : c)));
  };
  // Cobros que no llegan por el extracto: efectivo, Bizum, o un banco que no importas
  const handleRegistrarCobro = (invoiceId: string, cobro: CobroFactura) => setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? conCobro(i, cobro) : i)));
  const handleQuitarCobro = (invoiceId: string, cobroId: string) => setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? sinCobro(i, { id: cobroId }) : i)));

  const handleUpdateInvoiceStatus = (invoiceId: string, estado: Invoice['estado']) => setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? { ...i, estado } : i)));
  const handleUpdateInvoice = (invoiceId: string, campos: Partial<Invoice>) => setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? { ...i, ...campos } : i)));

  // ---------- Gastos ----------
  const categoriaDesglose = (cat: Expense['categoria']): keyof Project['desgloseGastos'] =>
    cat === 'Materiales' ? 'materiales' : cat === 'Subcontratas' ? 'subcontratas' : cat === 'Alquiler Maquinaria' ? 'maquinaria' : 'otros';

  const aplicarGastoAObra = (lista: Project[], exp: Expense, signo: 1 | -1): Project[] =>
    lista.map((p) => {
      if (p.id !== exp.obraId) return p;
      const k = categoriaDesglose(exp.categoria);
      return { ...p, totalGastos: Math.max(0, p.totalGastos + signo * exp.baseImponible), desgloseGastos: { ...p.desgloseGastos, [k]: Math.max(0, (p.desgloseGastos[k] || 0) + signo * exp.baseImponible) } };
    });

  const handleCreateExpense = (exp: Expense) => {
    setExpenses((prev) => [{ ...exp, esDemo: false }, ...prev]);
    if (exp.obraId) setProjects((prev) => aplicarGastoAObra(prev, exp, 1));
  };
  const handleUpdateExpense = (id: string, campos: Partial<Expense>) => {
    const antes = expenses.find((e) => e.id === id);
    if (!antes) return;
    const despues = { ...antes, ...campos };
    setExpenses((prev) => prev.map((e) => (e.id === id ? despues : e)));
    setProjects((prev) => {
      let l = prev;
      if (antes.obraId) l = aplicarGastoAObra(l, antes, -1);
      if (despues.obraId) l = aplicarGastoAObra(l, despues, 1);
      return l;
    });
  };
  const handleDeleteExpense = (id: string) => {
    const e = expenses.find((x) => x.id === id);
    setExpenses((prev) => prev.filter((x) => x.id !== id));
    if (e?.obraId) setProjects((prev) => aplicarGastoAObra(prev, e, -1));
  };

  // ---------- Clientes ----------
  const handleCreateClient = (c: Client) => setClients((prev) => [{ ...c, esDemo: false, fechaAlta: c.fechaAlta || hoyISO() }, ...prev]);
  const handleUpdateClient = (clientId: string, campos: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...campos } : c)));
    if (campos.nombre || campos.email || campos.telefono) {
      setProjects((prev) => prev.map((p) => (p.clienteId === clientId ? { ...p, clienteNombre: campos.nombre ?? p.clienteNombre, clienteEmail: campos.email ?? p.clienteEmail, clienteTelefono: campos.telefono ?? p.clienteTelefono } : p)));
    }
  };
  const handleDeleteClient = (clientId: string) => setClients((prev) => prev.filter((c) => c.id !== clientId));

  // ---------- Banco ----------
  const handleReconcileTransaction = (transactionId: string, refId: string, tipo: 'factura_venta' | 'gasto_compra', nombre?: string) => {
    setBankTransactions((prev) => prev.map((tx) => (tx.id === transactionId ? { ...tx, conciliado: true, conciliadoCon: { tipo, referenciaId: refId, referenciaNombre: nombre || refId } } : tx)));
    if (tipo === 'factura_venta') {
      // El ingreso del banco se anota como un cobro por SU importe, no marca la factura entera.
      // Con el reparto habitual 50-50, hacen falta dos ingresos para darla por cobrada.
      const tx = bankTransactions.find((t) => t.id === transactionId);
      setInvoices((prev) => prev.map((inv) => (inv.id === refId
        ? conCobro(inv, { id: `cob-${transactionId}`, fecha: tx?.fecha || hoyISO(), importe: Math.abs(tx?.importe || inv.total), metodo: 'Transferencia Bancaria', transaccionId: transactionId, nota: tx?.concepto?.substring(0, 80) })
        : inv)));
    }
    else setExpenses((prev) => prev.map((e) => (e.id === refId ? { ...e, estadoPago: 'Pagado', bancoConciliado: true, transaccionId: transactionId } : e)));
  };
  const handleUnreconcileTransaction = (transactionId: string) => {
    const tx = bankTransactions.find((t) => t.id === transactionId);
    if (!tx) return;
    setBankTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, conciliado: false, conciliadoCon: undefined } : t)));
    // Al deshacer la conciliación se retira ese cobro y la factura vuelve a su estado real
    if (tx.conciliadoCon?.tipo === 'factura_venta') setInvoices((prev) => prev.map((inv) => (inv.id === tx.conciliadoCon!.referenciaId ? sinCobro(inv, { transaccionId: transactionId }) : inv)));
    if (tx.conciliadoCon?.tipo === 'gasto_compra') setExpenses((prev) => prev.map((e) => (e.id === tx.conciliadoCon!.referenciaId ? { ...e, bancoConciliado: false, transaccionId: undefined } : e)));
  };
  const handleImportTransactions = (nuevas: BankTransaction[]) => {
    setBankTransactions((prev) => [...nuevas, ...prev].sort((a, b) => b.fecha.localeCompare(a.fecha)));
    setCompanySettings((prev) => ({ ...prev, bancoConexion: { ...(prev.bancoConexion || { conectado: false, proveedor: 'manual', entidad: '' }), ultimaImportacion: ahoraISO() } }));
  };
  const handleDeleteTransaction = (id: string) => {
    handleUnreconcileTransaction(id);
    setBankTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // ---------- Agenda ----------
  const handleAddCalendarEvent = (data: Omit<CalendarInstallation, 'id'>): CalendarInstallation => {
    const ev: CalendarInstallation = { ...data, id: uid('cal'), esDemo: false };
    setCalendarEvents((prev) => [ev, ...prev]);
    return ev;
  };
  const handleUpdateCalendarEvent = (id: string, campos: Partial<CalendarInstallation>) => setCalendarEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...campos } : e)));
  const handleDeleteCalendarEvent = (id: string) => setCalendarEvents((prev) => prev.filter((e) => e.id !== id));

  // Confirmar la cita de una obra: crea/actualiza el evento y pasa la obra a "En ejecución"
  const handleConfirmarCita = (projectId: string, hueco: HuecoPropuesto, tecnicos: string[], notas?: string): CalendarInstallation | null => {
    const p = projects.find((x) => x.id === projectId);
    if (!p) return null;
    // Si hay un técnico asignado con horario propio, la cita se ajusta a sus horas
    const h = tecnicos.length === 1 ? horasDeTecnico(tecnicos[0], hueco.franja, companySettings) : { inicio: hueco.horaInicio, fin: hueco.horaFin };
    const inicio = `${hueco.fecha}T${h.inicio}:00`;
    const fin = `${hueco.fecha}T${h.fin}:00`;
    const existente = calendarEvents.find((e) => e.obraId === projectId && e.tipo === 'Instalación' && e.estado !== 'Completada' && e.estado !== 'Cancelada');
    let ev: CalendarInstallation;
    if (existente) {
      ev = { ...existente, fechaHoraInicio: inicio, fechaHoraFin: fin, tecnicos, estado: 'Programada', notasTecnicas: notas || existente.notasTecnicas };
      handleUpdateCalendarEvent(existente.id, ev);
    } else {
      ev = handleAddCalendarEvent({
        titulo: `Instalación: ${p.nombre}`,
        obraId: p.id, obraNombre: p.nombre, clienteNombre: p.clienteNombre, clienteTelefono: p.clienteTelefono, clienteEmail: p.clienteEmail,
        direccion: p.direccion, fechaHoraInicio: inicio, fechaHoraFin: fin, tecnicos, tipo: 'Instalación', estado: 'Programada',
        googleCalendarSynced: false, presupuestoId: p.id, presupuestoCodigo: p.codigo, presupuestoTotal: p.presupuestoAceptado, notasTecnicas: notas, origenReserva: 'oficina',
      });
    }
    setProjects((prev) => prev.map((x) => (x.id === projectId ? {
      ...x,
      estado: x.estado === 'Aceptado' || x.estado === 'Enviado' || x.estado === 'Borrador' ? 'En ejecución' : x.estado,
      fechaCitaCalendario: inicio,
      huecoElegido: hueco,
      huecosPropuestos: undefined,
      tecnicosAsignados: tecnicos,
      solicitudCitaCliente: x.solicitudCitaCliente ? { ...x.solicitudCitaCliente, estado: 'Aceptada' } : x.solicitudCitaCliente,
      bitacora: [{ id: uid('log'), fecha: hoyISO(), autor: companySettings.nombreUsuario || 'Oficina', tipo: 'avance' as const, texto: `Cita de instalación confirmada para el ${hueco.fecha} de ${hueco.horaInicio} a ${hueco.horaFin}. Técnicos: ${tecnicos.join(', ') || 'sin asignar'}.` }, ...x.bitacora],
    } : x)));
    return ev;
  };

  // Atajos
  const handleOpenNewInvoiceForProject = (project: Project) => {
    setPreselectedProjectForInvoice(project);
    setShowNewInvoiceModal(true);
    setActiveTab('ventas');
  };
  const handleOpenNewExpenseForProject = (project: Project) => {
    setPreselectedProjectForInvoice(project);
    setShowNewExpenseModal(true);
    setActiveTab('gastos');
  };

  // ---------- Borrar ejemplos ----------
  const hayDemo = demoCargada && (
    clients.some(esRegistroDemo) || projects.some(esRegistroDemo) || invoices.some(esRegistroDemo) || expenses.some(esRegistroDemo) || bankTransactions.some(esRegistroDemo) || calendarEvents.some(esRegistroDemo)
  );
  const handleDeleteExamples = () => {
    setClients((prev) => prev.filter((x) => !esRegistroDemo(x)));
    setProjects((prev) => prev.filter((x) => !esRegistroDemo(x)));
    setInvoices((prev) => prev.filter((x) => !esRegistroDemo(x)));
    setExpenses((prev) => prev.filter((x) => !esRegistroDemo(x)));
    setBankTransactions((prev) => prev.filter((x) => !esRegistroDemo(x)));
    setCalendarEvents((prev) => prev.filter((x) => !esRegistroDemo(x)));
    setSuppliers((prev) => prev.filter((x) => !esRegistroDemo(x)));
    setKits((prev) => prev.map((k) => ({ ...k, esDemo: false }))); // los kits se conservan como plantillas
    setCompanySettings((prev) => ({ ...prev, bancoConexion: { conectado: false, proveedor: prev.bancoConexion?.proveedor || 'manual', entidad: '' } }));
    setDemoCargada(false);
    setSelectedProjectId(null);
    setShowDeleteDemoModal(false);
    setAviso({ texto: 'Ejemplos eliminados. La app está lista para tus datos reales.', tipo: 'ok' });
  };

  const handleCargarEjemplos = () => {
    setClients((prev) => [...INITIAL_CLIENTS, ...prev]);
    setProjects((prev) => [...INITIAL_PROJECTS, ...prev]);
    setInvoices((prev) => [...INITIAL_INVOICES, ...prev]);
    setExpenses((prev) => [...INITIAL_EXPENSES, ...prev]);
    setBankTransactions((prev) => [...INITIAL_BANK_TRANSACTIONS, ...prev]);
    setCalendarEvents((prev) => [...INITIAL_CALENDAR_EVENTS, ...prev]);
    setSuppliers((prev) => [...INITIAL_SUPPLIERS, ...prev.filter((s) => !esRegistroDemo(s))]);
    setDemoCargada(true);
  };

  const handleRestaurarEstado = (st: AppState) => {
    guardarCopiaAnterior(estadoCompleto);
    aplicarEstado(st);
    setAviso({ texto: 'Copia restaurada.', tipo: 'ok' });
  };

  const cerrarGuia = () => {
    setShowOnboarding(false);
    setGuiaVista(true);
  };

  // Contadores del menú
  const pendingInvoicesCount = invoices.filter((i) => i.estado === 'Pendiente' || i.estado === 'Vencida').length;
  const unreconciledTxCount = bankTransactions.filter((t) => !t.conciliado).length;
  const citasPendientes = projects.filter((p) => p.estado === 'Aceptado' && !p.fechaCitaCalendario).length + calendarEvents.filter((e) => e.estado === 'Pendiente confirmación').length;
  const obrasActivas = projects.filter((p) => p.estado === 'En ejecución' || p.estado === 'Aceptado').length;
  const presupuestosVivos = projects.filter((p) => p.estado === 'Borrador' || p.estado === 'Enviado').length;

  const nombreApp = companySettings.nombreComercial || companySettings.razonSocial;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {mobileMenuOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* ===================== MENÚ LATERAL ===================== */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white flex flex-col shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {companySettings.logoUrl ? (
              <img src={companySettings.logoUrl} alt="Logo" className="w-11 h-11 rounded-2xl object-contain bg-white p-1 shrink-0" />
            ) : (
              <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/30 shrink-0"><Zap className="text-white" size={24} /></div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-tight leading-none text-white truncate">
                {nombreApp || <>CONTROL<span className="text-blue-500">DE OBRA</span></>}
              </h1>
              <p className="text-[9px] text-slate-400 tracking-wider font-black uppercase mt-1 truncate">{companySettings.epigrafeIAE || 'Instalaciones eléctricas y recarga VE'}</p>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
        </div>

        <nav className="flex-1 px-4 py-5 overflow-y-auto space-y-5">
          <div>
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Gestión</p>
            <div className="space-y-1">
              <NavItem id="dashboard" icon={LayoutDashboard} label="Resumen" active={activeTab} onClick={irA} />
              <NavItem id="agenda" icon={CalendarDays} label="Agenda" badge={citasPendientes ? `${citasPendientes}` : undefined} badgeColor="bg-amber-500/20 text-amber-300" active={activeTab} onClick={irA} />
              <NavItem id="presupuestos" icon={FileText} label="Presupuestos" badge={presupuestosVivos ? `${presupuestosVivos}` : undefined} badgeColor="bg-blue-500/20 text-blue-300" active={activeTab} onClick={irA} />
              <NavItem id="obras" icon={HardHat} label="Obras" badge={obrasActivas ? `${obrasActivas} activas` : undefined} badgeColor="bg-amber-500/20 text-amber-300" active={activeTab} onClick={irA} />
              <NavItem id="contactos" icon={Users} label="Clientes" badge={`${clients.length}`} badgeColor="bg-slate-700 text-slate-300" active={activeTab} onClick={irA} />
              <NavItem id="catalogo" icon={Boxes} label="Materiales y kits" badge={`${catalogItems.length} + ${kits.length}`} badgeColor="bg-slate-700 text-slate-300" active={activeTab} onClick={irA} />
            </div>
          </div>
          <div>
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Dinero</p>
            <div className="space-y-1">
              <NavItem id="ventas" icon={BadgeEuro} label="Facturas" badge={pendingInvoicesCount ? `${pendingInvoicesCount} por cobrar` : undefined} badgeColor="bg-amber-500/20 text-amber-300" active={activeTab} onClick={irA} />
              <NavItem id="gastos" icon={Receipt} label="Gastos y compras" active={activeTab} onClick={irA} />
              <NavItem id="bancos" icon={Wallet} label="Banco y conciliación" badge={unreconciledTxCount ? `${unreconciledTxCount}` : undefined} badgeColor="bg-red-500/20 text-red-400" active={activeTab} onClick={irA} />
              <NavItem id="rentabilidad" icon={TrendingUp} label="Rentabilidad" active={activeTab} onClick={irA} />
              <NavItem id="gestoria" icon={BarChart3} label="Trimestre e impuestos" active={activeTab} onClick={irA} />
            </div>
          </div>
          <div>
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ajustes</p>
            <div className="space-y-1">
              <NavItem id="ajustes" icon={Settings} label="Configuración" active={activeTab} onClick={irA} />
              <button onClick={() => { setShowOnboarding(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-400 hover:bg-slate-900 hover:text-white transition-all cursor-pointer">
                <HelpCircle size={18} /> Guía de inicio
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-900 bg-slate-950/80 space-y-3">
          <button type="button" onClick={() => { setShowGlobalAIAssistant(true); setMobileMenuOpen(false); }} className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-purple-600/30 hover:from-blue-600/40 hover:to-purple-600/40 border border-blue-500/40 text-blue-300 hover:text-white transition-all shadow-md group cursor-pointer text-left" title="Dictar un presupuesto por voz">
            <div className="flex items-center gap-2.5 truncate">
              <div className="p-1.5 rounded-xl bg-blue-600 text-white shrink-0"><Sparkles size={14} className="text-amber-300" /></div>
              <div className="overflow-hidden">
                <p className="text-xs font-black text-white leading-tight truncate">Presupuesto por voz</p>
                <p className="text-[10px] text-blue-300/80 font-medium truncate">Dicta y revisa antes de guardar</p>
              </div>
            </div>
          </button>

          {firebaseUser ? (
            <div onClick={() => irA('ajustes')} className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/50 cursor-pointer transition-colors" title="Cuenta vinculada">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-xs text-white uppercase shrink-0">{(firebaseUser.displayName || firebaseUser.email || 'U').charAt(0)}</div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{firebaseUser.displayName || firebaseUser.email?.split('@')[0]}</p>
                <p className="text-[10px] text-emerald-400 truncate">{firebaseUser.email}</p>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => irA('ajustes')} className="w-full flex items-center gap-2.5 p-2 rounded-2xl bg-slate-900/80 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-all text-left cursor-pointer" title="Vincular Google en Configuración">
              <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0"><UserIcon size={15} /></div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-300 truncate">Solo en este dispositivo</p>
                <p className="text-[10px] text-slate-500 truncate">Vincula Google para sincronizar</p>
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* ===================== CONTENIDO ===================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        <header className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"><Menu size={20} /></button>
            <h1 className="font-black text-base tracking-tight truncate max-w-[50vw]">{nombreApp || <>CONTROL<span className="text-blue-500">DE OBRA</span></>}</h1>
          </div>
          {hayDemo && (
            <button type="button" onClick={() => setShowDeleteDemoModal(true)} className="text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"><Trash2 size={11} /> Borrar ejemplos</button>
          )}
        </header>

        <header className="hidden lg:flex bg-white border-b border-slate-200/80 px-8 py-3 items-center justify-between shadow-2xs shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{nombreApp || 'Control de Obra'}</span>
                <span className="text-slate-300 font-normal">/</span>
                <span className="text-blue-600">{TAB_TITULOS[activeTab] || activeTab}</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {companySettings.razonSocial ? `${companySettings.razonSocial} · ${companySettings.tipoEntidad === 'autonomo' ? 'NIF' : 'CIF'} ${companySettings.cif || 'sin indicar'}` : 'Completa los datos de tu empresa en Configuración'}
              </p>
            </div>
            {hayDemo && (
              <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Con datos de ejemplo</span>
                <button type="button" onClick={() => setShowDeleteDemoModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"><Trash2 size={13} /> Borrar ejemplos</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {errorLocal && <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5" title={errorLocal}><AlertTriangle size={13} /> No se guarda en local</span>}
            {firebaseUser ? (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${estadoNube === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-indigo-50 border-indigo-200 text-indigo-800'}`} title={errorNube || 'Sincronizado con la nube de tu cuenta de Google'}>
                {estadoNube === 'guardando' || estadoNube === 'cargando' ? <RefreshCw size={12} className="animate-spin" /> : estadoNube === 'error' ? <CloudOff size={13} /> : <Cloud size={13} />}
                <span className="text-[11px]">{estadoNube === 'guardando' ? 'Guardando en la nube…' : estadoNube === 'cargando' ? 'Cargando nube…' : estadoNube === 'error' ? 'Error de nube' : 'Nube sincronizada'}</span>
              </div>
            ) : (
              <button type="button" onClick={() => irA('ajustes')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer" title="Guardado en este navegador. Vincula Google para sincronizar entre dispositivos.">
                <Save size={13} /><span className="text-[11px]">Guardado en este dispositivo</span>
              </button>
            )}
          </div>
        </header>

        {(() => {
          const dias = diasSinCopiaLocal(companySettings);
          const cada = companySettings.copias?.recordarCadaDias ?? 7;
          if (avisoCopiaCerrado || activeTab === 'ajustes' || (dias !== null && dias < cada)) return null;
          return (
            <div className="mx-4 lg:mx-8 mt-3 p-3 rounded-2xl border border-amber-200 bg-amber-50 text-xs font-bold text-amber-900 flex items-center gap-2">
              <Save size={15} className="shrink-0" />
              <span className="flex-1">{dias === null ? 'No tienes ninguna copia guardada en tu ordenador. Si pierdes la cuenta de Google, lo pierdes todo.' : `Hace ${dias} días de tu última copia local.`}</span>
              <button onClick={() => irA('ajustes')} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-[11px] cursor-pointer shrink-0">Hacer copia</button>
              <button onClick={() => setAvisoCopiaCerrado(true)} className="text-amber-700 hover:text-amber-900 cursor-pointer shrink-0" title="Ocultar hasta la próxima vez que abras"><X size={14} /></button>
            </div>
          );
        })()}

        {conflictoInicial && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><AlertTriangle size={24} /></div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">Hay datos en este dispositivo y en la nube</h3>
                <p className="text-xs text-slate-500">Es la primera vez que vinculas esta cuenta aquí y las dos partes tienen trabajo tuyo. Elige con cuál te quedas; la otra versión queda guardada como copia de seguridad y puedes recuperarla en Configuración.</p>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50"><p className="font-black text-slate-800">En la nube (tu cuenta de Google)</p><p className="text-slate-500 mt-0.5">{conflictoInicial.resumenNube}</p></div>
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50"><p className="font-black text-slate-800">En este dispositivo</p><p className="text-slate-500 mt-0.5">{conflictoInicial.resumenLocal}</p></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => { const r = conflictoInicial.remoto; ultimoRemotoAplicado.current = r.updatedAt; aplicarEstado(r); setConflictoInicial(null); setAviso({ texto: 'Se han cargado los datos de la nube. La versión de este dispositivo queda como copia de seguridad.', tipo: 'ok' }); }} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs cursor-pointer">Quedarme con los de la nube</button>
                <button onClick={() => { pendienteSubida.current = true; setConflictoInicial(null); setAviso({ texto: 'Se conservan los datos de este dispositivo y se subirán a la nube.', tipo: 'info' }); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs cursor-pointer">Quedarme con los de este dispositivo</button>
              </div>
            </div>
          </div>
        )}

        {aviso && (
          <div className={`mx-4 lg:mx-8 mt-3 p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${aviso.tipo === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : aviso.tipo === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
            <CheckCircle2 size={15} className="shrink-0" /> <span className="flex-1">{aviso.texto}</span>
            {aviso.accion && <button onClick={aviso.accion.onClick} className="px-3 py-1.5 bg-slate-900 text-white rounded-xl font-black text-[11px] cursor-pointer shrink-0 flex items-center gap-1"><CalendarDays size={12} /> {aviso.accion.texto}</button>}
            {aviso.fijo && <button onClick={() => setAviso(null)} className="text-slate-500 hover:text-slate-900 cursor-pointer shrink-0" title="Cerrar"><X size={14} /></button>}
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
          {activeTab === 'dashboard' && (
            <DashboardView projects={projects} invoices={invoices} expenses={expenses} bankTransactions={bankTransactions} calendarEvents={calendarEvents} clients={clients} companySettings={companySettings}
              onNavigate={irA} onSelectProject={handleSelectProject}
              onOpenNewInvoice={() => { setPreselectedProjectForInvoice(null); setShowNewInvoiceModal(true); setActiveTab('ventas'); }}
              onOpenNewExpense={() => { setPreselectedProjectForInvoice(null); setShowNewExpenseModal(true); setActiveTab('gastos'); }} />
          )}
          {(activeTab === 'obras' || activeTab === 'presupuestos') && (
            <ProjectsView projects={projects} clients={clients} selectedProjectId={selectedProjectId} companySettings={companySettings} catalogCategories={catalogCategories} catalogItems={catalogItems} kits={kits} calendarEvents={calendarEvents} invoices={invoices}
              firebaseUid={firebaseUser?.uid || null} siguienteCodigo={siguienteCodigoPresupuesto()} modo={activeTab === 'presupuestos' ? 'presupuestos' : 'obras'} abrirCitaDe={citaPendienteDe} onCitaAbierta={() => setCitaPendienteDe(null)}
              onSelectProject={setSelectedProjectId} onCreateProject={handleCreateProject} onUpdateProject={handleUpdateProject} onUpdateProjectStatus={handleUpdateProjectStatus} onUpdateClient={handleUpdateClient}
              onAcceptBudgetAndConvertToObra={handleAcceptBudgetAndConvertToObra} onConfirmarCita={handleConfirmarCita} onDeleteProject={handleDeleteProject} onAddCalendarEvent={handleAddCalendarEvent} onUpdateCalendarEvent={handleUpdateCalendarEvent}
              onAddLog={handleAddProjectLog} onAddDocument={handleAddProjectDocument} onAddPhoto={handleAddProjectPhoto} onGuardarConsumo={handleGuardarConsumo} onOpenNewInvoiceForProject={handleOpenNewInvoiceForProject} onOpenNewExpenseForProject={handleOpenNewExpenseForProject} onAviso={(t, tipo) => setAviso({ texto: t, tipo: tipo || 'info' })} />
          )}
          {activeTab === 'agenda' && (
            <CalendarAgendaView calendarEvents={calendarEvents} projects={projects} clients={clients} companySettings={companySettings}
              onAddCalendarEvent={handleAddCalendarEvent} onUpdateCalendarEvent={handleUpdateCalendarEvent} onDeleteCalendarEvent={handleDeleteCalendarEvent} onConfirmarCita={handleConfirmarCita} onSelectProject={handleSelectProject} onAviso={(t, tipo) => setAviso({ texto: t, tipo: tipo || 'info' })} />
          )}
          {(activeTab === 'catalogo' || activeTab === 'kits') && (
            <MaterialsAndKitsView categories={catalogCategories} items={catalogItems} kits={kits}
              expenses={expenses} companySettings={companySettings}
              onAddItem={handleAddCatalogItem} onUpdateItem={handleUpdateCatalogItem} onDeleteItem={handleDeleteCatalogItem}
              onAddCategory={handleAddCatalogCategory} onPropagarCoste={handlePropagarCoste} onVaciarCatalogo={handleClearAllCatalogItems} onRestaurarCatalogo={handleResetCatalogToDefaults}
              onSaveKit={handleSaveKit} onDeleteKit={handleDeleteKit} onDuplicateKit={handleDuplicateKit} onUsarEnPresupuesto={() => irA('presupuestos')}
              onAviso={(t, tipo) => setAviso({ texto: t, tipo: tipo || 'info' })} />
          )}
          {activeTab === 'ventas' && (
            <SalesView invoices={invoices} clients={clients} projects={projects} companySettings={companySettings} siguienteNumero={siguienteNumeroFactura()} siguienteNumeroRectificativa={siguienteNumeroRectificativa()}
              onCreateInvoice={handleCreateInvoice} onRegistrarCobro={handleRegistrarCobro} onQuitarCobro={handleQuitarCobro} onIrABanco={() => irA('bancos')} onUpdateInvoiceStatus={handleUpdateInvoiceStatus} onUpdateInvoice={handleUpdateInvoice}
              showNewInvoiceModal={showNewInvoiceModal} setShowNewInvoiceModal={setShowNewInvoiceModal} preselectedProject={preselectedProjectForInvoice} onAviso={(t, tipo) => setAviso({ texto: t, tipo: tipo || 'info' })} />
          )}
          {activeTab === 'gastos' && (
            <ExpensesView expenses={expenses} projects={projects} suppliers={suppliers} companySettings={companySettings} catalogItems={catalogItems} onActualizarPrecios={handleActualizarPrecios} onCreateExpense={handleCreateExpense} onCreateSupplier={handleCreateSupplier} onUpdateExpense={handleUpdateExpense} onDeleteExpense={handleDeleteExpense}
              showNewExpenseModal={showNewExpenseModal} setShowNewExpenseModal={setShowNewExpenseModal} preselectedProject={preselectedProjectForInvoice} />
          )}
          {activeTab === 'bancos' && (
            <ReconciliationView bankTransactions={bankTransactions} invoices={invoices} expenses={expenses} companySettings={companySettings} onUpdateCompanySettings={setCompanySettings}
              onReconcileTransaction={handleReconcileTransaction} onUnreconcileTransaction={handleUnreconcileTransaction} onImportTransactions={handleImportTransactions} onDeleteTransaction={handleDeleteTransaction} />
          )}
          {activeTab === 'contactos' && (
            <ClientsView clients={clients} projects={projects} invoices={invoices} onCreateClient={handleCreateClient} onUpdateClient={handleUpdateClient} onDeleteClient={handleDeleteClient} onSelectProject={handleSelectProject} />
          )}
          {activeTab === 'rentabilidad' && <RentabilityView projects={projects} expenses={expenses} invoices={invoices} onSelectProject={handleSelectProject} />}
          {activeTab === 'gestoria' && <TaxClosingView invoices={invoices} expenses={expenses} companySettings={companySettings} bankTransactions={bankTransactions} onNavigate={irA} />}
          {activeTab === 'ajustes' && (
            <SettingsView companySettings={companySettings} onSaveSettings={setCompanySettings} onDeleteExamples={() => setShowDeleteDemoModal(true)} onCargarEjemplos={handleCargarEjemplos} hayDemo={hayDemo}
              estadoCompleto={estadoCompleto} onRestaurarEstado={handleRestaurarEstado} firebaseUser={firebaseUser} estadoNube={estadoNube} errorNube={errorNube} onAviso={(t, tipo) => setAviso({ texto: t, tipo: tipo || 'info' })} />
          )}
        </main>
      </div>

      {/* Portal de aceptación en la misma sesión (presencial, en el móvil del instalador) */}
      {portalProjectId && (() => {
        const targetProj = projects.find((p) => p.id === portalProjectId || p.codigo === portalProjectId);
        if (!targetProj) return null;
        const targetClient = clients.find((c) => c.id === targetProj.clienteId);
        return (
          <ClientAcceptancePortal project={targetProj} companySettings={companySettings} client={targetClient} calendarEvents={calendarEvents} onClose={() => setPortalProjectId(null)}
            onAcceptBudget={(id, firma, hueco) => { handleAcceptBudgetAndConvertToObra(id, { ...firma, metodo: 'presencial' }, hueco); setPortalProjectId(null); setActiveTab('obras'); setSelectedProjectId(id); }} />
        );
      })()}

      <VoiceAIBudgetAssistant isOpen={showGlobalAIAssistant} onClose={() => setShowGlobalAIAssistant(false)} catalogItems={catalogItems} clients={clients} companySettings={companySettings} siguienteCodigo={siguienteCodigoPresupuesto()} onCreateClient={handleCreateClient}
        onBudgetGenerated={(p) => { handleCreateProject(p); setShowGlobalAIAssistant(false); setActiveTab('obras'); }} />

      <OnboardingModal isOpen={showOnboarding} onClose={cerrarGuia} onGoToTab={(t) => { irA(t); cerrarGuia(); }} tipoEntidad={companySettings.tipoEntidad} />

      {showDeleteDemoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto"><AlertTriangle size={24} /></div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-slate-900 text-lg">¿Borrar los datos de ejemplo?</h3>
              <p className="text-xs text-slate-500">Se eliminan los clientes, presupuestos, obras, facturas, gastos, citas y <strong>movimientos bancarios</strong> de ejemplo, y se desvincula la cuenta bancaria de muestra. Los registros que hayas creado tú se conservan.</p>
              <p className="text-[11px] text-slate-500">Se mantienen tu configuración, el logotipo, el catálogo de materiales y los kits (puedes editarlos o borrarlos uno a uno).</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowDeleteDemoModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button>
              <button type="button" onClick={handleDeleteExamples} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md cursor-pointer">Sí, borrar ejemplos</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ id, icon: Icon, label, badge, badgeColor, active, onClick }: { id: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string; badge?: string; badgeColor?: string; active: string; onClick: (id: string) => void }) {
  const isActive = active === id;
  return (
    <button onClick={() => onClick(id)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 group cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
      <div className="flex items-center gap-3 truncate">
        <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400 transition-colors'} />
        <span className="truncate">{label}</span>
      </div>
      {badge && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : badgeColor || 'bg-slate-800 text-slate-300'}`}>{badge}</span>}
    </button>
  );
}
