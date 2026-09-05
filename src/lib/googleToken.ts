// Token OAuth de Google para las APIs que usa la app (Calendar y Gmail), obtenido con Firebase Auth.
// Se piden los dos permisos a la vez para que una sola ventana de Google sirva para ambos.
// El token dura una hora y se guarda solo en sessionStorage (se pierde al cerrar la pestaña).
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

export const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar.events';
export const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.send';
const KEY_TOKEN = 'obracontrol_google_token';

export interface TokenGoogle {
  accessToken: string;
  expira: number;
  email?: string;
  scopes: string[];
}

export function leerToken(): TokenGoogle | null {
  try {
    const raw = sessionStorage.getItem(KEY_TOKEN);
    if (!raw) return null;
    const t = JSON.parse(raw) as TokenGoogle;
    return t.expira > Date.now() + 30000 ? t : null;
  } catch {
    return null;
  }
}

export function tieneToken(scope?: string): boolean {
  const t = leerToken();
  return !!t && (!scope || t.scopes.includes(scope));
}

export function olvidarToken() {
  try {
    sessionStorage.removeItem(KEY_TOKEN);
  } catch {
    // ignorar
  }
}

// Abre la ventana de Google y devuelve un token con los permisos indicados
export async function pedirPermisoGoogle(scopes: string[] = [SCOPE_CALENDAR, SCOPE_GMAIL]): Promise<TokenGoogle> {
  const provider = new GoogleAuthProvider();
  scopes.forEach((s) => provider.addScope(s));
  provider.setCustomParameters({ prompt: 'consent select_account' });
  const result = await signInWithPopup(auth, provider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  if (!cred?.accessToken) throw new Error('Google no ha devuelto un token de acceso.');
  const t: TokenGoogle = { accessToken: cred.accessToken, expira: Date.now() + 55 * 60 * 1000, email: result.user.email || undefined, scopes };
  try {
    sessionStorage.setItem(KEY_TOKEN, JSON.stringify(t));
  } catch {
    // sin sessionStorage: se pedirá de nuevo
  }
  return t;
}

// Devuelve un token válido para el permiso pedido; si no lo hay, lo solicita
export async function tokenPara(scope: string): Promise<string> {
  const t = leerToken();
  if (t && t.scopes.includes(scope)) return t.accessToken;
  const nuevo = await pedirPermisoGoogle([SCOPE_CALENDAR, SCOPE_GMAIL]);
  return nuevo.accessToken;
}

export function mensajeErrorGoogle(status: number, api: string): string {
  if (status === 401) return `El permiso de Google ha caducado. Vuelve a pulsar para concederlo de nuevo.`;
  if (status === 403) return `Google ha rechazado la petición (403). Habilita "${api}" en el proyecto de Google Cloud de la app y añade tu cuenta como usuario de prueba en la pantalla de consentimiento.`;
  return `Google respondió ${status}.`;
}
