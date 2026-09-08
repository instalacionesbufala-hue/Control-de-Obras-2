import React, { useRef, useState } from 'react';
import { Users, Plus, Search, HardHat, FolderOpen, Image as ImageIcon, Phone, Mail, FileText, ChevronRight, X, BadgeEuro, Download, Upload, Trash2, Edit3, Eye, LayoutGrid, List, MapPin, Video } from 'lucide-react';
import { Client, Project, Invoice, ProjectPhoto, ProjectDocument, TipoCliente } from '../types';
import { formatCurrency, uid, telefonoWhatsApp } from '../utils/formatters';
import { hoyISO } from '../utils/dates';
import { prepararMedia, subirADrive, tamanoLegible } from '../lib/drive';

interface Props {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  onCreateClient: (client: Client) => void;
  onUpdateClient: (clientId: string, campos: Partial<Client>) => void;
  onDeleteClient: (clientId: string) => void;
  onSelectProject: (projectId: string) => void;
  hayDrive?: boolean; // cuenta de Google vinculada: los archivos van a su Drive
  onAviso?: (texto: string, tipo?: 'ok' | 'error' | 'info') => void;
}

const TIPOS: Array<{ id: TipoCliente; label: string }> = [
  { id: 'particular', label: 'Particular' },
  { id: 'pyme', label: 'Pyme / autónomo' },
  { id: 'comunidad', label: 'Comunidad' },
  { id: 'gran_empresa', label: 'Gran empresa' },
];

const LIMITE_ADJUNTO = 400 * 1024; // 400 KB por archivo incrustado

const formVacio = { nombre: '', nif: '', email: '', telefono: '', direccion: '', ciudad: '', codigoPostal: '', notas: '', exigirFirma: true, tipoCliente: 'particular' as TipoCliente };

export const ClientsView: React.FC<Props> = ({ clients, projects, invoices, onCreateClient, onUpdateClient, onDeleteClient, onSelectProject, hayDrive = false, onAviso }) => {
  const [busqueda, setBusqueda] = useState('');
  const [modo, setModo] = useState<'tarjetas' | 'lista'>(() => (localStorage.getItem('obracontrol-clientes-modo') as any) || 'tarjetas');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | TipoCliente>('todos');
  const [seleccionado, setSeleccionado] = useState<Client | null>(null);
  const [pestana, setPestana] = useState<'info' | 'obras' | 'fotos' | 'docs' | 'facturas'>('info');
  // Un cliente puede tener varias obras y cada una sus propias fotos y documentos.
  // Aquí se elige cuál se está mirando; 'todas' agrupa por obra.
  const [obraSel, setObraSel] = useState<string>('todas');
  const [editando, setEditando] = useState<Client | null>(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [aBorrar, setABorrar] = useState<Client | null>(null);
  const [fotoZoom, setFotoZoom] = useState<ProjectPhoto | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const cambiarModo = (m: 'tarjetas' | 'lista') => {
    setModo(m);
    localStorage.setItem('obracontrol-clientes-modo', m);
  };

  const cliente = seleccionado ? clients.find((c) => c.id === seleccionado.id) || seleccionado : null;

  const abrirFicha = (c: Client) => {
    setSeleccionado(c);
    setPestana('info');
    setObraSel('todas');
  };

  const filtrados = clients.filter((c) => {
    if (tipoFiltro !== 'todos' && (c.tipoCliente || 'particular') !== tipoFiltro) return false;
    const q = busqueda.toLowerCase();
    return !q || c.nombre.toLowerCase().includes(q) || c.nif.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.telefono || '').includes(q) || (c.obraPrincipal || '').toLowerCase().includes(q);
  });

  const abrirCrear = () => {
    setForm(formVacio);
    setCreando(true);
  };
  const abrirEditar = (c: Client) => {
    setForm({ nombre: c.nombre, nif: c.nif, email: c.email, telefono: c.telefono, direccion: c.direccion, ciudad: c.ciudad, codigoPostal: c.codigoPostal, notas: c.notas || '', exigirFirma: c.exigirFirma !== false, tipoCliente: c.tipoCliente || 'particular' });
    setEditando(c);
  };
  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    if (editando) {
      onUpdateClient(editando.id, { ...form, nombre: form.nombre.trim(), nif: form.nif.trim().toUpperCase() });
      setEditando(null);
    } else {
      onCreateClient({ id: uid('cli'), ...form, nombre: form.nombre.trim(), nif: form.nif.trim().toUpperCase(), totalFacturado: 0, obrasCount: 0, documentosCount: 0, fotos: [], documentos: [], fechaAlta: hoyISO() });
      setCreando(false);
    }
  };

  const leerArchivo = (file: File): Promise<string | undefined> => new Promise((res) => {
    if (file.size > LIMITE_ADJUNTO) return res(undefined);
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => res(undefined);
    r.readAsDataURL(file);
  });

  // Los archivos del cliente van a su carpeta de Drive, igual que los de obra.
  // Sin Drive se guardan dentro de la app y gastan del limitado espacio de la nube.
  const carpetaCliente = (c: Client) => ({ codigo: 'Cliente', nombre: c.nombre });

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !cliente) return;
    try {
      const m = await prepararMedia(file, carpetaCliente(cliente), { hayDrive, limiteSinDrive: LIMITE_ADJUNTO });
      const foto: ProjectPhoto = { id: uid('foto'), url: m.url, titulo: m.titulo, fecha: hoyISO(), tipo: 'despues', driveFileId: m.driveFileId, driveEnlace: m.driveEnlace, nombreArchivo: m.nombreArchivo, tamano: m.tamano, esVideo: m.esVideo };
      onUpdateClient(cliente.id, { fotos: [...(cliente.fotos || []), foto] });
      onAviso?.(`${m.esVideo ? 'Vídeo' : 'Foto'} de ${tamanoLegible(m.tamano)} añadido. ${m.aviso || ''}`, 'ok');
    } catch (err: any) {
      onAviso?.(err?.message || 'No se pudo guardar el archivo.', 'error');
    }
  };
  const subirDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !cliente) return;
    const nombreL = file.name.toLowerCase();
    const tipoDoc = (nombreL.includes('cie') ? 'CIE' : nombreL.includes('memoria') ? 'Memoria' : nombreL.includes('presu') ? 'Presupuesto' : 'Otro') as ProjectDocument['tipo'];
    if (hayDrive) {
      try {
        const subido = await subirADrive(file, file.name, 'Cliente', cliente.nombre);
        const doc: ProjectDocument = { id: uid('doc'), nombre: file.name, tipo: tipoDoc, fecha: hoyISO(), tamano: `${(file.size / 1024).toFixed(0)} KB`, estado: 'Aprobado', driveFileId: subido.id, driveEnlace: subido.enlace, tamanoBytes: subido.tamano, mime: file.type };
        onUpdateClient(cliente.id, { documentos: [...(cliente.documentos || []), doc], documentosCount: (cliente.documentos?.length || 0) + 1 });
        onAviso?.(`Documento subido a tu Drive (${tamanoLegible(subido.tamano)}), carpeta «Cliente ${cliente.nombre}».`, 'ok');
      } catch (err: any) {
        onAviso?.(err?.message || 'No se pudo subir el documento.', 'error');
      }
      return;
    }
    const dataUrl = await leerArchivo(file);
    const nombre = nombreL;
    const doc: ProjectDocument = { id: uid('doc'), nombre: file.name, tipo: nombre.includes('cie') ? 'CIE' : nombre.includes('memoria') ? 'Memoria' : nombre.includes('presu') ? 'Presupuesto' : 'Otro', fecha: hoyISO(), tamano: `${(file.size / 1024).toFixed(0)} KB`, estado: 'Aprobado', dataUrl, notas: dataUrl ? undefined : 'Archivo grande: solo se guarda el nombre (guárdalo en tu Drive).' };
    onUpdateClient(cliente.id, { documentos: [...(cliente.documentos || []), doc], documentosCount: (cliente.documentos?.length || 0) + 1 });
    e.target.value = '';
  };
  const descargar = (d: ProjectDocument) => {
    if (!d.dataUrl) return alert('Este documento no tiene archivo adjunto guardado en la app.');
    const a = document.createElement('a');
    a.href = d.dataUrl;
    a.download = d.nombre;
    a.click();
  };

  const tipoLabel = (t?: TipoCliente) => TIPOS.find((x) => x.id === (t || 'particular'))?.label || 'Particular';

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Users className="text-blue-600" size={28} /> Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">Fichas con obras, facturas, fotos y documentos. El interruptor "exigir firma" decide si cada presupuesto necesita firma manuscrita.</p>
        </div>
        <button onClick={abrirCrear} className="bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto cursor-pointer"><Plus size={16} /> Nuevo cliente</button>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:w-96"><Search className="absolute left-4 top-3 text-slate-400" size={18} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl bg-slate-50/80 text-xs font-medium focus:bg-white outline-none" placeholder="Buscar por nombre, NIF, teléfono, email u obra…" /></div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as any)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50 text-slate-700 cursor-pointer"><option value="todos">Todos los tipos</option>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => cambiarModo('tarjetas')} className={`p-2 rounded-lg cursor-pointer ${modo === 'tarjetas' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500'}`} title="Tarjetas"><LayoutGrid size={16} /></button>
            <button onClick={() => cambiarModo('lista')} className={`p-2 rounded-lg cursor-pointer ${modo === 'lista' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500'}`} title="Lista"><List size={16} /></button>
          </div>
          <span className="text-xs font-bold text-slate-500 hidden md:block">{filtrados.length} de {clients.length}</span>
        </div>
      </div>

      {filtrados.length === 0 && <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-sm">No hay clientes que coincidan. <button onClick={abrirCrear} className="text-blue-600 font-bold hover:underline cursor-pointer">Crea el primero</button>.</div>}

      {modo === 'tarjetas' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtrados.map((c) => {
            const obras = projects.filter((p) => p.clienteId === c.id);
            const facturado = invoices.filter((i) => i.clienteId === c.id && !['Anulada', 'Rectificada'].includes(i.estado)).reduce((a, b) => a + b.total, 0);
            return (
              <div key={c.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-blue-300 transition-all overflow-hidden flex flex-col group">
                <div className="p-5 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-lg">{c.nombre[0]}</div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono font-bold bg-white border border-slate-200/80 px-2 py-0.5 rounded-lg text-slate-600">{c.nif || 'sin NIF'}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${c.exigirFirma === false ? 'bg-amber-50 text-amber-700 border-amber-200/80' : 'bg-blue-50 text-blue-700 border-blue-200/80'}`}>{c.exigirFirma === false ? 'Sin firma (pedido)' : 'Exige firma'}</span>
                    </div>
                  </div>
                  <h3 className="font-black text-slate-900 text-base leading-tight group-hover:text-blue-600 transition-colors">{c.nombre}</h3>
                  <p className="text-[11px] text-slate-500 mt-1">{tipoLabel(c.tipoCliente)}{c.ciudad ? ` · ${c.ciudad}` : ''}</p>
                  {c.email && <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 truncate"><Mail size={13} className="text-slate-400 shrink-0" /> {c.email}</p>}
                  {c.telefono && <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {c.telefono}</p>}
                </div>
                <div className="p-5 space-y-3 flex-1">
                  {obras[0] && <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-2xl"><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Última obra</p><p className="text-xs font-bold text-slate-800 leading-snug">{obras[0].nombre}</p><p className="text-[10px] text-slate-500 mt-0.5">{obras[0].obraCodigo || obras[0].codigo} · {obras[0].estado}</p></div>}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/60"><p className="text-[10px] font-bold text-slate-400 uppercase">Facturado</p><p className="font-black text-slate-900 mt-0.5">{formatCurrency(facturado)}</p></div>
                    <div className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/60"><p className="text-[10px] font-bold text-slate-400 uppercase">Obras</p><p className="font-black text-slate-900 mt-0.5">{obras.length}</p></div>
                  </div>
                </div>
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(c)} title="Editar" className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"><Edit3 size={14} /></button>
                    <button onClick={() => setABorrar(c)} title="Eliminar" className="p-1.5 hover:bg-rose-100 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 size={14} /></button>
                    {telefonoWhatsApp(c.telefono) && <a href={`https://wa.me/${telefonoWhatsApp(c.telefono)}`} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-600"><Phone size={14} /></a>}
                    <span className="text-[11px] font-bold text-slate-400 ml-1">{(c.documentos || []).length} docs · {(c.fotos || []).length} fotos</span>
                  </div>
                  <button onClick={() => abrirFicha(c)} className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer">Abrir ficha <ChevronRight size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider"><tr><th className="p-3">Cliente</th><th className="p-3">NIF</th><th className="p-3">Tipo</th><th className="p-3">Contacto</th><th className="p-3">Dirección</th><th className="p-3 text-center">Firma</th><th className="p-3 text-right">Obras</th><th className="p-3 text-right">Facturado</th><th className="p-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((c) => {
                  const obras = projects.filter((p) => p.clienteId === c.id).length;
                  const facturado = invoices.filter((i) => i.clienteId === c.id && !['Anulada', 'Rectificada'].includes(i.estado)).reduce((a, b) => a + b.total, 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => abrirFicha(c)}>
                      <td className="p-3 font-bold text-slate-900">{c.nombre}</td>
                      <td className="p-3 font-mono text-slate-600">{c.nif || '—'}</td>
                      <td className="p-3 text-slate-600">{tipoLabel(c.tipoCliente)}</td>
                      <td className="p-3 text-slate-600"><div>{c.telefono}</div><div className="text-[10px] text-slate-400">{c.email}</div></td>
                      <td className="p-3 text-slate-500 truncate max-w-[220px]">{[c.direccion, c.codigoPostal, c.ciudad].filter(Boolean).join(', ')}</td>
                      <td className="p-3 text-center">{c.exigirFirma === false ? <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg">No</span> : <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">Sí</span>}</td>
                      <td className="p-3 text-right font-bold">{obras}</td>
                      <td className="p-3 text-right font-black text-slate-900">{formatCurrency(facturado)}</td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-1"><button onClick={() => abrirEditar(c)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"><Edit3 size={14} /></button><button onClick={() => setABorrar(c)} className="p-1.5 hover:bg-rose-100 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 size={14} /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <input type="file" ref={photoInputRef} onChange={subirFoto} accept="image/*" className="hidden" />
      <input type="file" ref={docInputRef} onChange={subirDoc} accept=".pdf,.doc,.docx,.xml,.jpg,.jpeg,.png" className="hidden" />

      {/* FICHA */}
      {cliente && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-wider bg-blue-500 px-2 py-0.5 rounded">{tipoLabel(cliente.tipoCliente)}</span>{cliente.exigirFirma === false && <span className="text-[10px] font-bold bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded">Acepta sin firma</span>}</div>
                <h2 className="text-xl md:text-2xl font-black mt-1">{cliente.nombre}</h2>
                <p className="text-xs text-slate-400 mt-0.5">NIF <strong className="text-slate-200 font-mono">{cliente.nif || '—'}</strong> · {[cliente.direccion, cliente.codigoPostal, cliente.ciudad].filter(Boolean).join(', ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => abrirEditar(cliente)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Edit3 size={14} /> Editar</button>
                <button onClick={() => setSeleccionado(null)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"><X size={18} /></button>
              </div>
            </div>
            <div className="px-6 bg-slate-100/80 border-b border-slate-200 flex gap-2 pt-2 overflow-x-auto">
              {([['info', 'Resumen', Users], ['obras', `Obras (${projects.filter((p) => p.clienteId === cliente.id).length})`, HardHat], ['fotos', `Fotos del cliente (${(cliente.fotos || []).length})`, ImageIcon], ['docs', `Documentos del cliente (${(cliente.documentos || []).length})`, FolderOpen], ['facturas', `Facturas (${invoices.filter((i) => i.clienteId === cliente.id).length})`, BadgeEuro]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setPestana(id)} className={`px-4 py-2.5 font-bold text-xs rounded-t-xl flex items-center gap-2 cursor-pointer whitespace-nowrap ${pestana === id ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}><Icon size={14} /> {label}</button>
              ))}
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              {pestana === 'info' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5"><p className="font-black text-slate-900 uppercase text-[11px]">Contacto</p><p className="flex items-center gap-2"><Phone size={13} className="text-slate-400" /> {cliente.telefono || '—'}</p><p className="flex items-center gap-2"><Mail size={13} className="text-slate-400" /> {cliente.email || '—'}</p><p className="flex items-center gap-2"><MapPin size={13} className="text-slate-400" /> {[cliente.direccion, cliente.codigoPostal, cliente.ciudad].filter(Boolean).join(', ') || '—'}</p>{cliente.notas && <p className="text-slate-500 pt-1 border-t border-slate-200 italic">{cliente.notas}</p>}</div>
                    <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-1.5"><p className="font-black text-blue-900 uppercase text-[11px]">Aceptación de presupuestos</p><p className="text-blue-800">{cliente.exigirFirma === false ? 'No se exige firma manuscrita: acepta indicando nombre y CIF (validación por pedido).' : 'Se exige firma en pantalla además de nombre y DNI.'}</p><button onClick={() => onUpdateClient(cliente.id, { exigirFirma: !(cliente.exigirFirma !== false) })} className="mt-1 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-bold cursor-pointer">Cambiar a {cliente.exigirFirma === false ? 'exigir firma' : 'sin firma'}</button></div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><HardHat size={16} className="text-blue-600" /> Presupuestos y obras</h3>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                      {projects.filter((p) => p.clienteId === cliente.id).length === 0 ? <div className="p-6 text-center text-xs text-slate-400">Sin presupuestos ni obras.</div> : projects.filter((p) => p.clienteId === cliente.id).map((p) => (
                        <div key={p.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div><div className="flex items-center gap-2"><span className="text-[10px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{p.obraCodigo || p.codigo}</span><span className="font-bold text-slate-800">{p.nombre}</span></div><p className="text-[11px] text-slate-400 mt-0.5">{formatCurrency(p.presupuestoAceptado)} · {p.estado}{p.firmaCliente ? ` · aceptado por ${p.firmaCliente.firmadoPor}` : ''}</p></div>
                          <button onClick={() => { setSeleccionado(null); onSelectProject(p.id); }} className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold flex items-center gap-1 cursor-pointer">Abrir <ChevronRight size={13} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {pestana === 'obras' && (() => {
                // Cada obra con lo suyo: sus fotos, sus vídeos y sus documentos. Un cliente puede
                // tener varias y mezclarlo todo hace imposible encontrar nada.
                const obrasCli = projects.filter((p) => p.clienteId === cliente.id).sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
                const visibles = obraSel === 'todas' ? obrasCli : obrasCli.filter((p) => p.id === obraSel);
                if (obrasCli.length === 0) return <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-xs text-slate-400">Este cliente todavía no tiene presupuestos ni obras.</div>;
                return (
                  <div className="space-y-4">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                      <button onClick={() => setObraSel('todas')} className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer shrink-0 ${obraSel === 'todas' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Todas ({obrasCli.length})</button>
                      {obrasCli.map((p) => {
                        const n = (p.fotos || []).length + (p.documentos || []).length;
                        return (
                          <button key={p.id} onClick={() => setObraSel(p.id)} className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-1.5 ${obraSel === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={p.nombre}>
                            <span className="font-mono">{p.obraCodigo || p.codigo}</span>
                            <span className="max-w-[9rem] truncate font-normal opacity-80">{p.nombre}</span>
                            {n > 0 && <span className={`text-[10px] px-1.5 rounded-full ${obraSel === p.id ? 'bg-white/25' : 'bg-white'}`}>{n}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {visibles.map((p) => {
                      const fotos = p.fotos || [];
                      const docs = p.documentos || [];
                      const cie = docs.filter((d) => d.paraCie || d.tipo === 'CIE' || d.tipo === 'Memoria' || d.tipo === 'Planos');
                      return (
                        <div key={p.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{p.obraCodigo || p.codigo}</span>
                                <span className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{p.estado}</span>
                              </div>
                              <p className="font-bold text-slate-900 text-xs mt-1 truncate">{p.nombre}</p>
                              <p className="text-[10px] text-slate-500">{formatCurrency(p.presupuestoAceptado)} · {fotos.length} foto{fotos.length === 1 ? '' : 's'} · {docs.length} documento{docs.length === 1 ? '' : 's'}</p>
                            </div>
                            <button onClick={() => { setSeleccionado(null); onSelectProject(p.id); }} className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs cursor-pointer shrink-0 flex items-center gap-1">Abrir obra <ChevronRight size={13} /></button>
                          </div>
                          <div className="p-3.5 space-y-3">
                            {fotos.length === 0 && docs.length === 0 && <p className="text-xs text-slate-400 text-center py-3">Sin fotos ni documentos todavía. Se suben desde la ficha de la obra.</p>}
                            {fotos.length > 0 && (
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {fotos.map((m) => (
                                  <a key={m.id} href={m.driveEnlace || m.url} target="_blank" rel="noreferrer" className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100 block" title={m.titulo}>
                                    {m.url ? <img src={m.url} alt={m.titulo} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={18} /></span>}
                                    {m.esVideo && <span className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white"><Video size={18} /></span>}
                                  </a>
                                ))}
                              </div>
                            )}
                            {docs.length > 0 && (
                              <div className="space-y-1.5">
                                {cie.length > 0 && <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">{cie.length} de estos documentos sirven para el certificado de instalación eléctrica (CIE).</p>}
                                {docs.map((d) => (
                                  <div key={d.id} className="flex items-center gap-2 text-xs p-2 rounded-xl bg-slate-50 border border-slate-200">
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${d.paraCie || d.tipo === 'CIE' ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-600 border border-slate-200'}`}>{d.tipo}</span>
                                    <span className="flex-1 min-w-0"><span className="font-bold text-slate-800 block truncate">{d.nombre}</span><span className="text-[10px] text-slate-400">{d.fecha} · {d.tamano}</span></span>
                                    {(d.driveEnlace || d.dataUrl) && <a href={d.driveEnlace || d.dataUrl} target="_blank" rel="noreferrer" download={d.driveEnlace ? undefined : d.nombre} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold shrink-0">Abrir</a>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {pestana === 'fotos' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><h3 className="font-bold text-slate-800 text-sm">Fotos del cliente</h3><button onClick={() => photoInputRef.current?.click()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Upload size={14} /> Subir foto</button></div>
                  {(cliente.fotos || []).length === 0 ? <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-xs text-slate-400">Sin fotos. Las fotos de cada obra están en su expediente; aquí van las generales del cliente.</div> : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(cliente.fotos || []).map((f) => (
                        <div key={f.id} className="group relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                          <div className="aspect-4/3 bg-slate-900"><img src={f.url} alt={f.titulo} className="w-full h-full object-cover" /></div>
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1"><button onClick={() => setFotoZoom(f)} className="p-1.5 bg-slate-900/80 text-white rounded-lg cursor-pointer"><Eye size={13} /></button><button onClick={() => onUpdateClient(cliente.id, { fotos: (cliente.fotos || []).filter((x) => x.id !== f.id) })} className="p-1.5 bg-rose-600 text-white rounded-lg cursor-pointer"><Trash2 size={13} /></button></div>
                          <div className="p-2 bg-white text-xs"><p className="font-bold text-slate-800 truncate">{f.titulo}</p><p className="text-[10px] text-slate-400">{f.fecha}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {pestana === 'docs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-800 text-sm">Documentos</h3><p className="text-[11px] text-slate-400">Presupuestos aceptados, CIE, memorias. Archivos de hasta {LIMITE_ADJUNTO / 1024} KB se guardan dentro de la app.</p></div><button onClick={() => docInputRef.current?.click()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Upload size={14} /> Subir</button></div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {(cliente.documentos || []).length === 0 ? <div className="p-8 text-center text-xs text-slate-400">Sin documentos.</div> : (cliente.documentos || []).map((d) => (
                      <div key={d.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                        <div className="flex items-center gap-3 min-w-0"><div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><FileText size={18} /></div><div className="min-w-0"><p className="font-bold text-slate-800 truncate">{d.nombre}</p><p className="text-[11px] text-slate-400">{d.tipo} · {d.tamano} · {d.fecha}{d.notas ? ` · ${d.notas}` : ''}</p></div></div>
                        <div className="flex items-center gap-2 shrink-0"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.estado === 'Aprobado' || d.estado === 'Firmado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{d.estado}</span>{d.dataUrl && <button onClick={() => descargar(d)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"><Download size={14} /></button>}<button onClick={() => onUpdateClient(cliente.id, { documentos: (cliente.documentos || []).filter((x) => x.id !== d.id), documentosCount: Math.max(0, (cliente.documentos || []).length - 1) })} className="p-1.5 hover:bg-rose-100 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 size={14} /></button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pestana === 'facturas' && (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {invoices.filter((i) => i.clienteId === cliente.id).length === 0 ? <div className="p-8 text-center text-xs text-slate-400">Sin facturas.</div> : invoices.filter((i) => i.clienteId === cliente.id).map((i) => (
                    <div key={i.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs"><div><p className="font-bold text-slate-800">{i.numero} · {i.fecha}</p><p className="text-[11px] text-slate-400">{formatCurrency(i.total)} · {i.metodoPago}{i.obraCodigo ? ` · ${i.obraCodigo}` : ''}</p></div><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${i.estado === 'Pagada' ? 'bg-emerald-100 text-emerald-800' : i.estado === 'Anulada' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>{i.estado}</span></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fotoZoom && <div onClick={() => setFotoZoom(null)} className="fixed inset-0 bg-slate-950/90 flex items-center justify-center z-50 p-4 cursor-zoom-out"><img src={fotoZoom.url} alt={fotoZoom.titulo} className="max-h-[85vh] rounded-2xl object-contain" /></div>}

      {/* CREAR / EDITAR */}
      {(creando || editando) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-4 my-6">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100"><h3 className="font-black text-slate-900 text-base flex items-center gap-2">{editando ? <Edit3 size={18} className="text-blue-600" /> : <Users size={18} className="text-blue-600" />} {editando ? 'Editar cliente' : 'Nuevo cliente'}</h3><button onClick={() => { setCreando(false); setEditando(null); }} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button></div>
            <form onSubmit={guardar} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Nombre / razón social *</label><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold" /></div>
                <div><label className="block font-bold text-slate-700 mb-1">NIF / CIF <span className="text-slate-400 font-normal">(obligatorio para facturar)</span></label><input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value.toUpperCase() })} placeholder="12345678Z" className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Teléfono (WhatsApp)</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="600 000 000" className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
              </div>
              <div><label className="block font-bold text-slate-700 mb-1">Dirección</label><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Calle, número, piso / garaje" className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-bold text-slate-700 mb-1">Código postal</label><input value={form.codigoPostal} onChange={(e) => setForm({ ...form, codigoPostal: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 font-mono" /></div>
                <div><label className="block font-bold text-slate-700 mb-1">Ciudad</label><input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2" /></div>
              </div>
              <div><label className="block font-bold text-slate-700 mb-1">Notas internas</label><textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3 py-2 h-16 resize-none" /></div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Tipo de cliente</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TIPOS.map((t) => <button key={t.id} type="button" onClick={() => setForm({ ...form, tipoCliente: t.id, exigirFirma: t.id === 'gran_empresa' ? false : form.exigirFirma })} className={`py-1.5 px-2 rounded-xl font-bold text-center border cursor-pointer ${form.tipoCliente === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{t.label}</button>)}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                  <div className="pr-3"><label className="font-bold text-slate-800">Exigir firma en los presupuestos</label><p className="text-[11px] text-slate-500 mt-0.5">{form.exigirFirma ? 'Activado (por defecto): el cliente firma en pantalla además de indicar nombre y DNI.' : 'Desactivado: acepta solo con nombre y CIF. Pensado para grandes empresas que validan por pedido.'}</p></div>
                  <button type="button" onClick={() => setForm({ ...form, exigirFirma: !form.exigirFirma })} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.exigirFirma ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition ${form.exigirFirma ? 'translate-x-5' : 'translate-x-0'}`} /></button>
                </div>
              </div>
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => { setCreando(false); setEditando(null); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">Cancelar</button><button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md cursor-pointer">{editando ? 'Guardar cambios' : 'Guardar cliente'}</button></div>
            </form>
          </div>
        </div>
      )}

      {aBorrar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto"><Trash2 size={24} /></div>
            <div className="text-center space-y-1"><h3 className="font-black text-slate-900 text-base">¿Eliminar este cliente?</h3><p className="text-xs text-slate-500">Se elimina la ficha de <strong>{aBorrar.nombre}</strong>. Sus presupuestos, obras y facturas se conservan.</p></div>
            <div className="flex gap-2 pt-2"><button onClick={() => setABorrar(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer">Cancelar</button><button onClick={() => { onDeleteClient(aBorrar.id); if (seleccionado?.id === aBorrar.id) setSeleccionado(null); setABorrar(null); }} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer">Sí, eliminar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
