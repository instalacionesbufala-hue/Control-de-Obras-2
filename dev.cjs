// Arranca Vite con el directorio del proyecto como raíz (útil cuando la ruta tiene espacios)
process.chdir(__dirname);
const { spawn } = require('node:child_process');
const vite = require('node:path').join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
const p = spawn(process.execPath, [vite, '--port', '3055', '--strictPort', '--host', '127.0.0.1'], { stdio: 'inherit', cwd: __dirname });
p.on('exit', (c) => process.exit(c ?? 0));
