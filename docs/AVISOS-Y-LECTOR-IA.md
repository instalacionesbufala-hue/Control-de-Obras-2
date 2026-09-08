# Avisos de aceptación y lector de tickets con IA

## Cómo te llega la aceptación del cliente

El cliente acepta desde su móvil y la aceptación se guarda en la nube de tu cuenta de Google. Nunca se pierde: la app la recoge en cuanto la abres, aunque llevara horas cerrada. Para enterarte al momento hay tres vías, de menos a más:

1. **Con la app abierta** (en el ordenador o en el móvil): llega al instante. Suena un aviso, aparece un cartel arriba con el botón **Proponer franjas**, y si has dado permiso, también una notificación del navegador. El permiso se pide desde Configuración → Avisos.
2. **El cliente te avisa**: tras firmar, la página le pide que te avise por el mismo medio por el que recibió el presupuesto, con un botón de WhatsApp y otro de correo ya redactados.
3. **Correo automático con Google Apps Script** (gratis, sin servidor, funciona con la app cerrada): un pequeño script en tu cuenta de Google recibe el aviso de la página del cliente y te envía un correo desde tu propia cuenta. Como Gmail avisa en el móvil, el aviso es inmediato.

### Montar el script de Google (10 minutos, una sola vez)

1. Entra en <https://script.google.com> con tu cuenta de Google y pulsa **Nuevo proyecto**.
2. Borra lo que haya y pega este código. Cambia el correo de destino si quieres recibirlo en otra cuenta:

```javascript
// Aviso de aceptación de presupuesto · Control de Obra
const DESTINO = Session.getEffectiveUser().getEmail(); // o 'tu-correo@gmail.com'

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  const asunto = `✅ Presupuesto ${d.codigo || ''} aceptado por ${d.cliente || 'un cliente'}`;
  const cuerpo = [
    `El cliente ${d.cliente || ''} (${d.dni || 'sin DNI'}) ha aceptado el presupuesto ${d.codigo || ''}.`,
    d.nombre ? `Trabajo: ${d.nombre}` : '',
    d.total ? `Importe: ${d.total} € (IVA incluido)` : '',
    d.hueco ? `Hueco preferido: ${d.hueco}` : 'No ha elegido hueco.',
    d.notas ? `Notas del cliente: ${d.notas}` : '',
    `Fecha y hora: ${d.fecha || new Date().toISOString()}`,
    d.codigoAceptacion ? `Código de aceptación: ${d.codigoAceptacion}` : '',
    '',
    'Abre Control de Obra para proponerle las franjas de instalación.',
  ].filter(Boolean).join('\n');
  MailApp.sendEmail(DESTINO, asunto, cuerpo);
  return ContentService.createTextOutput('ok');
}

// Para probar desde el editor: ejecuta esta función y mira tu correo
function prueba() {
  doPost({ postData: { contents: JSON.stringify({ codigo: 'PRE-TEST-001', cliente: 'Cliente de prueba', dni: '12345678Z', total: '1.234,00', fecha: new Date().toISOString() }) } });
}
```

3. Pulsa **Guardar** (icono de disquete) y ponle nombre, por ejemplo "Aviso Control de Obra".
4. Ejecuta una vez la función `prueba` (desplegable de funciones → `prueba` → **Ejecutar**). Google te pedirá autorizar el envío de correo desde tu cuenta; acepta. Debe llegarte un correo de prueba.
5. Arriba a la derecha: **Implementar → Nueva implementación**. Tipo: **Aplicación web**. "Ejecutar como": **Yo**. "Quién tiene acceso": **Cualquier usuario**. Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
6. En Control de Obra → Configuración → **Avisos cuando el cliente acepta** → pega la URL y guarda.

A partir de ahí, cada presupuesto que envíes con enlace lleva incorporada esa dirección, y cuando el cliente firme te llegará el correo. Si cambias el código del script, tienes que hacer **Nueva implementación** otra vez (la URL puede cambiar).

Qué no hace: no envía WhatsApp ni SMS. Eso requiere una pasarela de pago. El correo en el móvil cumple la misma función a coste cero.

## Lector de tickets y facturas con IA

En Gastos → Nuevo gasto, al adjuntar la foto de un ticket o el PDF de una factura aparece el botón **Leer los datos con IA**. La IA rellena proveedor, CIF, número, fecha, concepto, base, IVA, retención, total, forma de pago y categoría. **Nada se guarda solo**: los datos aparecen en el formulario para que los revises y corrijas antes de guardar. Si el proveedor no existe, se ofrece darlo de alta con los datos leídos.

### Conseguir tu clave de la API de Gemini (gratis)

1. Entra en <https://aistudio.google.com/apikey> con tu cuenta de Google.
2. Pulsa **Create API key** (Crear clave de API). Si te pide proyecto, elige el de la app o crea uno nuevo.
3. Copia la clave (empieza por `AIza`).
4. En Control de Obra → Configuración → **Lector de tickets con IA** → pega la clave y pulsa **Probar**.

Sobre la clave:

- Es **tu** clave, de tu cuenta de Google. No va en el código de la app ni en el repositorio.
- Se guarda en tu configuración, que se sincroniza entre tus dispositivos por la nube de tu cuenta. Solo tu cuenta puede leerla (reglas de Firestore).
- **No se incluye** en los archivos de copia de seguridad que exportas, por si los compartes con la gestoría.
- El nivel gratuito de Gemini da de sobra para leer tickets a diario. Si algún día quisieras limitar el gasto, en Google AI Studio puedes ver el uso y poner cuotas.
- **El modelo se elige solo.** Google retira y renombra modelos cada pocos meses (verás mensajes del tipo "no longer available to new users"). Al pulsar **Probar**, la app le pregunta a Google qué modelos admite tu clave, se queda con el más rápido y económico que sepa leer imágenes, y lo guarda. Si algún día ese modelo desaparece, la app busca otro sola en la siguiente lectura. En Configuración puedes ver cuál se está usando y cambiarlo por otro de la lista.
- La foto del ticket se envía a Google para leerla. Si un documento es confidencial, no uses el botón y rellena a mano.

### Poner al día los precios de compra

Si la factura del proveedor trae desglose de líneas, la app las compara con los materiales de tu catálogo por parecido de nombre. Cuando encuentra alguno cuyo precio ha cambiado, aparece un panel morado con la lista: nombre del material, cómo venía escrito en la factura, precio anterior tachado, precio nuevo y el porcentaje de subida o bajada.

- Vienen marcados los de coincidencia clara. Los dudosos se avisan con "parecido dudoso, compruébalo" y hay que marcarlos a mano.
- Los precios se guardan **al pulsar Guardar gasto**, no antes, y queda anotado de qué factura salieron y en qué fecha.
- Los kits no cambian aquí. Cuando edites ese material en el catálogo, la app te preguntará a qué kits aplicas el coste nuevo.

### Consejos para que lea bien

- Foto recta, con luz y el ticket entero. La app la reduce a 1.600 píxeles antes de guardarla.
- PDFs de facturas: funciona con PDF de texto y con escaneados.
- Si la confianza es "baja", la app lo avisa: revisa los importes.
