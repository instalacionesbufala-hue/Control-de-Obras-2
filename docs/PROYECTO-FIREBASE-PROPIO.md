# Tu propio proyecto de Firebase (independiente de Google AI Studio)

La app no necesita AI Studio para nada. Solo necesita un proyecto de Firebase, que es gratuito, y el archivo `firebase-config.json` con sus datos. Esta guía crea un proyecto limpio a tu nombre y desconecta el que generó AI Studio.

## Antes de empezar: qué es y qué no es el error de dominio

El error `auth/unauthorized-domain` **depende de la dirección web desde la que se abre la app, no de la cuenta que inicia sesión**. En cuanto autorizas tu dominio una sola vez, cualquier persona con cualquier cuenta de Google puede entrar sin ver ese error. No hay que hacer nada por cada cliente.

## 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com/> con la cuenta de Google que quieras que sea la dueña del negocio.
2. **Crear un proyecto**. Nombre: por ejemplo `control-de-obra`. Puedes desactivar Google Analytics: no hace falta.
3. Cuando termine, en la pantalla del proyecto pulsa el icono **Web** (`</>`) para registrar una aplicación web. Apodo: `Control de Obra`. **No** marques Firebase Hosting.
4. Google te muestra un bloque `firebaseConfig` con estos valores. Déjalo abierto, los necesitas en el paso 3.

## 2. Activar los dos servicios que usa la app

**Authentication**

1. Menú izquierdo → **Build → Authentication → Comenzar**.
2. Pestaña **Sign-in method** → **Google** → activar. Elige un correo de asistencia y guarda.
3. Pestaña **Settings** → **Authorized domains** → **Add domain**. Añade tu dominio **sin `https://` y sin barra final**:
   - `instalacionesbufala-hue.github.io` si publicas en GitHub Pages.
   - `localhost` ya viene incluido para las pruebas en tu ordenador.

**Firestore**

1. Menú izquierdo → **Build → Firestore Database → Crear base de datos**.
2. Ubicación: **eur3 (europe-west)** o **europe-southwest1 (Madrid)**. Los datos son de clientes españoles, conviene tenerlos en Europa.
3. Empieza en **modo de producción** (denegar todo). Las reglas correctas las pones en el paso siguiente.
4. Pestaña **Rules** → borra lo que haya, pega el contenido del archivo `firestore.rules` de este proyecto y pulsa **Publicar**.

## 3. Poner los datos en la app

Abre `firebase-config.json` en la raíz del proyecto y sustituye los valores por los tuyos:

```json
{
  "projectId": "control-de-obra-xxxxx",
  "appId": "1:000000000000:web:0000000000000000000000",
  "apiKey": "AIza...",
  "authDomain": "control-de-obra-xxxxx.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "control-de-obra-xxxxx.firebasestorage.app",
  "messagingSenderId": "000000000000",
  "measurementId": "",
  "oAuthClientId": "",
  "recaptchaSiteKey": ""
}
```

- Los cinco primeros valores salen del bloque `firebaseConfig` del paso 1.4.
- `firestoreDatabaseId` debe ser `(default)` si creaste la base de datos por defecto. El proyecto de AI Studio usaba una base con nombre propio; por eso este campo existe.
- `measurementId`, `oAuthClientId` y `recaptchaSiteKey` pueden quedarse vacíos.

Sube el cambio a GitHub. El flujo de Actions reconstruye y publica solo.

**La clave `apiKey` es pública por diseño**: viaja en el JavaScript de cualquier web con Firebase. Lo que protege los datos son las reglas de Firestore y la lista de dominios autorizados. Si quieres una capa más, en Google Cloud → Credenciales puedes restringir la clave por referente HTTP a tu dominio.

## 4. Permisos de Calendar y Gmail (opcional)

Solo si vas a usar "Guardar en Google Calendar" o "Enviar desde mi Gmail":

1. <https://console.cloud.google.com/> → mismo proyecto → **APIs y servicios → Biblioteca** → habilita **Google Calendar API** y **Gmail API**.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**. Aquí hay una decisión importante, explicada abajo.

## 5. Cómo lo van a usar tus clientes

Las reglas de seguridad guardan los datos de cada persona en `users/{su-identificador}/…` y solo esa cuenta puede leerlos. Es decir, **un mismo despliegue vale para varios clientes** y ninguno ve los datos de otro.

Con eso hay dos formas de venderlo:

### Opción A: tú alojas una sola app para todos (lo más cómodo para el cliente)

- Un solo proyecto de Firebase, el tuyo, y un solo dominio autorizado.
- El cliente abre el enlace, pulsa "Vincular cuenta de Google" y ya está. **No configura nada y no ve ningún error.**
- Los datos de todos los clientes viven en tu proyecto. Legalmente pasas a ser el encargado del tratamiento de datos de sus clientes, con lo que eso implica en el RGPD: contrato de encargo de tratamiento, y responsabilidad si hay una brecha.
- El plan gratuito de Firebase da 1 GB de almacenamiento, 50.000 lecturas y 20.000 escrituras al día. Para varios instaladores sobra.

### Opción B: cada cliente con su propio proyecto (lo más limpio legalmente)

- Cada empresa crea su Firebase siguiendo esta misma guía y usa su `firebase-config.json`.
- Sus datos están en su cuenta. Tú no tocas nada suyo y no asumes responsabilidad sobre ellos.
- A cambio, alguien tiene que hacer la instalación inicial: unos veinte minutos, y puedes cobrarla como puesta en marcha.

**Recomendación**: empieza con la opción A para las primeras pruebas y demostraciones, porque el cliente entra sin fricción. Cuando alguien te compre de verdad, pásalo a la opción B, así cada empresa es dueña de sus datos y tú te quitas la responsabilidad de encima.

### El detalle de la pantalla de consentimiento

Google distingue entre permisos básicos y permisos sensibles:

- **Iniciar sesión y guardar en la nube** usa permisos básicos. Con la pantalla de consentimiento **publicada** funciona para cualquier persona y Google no exige ninguna verificación.
- **Calendar y Gmail** son permisos sensibles. Sin pasar la verificación de Google, quien los conceda verá una pantalla de aviso de "aplicación no verificada" y hay un tope de usuarios.

En la práctica, mientras tengas pocos clientes lo más simple es dejar la pantalla de consentimiento en modo **Testing** y añadir el correo de cada cliente como **usuario de prueba**: caben cien y todo funciona, Calendar y Gmail incluidos. Si algún día pasas de ahí, la opción B evita el problema, porque cada empresa autoriza su propio proyecto para sí misma.

## 6. Desconectar el proyecto de AI Studio

Cuando la app funcione con tu proyecto nuevo:

- Comprueba que en GitHub ya no existe el archivo antiguo `firebase-applet-config.json`. Si sigue ahí, bórralo desde la web de GitHub.
- El proyecto viejo `gen-lang-client-0758030321` puedes dejarlo como está o eliminarlo desde la consola de Firebase → Configuración del proyecto → Eliminar proyecto.
- Si tenías datos de prueba en el proyecto viejo, no se migran: exporta una copia local desde Configuración → Copias de seguridad antes de cambiar, y restáurala después de vincular la cuenta nueva.
