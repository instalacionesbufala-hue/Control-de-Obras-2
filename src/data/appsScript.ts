// Código del script de Google Apps Script que envía un correo al instalador cuando el cliente
// acepta desde su móvil. Se copia desde Configuración → Avisos. Pasos completos en docs/AVISOS-Y-LECTOR-IA.md.
export const SCRIPT_AVISO_ACEPTACION = `// Aviso de aceptación de presupuesto · Control de Obra
const DESTINO = Session.getEffectiveUser().getEmail(); // o 'tu-correo@gmail.com'

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  const asunto = '✅ Presupuesto ' + (d.codigo || '') + ' aceptado por ' + (d.cliente || 'un cliente');
  const cuerpo = [
    'El cliente ' + (d.cliente || '') + ' (' + (d.dni || 'sin DNI') + ') ha aceptado el presupuesto ' + (d.codigo || '') + '.',
    d.nombre ? 'Trabajo: ' + d.nombre : '',
    d.total ? 'Importe: ' + d.total + ' (IVA incluido)' : '',
    d.hueco ? 'Hueco preferido: ' + d.hueco : 'No ha elegido hueco.',
    d.notas ? 'Notas del cliente: ' + d.notas : '',
    'Fecha y hora: ' + (d.fecha || new Date().toISOString()),
    d.codigoAceptacion ? 'Código de aceptación: ' + d.codigoAceptacion : '',
    '',
    'Abre Control de Obra para proponerle las franjas de instalación.',
  ].filter(Boolean).join('\\n');
  MailApp.sendEmail(DESTINO, asunto, cuerpo);
  return ContentService.createTextOutput('ok');
}

// Para probar desde el editor: ejecuta esta función y mira tu correo
function prueba() {
  doPost({ postData: { contents: JSON.stringify({ codigo: 'PRE-TEST-001', cliente: 'Cliente de prueba', dni: '12345678Z', total: '1.234,00 €', fecha: new Date().toISOString() }) } });
}
`;

export const PASOS_SCRIPT = [
  'Entra en script.google.com con tu cuenta de Google y pulsa "Nuevo proyecto".',
  'Pega el código (botón Copiar) y guarda el proyecto con un nombre.',
  'Ejecuta una vez la función "prueba" y autoriza el envío de correo. Te llegará un correo de prueba.',
  'Implementar → Nueva implementación → Aplicación web → Ejecutar como: Yo → Acceso: Cualquier usuario → Implementar.',
  'Copia la URL que termina en /exec y pégala aquí. Guarda los cambios.',
];
