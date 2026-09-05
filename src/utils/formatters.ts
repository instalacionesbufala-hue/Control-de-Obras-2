// Formateadores en español (moneda, fechas, números)
import { fechaES, fechaHoraES } from './dates';

export function formatCurrency(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${formatNumber(n, decimals)} %`;
}

// Acepta YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss; si trae hora la muestra
export function formatDate(dateString?: string): string {
  if (!dateString) return '';
  if (dateString.includes('T')) return fechaHoraES(dateString);
  return fechaES(dateString);
}

export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Genera un id único legible: prefijo + tiempo + aleatorio
export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

// Limpia un teléfono para wa.me (solo dígitos, con 34 delante si falta el prefijo)
export function telefonoWhatsApp(tel?: string): string {
  const digits = (tel || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 9) return `34${digits}`;
  return digits;
}

// Formatea una numeración con año: "FAC-{AAAA}-" + 001
export function numeroDocumento(prefijo: string, siguiente: number, anio = new Date().getFullYear()): string {
  const base = prefijo.includes('{AAAA}') ? prefijo.replace('{AAAA}', String(anio)) : prefijo;
  return `${base}${String(siguiente).padStart(3, '0')}`;
}
