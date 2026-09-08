// Información de protección de datos que se muestra al cliente antes de que firme.
//
// Enfoque: la ley (art. 13 del RGPD) obliga a INFORMAR en el momento de recoger los datos.
// No exige pedir consentimiento para esto, y de hecho pedirlo sería un error: la base legal
// aquí es ejecutar el contrato y cumplir la obligación fiscal de facturar, no el consentimiento.
// Si la base fuera el consentimiento, el cliente podría retirarlo y quedarías sin poder facturar.
//
// Por eso la casilla no dice "consiento", dice "he leído la información": sirve como prueba
// de que se informó, que es lo que sí hay que poder demostrar.
import { CompanySettings } from '../types';

export interface TextoPrivacidad {
  resumen: string;
  detalle: string;
}

// Años que hay que conservar los datos de facturación: 4 por la Ley General Tributaria
// y 6 por el Código de Comercio. Se toma el mayor.
export const ANIOS_CONSERVACION = 6;

export function textoPrivacidad(s: CompanySettings): TextoPrivacidad {
  const empresa = s.razonSocial || s.nombreComercial || 'La empresa instaladora';
  const nif = s.cif ? ` (NIF ${s.cif})` : '';
  const direccion = [s.direccion, s.codigoPostal, s.ciudad].filter(Boolean).join(', ');
  const correo = s.email || 'la dirección de correo que figura en el presupuesto';

  return {
    resumen: `${empresa} tratará tus datos para preparar el presupuesto, ejecutar la instalación y emitir la factura. Puedes ejercer tus derechos escribiendo a ${correo}.`,
    detalle: [
      `**Responsable.** ${empresa}${nif}${direccion ? `, con domicilio en ${direccion}` : ''}. Correo de contacto: ${correo}.`,
      '',
      '**Qué datos se recogen.** Tu nombre o razón social, tu DNI, NIE o CIF, la dirección de la instalación y tus datos de contacto. Si firmas en pantalla, también el trazo de tu firma, la fecha y la hora. Durante los trabajos pueden tomarse fotografías de la instalación.',
      '',
      '**Para qué.** Preparar y documentar el presupuesto, dejar constancia de que lo aceptaste, organizar la cita, ejecutar la instalación, emitir la factura y cumplir las obligaciones fiscales y de facturación, incluida la documentación técnica necesaria para legalizar la instalación.',
      '',
      '**Con qué base legal.** La ejecución del contrato que nos une (artículo 6.1.b del RGPD) y el cumplimiento de obligaciones legales en materia fiscal y de facturación (artículo 6.1.c). No se te pide consentimiento porque no es la base aplicable: sin estos datos no es posible emitirte una factura válida.',
      '',
      `**Cuánto tiempo se conservan.** Mientras dure la relación y, después, ${ANIOS_CONSERVACION} años, que es el plazo que exigen la normativa fiscal y el Código de Comercio. Las fotografías de la instalación se conservan mientras dure la garantía de los trabajos.`,
      '',
      '**Quién más puede verlos.** La asesoría o gestoría que lleva la contabilidad, la Agencia Tributaria cuando la ley lo exige, y el proveedor de almacenamiento en la nube (Google), que actúa como encargado del tratamiento y no los usa para otra cosa. No se ceden a nadie más ni se usan para enviarte publicidad.',
      '',
      `**Tus derechos.** Puedes pedir acceder a tus datos, rectificarlos, suprimirlos, oponerte al tratamiento, limitarlo o solicitar su portabilidad, escribiendo a ${correo}. Ten en cuenta que los datos de una factura ya emitida no pueden borrarse antes del plazo legal de conservación. Si consideras que no se han atendido tus derechos, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`,
    ].join('\n'),
  };
}

// La casilla que marca el cliente. No es un consentimiento: es la prueba de que se le informó.
export const ETIQUETA_CASILLA = 'He leído la información sobre protección de datos.';
