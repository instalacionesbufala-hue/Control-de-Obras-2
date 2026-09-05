import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Sparkles, Volume2, CheckCircle2, ArrowRight, 
  X, RefreshCw, Zap, ShieldCheck, HardHat, FileText, AlertCircle
} from 'lucide-react';
import { CatalogItem, Project, PresupuestoPartida, Client, CompanySettings } from '../types';
import { uid } from '../utils/formatters';
import { hoyISO, addDays } from '../utils/dates';
import { formatCurrency } from '../utils/formatters';

interface VoiceAIBudgetAssistantProps {
  catalogItems: CatalogItem[];
  clients?: Client[];
  companySettings?: CompanySettings;
  siguienteCodigo?: string;
  onCreateClient?: (client: Client) => void;
  isOpen: boolean;
  onClose: () => void;
  onBudgetGenerated: (newProject: Omit<Project, 'id' | 'fotos' | 'documentos' | 'bitacora' | 'desgloseGastos'>) => void;
}

export const VoiceAIBudgetAssistant: React.FC<VoiceAIBudgetAssistantProps> = ({
  catalogItems,
  clients = [],
  companySettings,
  siguienteCodigo,
  onCreateClient,
  isOpen,
  onClose,
  onBudgetGenerated,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<{
    clienteNombre: string;
    direccion: string;
    tipoInstalacion: string;
    partidas: PresupuestoPartida[];
    totalVenta: number;
    totalCoste: number;
    margen: number;
  } | null>(null);

  // Client match / creation states
  const [matchedClient, setMatchedClient] = useState<Client | null>(null);
  const [clientStatus, setClientStatus] = useState<'existing' | 'new'>('new');
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [newClientNif, setNewClientNif] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientTelefono, setNewClientTelefono] = useState('');

  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  // Quick dictation sample buttons for testing without talking
  const samplePrompts = [
    'Instalación para Ana López en Calle Ejemplo 32. Quiere un cargador de 7,4 kW con 20 metros de cable, protección contra sobretensiones y boletín CIE.',
    'Punto de recarga para Almacenes Ejemplo en Polígono Norte. Cargador de 7,4 kW con balanceo dinámico de carga, 35 metros por bandeja y memoria técnica.',
  ];

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalTrans = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (finalTrans) {
          setTranscript((prev) => (prev ? `${prev} ${finalTrans}` : finalTrans));
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      alert('Tu navegador no soporta reconocimiento de voz nativo directo. Puedes escribir tu orden o usar los ejemplos rápidos.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      setTranscript('');
      setInterimTranscript('');
      setParsedData(null);
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };

  // AI parsing logic for electrical and EV quotation
  const handleAnalyzeText = (textToAnalyze?: string) => {
    const text = (textToAnalyze || transcript || interimTranscript).trim();
    if (!text) return;

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    setIsAnalyzing(true);

    setTimeout(() => {
      const lower = text.toLowerCase();

      // 1. Extract client name
      let cliente = 'Cliente';
      const clientMatch = text.match(/(?:para|cliente|nombre:?)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){1,3})/i);
      if (clientMatch && clientMatch[1]) {
        cliente = clientMatch[1].trim();
      }

      // 2. Extract address
      let direccion = '';
      const dirMatch = text.match(/(?:en|ubicación|dirección:?)\s+((?:calle|avda|avenida|paseo|plaza|polígono|carretera)[^.,;\n]+)/i);
      if (dirMatch && dirMatch[1]) {
        direccion = dirMatch[1].trim();
      }

      // 3. Match items from catalog or build appropriate parts
      const partidasEncontradas: PresupuestoPartida[] = [];

      // Check for charger
      const quiereBalanceo = lower.includes('balanceo') || lower.includes('power boost') || lower.includes('dinamico') || lower.includes('dinámico');
      if (quiereBalanceo) {
        const item = catalogItems.find(c => /balanceo/i.test(c.concepto) && /cargador/i.test(c.concepto)) || {
          concepto: 'Cargador 7,4 kW con balanceo dinámico de potencia',
          precioUnitario: 760,
          ivaPorcentaje: 21,
          categoriaNombre: '⚡ Puntos de recarga',
          costeInternoTotal: 540,
          margenPorcentaje: 40,
        };
        partidasEncontradas.push({
          id: `par-${Date.now()}-1`,
          categoria: item.categoriaNombre || '⚡ Puntos de Recarga & Wallbox',
          concepto: item.concepto,
          cantidad: 1,
          unidad: 'ud',
          precioUnitario: item.precioUnitario,
          ivaPorcentaje: item.ivaPorcentaje,
          total: item.precioUnitario,
          costeInternoTotal: item.costeInternoTotal || item.precioUnitario * 0.65,
          margenPorcentaje: item.margenPorcentaje || 35,
        });
      } else {
        // Default to Wallbox Pulsar Plus
        const item = catalogItems.find(c => /cargador/i.test(c.concepto) && !/balanceo|doble/i.test(c.concepto)) || {
          concepto: 'Cargador 7,4 kW monofásico tipo 2 con conectividad',
          precioUnitario: 685,
          ivaPorcentaje: 21,
          categoriaNombre: '⚡ Puntos de recarga',
          costeInternoTotal: 485,
          margenPorcentaje: 41,
        };
        partidasEncontradas.push({
          id: `par-${Date.now()}-1`,
          categoria: item.categoriaNombre || '⚡ Puntos de Recarga & Wallbox',
          concepto: item.concepto,
          cantidad: 1,
          unidad: 'ud',
          precioUnitario: item.precioUnitario,
          ivaPorcentaje: item.ivaPorcentaje,
          total: item.precioUnitario,
          costeInternoTotal: item.costeInternoTotal || item.precioUnitario * 0.65,
          margenPorcentaje: item.margenPorcentaje || 35,
        });
      }

      // Check for installation labor / distance
      let metros = 15;
      const metersMatch = lower.match(/(\d+)\s*(?:m|metros|metro)/);
      if (metersMatch && metersMatch[1]) {
        metros = parseInt(metersMatch[1], 10);
      }

      const laborPrice = metros > 25 ? 890 : 650;
      partidasEncontradas.push({
        id: `par-${Date.now()}-2`,
        categoria: '⚡ Puntos de Recarga & Wallbox',
        concepto: `Instalación y tendido de línea ITC-BT-52 (${metros} m de cable libre de halógenos con canalización)`,
        cantidad: 1,
        unidad: 'ud',
        precioUnitario: laborPrice,
        ivaPorcentaje: 21,
        total: laborPrice,
        costeInternoTotal: laborPrice * 0.45,
        margenPorcentaje: 55,
      });

      // Protections
      partidasEncontradas.push({
        id: `par-${Date.now()}-3`,
        categoria: '🛡️ Protecciones y cuadro',
        concepto: 'Cuadro de protección para VE (IGA, diferencial tipo A y sobretensiones)',
        cantidad: 1,
        unidad: 'ud',
        precioUnitario: 245,
        ivaPorcentaje: 21,
        total: 245,
        costeInternoTotal: 135,
        margenPorcentaje: 45,
      });

      // Dynamic load balancing if requested
      if (quiereBalanceo && !catalogItems.some(c => /balanceo/i.test(c.concepto) && /cargador/i.test(c.concepto))) {
        partidasEncontradas.push({
          id: `par-${Date.now()}-4`,
          categoria: '⚡ Puntos de recarga',
          concepto: 'Medidor de balanceo dinámico de potencia',
          cantidad: 1,
          unidad: 'ud',
          precioUnitario: 145,
          ivaPorcentaje: 21,
          total: 145,
          costeInternoTotal: 75,
          margenPorcentaje: 48,
        });
      }

      // CIE Bulletin
      if (lower.includes('cie') || lower.includes('boletin') || lower.includes('boletín') || lower.includes('industria') || lower.includes('legaliz')) {
        partidasEncontradas.push({
          id: `par-${Date.now()}-5`,
          categoria: '📑 Legalización y documentación',
          concepto: 'Tramitación del certificado de instalación eléctrica (CIE)',
          cantidad: 1,
          unidad: 'ud',
          precioUnitario: 180,
          ivaPorcentaje: 21,
          total: 180,
          costeInternoTotal: 50,
          margenPorcentaje: 72,
        });
      }

      const totalVenta = partidasEncontradas.reduce((sum, p) => sum + p.total, 0);
      const totalCoste = partidasEncontradas.reduce((sum, p) => sum + (p.costeInternoTotal || p.total * 0.6), 0);
      const margen = totalVenta > 0 ? Math.round(((totalVenta - totalCoste) / totalVenta) * 100) : 0;

      // Check if client exists in database (exact or normalized match)
      const normCliente = cliente.toLowerCase().trim();
      const existing = clients.find(c => {
        const cName = c.nombre.toLowerCase().trim();
        return cName === normCliente || cName.includes(normCliente) || normCliente.includes(cName);
      });

      if (existing) {
        setMatchedClient(existing);
        setClientStatus('existing');
        setClientConfirmed(false);
      } else {
        setMatchedClient(null);
        setClientStatus('new');
        setClientConfirmed(true);
        setNewClientNif('');
        setNewClientEmail('');
        setNewClientTelefono('');
      }

      setParsedData({
        clienteNombre: existing ? existing.nombre : cliente,
        direccion: direccion || (existing ? existing.direccion : 'Por definir'),
        tipoInstalacion: `Instalación Punto de Recarga VE - ${existing ? existing.nombre : cliente}`,
        partidas: partidasEncontradas,
        totalVenta,
        totalCoste,
        margen,
      });

      setIsAnalyzing(false);
    }, 800);
  };

  const handleConfirmAndCreate = () => {
    if (!parsedData) return;

    let finalClientId = '';
    let finalClientNombre = parsedData.clienteNombre;
    let finalClientEmail = '';
    let finalClientTelefono = '';
    let finalDireccion = parsedData.direccion;

    if (clientStatus === 'existing' && matchedClient) {
      finalClientId = matchedClient.id;
      finalClientNombre = matchedClient.nombre;
      finalClientEmail = matchedClient.email || '';
      finalClientTelefono = matchedClient.telefono || '';
      if (!parsedData.direccion || parsedData.direccion === 'Por definir') {
        finalDireccion = matchedClient.direccion;
      }
    } else {
      // Create new client if not in database
      const generatedClientId = uid('cli');
      finalClientId = generatedClientId;
      finalClientNombre = parsedData.clienteNombre;
      finalClientEmail = newClientEmail.trim();
      finalClientTelefono = newClientTelefono.trim();

      if (onCreateClient) {
        const newClientRecord: Client = {
          id: generatedClientId,
          nombre: parsedData.clienteNombre,
          nif: newClientNif.trim().toUpperCase(),
          email: finalClientEmail,
          telefono: finalClientTelefono,
          direccion: finalDireccion,
          ciudad: companySettings?.ciudad || '',
          codigoPostal: '',
          obraPrincipal: parsedData.tipoInstalacion,
          totalFacturado: 0,
          obrasCount: 1,
          documentosCount: 0,
          notas: 'Cliente creado desde el asistente de presupuestos por voz.',
          exigirFirma: true,
          tipoCliente: 'particular',
          fotos: [],
          documentos: [],
        };
        onCreateClient(newClientRecord);
      }
    }

    const newCode = siguienteCodigo || `PRE-${new Date().getFullYear()}-001`;

    const newProjectData: Omit<Project, 'id' | 'fotos' | 'documentos' | 'bitacora' | 'desgloseGastos'> = {
      codigo: newCode,
      nombre: parsedData.tipoInstalacion,
      clienteId: finalClientId,
      clienteNombre: finalClientNombre,
      clienteEmail: finalClientEmail,
      clienteTelefono: finalClientTelefono,
      direccion: finalDireccion,
      estado: 'Borrador',
      fechaInicio: hoyISO(),
      fechaFinPrevista: addDays(hoyISO(), 30),
      presupuestoAceptado: Math.round(parsedData.totalVenta * 100) / 100,
      totalFacturado: 0,
      totalGastos: 0,
      porcentajeAvance: 0,
      partidas: parsedData.partidas.map((p) => ({ ...p, total: Math.round(p.cantidad * p.precioUnitario * (1 + p.ivaPorcentaje / 100) * 100) / 100 })),
      notaFinal: companySettings?.notaFinalPresupuestoDefecto,
      plantillaPresupuesto: companySettings?.plantillaPorDefecto,
    };

    onBudgetGenerated(newProjectData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Zap size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Presupuesto por voz
                <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">Borrador para revisar</span>
              </h2>
              <p className="text-xs text-slate-300">Dicta cliente, dirección, cargador, metros y si hay boletín. Se crea un borrador con partidas del catálogo que revisas antes de enviarlo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* VOICE RECORDING CONTROLLER */}
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-4">
            <div className="flex justify-center">
              <button
                onClick={toggleListening}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                  isListening 
                    ? 'bg-rose-600 text-white scale-110 shadow-rose-500/40 ring-8 ring-rose-200 animate-pulse' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'
                }`}
              >
                {isListening ? <MicOff size={32} /> : <Mic size={32} />}
              </button>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                {isListening ? '🎙️ Escuchando... Habla ahora con claridad' : 'Pulsa el micrófono para dictar'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Menciona el nombre del cliente, la calle, el tipo de cargador, los metros de cable y si hace falta boletín CIE.
              </p>
            </div>

            {/* TRANSCRIPTION BOX */}
            <div className="text-left bg-white p-4 rounded-2xl border border-slate-200 min-h-[90px] text-xs font-medium text-slate-800 relative">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Transcripción en tiempo real:
              </span>
              {transcript || interimTranscript ? (
                <p className="leading-relaxed">
                  {transcript} <span className="text-blue-500 italic">{interimTranscript}</span>
                </p>
              ) : (
                <p className="text-slate-400 italic">
                  &quot;Ejemplo: Instalar un cargador para Pedro Ramírez en Calle Ejemplo 12 con 25 metros de cable y boletín CIE…&quot;
                </p>
              )}
            </div>

            {/* ACTION BUTTONS FOR DICTATION */}
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              <button
                onClick={() => handleAnalyzeText()}
                disabled={(!transcript && !interimTranscript) || isAnalyzing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-40 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Analizando…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Preparar borrador
                  </>
                )}
              </button>

              {(transcript || interimTranscript) && (
                <button
                  onClick={() => {
                    setTranscript('');
                    setInterimTranscript('');
                    setParsedData(null);
                  }}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* QUICK PROMPT SAMPLES */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-600 block">O prueba un ejemplo predefinido con un clic:</span>
            <div className="space-y-1.5">
              {samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTranscript(prompt);
                    handleAnalyzeText(prompt);
                  }}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-900 text-xs transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span className="truncate pr-3">{prompt}</span>
                  <ArrowRight size={14} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* PARSED RESULT PREVIEW */}
          {parsedData && (
            <div className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-200 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  Borrador preparado (revísalo antes de guardar)
                </div>
                <span className="text-xs font-black bg-emerald-200/80 text-emerald-900 px-2.5 py-0.5 rounded-full">
                  Margen Estimado: {parsedData.margen}%
                </span>
              </div>

              {/* CLIENT VALIDATION CARD */}
              <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Comprobación de Cliente en Base de Datos
                  </span>
                  {clientStatus === 'existing' ? (
                    <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck size={12} /> Cliente Registrado
                    </span>
                  ) : (
                    <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle size={12} /> Nuevo Cliente (Se dará de alta)
                    </span>
                  )}
                </div>

                {clientStatus === 'existing' && matchedClient ? (
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          {matchedClient.nombre}
                          <span className="font-mono text-[10px] bg-white text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                            {matchedClient.nif}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {matchedClient.email} • {matchedClient.telefono}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          📍 {matchedClient.direccion}, {matchedClient.ciudad}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setClientStatus('new');
                          setMatchedClient(null);
                          setClientConfirmed(true);
                        }}
                        className="text-[10px] text-slate-500 hover:text-blue-600 underline font-bold"
                      >
                        No es este cliente
                      </button>
                    </div>

                    <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-700">
                        {clientConfirmed 
                          ? '✓ Confirmado: Se asignará a la ficha de este cliente'
                          : '¿Confirmas que es el cliente adecuado?'
                        }
                      </span>
                      {!clientConfirmed ? (
                        <button
                          type="button"
                          onClick={() => setClientConfirmed(true)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={13} /> Confirmar Cliente
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setClientConfirmed(false)}
                          className="text-[10px] text-blue-700 hover:underline font-bold"
                        >
                          Cambiar
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2.5">
                    <p className="text-xs text-amber-900 font-medium">
                      El cliente <strong>&quot;{parsedData.clienteNombre}&quot;</strong> no existe en tu base de datos. Se registrará automáticamente como nuevo cliente al generar el presupuesto.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">NIF / CIF (Opcional)</label>
                        <input
                          type="text"
                          value={newClientNif}
                          onChange={(e) => setNewClientNif(e.target.value)}
                          placeholder="Ej. 12345678Z"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Email (Opcional)</label>
                        <input
                          type="email"
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          placeholder="correo@cliente.es"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Teléfono (Opcional)</label>
                        <input
                          type="text"
                          value={newClientTelefono}
                          onChange={(e) => setNewClientTelefono(e.target.value)}
                          placeholder="+34 600 000 000"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-bold">Cliente Detectado:</span>
                  <p className="font-black text-slate-900">{parsedData.clienteNombre}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Dirección:</span>
                  <p className="font-black text-slate-900 truncate">{parsedData.direccion}</p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Partidas y Materiales Computados ({parsedData.partidas.length}):</span>
                <div className="divide-y divide-emerald-100 bg-white rounded-2xl border border-emerald-200 overflow-hidden">
                  {parsedData.partidas.map((part, idx) => (
                    <div key={idx} className="p-3 text-xs flex items-center justify-between">
                      <div className="pr-3">
                        <p className="font-bold text-slate-900">{part.concepto}</p>
                        <p className="text-[10px] text-slate-500">
                          {part.categoria} • Coste interno: {formatCurrency(part.costeInternoTotal || 0)}
                        </p>
                      </div>
                      <span className="font-black text-slate-900 shrink-0">
                        {formatCurrency(part.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-[11px] text-slate-600 font-bold">
                    Coste Materiales: <strong>{formatCurrency(parsedData.totalCoste)}</strong>
                  </p>
                  <p className="text-sm font-black text-slate-900">
                    Total con IVA 21 %: {formatCurrency(parsedData.totalVenta * 1.21)}
                  </p>
                </div>

                <button
                  onClick={handleConfirmAndCreate}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} /> Crear borrador y abrir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
