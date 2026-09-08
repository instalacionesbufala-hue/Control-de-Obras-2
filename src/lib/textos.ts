// Textos al pie de presupuestos y facturas con comodines.
//
// El problema que resuelve: los textos por defecto decían "Validez 30 días" a fuego, así que al
// cambiar la validez a 7 días en los ajustes el documento seguía diciendo 30. Ahora el texto
// lleva {validez} o {vencimiento} y se rellena al mostrar el documento con el valor vigente.

export interface ValoresTexto {
  validez?: number; // días de validez del presupuesto
  vencimiento?: number; // días de vencimiento de la factura
}

export function rellenarTexto(texto: string | undefined, v: ValoresTexto): string {
  if (!texto) return '';
  return texto
    .replace(/\{validez\}/gi, String(v.validez ?? 30))
    .replace(/\{vencimiento\}/gi, String(v.vencimiento ?? 30));
}

// Convierte los "30 días" escritos a mano en los textos antiguos al comodín, para que los datos
// que ya tiene el usuario obedezcan al ajuste sin que tenga que reescribir nada.
// Solo toca la cifra cuando va pegada a la palabra validez o vencimiento: el resto del texto
// (porcentajes de pago, garantías de 2 años…) no se toca.
export function normalizarValidez(texto: string | undefined): string {
  if (!texto) return '';
  return texto
    // "Validez de la oferta: 30 días naturales" · "Validez: 30 días" · "Validez 30 días"
    .replace(/(validez(?: de la oferta)?:?\s*)\d+\s*d[ií]as/gi, '$1{validez} días')
    // "Oferta válida 30 días" · "válido durante 30 días"
    .replace(/(v[aá]lid[oa](?:\s+durante)?:?\s*)\d+\s*d[ií]as/gi, '$1{validez} días')
    // "Vencimiento a 30 días" · "Vencimiento: 30 días" · "vence a los 30 días"
    .replace(/(vencimiento:?\s*(?:a\s+(?:los\s+)?)?)\d+\s*d[ií]as/gi, '$1{vencimiento} días')
    .replace(/(vence\s+a\s+(?:los\s+)?)\d+\s*d[ií]as/gi, '$1{vencimiento} días');
}
