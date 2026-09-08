# Guía de inicio y publicación

## Qué es

Control de Obra es una aplicación web (React + Vite + Tailwind) para instaladores eléctricos y de recarga de vehículo eléctrico. Flujo principal:

**Presupuesto → el cliente lo acepta desde su móvil (nombre, DNI, firma y hueco preferido) → se crea la obra con su código → se confirma la cita (agenda propia y Google Calendar) → se termina la obra → se emite la factura con huella VERI*FACTU y la aceptación del cliente.**

Además: clientes, materiales y conceptos con escandallo, kits, gastos con imputación a obra, banco (Norma 43/CSV) y conciliación, rentabilidad por obra, trimestre e impuestos con cuenta atrás de Hacienda, copias de seguridad local y en la nube.

## Dónde se guardan los datos

- **Siempre** en el propio navegador (`localStorage`). Funciona sin internet y sin cuenta.
- **Con Google vinculado** (Configuración → Cuenta de Google): además en Firestore, en la base de datos privada de esa cuenta. Se sincroniza en tiempo real entre dispositivos (gana el último que guarda; antes de aplicar un cambio remoto se conserva la versión anterior, recuperable en Configuración → Copias).
- **Copias**: archivo JSON descargable y copia manual en la nube. Se recomienda una copia local al mes como mínimo.
- Límite de la nube: un documento de Firestore admite 1 MB. Por eso las **fotos, vídeos y documentos van a tu Google Drive** cuando la cuenta está vinculada, y en la app solo queda una miniatura. Sin Drive se guardan dentro de la app con un tope de 400 KB y gastando de ese 1 MB.

## Publicar en Google AI Studio

1. Sube el contenido de esta carpeta (sin `node_modules`) al proyecto de AI Studio, o pega los archivos cambiados.
2. AI Studio construye la app con Vite y la sirve en su URL pública. No hace falta ninguna variable de entorno: `GEMINI_API_KEY` ya no se usa.
3. **Firebase**: el archivo `firebase-config.json` guarda los datos del proyecto (ver `docs/PROYECTO-FIREBASE-PROPIO.md` para crear uno propio). Para que funcione la nube y el enlace de aceptación:
   - En la consola de Firebase del proyecto → Authentication → Sign-in method → habilitar **Google**.
   - Authentication → Settings → **Authorized domains**: añadir el dominio donde se publica la app (AI Studio lo añade solo si usas su hosting; si publicas en otro sitio, añádelo a mano).
   - Firestore → Rules → pegar el contenido de `firestore.rules` y publicar. Estas reglas dan acceso a cada usuario solo a sus datos y permiten que el cliente lea la propuesta con el enlace y cree una única aceptación.
4. **Google Calendar** (opcional): en Google Cloud Console del mismo proyecto → APIs y servicios → habilitar **Google Calendar API**. La app pide el permiso `calendar.events` cuando el usuario pulsa "Guardar en Google Calendar"; el permiso dura una hora y se vuelve a pedir cuando hace falta. Sin ese permiso siguen funcionando "Abrir en Google" (enlace) y la exportación `.ics`.
5. Abre la app, ve a Configuración, elige **empresa o autónomo**, rellena los datos fiscales, el logotipo y la numeración, y pulsa **Borrar ejemplos** cuando quieras empezar con datos reales.

## Publicar en GitHub Pages

La carpeta ya trae todo lo necesario: `vite.config.ts` usa rutas relativas (`base: './'`), y `.github/workflows/deploy.yml` construye y publica la app cada vez que subes cambios a la rama `main`.

1. Crea un repositorio en GitHub (puede ser privado: GitHub Pages funciona con repositorios privados en planes de pago; en el plan gratuito el repositorio debe ser público, aunque los **datos** de la app nunca están en el repositorio).
2. Sube la carpeta completa **sin `node_modules` ni `dist`** (`.gitignore` ya los excluye).
3. En el repositorio: **Settings → Pages → Build and deployment → Source: "GitHub Actions"**. Con la primera subida el flujo se ejecuta solo; en la pestaña *Actions* ves si termina en verde. La URL será `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`.
4. **Firebase**: en la consola de Firebase → Authentication → Settings → **Authorized domains** → añade `TU_USUARIO.github.io`. Sin esto, "Vincular cuenta de Google" falla con `auth/unauthorized-domain`.

   Paso a paso, con el error delante:

   1. Abre <https://console.firebase.google.com/> con la **misma cuenta de Google** con la que se creó el proyecto y entra en el proyecto `gen-lang-client-0758030321` (nombre "Default Gemini Project").
   2. Menú izquierdo → **Build → Authentication**. Si es la primera vez, pulsa **Comenzar** y en **Sign-in method** habilita **Google** (elige un correo de asistencia y guarda).
   3. Pestaña **Settings** (dentro de Authentication) → apartado **Authorized domains** → botón **Add domain**.
   4. Escribe el dominio **sin `https://` y sin barra final**, por ejemplo `instalacionesbufala-hue.github.io`, y pulsa **Add**. Repite con el dominio de AI Studio si también la publicas allí.
   5. Vuelve a la app, recarga la página y pulsa **Vincular cuenta de Google**.

   La propia app te dice qué dominio falta: al fallar, la sección de Google muestra un aviso con el dominio exacto y un botón para copiarlo.
5. **Firestore**: publica `firestore.rules` en la base de datos que usa la app (el nombre está en `firebase-config.json`, campo `firestoreDatabaseId`; si no es `(default)`, selecciónala en el desplegable de Firestore antes de pegar las reglas).
6. **Google Calendar, Gmail y Drive** (opcionales): en Google Cloud Console del mismo proyecto → *APIs y servicios* → habilita **Google Calendar API**, **Gmail API** y **Google Drive API**. En *Pantalla de consentimiento OAuth* añade tu cuenta como **usuario de prueba** (con la app en modo "Testing" solo pueden conceder permisos las cuentas de prueba, y el permiso dura una hora; para publicar la pantalla de consentimiento Google exige verificación, innecesaria para uso propio).
7. Los permisos de Google se piden en el momento de usarlos (guardar una cita, enviar un correo) y también desde Configuración → Google.

### Cómo subir los archivos sin que falle

Al subir la carpeta a mano desde la web de GitHub es fácil dejarse algún archivo. Estos tres son imprescindibles y suelen ser los que faltan:

- `package.json` y `package-lock.json`, en la raíz. Sin el segundo, el flujo instala igualmente, pero conviene subirlo.
- `.github/workflows/deploy.yml`. Las carpetas que empiezan por punto a veces no entran al arrastrar.
- `firebase-config.json`, en la raíz. Si falta, la compilación falla porque el código lo importa.

Si el flujo termina en rojo, entra en la pestaña **Actions**, abre la ejecución fallida, pulsa el trabajo **build** y despliega el paso marcado en rojo. La primera línea roja dice exactamente qué pasa. Para volver a lanzarlo sin subir nada, usa **Re-run all jobs**.

Qué puede fallar y cómo se arregla:

- **Pantalla en blanco al abrir la URL**: casi siempre es `base`. Ya está en `'./'`, así que la app funciona en cualquier subcarpeta. Si el flujo falla en *Actions*, mira el paso que aparece en rojo (`npm run lint` = tipos, `npm test` = pruebas, `npm run build`).
- **El enlace de aceptación del cliente** (`…/?aceptar=TOKEN`) funciona en GitHub Pages porque se sirve desde `index.html` con parámetro de consulta, no con rutas.
- **La clave de Firebase es pública** (va en el JavaScript, es así por diseño): lo que protege los datos son las reglas de Firestore y la lista de dominios autorizados. Para más tranquilidad, en Google Cloud → *Credenciales* restringe la clave API por **referente HTTP** a tu dominio de GitHub Pages y al de AI Studio.
- **Privacidad**: el repositorio contiene código y ejemplos ficticios, nunca facturas, clientes ni el certificado digital.

## Publicar en otro hosting estático (Netlify, Hostinger…)

```bash
npm install
npm run build
```

Sube la carpeta `dist/`. Recuerda añadir el dominio en Firebase → Authentication → Authorized domains.

## Enviar presupuestos y facturas por correo con el PDF adjunto

Desde la vista previa de cualquier presupuesto o factura, botón **Correo**. El panel prepara destinatario, asunto y texto (editables) y ofrece tres vías:

- **Enviar desde mi Gmail con el PDF adjunto**: la app genera el PDF a partir de lo que ves en pantalla (plantilla y color incluidos) y lo envía con la API de Gmail **desde tu propia cuenta**. Queda en tu carpeta Enviados y el cliente lo recibe de tu dirección. Requiere la cuenta de Google vinculada, la Gmail API habilitada y el permiso `gmail.send` (se pide la primera vez, dura una hora). Nada pasa por servidores de terceros.
- **Compartir el PDF**: en móvil, abre la hoja del sistema (WhatsApp, Gmail, Drive…). Solo aparece en navegadores compatibles.
- **Descargar el PDF y abrir mi programa de correo**: para cuentas que no son de Google. Se descarga el PDF y se abre el correo con el texto preparado; adjuntas el archivo.

El botón **PDF** descarga el archivo sin enviar nada. **Imprimir / PDF** sigue disponible para imprimir con el diálogo del navegador.

## Presupuestos, obras y facturas: el ciclo

- **Presupuestos** muestra por defecto solo borradores y enviados. Filtros: Activos, Aceptados, Rechazados, Todos. Cuando el cliente acepta, el presupuesto pasa al filtro Aceptados en ámbar y aparece en **Obras**.
- **Obras** muestra por defecto las que están en curso. Al terminar una obra, el botón **Convertir en factura** abre la factura con las líneas de la obra y la fecha del día (editable). Al emitirla, obra y presupuesto pasan a verde y salen de la vista por defecto.
- La aceptación firmada del cliente (nombre, DNI, fecha y trazo) se guarda en el presupuesto, pasa a la obra y se imprime en la factura.
- **Presupuesto sin impuestos**: en el formulario del presupuesto hay un interruptor para presentarlo sin IVA, pensado para trabajos en los que no procede repercutirlo. Se elige el motivo (presupuesto orientativo, inversión del sujeto pasivo, operación exenta, no sujeta, u otro que escribas) y ese texto se imprime en el documento. Al activarlo desaparecen la columna de IVA, la base imponible y la cuota, y el total pasa a decir "TOTAL (sin impuestos)". El cliente lo ve igual en el enlace de aceptación. Esto afecta solo al presupuesto: la factura lleva siempre el IVA que corresponda, salvo que marques inversión del sujeto pasivo al emitirla, cosa que la app te propone sola si el presupuesto llevaba ese motivo.
- Las facturas emitidas **no se borran**: se anulan (registro de anulación) o se rectifican. Desde la factura abierta, el botón **Rectificar** crea la rectificativa con los mismos conceptos.
- Las plantillas de presupuesto y factura se eligen en **Configuración → Plantillas**, con vista previa en vivo. Los documentos usan siempre la plantilla predeterminada.
- En **Configuración → Técnicos y franjas** puedes quitar la franja de mañana o de tarde para toda la empresa o solo para un técnico. La agenda solo ofrece huecos que alguien cubra.
- Avisos de aceptación y lector de tickets con IA: ver `docs/AVISOS-Y-LECTOR-IA.md`.

## Dónde se guardan las fotos y los documentos

Con la cuenta de Google vinculada, las fotos, los vídeos y los documentos de una obra **se suben a tu Google Drive**, a la carpeta . En la app queda solo una miniatura de unos 20 KB para verla.

Esto importa más de lo que parece. Antes las fotos se guardaban dentro de los datos de la app, y esos datos viajan a la nube como **un único documento con un tope duro de 1 MB**: con dos o tres fotos la sincronización dejaba de funcionar. Drive da 15 GB gratis y las carpetas son tuyas, así que puedes copiarlas a un disco externo cuando quieras.

- Las **fotos se comprimen** antes de subirlas: una de 4 MB del móvil baja a unos 400 KB sin perder legibilidad.
- Los **vídeos** se suben tal cual y solo se admiten con Drive vinculado. No se pueden comprimir dentro del navegador sin destrozar la calidad, así que no se intenta.
- Los **PDF** se suben tal cual: comprimirlos en el navegador daría muy poca ganancia.
- El permiso que se pide es `drive.file`, que deja ver a la app **solo los archivos que ella crea**, nunca el resto de tu Drive. Es un permiso no sensible, así que no exige la verificación de Google.
- Sin Drive vinculado todo sigue funcionando, pero con el tope de 400 KB por archivo y gastando del limitado espacio de la nube.

En la **ficha del cliente** se reúnen las fotos y vídeos de todas sus obras y la lista de documentos, marcando los que sirven para el certificado de instalación eléctrica (CIE).

## Copia local: no dependas solo de Google

Si pierdes el acceso a tu cuenta de Google, pierdes la nube, el Drive y el correo de golpe. Por eso la app te recuerda descargar una copia a tu ordenador cada cierto tiempo, configurable en Configuración → Copias de seguridad, siete días por defecto.

El aviso sale en la parte de arriba de la app y se puede cerrar hasta la próxima vez que la abras. Guarda ese archivo en un disco aparte, no en la misma cuenta de Google.

## Cerrar la obra desde el móvil: material real y rentabilidad

En la ficha de una obra hay una pestaña **Material real**, pensada para usarla a pie de instalación con el teléfono.

- El material del presupuesto **ya viene listado** con la cantidad prevista puesta. Solo hay que corregir lo que sobró o faltó, con botones grandes de más y menos.
- Botón de **hacer foto** que abre directamente la cámara y la guarda en la obra.
- **Añadir material imprevisto**, buscándolo en el catálogo o escribiéndolo si no está.
- Arriba, siempre a la vista, el previsto, el real, el desvío en euros y el margen real. Debajo, en qué líneas concretas se ha desviado.
- Al pulsar **Cerrar consumo**, la rentabilidad de esa obra deja de usar la estimación del escandallo y pasa a usar el material que de verdad se gastó. Queda anotado en la bitácora con las dos cifras.

Nada de esto sale en el presupuesto ni en la factura: es control interno de coste.

## Cobros: cuándo una factura está cobrada

Una factura no se marca cobrada a mano: se calcula sumando sus cobros. Y los cobros llegan sobre todo del banco.

- **Al conciliar un ingreso** en Banco y conciliación, ese importe se anota como cobro de la factura. Con el reparto habitual de 50 % al aceptar y 50 % al terminar, hacen falta **dos ingresos** para darla por cobrada.
- Mientras falte dinero, la factura queda **A medias** o **Por cobrar**, con los días de retraso si ha vencido.
- Si deshaces la conciliación, ese cobro desaparece y la factura vuelve a su estado real.
- Para lo que no pasa por el extracto (efectivo, Bizum, un banco que no importas) hay un botón para **anotar el cobro a mano**, con atajos de 50 % y del resto pendiente.
- Desde ese mismo panel puedes **reclamar por WhatsApp** con el texto ya redactado, que dice cuánto falta y cuántos días lleva.

En la portada, el aviso indica cuántas facturas están sin cobrar, **cuánto falta de verdad** contando los cobros parciales, y los días que lleva la más vieja.

## Materiales y kits

Son dos cosas distintas y viven en solapas separadas dentro de la misma pestaña.

- **Materiales**: artículos sueltos que compras. Nombre, referencia, unidad, **precio de compra**, proveedor y un PVP por si lo vendes suelto. El precio de compra es interno y no sale nunca en un presupuesto ni en una factura.
- **Kits**: agrupaciones de materiales del catálogo más mano de obra y otros trabajos. De ahí salen el coste, el precio de venta y el margen. Es lo que insertas como partida en un presupuesto.

Al actualizar la app, los "conceptos" antiguos que llevaban escandallo dentro se convierten en kits y sus materiales salen al catálogo sin repetirse. No se pierde nada y los presupuestos ya hechos no cambian.

**Si cambias el precio de compra de un material** que usan varios kits, la app te pregunta a cuáles se lo aplicas, con la lista delante y su margen actual. El precio de venta de los kits no se toca: solo cambia el coste, para que veas si la subida se ha comido el beneficio y decidas tú. También puedes aplicarlo solo al material y dejar los kits como estaban.

**Margen.** En Configuración fijas tu margen objetivo, y con él la app sugiere precios de venta en tres sitios: al crear un material, al montar un kit y en cada partida del presupuesto. Siempre puedes escribir el precio a mano, como hasta ahora; el selector es un atajo, no una imposición.

**Sugerencia de precio.** Al dar de alta un material, si en tus gastos hay una compra parecida, la app te ofrece ese importe indicando de qué factura sale. Es un dato tuyo, no una estimación inventada.

## Usar la app en varios dispositivos

Basta con abrir la web y pulsar **Vincular cuenta de Google** con la misma cuenta. Todo lo tuyo viaja en la nube de tu cuenta: clientes, presupuestos, obras, facturas, gastos, banco, catálogo, kits y **toda la configuración**, incluidas la clave de Gemini, el modelo elegido y la dirección del script de avisos. No hay que volver a escribir nada.

Se sincroniza **toda** la pantalla de Configuración: datos fiscales, logotipo, numeración y prefijos, técnicos y franjas, plantillas con sus textos al pie, clave de Gemini, modelo elegido, dirección del script de avisos y datos del certificado.

Dos cosas son de cada dispositivo por diseño y no se sincronizan:

- **El permiso de Google Calendar y Gmail**, que dura una hora y se pide solo cuando lo necesitas. Es así porque el permiso va ligado a la sesión del navegador.
- **El permiso de avisos del navegador**, que concedes una vez en cada móvil u ordenador desde Configuración → Avisos.

Qué pasa la primera vez que vinculas la cuenta en un equipo nuevo:

- Si en el equipo solo están los ejemplos de bienvenida, se cargan tus datos de la nube sin preguntar.
- Si en el equipo ya habías metido trabajo real **y** en la nube también hay datos, la app se detiene y te muestra un resumen de cada versión para que elijas. La descartada queda como copia de seguridad recuperable en Configuración.
- Si la nube está vacía porque es tu primera vez con esa cuenta, se sube lo que tengas en el equipo.

## Enlace de aceptación para el cliente

Al enviar un presupuesto con la cuenta de Google vinculada, la app publica en Firestore un documento con un identificador aleatorio (sin costes internos) y genera el enlace `…/?aceptar=TOKEN`. El cliente:

1. Abre el enlace en su móvil, sin instalar nada ni iniciar sesión.
2. Ve el presupuesto, las condiciones y los materiales marcados como visibles.
3. Indica nombre y DNI/CIF, firma en pantalla (salvo si en su ficha está desactivado "exigir firma") y elige un hueco de los propuestos.
4. Recibe un código de aceptación. La app del instalador recibe la aceptación al instante y convierte el presupuesto en obra.

Si no hay cuenta de Google vinculada, el mensaje se envía con el PDF y la aceptación se registra a mano ("Registrar aceptación recibida") o en persona ("Aceptar aquí").

## VERI*FACTU: qué hace la app y qué no

- **Hace**: numeración correlativa, registro de facturación con la cadena oficial (`IDEmisorFactura=…&NumSerieFactura=…&FechaExpedicionFactura=…&TipoFactura=F1&CuotaTotal=…&ImporteTotal=…&Huella=…&FechaHoraHusoGenRegistro=…`), huella SHA-256 encadenada con la factura anterior, URL de cotejo y QR en la factura, leyenda "VERI*FACTU · Factura verificable en la sede electrónica de la AEAT", comprobación del encadenamiento y autocomprobación del algoritmo con los vectores oficiales de la AEAT. El QR y la huella **solo aparecen en facturas**, nunca en presupuestos.
- **Rectificativas**: desde la lista de facturas, icono morado "Emitir factura rectificativa". Se elige el tipo según la causa (R1 error fundado en derecho y art. 80.Uno/Dos/Seis LIVA; R2 concurso de acreedores; R3 crédito incobrable; R4 resto de causas), el modo (**por sustitución**, con los importes correctos completos, o **por diferencias**, solo la diferencia positiva o negativa) y el motivo, que se imprime. Tiene su propia serie (`REC-{AAAA}-`, configurable) y entra en la misma cadena de huellas; el registro incluye `TipoRectificativa` y la factura rectificada con su base y cuota. Si es por sustitución, la original pasa a estado "Rectificada" y deja de contar en totales y en la obra; ambas se conservan.
- **No hace** (no puede desde un navegador): enviar los registros a la AEAT. Eso requiere firmar la petición con el certificado digital de la empresa en un servidor. Cada factura queda "pendiente de envío" y se puede marcar como enviada con el CSV que devuelve la AEAT cuando se remita por otro medio (servidor propio o gestoría).
- Obligatoriedad: sociedades desde el 1 de enero de 2027; autónomos desde el 1 de julio de 2027 (RDL 15/2025). Consulta con tu gestoría si acepta un programa propio.

## Preguntas frecuentes

- **¿Puedo borrar una factura?** Solo la última de la cadena. Las anteriores se anulan (queda constancia) o se corrigen con una rectificativa.
- **¿Anular o rectificar?** Anula si la factura no debió existir (cliente equivocado, duplicada). Rectifica si hubo un error en importes, IVA o datos, o si hay un abono o descuento posterior.
- **¿Por qué el filtro de mes oculta cosas?** Cada sección arranca en el mes y año en curso. Pulsa "Ver todo" o cambia el mes.
- **¿Dónde está el coste de los materiales en el PDF?** En ningún sitio: es interno. Solo el nombre y la cantidad de los materiales marcados con el ojo verde se imprimen.
- **La cuenta atrás de Hacienda muestra modelos que no me tocan.** Ajusta en Configuración: empleados, alquiler de local, operaciones intracomunitarias.
