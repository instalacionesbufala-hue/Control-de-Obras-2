// Utilidades criptográficas y de enlace de aceptación de presupuestos
// Compatible con el estándar ACP1 y SHA-256 para validación de clientes

export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Codificador Base64-URL seguro
export const b64u = {
  enc: (str: string) => {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec: (str: string) => {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  },
};

export interface DatosAceptacion {
  v: number;      // Versión del protocolo (1)
  n: string;      // Número o código del presupuesto
  h: string;      // Hash de integridad del presupuesto
  t: string;      // Fecha y hora (ISO)
  nm: string;     // Nombre del aceptante
  d: string;      // DNI / CIF del aceptante
  f?: string;     // Hash o presencia de la firma
}

export function generarCodigoAceptacion(datos: DatosAceptacion): string {
  const json = JSON.stringify(datos);
  return `ACP1.${b64u.enc(json)}`;
}

export function leerCodigoAceptacion(texto: string): DatosAceptacion | null {
  if (!texto) return null;
  const m = String(texto).match(/ACP1\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    return JSON.parse(b64u.dec(m[1]));
  } catch (e) {
    return null;
  }
}

// Validación de DNI/NIE/CIF español
export function validarDniCif(doc: string): { valido: boolean; mensaje?: string } {
  const limpio = (doc || '').trim().toUpperCase().replace(/[\s.-]/g, '');
  if (!limpio) {
    return { valido: false, mensaje: 'El DNI/CIF es obligatorio para tramitar la obra y la factura.' };
  }
  if (limpio.length < 8 || limpio.length > 10) {
    return { valido: false, mensaje: 'El documento debe tener entre 8 y 9 caracteres (letras y números).' };
  }
  // Formato básico de DNI, NIE o CIF
  const regex = /^[XYZKLM0-9][0-9]{7}[A-Z0-9]$|^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/;
  if (!regex.test(limpio) && !/^[A-Z0-9]{8,10}$/.test(limpio)) {
    return { valido: false, mensaje: 'Revisa el formato del DNI/CIF (ej: 12345678Z o B12345678).' };
  }
  return { valido: true };
}
