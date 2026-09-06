// Sincronización con la nube (Firestore) y copia de seguridad en la nube.
// - Al iniciar sesión con Google se carga el estado de la nube y se escucha en tiempo real:
//   si otro dispositivo guarda, este se actualiza solo (gana el último que guarda).
// - Cada cambio local se sube con un pequeño retardo. Se ignoran los ecos del propio
//   dispositivo comparando deviceId + updatedAt.
import { auth, db, googleProvider, signInWithPopup, signOut, doc, setDoc, getDoc, onSnapshot, User } from './firebase';
import firebaseConfig from '../../firebase-config.json';
import { AppState } from '../types';
import { migrarEstado } from './storage';

export const loginWithGoogle = async (): Promise<User | null> => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

// Traduce los errores de Firebase Auth a algo accionable. El más habitual al publicar la app en
// un dominio nuevo es 'auth/unauthorized-domain': hay que añadirlo en la consola de Firebase.
export function mensajeErrorAuth(e: any): string {
  const code = e?.code || '';
  const dominio = typeof window !== 'undefined' ? window.location.hostname : 'este dominio';
  const proyecto = (firebaseConfig as any).projectId || '';
  switch (code) {
    case 'auth/unauthorized-domain':
      return `El dominio "${dominio}" no está autorizado en Firebase. Entra en la consola de Firebase del proyecto ${proyecto} → Authentication → Settings → Authorized domains → Add domain, escribe exactamente ${dominio} (sin https:// y sin la barra final) y vuelve a intentarlo.`;
    case 'auth/operation-not-allowed':
      return `Falta habilitar el acceso con Google. Consola de Firebase → Authentication → Sign-in method → Google → Habilitar.`;
    case 'auth/configuration-not-found':
      return `Este proyecto de Firebase (${proyecto}) todavía no tiene Authentication activado. Entra en la consola de Firebase → Authentication → Comenzar, y habilita el proveedor Google.`;
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Ventana de Google cerrada sin iniciar sesión.';
    case 'auth/popup-blocked':
      return 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para este sitio y vuelve a pulsar.';
    case 'auth/network-request-failed':
      return 'No hay conexión con Google. Comprueba tu red y vuelve a intentarlo.';
    default:
      return `No se pudo iniciar sesión: ${e?.message || e}`;
  }
}

export const logoutGoogleUser = async (): Promise<void> => {
  await signOut(auth);
};

const refPrincipal = (userId: string) => doc(db, 'users', userId, 'appData', 'main');
const refCopia = (userId: string, nombre: string) => doc(db, 'users', userId, 'backups', nombre);

// Firestore no admite undefined: limpiamos el objeto antes de subirlo
function limpiarUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export const guardarEstadoEnNube = async (userId: string, state: AppState): Promise<void> => {
  await setDoc(refPrincipal(userId), limpiarUndefined(state));
};

export const cargarEstadoDeNube = async (userId: string): Promise<AppState | null> => {
  const snap = await getDoc(refPrincipal(userId));
  if (!snap.exists()) return null;
  return migrarEstado(snap.data());
};

// Escucha en tiempo real. El callback recibe el estado remoto cada vez que cambia.
export const escucharEstadoNube = (userId: string, onCambio: (estado: AppState, meta: { deviceId?: string; updatedAt: string }) => void, onError?: (e: Error) => void) => {
  return onSnapshot(
    refPrincipal(userId),
    (snap) => {
      if (!snap.exists()) return;
      if (snap.metadata.hasPendingWrites) return; // es nuestra propia escritura aún no confirmada
      const data = snap.data();
      const st = migrarEstado(data);
      if (st) onCambio(st, { deviceId: data.deviceId, updatedAt: data.updatedAt || '' });
    },
    (err) => onError?.(err as Error)
  );
};

export const guardarCopiaEnNube = async (userId: string, state: AppState, nota?: string): Promise<{ nombre: string; fecha: string }> => {
  const fecha = new Date().toISOString();
  const nombre = `copia-${fecha.replace(/[:.]/g, '-')}`;
  await setDoc(refCopia(userId, nombre), limpiarUndefined({ ...state, backupNota: nota || 'Copia manual', backupFecha: fecha }));
  // Además, mantenemos "ultima" para restaurar con un clic
  await setDoc(refCopia(userId, 'ultima'), limpiarUndefined({ ...state, backupNota: nota || 'Copia manual', backupFecha: fecha }));
  return { nombre, fecha };
};

export const cargarUltimaCopiaNube = async (userId: string): Promise<{ estado: AppState; fecha?: string } | null> => {
  const snap = await getDoc(refCopia(userId, 'ultima'));
  if (!snap.exists()) return null;
  const data = snap.data();
  const st = migrarEstado(data);
  return st ? { estado: st, fecha: data.backupFecha } : null;
};

// Tamaño aproximado: Firestore limita cada documento a 1 MiB
export const tamanoDocumentoKB = (state: AppState): number => Math.round(JSON.stringify(limpiarUndefined(state)).length / 1024);
export const LIMITE_FIRESTORE_KB = 1000;
