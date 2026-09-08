# Protección de datos (RGPD) en Control de Obra

Documento de trabajo para el titular de la app. No es un dictamen jurídico: si algún día
tienes empleados, cámaras o mandas publicidad, enséñaselo a tu gestoría o a un abogado.

## 1. La idea en una frase

**No pidas consentimiento a tus clientes. Infórmales.**

Es el error más común. Suena más “legal” poner una casilla de *acepto el tratamiento de mis
datos*, pero es peor para ti: si la base legal fuera el consentimiento, el cliente podría
retirarlo cuando quisiera y tú te quedarías sin poder emitirle la factura ni conservarla los
años que exige Hacienda.

Lo que realmente aplica cuando alguien te contrata una instalación:

| Base legal | Artículo | Para qué la usas |
|---|---|---|
| Ejecución del contrato | 6.1.b RGPD | Presupuestar, ir a su casa, hacer la obra, cobrar |
| Obligación legal | 6.1.c RGPD | Emitir y conservar la factura, VERI\*FACTU, IVA, CIE |

Con esas dos bases no hace falta consentimiento. Lo que **sí** es obligatorio es el
**deber de información** del artículo 13: contarle quién eres, qué haces con sus datos y
cómo ejercer sus derechos, en el momento en que se los pides.

## 2. Cómo lo resuelve la app

- El texto vive en [`src/data/privacidad.ts`](../src/data/privacidad.ts) y se genera solo con
  tus datos de empresa (razón social, NIF, domicilio, correo). Si cambias esos datos en
  Configuración, el texto cambia con ellos.
- En la página que abre el cliente en su móvil para aceptar el presupuesto aparece:
  1. un **resumen** de una línea junto a la casilla,
  2. un enlace **“Leer la información completa”** que despliega el texto largo,
  3. una casilla obligatoria que dice **“He leído la información sobre protección de datos.”**
     No dice *consiento*: es la prueba de que se le informó, que es justo lo que tienes que
     poder demostrar.
- Sin marcar la casilla el botón de aceptar no deja continuar.
- La aceptación se guarda con `informadoProteccionDatos: true` junto al nombre, el DNI, la
  fecha, la hora y el trazo de la firma. En el PDF del presupuesto, de la obra y de la factura
  se imprime la línea *“El cliente confirmó haber leído la información sobre protección de datos.”*
- En **Configuración → Protección de datos (RGPD)** puedes leer el texto exacto que ven tus
  clientes y copiarlo (para tu web, o para un anexo en papel si alguna vez firmas a mano).

## 3. Qué datos tratas y cuánto los guardas

| Dato | Por qué | Cuánto tiempo |
|---|---|---|
| Nombre / razón social, NIF, dirección, teléfono, correo | Contrato y factura | 6 años desde la última factura |
| Firma dibujada + fecha/hora + código de aceptación | Probar que aceptó el presupuesto | 6 años |
| Fotos y vídeos de la instalación | Documentar el trabajo, garantía, CIE | Mientras dure la garantía |
| Documentos del CIE | Obligación legal de legalización | Según normativa de baja tensión |

Se toman **6 años** porque el Código de Comercio (art. 30) exige seis y la Ley General
Tributaria cuatro: se aplica el plazo mayor. La constante está en `ANIOS_CONSERVACION`.

Importante para las peticiones de borrado: **una factura ya emitida no se borra**. Ni por
petición del cliente ni por la tuya (VERI\*FACTU y el propio Código de Comercio lo impiden).
Si un cliente pide supresión, se le borra lo que no esté ligado a una obligación legal
(por ejemplo, fotos que ya no hagan falta) y se le explica el resto.

## 4. La firma dibujada: qué es y qué no es

Un asesor podría decirte que la firma es “categoría especial” de datos. **No lo es.** El
artículo 9 del RGPD habla de datos biométricos *cuando se usan para identificar unívocamente
a una persona* (huella dactilar, reconocimiento facial). Un trazo dibujado en la pantalla,
guardado como imagen y usado solo como prueba de conformidad comercial, es dato personal
normal. Por eso en la app se llama siempre **“aceptación comercial”** y nunca “firma
certificada”.

## 5. Encargados del tratamiento

Terceros que tocan datos de tus clientes por cuenta tuya:

- **Google** (Firestore, Drive, Gmail): es encargado del tratamiento. Su contrato
  (*Google Cloud Data Processing Addendum*) se acepta automáticamente al usar el servicio;
  no tienes que firmar nada aparte. Los datos se alojan en la UE si eliges región europea.
- **Google (Gemini)**, si usas el lector de tickets: procesa la foto del ticket del
  proveedor. Ahí no suele haber datos de tus clientes, sino de tus compras.
- **Tu gestoría**: aquí sí conviene tener firmado un contrato de encargado del tratamiento.
  Normalmente lo tienen ellos preparado; pídeselo si no lo has firmado.

## 6. Lo que todavía te falta a ti (fuera de la app)

1. **Registro de actividades de tratamiento.** Un documento interno de una o dos páginas
   listando los tratamientos que haces (clientes, facturación, personal si lo hay). No se
   presenta en ningún registro público: se enseña si la AEPD te lo pide. La AEPD tiene una
   herramienta gratuita, *Facilita RGPD*, que te lo genera en 20 minutos:
   https://www.aepd.es/herramientas/facilita
2. **Texto de privacidad en tu web**, si tienes formulario de contacto. Puedes copiar el que
   genera la app desde Configuración.
3. **Contrato de encargado con la gestoría** (punto 5).
4. **Aviso en los correos** que mandas con presupuestos: basta con una línea al pie
   remitiendo a la información completa.

## 7. Si un cliente ejerce sus derechos

Tienes **un mes** para contestar, por escrito y gratis. En la práctica:

- *Acceso*: exporta sus datos desde su ficha y mándaselos.
- *Rectificación*: corrige la ficha y, si el error está en una factura, emite una
  rectificativa (la app ya lo hace con R1-R4).
- *Supresión*: borra lo que no esté sujeto al plazo legal y explícale por qué la facturación
  se conserva.
- *Oposición / limitación / portabilidad*: contesta por escrito aunque sea para decir que no
  procede, motivándolo.

Guarda copia de tu respuesta. La reclamación del cliente, si no queda conforme, va a la
Agencia Española de Protección de Datos (www.aepd.es).
