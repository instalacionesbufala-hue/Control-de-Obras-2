import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  disabled?: boolean;
  inicial?: string;
}

// Lienzo de firma táctil/ratón. Corrige la escala entre el tamaño CSS y el del canvas para
// que el trazo quede donde se dibuja también en el móvil. Devuelve PNG en data URL.
export const SignaturePad: React.FC<SignaturePadProps> = ({ onChange, height = 176, disabled = false, inicial }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const trazos = useRef(0);
  const [tieneFirma, setTieneFirma] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F172A';
    if (inicial) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setTieneFirma(true);
      };
      img.src = inicial;
    }
  }, [inicial]);

  const coords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const p = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: (p.clientX - rect.left) * sx, y: (p.clientY - rect.top) * sy };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const c = coords(e);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    drawing.current = true;
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const c = coords(e);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    trazos.current++;
    if (!tieneFirma) setTieneFirma(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (trazos.current >= 3 && canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  };
  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    trazos.current = 0;
    setTieneFirma(false);
    onChange(null);
  };

  return (
    <div className="space-y-1">
      <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 overflow-hidden touch-none" style={{ height }}>
        <canvas
          ref={canvasRef}
          width={560}
          height={height}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          className={`w-full h-full ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'}`}
        />
        {!tieneFirma && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
            <p className="text-xs font-medium">Dibuja aquí la firma</p>
            <p className="text-[10px]">Con el dedo en el móvil o con el ratón</p>
          </div>
        )}
      </div>
      {tieneFirma && !disabled && (
        <button type="button" onClick={limpiar} className="text-[11px] text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold cursor-pointer">
          <RotateCcw size={12} /> Borrar y repetir la firma
        </button>
      )}
    </div>
  );
};
