// Sincronización con la nube (Firestore) y copia de seguridad en la nube.
// - Al iniciar sesión con Google se carga el estado de la nube y se escucha en tiempo real:
//   si otro dispositivo guarda, este se actualiza solo (gana el último que guarda).
// - Cada cambio local se sube con un pequeño retardo. Se ignoran los ecos del propio
//   dispositivo comparando deviceId + updatedAt.
import { auth, db, googleProvider, signInWithPopup, signOut, doc, setDoc, getDoc, onSnapshot, User } from './firebase';
import { AppState } from '../types';
import { migrarEstado } from './storage';

export const loginWithGoogle = async (): Promise<User | null> => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

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
