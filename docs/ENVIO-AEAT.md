# El envío de los registros a la AEAT

## Qué hace la app y qué no

La app **genera** el registro de facturación y ahora también el **fichero XML oficial** que
hay que remitir. Lo que no hace, y no puede hacer, es **enviarlo**.

El servicio web de la AEAT exige TLS mutuo: quien llama tiene que presentar tu certificado
digital. Un navegador no puede presentar un certificado a un servidor ajeno desde JavaScript,
y además hay CORS de por medio. No es una limitación de esta app: es cómo funcionan los
navegadores. Cualquier programa que diga que envía a la AEAT desde el navegador, o miente o
está mandando tu certificado a un servidor intermedio.

Ojo con el atajo que parece existir: la modalidad **no VERI\*FACTU** tampoco te salva, porque
obliga a firmar electrónicamente cada registro y a llevar un registro de eventos mucho más
exigente. También necesita el certificado. No hay un camino que se resuelva solo en el
navegador.

## Fechas

| Quién | Desde cuándo |
|---|---|
| Contribuyentes del Impuesto sobre Sociedades (una SL) | 1 de enero de 2027 |
| El resto (autónomos, IRPF) | 1 de julio de 2027 |

Fechas fijadas por el RDL 15/2025. **Si constituyes la SL, tu fecha es la primera.**

## Cómo se usa hoy

Todo lo del XML vive en **Trimestre e impuestos**, que es la pestaña de lo que se le entrega a
la gestoría. En **Facturas** solo queda el aviso, con un enlace para saltar allí, y el XML de
una factura suelta dentro de *Ver registro de facturación*.

En el bloque **Para la gestoría** hay ahora un cuarto archivo:

- **4. Registros VERI*FACTU (XML)**: los registros del trimestre que estés mirando, en el
  mismo criterio que los tres CSV. Es lo que se entrega junto al resto del paquete.

Y debajo, un bloque propio de **pendientes de envío**:

- **Descargar el lote pendiente en XML**: todos los registros que no constan enviados, de
  cualquier periodo, en el orden de la cadena de huellas. La AEAT admite hasta 1000 por envío.
- **XML** en cada línea: el fichero de esa factura sola.
- **Marcar como enviado**: anota la fecha y el CSV que devuelva la AEAT. **No envía nada.** Es
  una anotación de lo que ya has hecho por otro medio; la factura pasa a `enviado` y
  desaparece de la lista.

Ese bloque cuenta **todos los periodos, no solo el trimestre en pantalla**, y es a propósito:
la remisión no va por trimestres, va factura a factura. El paquete de la gestoría sí es
trimestral; los pendientes, no.

Antes de generar nada, la app avisa si falta algo que la AEAT rechaza: tu NIF, tu razón
social, el NIF del cliente o las líneas de la factura.

## Qué lleva el fichero

Sigue los esquemas `SuministroLR.xsd` / `SuministroInformacion.xsd`. Por cada factura:

- Identificación de la factura (NIF del emisor, número de serie, fecha de expedición).
- Tipo de factura y, en rectificativas, el tipo (S o I) y las facturas rectificadas.
- Destinatario con su NIF, ya limpio de puntos y guiones.
- Desglose **agrupado por tipo de IVA**, no por concepto, con base y cuota repercutida. Con
  inversión del sujeto pasivo la calificación pasa a S2 y no se repercute cuota.
- Encadenamiento: la primera factura se declara `PrimerRegistro`, y las siguientes citan a la
  anterior por número, fecha y huella.
- Identificación del sistema informático, la fecha-hora con huso y la huella SHA-256.

Las facturas anuladas generan `RegistroAnulacion` en lugar de `RegistroAlta`.

**Antes de usarlo contra producción hay que validarlo en el entorno de preproducción de la
AEAT** (`prewww1.aeat.es`). Los códigos de error que devuelve señalan cualquier desviación del
esquema. Los tests de `scripts/test-libs.ts` comprueban que el XML queda bien formado y que
los campos críticos salen como deben, pero eso no sustituye a la validación contra la AEAT.

## Lo que queda por decidir: quién lo envía

Esto se decidió aplazar a propósito, porque el XML es el mismo lo envíe quien lo envíe.

1. **La gestoría o un tercero representante.** El reglamento lo permite. Es la opción que no
   te convierte en tu propio departamento de sistemas. **Antes de nada, pregúntaselo**:
   *«cuando entre VERI\*FACTU, ¿remitís vosotros mis registros o los tengo que enviar yo?»*.
   Aviso importante: delegar el envío **no exime a tu sistema** de cumplir los requisitos
   técnicos. La app tiene que estar bien hecha igualmente.
2. **Un servidor propio pequeño.** Ya existe a medias en la carpeta `control-de-obra/`
   (`src/verifactu/soap.js` con los endpoints de producción y preproducción). Custodia el
   `.p12` fuera del webroot con permisos 600. Cuesta 3-5 €/mes. Lo caro no es el alquiler: es
   mantenerlo, renovar el certificado cada año y mirar los rechazos.
3. **Una pasarela comercial.** Cuota mensual pequeña, menos control, cero mantenimiento.

Si se monta el servidor, hacen falta dos cosas que el consejo señaló y que no son opcionales:
**cola de reintentos** y **aviso al móvil** cuando algo falle. Un panel que hay que mirar no
sirve cuando estás subido a un tejado.

## Lo que NO se va a hacer

**Multi-tenant custodiando certificados de otros instaladores.** Es el escenario de máxima
exposición legal y queda descartado. Si algún día se vende la app, cada instalador pone su
certificado en su propio sitio. Y aun así, vender el software convierte al que lo vende en
**productor de un sistema informático de facturación**, con declaración responsable
obligatoria y sanciones de hasta 150.000 € al año por producir sistemas no conformes. Esa
decisión no depende de la arquitectura: depende de decidir vender, y hoy no es prioritario.

Ver el análisis completo en `council-report/council-report-2026-09-08-aeat.html`.
