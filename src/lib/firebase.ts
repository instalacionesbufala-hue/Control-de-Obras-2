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

export const firebaseDisponible = Boolean((firebaseConfig as any).apiKey && (firebaseConfig as any).projectId);

export { signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc, onSnapshot };
export type { User };
