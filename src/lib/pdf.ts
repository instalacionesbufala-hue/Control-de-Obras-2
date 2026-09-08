// Generación de un PDF real (archivo) a partir del documento que se ve en pantalla.
// Se rasteriza el documento a alta resolución (el QR sigue siendo legible) y se pagina en A4.
// html2canvas-pro entiende los colores modernos (oklch) que usa Tailwind 4.
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export async function generarPDFDesdeElemento(el: HTMLElement): Promise<Blob> {
  // Ojo con windowWidth: html2canvas clona la página en un marco de ese ancho y la app entera se
  // recoloca como si fuera un móvil, con lo que el documento salía con otro ancho y otra altura
  // (desproporcionado). Se captura con la ventana real y con el tamaño completo del contenido,
  // no el de su caja (que en el modal es la del contenedor, más baja que el documento).
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    scrollX: 0,
    scrollY: 0,
  });
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const anchoPag = pdf.internal.pageSize.getWidth();
  const altoPag = pdf.internal.pageSize.getHeight();
  const margen = 8;
  const anchoUtil = anchoPag - margen * 2;
  const altoUtil = altoPag - margen * 2;
  const escala = anchoUtil / canvas.width; // mm por píxel
  const altoPaginaPx = Math.floor(altoUtil / escala);
  let y = 0;
  let primera = true;
  while (y < canvas.height) {
    const trozo = document.createElement('canvas');
    trozo.width = canvas.width;
    trozo.height = Math.min(altoPaginaPx, canvas.height - y);
    const ctx = trozo.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, trozo.width, trozo.height);
    ctx.drawImage(canvas, 0, y, canvas.width, trozo.height, 0, 0, canvas.width, trozo.height);
    if (!primera) pdf.addPage();
    pdf.addImage(trozo.toDataURL('image/jpeg', 0.92), 'JPEG', margen, margen, anchoUtil, trozo.height * escala);
    y += altoPaginaPx;
    primera = false;
  }
  return pdf.output('blob');
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Compartir el PDF con la hoja nativa del móvil (WhatsApp, Gmail, Drive…). Solo en navegadores compatibles.
export function puedeCompartirArchivos(): boolean {
  try {
    const f = new File([new Blob(['x'])], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

export async function compartirPDF(blob: Blob, nombre: string, titulo: string, texto: string): Promise<boolean> {
  const file = new File([blob], nombre, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [file], title: titulo, text: texto });
    return true;
  } catch (e: any) {
    if (e?.name === 'AbortError') return false;
    throw e;
  }
}

export function nombreArchivoPDF(tipo: 'presupuesto' | 'factura', numero: string, cliente: string): string {
  const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${tipo === 'factura' ? 'Factura' : 'Presupuesto'}_${limpio(numero)}_${limpio(cliente).substring(0, 30)}.pdf`;
}
