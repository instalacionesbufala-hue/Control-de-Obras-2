// Registro de facturación VERI*FACTU (RD 1007/2023 y Orden HAC/1177/2024).
// Huella SHA-256 en UTF-8 sobre una cadena de campos en orden fijo, salida hexadecimal en mayúsculas.
// La cadena y los vectores de prueba proceden del documento oficial de la AEAT
// "Veri-Factu_especificaciones_huella_hash_registros" y ya se han verificado en el servidor
// Node del proyecto hermano (scripts/test-huella.mjs).
//
// Límite honesto: desde un navegador no se puede firmar ni enviar el registro a la AEAT (hace
// falta el certificado del representante en un servidor). Aquí se genera el registro completo
// (cadena, huella encadenada y QR de cotejo) y queda "pendiente de envío".

import { RegistroVerifactu, TipoFacturaVerifactu } from '../types';

export const dec2 = (n: number) => (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);

export const fechaAEAT = (iso: string) => {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}-${m}-${y}`;
};

// Marca de tiempo con huso horario del dispositivo, p. ej. 2027-01-15T10:20:30+01:00
export function fechaHoraHuso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const s = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}

export async function sha256HexUpper(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function cadenaAlta(p: {
  nif: string;
  numero: string;
  fecha: string;
  tipoFactura: TipoFacturaVerifactu;
  cuotaTotal: number;
  importeTotal: number;
  huellaAnterior: string;
  fechaHoraGen: string;
}): string {
  return `IDEmisorFactura=${p.nif}&NumSerieFactura=${p.numero}&FechaExpedicionFactura=${fechaAEAT(p.fecha)}&TipoFactura=${p.tipoFactura}&CuotaTotal=${dec2(p.cuotaTotal)}&ImporteTotal=${dec2(p.importeTotal)}&Huella=${p.huellaAnterior || ''}&FechaHoraHusoGenRegistro=${p.fechaHoraGen}`;
}

export function cadenaAnulacion(p: { nif: string; numero: string; fecha: string; huellaAnterior: string; fechaHoraGen: string }): string {
  return `IDEmisorFacturaAnulada=${p.nif}&NumSerieFacturaAnulada=${p.numero}&FechaExpedicionFacturaAnulada=${fechaAEAT(p.fecha)}&Huella=${p.huellaAnterior || ''}&FechaHoraHusoGenRegistro=${p.fechaHoraGen}`;
}

// NIF tal y como debe ir en la cadena y en el QR: sin guiones ni espacios, en mayúsculas
export function nifLimpio(nif: string): string {
  return (nif || '').replace(/[\s.-]/g, '').toUpperCase();
}

// URL de cotejo del QR (servicio de validación de la AEAT). La fecha va en dd-mm-aaaa.
export function urlCotejoQR(p: { nif: string; numero: string; fecha: string; importeTotal: number }, entorno: 'produccion' | 'pruebas' = 'produccion'): string {
  const host = entorno === 'pruebas' ? 'https://prewww2.aeat.es' : 'https://www2.agenciatributaria.gob.es';
  const q = new URLSearchParams({
    nif: nifLimpio(p.nif),
    numserie: p.numero,
    fecha: fechaAEAT(p.fecha),
    importe: dec2(p.importeTotal),
  });
  return `${host}/wlpl/TIKE-CONT/ValidarQR?${q.toString()}`;
}

export const SISTEMA_EMISOR = 'Control de Obra · sistema informático de facturación propio (modalidad VERI*FACTU)';

export async function generarRegistroAlta(p: {
  nifEmisor: string;
  numero: string;
  fecha: string;
  cuotaTotal: number;
  importeTotal: number;
  huellaAnterior: string;
  tipoFactura?: TipoFacturaVerifactu;
  rectificativa?: { tipo: 'S' | 'I'; rectificadas: Array<{ numero: string; fecha: string }>; baseRectificada?: number; cuotaRectificada?: number };
}): Promise<RegistroVerifactu> {
  const fechaHoraGen = fechaHoraHuso();
  const tipoFactura = p.tipoFactura || 'F1';
  const cadena = cadenaAlta({
    nif: nifLimpio(p.nifEmisor),
    numero: p.numero,
    fecha: p.fecha,
    tipoFactura,
    cuotaTotal: p.cuotaTotal,
    importeTotal: p.importeTotal,
    huellaAnterior: p.huellaAnterior,
    fechaHoraGen,
  });
  const huella = await sha256HexUpper(cadena);
  return {
    registrada: true,
    tipoFactura,
    fechaHoraHuso: fechaHoraGen,
    cadena,
    huellaHash: huella,
    hashAnterior: p.huellaAnterior || '',
    codigoQR: urlCotejoQR({ nif: p.nifEmisor, numero: p.numero, fecha: p.fecha, importeTotal: p.importeTotal }),
    sistemaEmisor: SISTEMA_EMISOR,
    estadoEnvio: 'pendiente',
    ...(p.rectificativa ? { tipoRectificativa: p.rectificativa.tipo, facturasRectificadas: p.rectificativa.rectificadas, importeRectificacion: p.rectificativa.tipo === 'S' ? { baseRectificada: p.rectificativa.baseRectificada || 0, cuotaRectificada: p.rectificativa.cuotaRectificada || 0 } : undefined } : {}),
  };
}

// Tipos de factura rectificativa (art. 80 LIVA y RD 1619/2012)
export const TIPOS_RECTIFICATIVA: Array<{ codigo: TipoFacturaVerifactu; nombre: string; descripcion: string }> = [
  { codigo: 'R1', nombre: 'R1 · Error fundado en derecho y art. 80.Uno/Dos/Seis', descripcion: 'Error en datos, precio, IVA aplicado, descuentos o devoluciones' },
  { codigo: 'R2', nombre: 'R2 · Concurso de acreedores (art. 80.Tres)', descripcion: 'El cliente ha entrado en concurso' },
  { codigo: 'R3', nombre: 'R3 · Crédito incobrable (art. 80.Cuatro)', descripcion: 'Impago que cumple los plazos para recuperar el IVA' },
  { codigo: 'R4', nombre: 'R4 · Resto de causas', descripcion: 'Cualquier otro motivo de rectificación' },
];

// Recalcula la huella de cada factura registrada y comprueba el encadenamiento.
export async function verificarCadena(facturas: Array<{ numero: string; verifactu: RegistroVerifactu }>): Promise<{ ok: boolean; errores: string[] }> {
  const errores: string[] = [];
  const registradas = facturas.filter((f) => f.verifactu?.registrada && f.verifactu.cadena);
  // Orden por FechaHoraHusoGenRegistro
  registradas.sort((a, b) => a.verifactu.fechaHoraHuso.localeCompare(b.verifactu.fechaHoraHuso));
  let anterior = '';
  for (const f of registradas) {
    const h = await sha256HexUpper(f.verifactu.cadena);
    if (h !== f.verifactu.huellaHash) errores.push(`${f.numero}: la huella guardada no coincide con la cadena.`);
    if (f.verifactu.hashAnterior !== anterior) errores.push(`${f.numero}: la huella anterior no enlaza con la factura previa.`);
    anterior = f.verifactu.huellaHash;
  }
  return { ok: errores.length === 0, errores };
}

// Vectores oficiales de la AEAT para autocomprobación del algoritmo
export const VECTORES_AEAT = [
  {
    cadena: 'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00',
    huella: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
  },
  {
    cadena: 'IDEmisorFactura=89890001K&NumSerieFactura=12345679/G34&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60&FechaHoraHusoGenRegistro=2024-01-01T19:20:35+01:00',
    huella: 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97',
  },
];

export async function autocomprobarAlgoritmo(): Promise<boolean> {
  for (const v of VECTORES_AEAT) {
    if ((await sha256HexUpper(v.cadena)) !== v.huella) return false;
  }
  return true;
}

// Exporta el libro de facturas emitidas para la gestoría (sin estimaciones fiscales)
export function csvLibroEmitidas(facturas: Array<{
  numero: string; fecha: string; clienteNombre: string; clienteNif: string; obraNombre?: string;
  baseImponible: number; ivaTotal: number; irpfTotal?: number; total: number; estado: string; verifactu: RegistroVerifactu;
}>): string {
  const filas = [
    ['Nº Factura', 'Tipo', 'Rectifica a', 'Fecha', 'Cliente', 'NIF', 'Obra', 'Base imponible', 'Cuota IVA', 'Retención IRPF', 'Total', 'Estado cobro', 'Huella VERI*FACTU', 'Envío AEAT'],
    ...facturas.map((f) => [
      f.numero,
      f.verifactu?.tipoFactura || 'F1',
      (f.verifactu?.facturasRectificadas || []).map((r) => r.numero).join(' '),
      fechaAEAT(f.fecha),
      `"${(f.clienteNombre || '').replace(/"/g, '""')}"`,
      f.clienteNif,
      `"${(f.obraNombre || '').replace(/"/g, '""')}"`,
      dec2(f.baseImponible).replace('.', ','),
      dec2(f.ivaTotal).replace('.', ','),
      dec2(f.irpfTotal || 0).replace('.', ','),
      dec2(f.total).replace('.', ','),
      f.estado,
      f.verifactu?.huellaHash || '',
      f.verifactu?.estadoEnvio || '',
    ]),
  ];
  return '﻿' + filas.map((r) => r.join(';')).join('\r\n');
}
