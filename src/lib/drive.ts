// Archivos pesados (fotos, vídeos y documentos) en el Google Drive del propio usuario.
//
// Por qué: las fotos se guardaban dentro del estado de la app, y ese estado viaja a Firestore
// como UN documento con un tope duro de 1 MB. Con dos o tres fotos la nube dejaba de sincronizar.
// Drive da 15 GB gratis y los archivos quedan en carpetas del usuario, que puede copiar a un disco.
//
// El permiso es drive.file: la app solo ve los archivos que ella misma crea, nunca el resto del
// Drive. Es un permiso no sensible, así que no obliga a pasar la verificación de Google.
import { tokenPara, SCOPE_DRIVE, olvidarToken, mensajeErrorGoogle } from './googleToken';

const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
const CARPETA_RAIZ = 'Control de Obra';

export interface ArchivoDrive {
  id: string;
  nombre: string;
  enlace: string; // para abrirlo en el navegador
  tamano?: number;
  mime?: string;
}

async function pedir(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
  if (res.status === 401) {
    olvidarToken();
    throw new Error(mensajeErrorGoogle(401, 'Google Drive API'));
  }
  if (!res.ok) throw new Error(`${mensajeErrorGoogle(res.status, 'Google Drive API')} ${(await res.text()).substring(0, 160)}`);
  return res.json();
}

// Busca una carpeta por nombre dentro de otra; si no existe, la crea
async function carpeta(token: string, nombre: string, padre?: string): Promise<string> {
  const q = [`name='${nombre.replace(/'/g, "\\'")}'`, "mimeType='application/vnd.google-apps.folder'", 'trashed=false', padre ? `'${padre}' in parents` : "'root' in parents"].join(' and ');
  const busca = await pedir(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, token);
  if (busca.files?.[0]?.id) return busca.files[0].id;
  const creada = await pedir(`${API}/files?fields=id`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: padre ? [padre] : undefined }),
  });
  return creada.id;
}

const cacheCarpetas = new Map<string, string>();

// Carpeta de una obra: "Control de Obra / OB-2026-001 Nombre de la obra"
export async function carpetaDeObra(codigo: string, nombre: string): Promise<{ token: string; carpetaId: string }> {
  const token = await tokenPara(SCOPE_DRIVE);
  const clave = `${codigo}|${nombre}`;
  const cacheada = cacheCarpetas.get(clave);
  if (cacheada) return { token, carpetaId: cacheada };
  const raiz = await carpeta(token, CARPETA_RAIZ);
  const limpio = `${codigo} ${nombre}`.replace(/[\\/:*?"<>|]/g, '-').substring(0, 90).trim();
  const id = await carpeta(token, limpio, raiz);
  cacheCarpetas.set(clave, id);
  return { token, carpetaId: id };
}

// Sube un archivo a la carpeta de la obra y devuelve su referencia
export async function subirADrive(blob: Blob, nombreArchivo: string, codigoObra: string, nombreObra: string): Promise<ArchivoDrive> {
  const { token, carpetaId } = await carpetaDeObra(codigoObra, nombreObra);
  const metadatos = { name: nombreArchivo, parents: [carpetaId] };
  const limite = `-------obracontrol${Math.random().toString(36).substring(2)}`;
  const cuerpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadatos)}\r\n`,
    `--${limite}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${limite}--\r\n`,
  ]);
  const res = await fetch(`${SUBIDA}?uploadType=multipart&fields=id,name,size,mimeType,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  if (res.status === 401) {
    olvidarToken();
    throw new Error(mensajeErrorGoogle(401, 'Google Drive API'));
  }
  if (!res.ok) throw new Error(`${mensajeErrorGoogle(res.status, 'Google Drive API')} ${(await res.text()).substring(0, 160)}`);
  const j = await res.json();
  return { id: j.id, nombre: j.name, enlace: j.webViewLink || `https://drive.google.com/file/d/${j.id}/view`, tamano: Number(j.size) || blob.size, mime: j.mimeType || blob.type };
}

export async function borrarDeDrive(fileId: string): Promise<void> {
  const token = await tokenPara(SCOPE_DRIVE);
  await pedir(`${API}/files/${fileId}`, token, { method: 'DELETE' }).catch(() => undefined);
}

// Enlace a la carpeta de la obra, para abrirla en Drive y copiarla a un disco
export function enlaceCarpeta(carpetaId: string): string {
  return `https://drive.google.com/drive/folders/${carpetaId}`;
}

// ---- Compresión antes de subir ----

// Reduce una imagen manteniendo una calidad razonable para documentar una instalación.
// Una foto de móvil de 4 MB baja a unos 300-500 KB sin que se deje de leer una etiqueta.
export function comprimirFoto(file: File, maxLado = 1920, calidad = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen.'))), 'image/jpeg', calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

// Miniatura muy pequeña que sí cabe en el estado, para verla sin bajar nada de Drive
export function miniatura(file: Blob, lado = 320, calidad = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

// Primer fotograma de un vídeo, para tener una miniatura sin guardar el vídeo en el estado
export function fotogramaDeVideo(file: File, lado = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    const limpiar = () => URL.revokeObjectURL(url);
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 4);
    };
    v.onseeked = () => {
      const escala = Math.min(1, lado / Math.max(v.videoWidth || lado, v.videoHeight || lado));
      const c = document.createElement('canvas');
      c.width = Math.round((v.videoWidth || lado) * escala);
      c.height = Math.round((v.videoHeight || lado) * escala);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      limpiar();
      resolve(c.toDataURL('image/jpeg', 0.6));
    };
    v.onerror = () => { limpiar(); reject(new Error('No se pudo leer el vídeo.')); };
    v.src = url;
  });
}

export const esImagen = (f: File) => f.type.startsWith('image/');
export const esVideo = (f: File) => f.type.startsWith('video/');

export function tamanoLegible(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Preparar un archivo para guardarlo en una obra ----
// Con Drive disponible: se comprime si es imagen, se sube el original y en la app queda solo
// una miniatura de unos 20 KB. Sin Drive: se guarda dentro del estado, con el tope de siempre.

export interface MediaPreparada {
  url: string; // miniatura o data URL si no hay Drive
  titulo: string;
  nombreArchivo: string;
  tamano: number;
  esVideo: boolean;
  driveFileId?: string;
  driveEnlace?: string;
  aviso?: string;
}

const leerComoDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result as string);
  r.onerror = () => rej(new Error('No se pudo leer el archivo.'));
  r.readAsDataURL(b);
});

export async function prepararMedia(
  file: File,
  obra: { codigo: string; nombre: string },
  opciones: { hayDrive: boolean; limiteSinDrive: number },
): Promise<MediaPreparada> {
  const video = esVideo(file);
  const imagen = esImagen(file);
  const base = { titulo: file.name.replace(/\.[^.]+$/, '').substring(0, 60), nombreArchivo: file.name, esVideo: video };

  // Lo que se sube: las fotos comprimidas, el resto tal cual
  const paraSubir: Blob = imagen ? await comprimirFoto(file) : file;

  if (opciones.hayDrive) {
    const nombre = imagen && !/\.jpe?g$/i.test(file.name) ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
    const subido = await subirADrive(paraSubir, nombre, obra.codigo, obra.nombre);
    const mini = imagen ? await miniatura(paraSubir) : video ? await fotogramaDeVideo(file).catch(() => '') : '';
    const ahorro = imagen && file.size > paraSubir.size ? ` Comprimida de ${tamanoLegible(file.size)} a ${tamanoLegible(paraSubir.size)}.` : '';
    return { ...base, url: mini, tamano: subido.tamano || paraSubir.size, driveFileId: subido.id, driveEnlace: subido.enlace, aviso: `Guardada en tu Drive, carpeta «${CARPETA_RAIZ} / ${obra.codigo}».${ahorro}` };
  }

  // Sin Drive: solo cabe lo pequeño, y ocupa del límite de 1 MB de la nube
  if (video) throw new Error('Los vídeos necesitan Google Drive. Vincula tu cuenta de Google en Configuración.');
  const comprimida = imagen ? await comprimirFoto(file, 1280, 0.7) : file;
  if (comprimida.size > opciones.limiteSinDrive) {
    throw new Error(`El archivo ocupa ${tamanoLegible(comprimida.size)} y sin Google Drive el tope es ${tamanoLegible(opciones.limiteSinDrive)}. Vincula tu cuenta de Google para guardarlo sin límite.`);
  }
  return { ...base, url: await leerComoDataUrl(comprimida), tamano: comprimida.size, aviso: 'Guardada dentro de la app. Vincula Google Drive para no gastar espacio de la nube.' };
}
