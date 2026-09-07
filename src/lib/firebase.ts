// Inicialización de Firebase (Auth con Google + Firestore con caché local).
// La configuración se lee de firebase-config.json (configuración pública del proyecto, no un
// secreto: lo que protege los datos son las reglas de Firestore y los dominios autorizados).
// Para instalar la app en otra empresa basta con sustituir ese archivo por el de su propio
// proyecto de Firebase. Pasos en docs/PROYECTO-FIREBASE-PROPIO.md.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, setDoc, getDoc, onSnapshot, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
let dbInstance;
try {
  dbInstance = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, dbId);
} catch {
  dbInstance = getFirestore(app, dbId);
}

export const db = dbInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const cfg = firebaseConfig as Record<string, string>;
// Los huecos del archivo de ejemplo empiezan por PEGA_AQUI_: mientras estén sin rellenar,
// la nube no puede funcionar y conviene decirlo en vez de fallar de forma rara.
const faltaAlgo = ['apiKey', 'appId', 'projectId'].some((k) => !cfg[k] || cfg[k].startsWith('PEGA_AQUI_'));
// Una clave copiada de la consola mientras estaba oculta trae puntos de máscara (•) y engaña,
// porque mide lo mismo que la buena. Se comprueba el formato real.
export const claveMalCopiada = Boolean(cfg.apiKey) && !cfg.apiKey.startsWith('PEGA_AQUI_') && !/^AIza[0-9A-Za-z_-]{35}$/.test(cfg.apiKey);
export const configPendiente = faltaAlgo || claveMalCopiada;
export const proyectoFirebase = cfg.projectId || '';
export const firebaseDisponible = Boolean(cfg.apiKey && cfg.projectId) && !configPendiente;

export { signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc, onSnapshot };
export type { User };
