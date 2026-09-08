// Enlace público de aceptación: el presupuesto se publica en Firestore en un documento con un
// token aleatorio que el cliente abre desde su móvil sin iniciar sesión. El cliente acepta
// (nombre, DNI, fecha/hora y firma dibujada si se le exige) y elige un hueco entre los
// propuestos. La aceptación se escribe en una subcolección y la app del instalador la recibe
// en tiempo real y convierte el presupuesto en obra. Nunca se publican costes internos.
import { textoPrivacidad } from '../data/privacidad';
import { rellenarTexto } from './textos';
import { collection, doc, getDoc, setDoc, addDoc, onSnapshot, query, limit, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CompanySettings, FirmaCliente, HuecoPropuesto, Project } from '../types';

export interface PropuestaPublica {
  token: string;
  ownerUid: string;
  publicadaEl: string;
  empresa: {
    nombre: string;
    razonSocial: string;
    nif: string;
    direccion: string;
    telefono: string;
    email: string;
    logoUrl?: string;
    plantilla?: string;
    avisoUrl?: string; // Apps Script del instalador que le envía un correo al aceptar
  };
  presupuesto: {
    id: string;
    codigo: string;
    nombre: string;
    fecha: string;
    validezDias: number;
    clienteNombre: string;
    clienteNif?: string;
    direccion: string;
    baseImponible: number;
    ivaTotal: number;
    total: number;
    notaFinal?: string;
    sinImpuestos?: boolean;
    motivoSinImpuestos?: string;
    lineas: Array<{ concepto: string; cantidad: number; unidad: string; precioUnitario: number; ivaPorcentaje: number; total: number; materiales?: Array<{ nombre: string; cantidad: number; unidad: string }> }>;
  };
  exigirFirma: boolean;
  // Información de protección de datos que se enseña al cliente antes de firmar
  privacidad?: { resumen: string; detalle: string };
  huecos: HuecoPropuesto[];
  estado: 'abierta' | 'aceptada' | 'rechazada' | 'caducada';
}

export interface AceptacionPublica {
  firmadoPor: string;
  dni: string;
  fechaFirma: string;
  trazoFirma?: string;
  codigoAceptacion: string;
  huecoElegido?: HuecoPropuesto;
  notasCliente?: string;
  informadoProteccionDatos?: boolean;
  userAgent?: string;
}

export function generarToken(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function construirPropuesta(project: Project, settings: CompanySettings, ownerUid: string, token: string, exigirFirma: boolean, huecos: HuecoPropuesto[], clienteNif?: string): PropuestaPublica {
  const lineas = (project.partidas || []).map((p) => ({
    concepto: p.concepto,
    cantidad: p.cantidad,
    unidad: p.unidad,
    precioUnitario: p.precioUnitario,
    ivaPorcentaje: p.ivaPorcentaje,
    total: p.total,
    materiales: (p.materiales || []).filter((m) => m.visibleCliente).map((m) => ({ nombre: m.nombre, cantidad: m.cantidad * p.cantidad, unidad: m.unidad })),
  }));
  const base = lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario, 0) || project.presupuestoAceptado;
  const iva = project.sinImpuestos ? 0 : lineas.reduce((a, l) => a + l.cantidad * l.precioUnitario * (l.ivaPorcentaje / 100), 0) || project.presupuestoAceptado * 0.21;
  return {
    token,
    ownerUid,
    publicadaEl: new Date().toISOString(),
    empresa: {
      nombre: settings.nombreComercial || settings.razonSocial,
      razonSocial: settings.razonSocial,
      nif: settings.cif,
      direccion: [settings.direccion, settings.codigoPostal, settings.ciudad].filter(Boolean).join(', '),
      telefono: settings.telefono,
      email: settings.email,
      logoUrl: settings.logoUrl && settings.logoUrl.length < 200000 ? settings.logoUrl : undefined,
      plantilla: project.plantillaPresupuesto,
      avisoUrl: settings.avisoScriptUrl || undefined,
    },
    presupuesto: {
      id: project.id,
      codigo: project.codigo,
      nombre: project.nombre,
      fecha: project.fechaInicio,
      validezDias: settings.diasValidezPresupuesto || 30,
      clienteNombre: project.clienteNombre,
      clienteNif,
      direccion: project.direccion,
      baseImponible: Math.round(base * 100) / 100,
      ivaTotal: Math.round(iva * 100) / 100,
      total: Math.round((base + iva) * 100) / 100,
      notaFinal: rellenarTexto(project.notaFinal || settings.notaFinalPresupuestoDefecto, { validez: settings.diasValidezPresupuesto, vencimiento: settings.diasVencimientoFactura }),
      sinImpuestos: project.sinImpuestos || undefined,
      motivoSinImpuestos: project.sinImpuestos ? project.motivoSinImpuestos : undefined,
      lineas,
    },
    exigirFirma,
    privacidad: textoPrivacidad(settings),
    huecos,
    estado: 'abierta',
  };
}

const refPropuesta = (token: string) => doc(db, 'propuestas', token);

export async function publicarPropuesta(p: PropuestaPublica): Promise<void> {
  await setDoc(refPropuesta(p.token), JSON.parse(JSON.stringify(p)));
}

export async function cerrarPropuesta(token: string, estado: PropuestaPublica['estado']): Promise<void> {
  try {
    const snap = await getDoc(refPropuesta(token));
    if (snap.exists()) await setDoc(refPropuesta(token), { ...snap.data(), estado }, { merge: true });
  } catch (e) {
    console.warn('No se pudo cerrar la propuesta pública:', e);
  }
}

export async function borrarPropuesta(token: string): Promise<void> {
  try {
    await deleteDoc(refPropuesta(token));
  } catch {
    // sin permisos o ya borrada
  }
}

export async function leerPropuesta(token: string): Promise<PropuestaPublica | null> {
  const snap = await getDoc(refPropuesta(token));
  return snap.exists() ? (snap.data() as PropuestaPublica) : null;
}

export async function enviarAceptacion(token: string, a: AceptacionPublica): Promise<void> {
  await addDoc(collection(db, 'propuestas', token, 'aceptaciones'), JSON.parse(JSON.stringify({ ...a, enviadaEl: new Date().toISOString() })));
}

// El instalador escucha las aceptaciones de sus propuestas abiertas
export function escucharAceptaciones(token: string, onAceptacion: (a: AceptacionPublica) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    query(collection(db, 'propuestas', token, 'aceptaciones'), limit(5)),
    (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type === 'added') onAceptacion(ch.doc.data() as AceptacionPublica);
      });
    },
    (err) => onError?.(err as Error)
  );
}

export function firmaDesdeAceptacion(a: AceptacionPublica): FirmaCliente {
  return { firmadoPor: a.firmadoPor, dni: a.dni, fechaFirma: a.fechaFirma, trazoFirma: a.trazoFirma, codigoAceptacion: a.codigoAceptacion, metodo: 'portal', informadoProteccionDatos: a.informadoProteccionDatos };
}

export function enlacePropuesta(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${base}?aceptar=${encodeURIComponent(token)}`;
}
