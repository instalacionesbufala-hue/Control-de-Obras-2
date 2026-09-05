# Estudio: cómo leer los movimientos del banco en Control de Obra

Fecha: septiembre de 2026. Ámbito: una S.L. o un autónomo instalador en España con una o dos cuentas bancarias, que quiere ver sus movimientos dentro de la app y cruzarlos con facturas y gastos. Se evalúa lo que se puede hacer **desde una web estática publicada en Google AI Studio** (sin servidor propio) y lo que exige un servidor.

## 1. Resumen y recomendación

| Opción | Coste | Qué hace falta | Esfuerzo mensual | Estado en la app |
|---|---|---|---|---|
| **Importar el extracto a mano (Norma 43 o CSV)** | 0 € | Nada. Descargar el archivo de la banca online | 2 minutos al mes | **Implementado y funcionando** |
| GoCardless Bank Account Data (PSD2) | Gratis hasta cierto volumen; planes de pago | Un servidor que guarde el secreto de API y reciba la redirección del banco | 0 (automático, renovar permiso cada 90–180 días) | Preparado en Configuración; requiere servidor |
| Enable Banking (PSD2) | Cuota mensual baja (decenas de euros) | Servidor, igual que arriba | 0 | Igual |
| Afterbanks / Arcopay (PSD2, español) | Contrato a medida | Servidor + contrato | 0 | Igual |
| Tink (Visa) | Orientado a grandes empresas | Servidor + contrato | 0 | No recomendado para este tamaño |
| API directa del banco | Certificado eIDAS QWAC/QSeal (3.000–8.000 €/año) | Servidor, homologación como TPP | 0 | Descartado: no compensa |
| Leer el correo de avisos del banco | 0 € | Acceso a Gmail (permiso) | 0 | Descartado: frágil e incompleto |

**Recomendación:** hoy, importación manual del **Norma 43** (o CSV) una o dos veces al mes. Es gratis, no da credenciales a nadie y la app ya la lee y propone los cruces. Cuando la app se aloje en un servidor propio (la versión Node de `control-de-obra/` ya tiene la integración con GoCardless), activar la lectura automática por PSD2 con GoCardless o Enable Banking. La elección queda guardada en Configuración para que la transición sea inmediata.

## 2. Por qué no se puede conectar el banco desde una web estática

La normativa europea PSD2 obliga a que quien lee las cuentas sea un tercero autorizado (TPP) o use uno. Los agregadores (GoCardless, Enable Banking, Tink, Afterbanks) ofrecen esa autorización, pero su API funciona así:

1. La app pide al agregador un enlace de consentimiento usando un **secreto de API**.
2. El cliente se identifica en **su banco** (nunca en la app) y autoriza la lectura durante 90 o 180 días.
3. El banco devuelve al agregador un permiso; el agregador lo asocia a la petición de la app.
4. La app pide los movimientos con el secreto de API y ese permiso.

El paso 1 y el 4 exigen el secreto de API. En una web estática (AI Studio, GitHub Pages) todo el código llega al navegador, así que **el secreto quedaría a la vista de cualquiera** que abriera las herramientas de desarrollador. Además, el paso 3 necesita una URL de retorno controlada por un servidor. Por eso la conexión automática está marcada en la app como "requiere servidor".

## 3. Norma 43 (cuaderno 43 de la AEB): lo que se ha implementado

Es el formato estándar que todos los bancos españoles permiten descargar desde la banca online de empresas ("Exportar movimientos", "Descargar extracto", "Fichero AEB43"). Es un archivo de texto con registros de 80 caracteres:

- `11` cabecera de cuenta: entidad, oficina, cuenta, fechas, saldo inicial.
- `22` movimiento: fecha de operación, fecha valor, clave debe/haber, importe (14 cifras, 2 decimales), número de documento y referencias.
- `23` conceptos complementarios (hasta varios por movimiento): el texto que ves en la app.
- `33` final de cuenta: totales y **saldo final**, con el que la app reconstruye el saldo tras cada movimiento.
- `88` fin de fichero.

La app (`src/lib/norma43.ts`):

- Detecta automáticamente si el archivo es Norma 43 o CSV.
- Convierte fechas AAMMDD, signo por clave 1/2, decimales implícitos.
- Identifica la entidad por su código (BBVA 0182, CaixaBank 2100, Santander 0049, Sabadell 0081, Bankinter 0128, ING 1465, Unicaja 2103, Ibercaja 2085, Abanca 2080, Cajamar 3058…).
- Evita duplicados al importar el mismo extracto dos veces (clave fecha + importe + referencia/concepto).
- Todo se procesa en el navegador; el archivo no se envía a ningún sitio.

Para el CSV, reconoce cabeceras habituales (fecha, fecha valor, concepto, importe o debe/haber, saldo, referencia) con separador `;`, `,` o tabulador, importes con coma decimal y fechas dd/mm/aaaa.

## 4. Propuestas de cruce (conciliación)

La app **propone** y el usuario **confirma**; nunca concilia sola. Cada movimiento sin conciliar se compara con facturas emitidas (si es un ingreso) o con gastos (si es un cargo):

| Señal | Puntos |
|---|---|
| El concepto contiene el número de factura | 3 |
| Importe exacto | 3 |
| Importe con diferencia ≤ 1 € | 2 |
| Posible cobro parcial (40–100 % del total) | 1 |
| Nombre del cliente o proveedor en el concepto | 2 |
| Fechas a menos de 45 días | 1 |

Confianza **alta** con 6 puntos o más, **media** con 4 o 5, **baja** con 2 o 3. Con menos de 2 no se propone. Siempre se puede buscar el documento a mano.

## 5. Plan para la lectura automática cuando haya servidor

1. Alta en GoCardless Bank Account Data (portal de desarrolladores, gratuito) y obtención de `secret_id` y `secret_key`.
2. Guardarlos en el `.env` del servidor (nunca en el navegador).
3. Rutas del servidor: `GET /api/banco/instituciones`, `POST /api/banco/conectar` (crea la "requisition" y devuelve la URL del banco), `GET /api/banco/retorno` (guarda las cuentas autorizadas), `POST /api/banco/sincronizar` (descarga movimientos y los añade sin duplicar). La versión Node de `control-de-obra/server.js` ya implementa exactamente esto.
4. En la app: al pulsar "Sincronizar" se llama a esas rutas y los movimientos entran por el mismo camino que los importados a mano, así que la conciliación no cambia.
5. Renovar el consentimiento cuando caduque (la app avisará con la fecha de expiración).

## 6. Seguridad y RGPD

- No pedir nunca usuario ni contraseña de banca online. Los agregadores PSD2 redirigen al banco; la app solo recibe permisos de lectura.
- Los extractos contienen datos personales de terceros (nombres en los conceptos). Se guardan en el dispositivo y, con Google vinculado, en la base de datos privada del usuario en Firestore. Incluirlo en el registro de actividades de tratamiento.
- Conservación: los libros y justificantes deben guardarse al menos 4 años a efectos fiscales (6 años por el Código de Comercio para sociedades). Hacer copia local periódica.
