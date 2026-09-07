// Comprueba firebase-config.json antes de construir, con mensajes entendibles.
// El fallo más traicionero es copiar la clave de la consola de Firebase mientras está oculta:
// se copian los puntos de la máscara (•) en vez del valor, y tiene la misma longitud que la buena.
import { readFileSync } from 'node:fs';

const RUTA = 'firebase-config.json';
const error = (m) => { console.log(`::error::${m}`); process.exitCode = 1; };

let cfg;
try {
  cfg = JSON.parse(readFileSync(RUTA, 'utf8'));
} catch (e) {
  error(`${RUTA} no es JSON válido (${e.message}). Las claves van entre comillas dobles: "apiKey": "AIza…", no apiKey: "AIza…".`);
  process.exit(1);
}

const obligatorios = ['apiKey', 'appId', 'projectId', 'authDomain', 'messagingSenderId'];
for (const k of obligatorios) {
  if (!cfg[k] || String(cfg[k]).trim() === '') error(`Falta "${k}" en ${RUTA}.`);
  else if (String(cfg[k]).startsWith('PEGA_AQUI_')) error(`"${k}" sigue con el texto de ejemplo: pega el valor de tu proyecto de Firebase.`);
}

const clave = String(cfg.apiKey || '');
const raros = [...clave].filter((c) => !/[0-9A-Za-z_-]/.test(c));
if (raros.length) {
  const nombres = [...new Set(raros)].map((c) => (c === '•' ? 'puntos de máscara (•)' : `"${c}" (código ${c.charCodeAt(0)})`)).join(', ');
  error(`La apiKey contiene caracteres que no puede tener: ${nombres}. Casi seguro que la copiaste de la consola de Firebase mientras estaba OCULTA y se copió la máscara. Pulsa el ojo para mostrarla, o usa el botón de copiar, y pega el valor real.`);
} else if (!/^AIza[0-9A-Za-z_-]{35}$/.test(clave)) {
  error(`La apiKey no tiene el formato de una clave de Google (debe empezar por AIza y medir 39 caracteres; la actual mide ${clave.length}).`);
}

if (cfg.appId && cfg.messagingSenderId && String(cfg.appId).split(':')[1] !== String(cfg.messagingSenderId)) {
  error('El appId y el messagingSenderId no son del mismo proyecto: revisa que los copiaste de la misma aplicación web.');
}
if (cfg.authDomain && cfg.projectId && cfg.authDomain !== `${cfg.projectId}.firebaseapp.com`) {
  console.log(`::warning::authDomain (${cfg.authDomain}) no coincide con projectId (${cfg.projectId}). Compruébalo si el inicio de sesión falla.`);
}

if (process.exitCode === 1) {
  console.log('--- contenido actual (la apiKey se muestra parcialmente) ---');
  console.log(JSON.stringify({ ...cfg, apiKey: clave ? `${clave.slice(0, 8)}… (${clave.length} caracteres)` : '(vacía)' }, null, 2));
  process.exit(1);
}

console.log(`firebase-config.json correcto. Proyecto: ${cfg.projectId} · base de datos: ${cfg.firestoreDatabaseId || '(default)'}`);
