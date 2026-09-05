// Envío de correos con adjunto PDF desde la propia cuenta de Gmail del usuario (API de Gmail,
// permiso gmail.send). El correo sale de su cuenta y queda en su carpeta "Enviados".
// No pasa por ningún servidor de la app ni por terceros.
import { tokenPara, SCOPE_GMAIL, olvidarToken, mensajeErrorGoogle } from './googleToken';

const b64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64utf8 = (s: string) => b64(new TextEncoder().encode(s));
const b64url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// Cabeceras con acentos según RFC 2047
const cab = (s: string) => `=?UTF-8?B?${b64utf8(s)}?=`;

export interface CorreoConAdjunto {
  para: string;
  cc?: string;
  asunto: string;
  cuerpo: string;
  adjunto?: { nombre: string; blob: Blob };
}

export function correoValido(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
}

export async function enviarConGmail(c: CorreoConAdjunto): Promise<{ id: string }> {
  if (!correoValido(c.para)) throw new Error('La dirección de correo del destinatario no es válida.');
  const token = await tokenPara(SCOPE_GMAIL);
  const limite = '==obracontrol_' + Math.random().toString(36).substring(2) + '==';
  const partes: string[] = [
    `To: ${c.para.trim()}`,
    ...(c.cc ? [`Cc: ${c.cc.trim()}`] : []),
    `Subject: ${cab(c.asunto)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${limite}"`,
    '',
    `--${limite}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64utf8(c.cuerpo),
  ];
  if (c.adjunto) {
    const bytes = new Uint8Array(await c.adjunto.blob.arrayBuffer());
    partes.push(`--${limite}`, `Content-Type: application/pdf; name="${c.adjunto.nombre}"`, `Content-Disposition: attachment; filename="${c.adjunto.nombre}"`, 'Content-Transfer-Encoding: base64', '', b64(bytes));
  }
  partes.push(`--${limite}--`, '');
  const raw = b64url(b64utf8(partes.join('\r\n')));
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (res.status === 401) {
    olvidarToken();
    throw new Error(mensajeErrorGoogle(401, 'Gmail API'));
  }
  if (!res.ok) throw new Error(`${mensajeErrorGoogle(res.status, 'Gmail API')} ${(await res.text()).substring(0, 200)}`);
  const json = await res.json();
  return { id: json.id };
}
