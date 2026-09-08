// Construcción del XML de los registros de facturación (servicio SuministroLR de la AEAT).
//
// Por qué esto vive aquí y no en un servidor: el XML es lo mismo lo envíe quien lo envíe.
// Si mañana los remite la gestoría, si los remite un servidor propio o una pasarela, el
// documento que hay que producir es exactamente este. Generarlo en la app no depende de
// ninguna de esas decisiones, y permite entregarle hoy a la gestoría un fichero válido.
//
// Lo que NO se hace aquí, porque un navegador no puede: firmar la petición con el
// certificado digital y llamar al web service. Eso exige TLS mutuo.
//
// Estructura según los esquemas SuministroLR.xsd / SuministroInformacion.xsd. Antes de usarlo
// contra producción hay que validarlo en preproducción (prewww1.aeat.es): los códigos de
// error de la AEAT señalan cualquier desviación.
import { CompanySettings, Invoice } from '../types';
import { dec2, fechaAEAT, nifLimpio } from './verifactu';

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NS = 'xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd" xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd"';

// Identificación del sistema informático de facturación. Al ser un sistema de desarrollo
// propio para uso exclusivo del obligado tributario, el productor es el propio obligado.
export const ID_SISTEMA = 'CO';
export const NOMBRE_SISTEMA = 'Control de Obra';
export const VERSION_SISTEMA = '1.0';

export interface EmisorXML {
  nombre: string;
  nif: string;
}

export function emisorDe(s: CompanySettings): EmisorXML {
  return { nombre: s.razonSocial || s.nombreComercial, nif: nifLimpio(s.cif) };
}

function sistemaInformatico(e: EmisorXML): string {
  return `<sum1:SistemaInformatico>
      <sum1:NombreRazon>${esc(e.nombre)}</sum1:NombreRazon>
      <sum1:NIF>${esc(e.nif)}</sum1:NIF>
      <sum1:NombreSistemaInformatico>${esc(NOMBRE_SISTEMA)}</sum1:NombreSistemaInformatico>
      <sum1:IdSistemaInformatico>${esc(ID_SISTEMA)}</sum1:IdSistemaInformatico>
      <sum1:Version>${esc(VERSION_SISTEMA)}</sum1:Version>
      <sum1:NumeroInstalacion>1</sum1:NumeroInstalacion>
      <sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>
      <sum1:TipoUsoPosibleMultiOT>N</sum1:TipoUsoPosibleMultiOT>
      <sum1:IndicadorMultiplesOT>N</sum1:IndicadorMultiplesOT>
    </sum1:SistemaInformatico>`;
}

// La factura anterior de la cadena. Si no hay, este es el primer registro.
export interface Anterior {
  numero: string;
  fecha: string;
  huella: string;
}

function encadenamiento(nif: string, anterior: Anterior | null): string {
  if (!anterior || !anterior.huella) return '<sum1:Encadenamiento><sum1:PrimerRegistro>S</sum1:PrimerRegistro></sum1:Encadenamiento>';
  return `<sum1:Encadenamiento><sum1:RegistroAnterior>
      <sum1:IDEmisorFactura>${esc(nif)}</sum1:IDEmisorFactura>
      <sum1:NumSerieFactura>${esc(anterior.numero)}</sum1:NumSerieFactura>
      <sum1:FechaExpedicionFactura>${fechaAEAT(anterior.fecha)}</sum1:FechaExpedicionFactura>
      <sum1:Huella>${esc(anterior.huella)}</sum1:Huella>
    </sum1:RegistroAnterior></sum1:Encadenamiento>`;
}

export interface LineaDesglose {
  tipo: number;
  base: number;
  cuota: number;
}

// Agrupa las líneas de la factura por tipo de IVA: la AEAT quiere un detalle por tipo,
// no una entrada por concepto.
export function desgloseDe(inv: Invoice): LineaDesglose[] {
  const porTipo = new Map<number, LineaDesglose>();
  for (const l of inv.lineas) {
    const tipo = Number(l.ivaPorcentaje) || 0;
    const base = Number(l.total) || 0;
    const previo = porTipo.get(tipo) || { tipo, base: 0, cuota: 0 };
    previo.base += base;
    previo.cuota += base * (tipo / 100);
    porTipo.set(tipo, previo);
  }
  return [...porTipo.values()].sort((a, b) => b.tipo - a.tipo);
}

// isp = inversión del sujeto pasivo: calificación S2, sin cuota repercutida.
function desglose(lineas: LineaDesglose[], isp: boolean): string {
  const detalle = lineas.map((l) => isp
    ? `<sum1:DetalleDesglose><sum1:Impuesto>01</sum1:Impuesto><sum1:ClaveRegimen>01</sum1:ClaveRegimen><sum1:CalificacionOperacion>S2</sum1:CalificacionOperacion><sum1:BaseImponibleOimporteNoSujeto>${dec2(l.base)}</sum1:BaseImponibleOimporteNoSujeto></sum1:DetalleDesglose>`
    : `<sum1:DetalleDesglose><sum1:Impuesto>01</sum1:Impuesto><sum1:ClaveRegimen>01</sum1:ClaveRegimen><sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion><sum1:TipoImpositivo>${dec2(l.tipo)}</sum1:TipoImpositivo><sum1:BaseImponibleOimporteNoSujeto>${dec2(l.base)}</sum1:BaseImponibleOimporteNoSujeto><sum1:CuotaRepercutida>${dec2(l.cuota)}</sum1:CuotaRepercutida></sum1:DetalleDesglose>`);
  return `<sum1:Desglose>${detalle.join('')}</sum1:Desglose>`;
}

function descripcionDe(inv: Invoice): string {
  if (inv.obraNombre) return `Instalación en ${inv.obraNombre}`;
  const primera = inv.lineas[0]?.concepto;
  return primera ? primera.slice(0, 500) : 'Trabajos de instalación eléctrica';
}

// El bloque <sum1:RegistroAlta> de una factura, sin sobre SOAP: así se puede meter suelto
// en un lote junto a otros registros.
export function bloqueRegistroAlta(inv: Invoice, anterior: Anterior | null, e: EmisorXML): string {
  const v = inv.verifactu;
  const nif = e.nif;
  const rect = v.tipoFactura !== 'F1' && inv.rectificaA
    ? `<sum1:TipoRectificativa>${esc(v.tipoRectificativa || 'I')}</sum1:TipoRectificativa><sum1:FacturasRectificadas><sum1:IDFacturaRectificada><sum1:IDEmisorFactura>${esc(nif)}</sum1:IDEmisorFactura><sum1:NumSerieFactura>${esc(inv.rectificaA.numero)}</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>${fechaAEAT(inv.rectificaA.fecha)}</sum1:FechaExpedicionFactura></sum1:IDFacturaRectificada></sum1:FacturasRectificadas>`
    : '';
  const lineas = desgloseDe(inv);
  const cuotaTotal = inv.inversionSujetoPasivo ? 0 : lineas.reduce((a, l) => a + l.cuota, 0);
  return `<sum1:RegistroAlta>
    <sum1:IDVersion>1.0</sum1:IDVersion>
    <sum1:IDFactura><sum1:IDEmisorFactura>${esc(nif)}</sum1:IDEmisorFactura><sum1:NumSerieFactura>${esc(inv.numero)}</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>${fechaAEAT(inv.fecha)}</sum1:FechaExpedicionFactura></sum1:IDFactura>
    <sum1:NombreRazonEmisor>${esc(e.nombre)}</sum1:NombreRazonEmisor>
    <sum1:TipoFactura>${esc(v.tipoFactura)}</sum1:TipoFactura>${rect}
    <sum1:DescripcionOperacion>${esc(descripcionDe(inv))}</sum1:DescripcionOperacion>
    <sum1:Destinatarios><sum1:IDDestinatario><sum1:NombreRazon>${esc(inv.clienteNombre)}</sum1:NombreRazon><sum1:NIF>${esc(nifLimpio(inv.clienteNif))}</sum1:NIF></sum1:IDDestinatario></sum1:Destinatarios>
    ${desglose(lineas, !!inv.inversionSujetoPasivo)}
    <sum1:CuotaTotal>${dec2(cuotaTotal)}</sum1:CuotaTotal>
    <sum1:ImporteTotal>${dec2(inv.total)}</sum1:ImporteTotal>
    ${encadenamiento(nif, anterior)}
    ${sistemaInformatico(e)}
    <sum1:FechaHoraHusoGenRegistro>${esc(v.fechaHoraHuso)}</sum1:FechaHoraHusoGenRegistro>
    <sum1:TipoHuella>01</sum1:TipoHuella>
    <sum1:Huella>${esc(v.huellaHash)}</sum1:Huella>
  </sum1:RegistroAlta>`;
}

export function bloqueRegistroAnulacion(inv: Invoice, anterior: Anterior | null, e: EmisorXML): string {
  const v = inv.verifactu;
  return `<sum1:RegistroAnulacion>
    <sum1:IDVersion>1.0</sum1:IDVersion>
    <sum1:IDFactura><sum1:IDEmisorFacturaAnulada>${esc(e.nif)}</sum1:IDEmisorFacturaAnulada><sum1:NumSerieFacturaAnulada>${esc(inv.numero)}</sum1:NumSerieFacturaAnulada><sum1:FechaExpedicionFacturaAnulada>${fechaAEAT(inv.fecha)}</sum1:FechaExpedicionFacturaAnulada></sum1:IDFactura>
    ${encadenamiento(e.nif, anterior)}
    ${sistemaInformatico(e)}
    <sum1:FechaHoraHusoGenRegistro>${esc(v.fechaHoraHuso)}</sum1:FechaHoraHusoGenRegistro>
    <sum1:TipoHuella>01</sum1:TipoHuella>
    <sum1:Huella>${esc(v.huellaHash)}</sum1:Huella>
  </sum1:RegistroAnulacion>`;
}

function sobre(e: EmisorXML, registros: string[]): string {
  const cuerpo = registros.map((r) => `  <sum:RegistroFactura>${r}</sum:RegistroFactura>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope ${NS}><soapenv:Header/><soapenv:Body>
<sum:RegFactuSistemaFacturacion>
  <sum:Cabecera><sum1:ObligadoEmision><sum1:NombreRazon>${esc(e.nombre)}</sum1:NombreRazon><sum1:NIF>${esc(e.nif)}</sum1:NIF></sum1:ObligadoEmision></sum:Cabecera>
${cuerpo}
</sum:RegFactuSistemaFacturacion>
</soapenv:Body></soapenv:Envelope>`;
}

// Una factura suelta, lista para enviar o para entregar a la gestoría.
export function xmlDeFactura(inv: Invoice, anterior: Anterior | null, s: CompanySettings): string {
  const e = emisorDe(s);
  const bloque = inv.estado === 'Anulada' ? bloqueRegistroAnulacion(inv, anterior, e) : bloqueRegistroAlta(inv, anterior, e);
  return sobre(e, [bloque]);
}

// Ordena las facturas como está encadenada la huella: por fecha de generación del registro.
// Es el mismo orden que usa verificarCadena.
export function ordenCadena(invoices: Invoice[]): Invoice[] {
  return invoices
    .filter((i) => i.verifactu?.registrada && i.verifactu.cadena)
    .slice()
    .sort((a, b) => (a.verifactu.fechaHoraHuso || '').localeCompare(b.verifactu.fechaHoraHuso || '') || a.numero.localeCompare(b.numero));
}

// La factura anterior en la cadena, que es la que hay que citar en el encadenamiento.
export function anteriorDe(inv: Invoice, invoices: Invoice[]): Anterior | null {
  if (!inv.verifactu?.hashAnterior) return null;
  const previa = invoices.find((i) => i.verifactu?.huellaHash === inv.verifactu.hashAnterior);
  if (!previa) return null;
  return { numero: previa.numero, fecha: previa.fecha, huella: previa.verifactu.huellaHash };
}

// Un lote con varios registros: lo que se le pasa a la gestoría o lo que se enviaría de una vez.
// La AEAT admite hasta 1000 registros por envío.
export const MAX_REGISTROS_LOTE = 1000;

export function xmlLote(facturas: Invoice[], todas: Invoice[], s: CompanySettings): string {
  const e = emisorDe(s);
  const bloques = facturas.slice(0, MAX_REGISTROS_LOTE).map((inv) => {
    const anterior = anteriorDe(inv, todas);
    return inv.estado === 'Anulada' ? bloqueRegistroAnulacion(inv, anterior, e) : bloqueRegistroAlta(inv, anterior, e);
  });
  return sobre(e, bloques);
}

// Facturas con registro generado que todavía no constan enviadas.
export function pendientesDeEnvio(invoices: Invoice[]): Invoice[] {
  return ordenCadena(invoices).filter((i) => i.verifactu.estadoEnvio === 'pendiente');
}

// Comprobación mínima antes de entregar el XML: campos que la AEAT rechaza si faltan.
export function avisosPrevios(inv: Invoice, s: CompanySettings): string[] {
  const avisos: string[] = [];
  if (!s.cif) avisos.push('Falta el NIF de tu empresa en Configuración.');
  if (!(s.razonSocial || s.nombreComercial)) avisos.push('Falta la razón social en Configuración.');
  if (!inv.clienteNif) avisos.push(`La factura ${inv.numero} no tiene NIF del cliente.`);
  if (!inv.verifactu?.huellaHash) avisos.push(`La factura ${inv.numero} no tiene huella generada.`);
  if (!inv.lineas.length) avisos.push(`La factura ${inv.numero} no tiene líneas.`);
  return avisos;
}
