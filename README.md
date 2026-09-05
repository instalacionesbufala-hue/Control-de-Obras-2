# Control de Obra

Aplicación web para instaladores eléctricos y de puntos de recarga de vehículo eléctrico: presupuestos con aceptación desde el móvil del cliente, obras con cita y agenda, facturas con registro VERI*FACTU, gastos, banco y conciliación, rentabilidad, trimestre fiscal y copias de seguridad local y en la nube.

Sin datos privados de ninguna empresa: todo se configura en **Configuración** (empresa o autónomo, logotipo, numeración, técnicos, plantillas). Los ejemplos que aparecen al abrirla por primera vez son ficticios y se borran con un botón.

## Ejecutar en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Para comprobar tipos: `npm run lint`. Pruebas: `npm test`. Para generar la versión publicable: `npm run build` (carpeta `dist/`).

## Publicar en GitHub Pages

El repositorio incluye `.github/workflows/deploy.yml`: al subir a `main` se construye y publica en Pages. Solo hay que activar **Settings → Pages → Source: GitHub Actions** y añadir `TU_USUARIO.github.io` en Firebase → Authentication → Authorized domains. Detalles y qué puede fallar en `docs/GUIA-INICIO.md`.

## Documentación

- `docs/GUIA-INICIO.md`: qué hace la app, dónde guarda los datos, cómo publicarla en Google AI Studio o GitHub Pages, configuración de Firebase, Google Calendar y Gmail, envío de PDF por correo, alcance real de VERI*FACTU y rectificativas.
- `docs/ESTUDIO-SINCRONIZACION-BANCARIA.md`: opciones para leer los movimientos del banco (Norma 43 implementado; PSD2 requiere servidor) y cómo funcionan las propuestas de cruce.
- `firestore.rules`: reglas de seguridad que hay que publicar en Firestore.

## Estructura

- `src/App.tsx`: estado, persistencia (localStorage + Firestore en tiempo real), flujo presupuesto → obra → factura.
- `src/components/`: una vista por sección; `DocumentRenderer` imprime presupuestos y facturas; `PublicAcceptancePage` es lo que ve el cliente en su móvil.
- `src/lib/`: `verifactu` (huella oficial y QR), `norma43` (extractos), `conciliacion` (propuestas de cruce), `fiscal` (calendario y modelos AEAT), `agenda` (huecos libres), `googleCalendar`, `googleToken` (permiso OAuth compartido Calendar + Gmail), `gmail` (envío con adjunto desde la cuenta del usuario), `pdf` (PDF real del documento), `propuestas` (enlace público), `storage`, `cloudSync`.
- `src/data/initialData.ts`: datos de ejemplo con fechas relativas a hoy.
