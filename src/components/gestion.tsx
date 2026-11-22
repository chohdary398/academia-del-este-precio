'use client';

import { useRef, useState } from 'react';

import { Modal } from '@/components/modal';
import {
  aplicarComando,
  calcularCuotas,
  formatoPesos,
  precioContado,
  validarServicio,
  type Comando,
  type Estado,
  type Perfil,
  type Servicio,
} from '@/domain/motor';

export type Sesion = { actor: string; perfil: Perfil };
const CATEGORIAS = ['Curso práctico', 'Clase suelta', 'Teórico virtual', 'Simulador'];
const f = formatoPesos;
const btn = 'rounded-md border-2 border-ink px-4 py-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-40';
const btnOk = `${btn} bg-brand text-white hover:bg-brand-dark`;
const btnSec = `${btn} bg-surface hover:bg-paper`;
const campo = 'mt-1 w-full rounded-md border-2 border-ink bg-surface px-3 py-2';
const th = 'px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-mute';
const td = 'px-3 py-3 align-top';

function Etiqueta({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}
const claseEstado: Record<string, string> = {
  Publicado: 'bg-brand text-white',
  Pausado: 'bg-line text-ink',
  Aprobada: 'bg-brand text-white',
  Pendiente: 'bg-accent text-ink',
  Rechazada: 'bg-ink text-white',
};

function Cartel({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mt-3 rounded-md border-2 border-red-700 bg-red-50 px-4 py-3 font-bold text-red-800" role="alert">
      {error}
    </p>
  );
}

/** Ejecuta un comando conservando el mismo ID para reintentos hasta que se aplique. */
function useEjecutor(estado: Estado, sesion: Sesion, onEstado: (e: Estado) => void) {
  const idRef = useRef<{ clave: string; id: string } | null>(null);
  return function ejecutar(tipo: string, entidadId: string, datos: unknown, motivo = ''): { ok: boolean; error?: string; estado?: Estado } {
    const clave = JSON.stringify([tipo, entidadId, datos, motivo, sesion.actor]);
    if (!idRef.current || idRef.current.clave !== clave)
      idRef.current = { clave, id: `CMD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}` };
    const c: Comando = { id: idRef.current.id, tipo, entidadId, actor: sesion.actor, perfil: sesion.perfil, instante: new Date().toISOString(), revisionEsperada: estado.revision, datos, motivo };
    const r = aplicarComando(estado, c, localStorage);
    if (r.ok) {
      idRef.current = null;
      onEstado(r.estado);
      return { ok: true, estado: r.estado };
    }
    if (r.estado) {
      idRef.current = null;
      onEstado(r.estado);
    }
    return { ok: false, error: r.error };
  };
}

type Props = { estado: Estado; sesion: Sesion; onEstado: (e: Estado) => void; recargar: () => void };

export function Gestion({ estado, sesion, onEstado, recargar }: Props) {
  const [pestana, setPestana] = useState<'cursos' | 'propuestas'>('cursos');
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <div>
      <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Gestión y Propuestas</h2>
      {sesion.perfil === 'Auditor' ? (
        <p className="mt-2 rounded-md border-2 border-ink bg-accent px-4 py-2 font-bold">Perfil Auditor: solo lectura. Los botones de cambio están deshabilitados.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {([['cursos', 'Cursos'], ['propuestas', 'Propuestas de Ajuste de Precios y Revisión']] as const).map(([k, l]) => (
          <button aria-selected={pestana === k} className={`${btn} ${pestana === k ? 'bg-ink text-white' : 'bg-surface hover:bg-paper'}`} key={k} onClick={() => setPestana(k)} role="tab" type="button">
            {l}
          </button>
        ))}
      </div>
      {aviso ? (
        <p className="mt-3 rounded-md bg-brand px-4 py-3 font-bold text-white" role="status">
          {aviso}
        </p>
      ) : null}
      {pestana === 'cursos' ? (
        <Cursos estado={estado} onAviso={setAviso} onEstado={onEstado} recargar={recargar} sesion={sesion} />
      ) : (
        <Propuestas estado={estado} onAviso={setAviso} onEstado={onEstado} recargar={recargar} sesion={sesion} />
      )}
      <ClaveAcceso estado={estado} onAviso={setAviso} onEstado={onEstado} recargar={recargar} sesion={sesion} />
    </div>
  );
}

type Sub = Props & { onAviso: (s: string | null) => void };

function Cursos({ estado, sesion, onEstado, onAviso, recargar }: Sub) {
  const servicios = estado.entidades.servicios;
  const [form, setForm] = useState(false);
  const [borrar, setBorrar] = useState<Servicio | null>(null);
  const [errorFila, setErrorFila] = useState<string | null>(null);
  const ejecutar = useEjecutor(estado, sesion, onEstado);
  const ro = sesion.perfil === 'Auditor';
  const pub = servicios.filter((s) => s.estado === 'Publicado').length;
  const pausados = servicios.filter((s) => s.estado === 'Pausado').length;
  const promo = servicios.filter((s) => s.promoDelMes).length;

  function alternar(s: Servicio) {
    onAviso(null);
    const r = ejecutar(s.estado === 'Publicado' ? 'pausar_servicio' : 'publicar_servicio', s.id, {}, s.estado === 'Publicado' ? 'Pausa desde el panel' : 'Publicación desde el panel');
    if (r.ok) { setErrorFila(null); onAviso(`«${s.nombre}» ahora está ${s.estado === 'Publicado' ? 'Pausado' : 'Publicado'}.`); }
    else setErrorFila(`No se pudo cambiar el estado de «${s.nombre}»: ${r.error}`);
  }

  return (
    <section className="mt-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Total de servicios', servicios.length], ['Publicados', pub], ['Pausados', pausados], ['En Promo del mes', promo]].map(([l, v]) => (
          <div className="rounded-card border-2 border-ink bg-surface p-3" key={l}>
            <dt className="text-xs font-bold uppercase text-mute">{l}</dt>
            <dd className="font-display text-3xl font-black">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={btnOk} disabled={ro} onClick={() => setForm(true)} type="button">+ Nuevo curso</button>
        <button className={btnSec} onClick={recargar} type="button">Actualizar datos</button>
      </div>
      <Cartel error={errorFila} />
      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-paper">
            <tr><th className={th}>Curso</th><th className={`${th} hidden sm:table-cell`}>Precios</th><th className={th}>Estado</th><th className={th}>Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {servicios.map((s) => (
              <tr key={s.id}>
                <td className={`${td} break-words`}>
                  <p className="font-semibold">{s.nombre}</p>
                  <p className="text-xs text-mute">{s.id} · {s.categoria} · {s.detalle}</p>
                  <p className="text-xs text-mute sm:hidden">Lista {f(s.precioLista)} · Contado {f(s.precioLista - s.descuentoContado)}</p>
                </td>
                <td className={`${td} hidden sm:table-cell`}>
                  <p>Lista {f(s.precioLista)}</p><p className="font-semibold">Contado {f(s.precioLista - s.descuentoContado)}</p>
                </td>
                <td className={td}>
                  <div className="flex flex-col items-start gap-1">
                    <Etiqueta cls={claseEstado[s.estado] ?? 'bg-paper'}>{s.estado}</Etiqueta>
                    {s.promoDelMes ? <Etiqueta cls="bg-accent text-ink">Promo del mes</Etiqueta> : null}
                  </div>
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-2">
                    <button className={btnSec} disabled={ro} onClick={() => alternar(s)} type="button">{s.estado === 'Publicado' ? 'Pausar' : 'Publicar'}</button>
                    <button className={btnSec} disabled={ro} onClick={() => setBorrar(s)} type="button">Borrar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form ? <FormCurso estado={estado} onCerrar={() => setForm(false)} onAviso={onAviso} ejecutar={ejecutar} /> : null}
      {borrar ? <ConfirmarBorrado ejecutar={ejecutar} onAviso={onAviso} onCerrar={() => setBorrar(null)} servicio={borrar} /> : null}
    </section>
  );
}

type Ejecutar = ReturnType<typeof useEjecutor>;

function ConfirmarBorrado({ servicio, ejecutar, onCerrar, onAviso }: { servicio: Servicio; ejecutar: Ejecutar; onCerrar: () => void; onAviso: (s: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={onCerrar} title="Borrar curso">
      <p className="font-bold">¿Confirmás borrar este curso? Desaparecerá del catálogo y de los contadores</p>
      <p className="mt-2">{servicio.nombre} ({servicio.id})</p>
      <Cartel error={error} />
      <div className="mt-4 flex gap-3">
        <button className={btnOk} onClick={() => {
          const r = ejecutar('borrar_servicio', servicio.id, { confirmado: true }, 'Borrado desde el panel');
          if (r.ok) { onAviso(`Se borró «${servicio.nombre}».`); onCerrar(); } else setError(`No se pudo borrar: ${r.error}`);
        }} type="button">Sí, borrar</button>
        <button className={btnSec} onClick={onCerrar} type="button">Cancelar</button>
      </div>
    </Modal>
  );
}

function VistaPrecios({ lista, descuento, cuotas }: { lista: number; descuento: number; cuotas: 1 | 3 }) {
  if (!(lista > 0) || descuento < 0 || descuento > lista / 2) return <p className="text-sm text-mute">Completá precio y descuento válidos para ver el cálculo.</p>;
  const c = calcularCuotas(lista, cuotas);
  return (
    <div className="rounded-md border-2 border-ink bg-paper p-3 text-sm" aria-live="polite">
      <p>Precio contado: <b>{f(precioContado(lista, descuento))}</b></p>
      <p>{cuotas === 1 ? `1 pago de ${f(c[0])}` : `3 cuotas: ${c.map((m, i) => `${i + 1}ª ${f(m)}`).join(' · ')}`}</p>
    </div>
  );
}

function FormCurso({ estado, ejecutar, onCerrar, onAviso }: { estado: Estado; ejecutar: Ejecutar; onCerrar: () => void; onAviso: (s: string) => void }) {
  const [v, setV] = useState({ nombre: '', categoria: CATEGORIAS[0], detalle: '', precioLista: '', descuentoContado: '0', cuotas: '3', promoDelMes: false, estado: 'Publicado' });
  const [errores, setErrores] = useState<string[]>([]);
  const set = (k: string, x: string | boolean) => setV((p) => ({ ...p, [k]: x }));
  const datos = { nombre: v.nombre, categoria: v.categoria, detalle: v.detalle.trim(), precioLista: Number(v.precioLista), descuentoContado: Number(v.descuentoContado || 0), cuotas: Number(v.cuotas) as 1 | 3, promoDelMes: v.promoDelMes, estado: v.estado as Servicio['estado'] };
  return (
    <Modal onClose={onCerrar} title="Nuevo curso">
      <form onSubmit={(e) => {
        e.preventDefault();
        const val = validarServicio(estado.entidades.servicios, datos);
        if (val.length) { setErrores(val); return; }
        const r = ejecutar('crear_servicio', '', datos, 'Alta desde el panel');
        if (r.ok) { onAviso(`Se creó «${datos.nombre.trim()}».`); onCerrar(); }
        else setErrores([`No se guardó: ${r.error}`]);
      }}>
        <div className="grid gap-3">
          <label className="text-sm font-bold">Nombre<input className={campo} onChange={(e) => set('nombre', e.target.value)} value={v.nombre} /></label>
          <label className="text-sm font-bold">Categoría
            <select className={campo} onChange={(e) => set('categoria', e.target.value)} value={v.categoria}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="text-sm font-bold">Cantidad y duración de clases<input className={campo} onChange={(e) => set('detalle', e.target.value)} placeholder="Ej.: 10 clases de 45 minutos" value={v.detalle} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">Precio de lista ($)<input className={campo} inputMode="numeric" min="0" onChange={(e) => set('precioLista', e.target.value)} type="number" value={v.precioLista} /></label>
            <label className="text-sm font-bold">Descuento contado ($)<input className={campo} inputMode="numeric" min="0" onChange={(e) => set('descuentoContado', e.target.value)} type="number" value={v.descuentoContado} /></label>
            <label className="text-sm font-bold">Cuotas
              <select className={campo} onChange={(e) => set('cuotas', e.target.value)} value={v.cuotas}><option value="1">1</option><option value="3">3</option></select>
            </label>
            <label className="text-sm font-bold">Estado inicial
              <select className={campo} onChange={(e) => set('estado', e.target.value)} value={v.estado}><option>Publicado</option><option>Pausado</option></select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold"><input checked={v.promoDelMes} onChange={(e) => set('promoDelMes', e.target.checked)} type="checkbox" /> Promo del mes</label>
          <VistaPrecios cuotas={datos.cuotas} descuento={datos.descuentoContado} lista={datos.precioLista} />
        </div>
        {errores.length ? <Cartel error={errores.join(' · ')} /> : null}
        <div className="mt-4 flex gap-3">
          <button className={btnOk} type="submit">Guardar curso</button>
          <button className={btnSec} onClick={onCerrar} type="button">Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}

function Propuestas({ estado, sesion, onEstado, onAviso }: Sub) {
  const { servicios, propuestas } = estado.entidades;
  const ejecutar = useEjecutor(estado, sesion, onEstado);
  const [nueva, setNueva] = useState(false);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nombre = (id: string) => servicios.find((s) => s.id === id)?.nombre ?? `${id} (borrado)`;
  const ro = sesion.perfil === 'Auditor';
  const esRevisor = sesion.perfil === 'Revisor';
  const cambiosTxt = (c: Partial<Servicio>) => [c.precioLista !== undefined ? `Lista ${f(c.precioLista)}` : '', c.descuentoContado !== undefined ? `Descuento ${f(c.descuentoContado)}` : ''].filter(Boolean).join(' · ');

  function aprobar(id: string) {
    onAviso(null);
    const r = ejecutar('aprobar_propuesta', id, {}, 'Aprobada');
    if (r.ok) { setError(null); onAviso(`Aprobaste ${id}: el precio del curso ya está actualizado.`); } else setError(r.error ?? 'Error');
  }
  function rechazar(id: string) {
    const r = ejecutar('rechazar_propuesta', id, {}, motivo);
    if (r.ok) { setError(null); setRechazando(null); setMotivo(''); onAviso(`Rechazaste ${id}. El curso no cambió.`); } else setError(r.error ?? 'Error');
  }

  return (
    <section className="mt-6">
      <p className="text-mute">Una propuesta pendiente no cambia los precios vigentes hasta que un Revisor la aprueba.</p>
      <div className="mt-3"><button className={btnOk} disabled={ro} onClick={() => setNueva(true)} type="button">+ Nueva propuesta</button></div>
      <Cartel error={error} />
      <ul className="mt-4 grid gap-3">
        {propuestas.map((p) => {
          const s = servicios.find((x) => x.id === p.servicioId);
          return (
            <li className="rounded-card border-2 border-ink bg-surface p-4" key={p.id}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{p.id}</b><Etiqueta cls={claseEstado[p.estado]}>{p.estado}</Etiqueta>
                <span className="text-xs text-mute">Registro {p.servicioId}{p.revisionBase !== undefined ? ` · versión de partida: revisión ${p.revisionBase}` : ''}</span>
              </div>
              <p className="mt-1 font-semibold">{nombre(p.servicioId)}</p>
              <p className="text-sm">Vigente: {s ? `Lista ${f(s.precioLista)} · Descuento ${f(s.descuentoContado)}` : '—'}</p>
              <p className="text-sm">Propuesto: <b>{cambiosTxt(p.cambios)}</b></p>
              <p className="text-sm text-mute">Creada por {p.creador}. Motivo: {p.motivo}</p>
              {p.motivoDecision ? <p className="text-sm text-mute">Decisión de {p.decididaPor}: {p.motivoDecision}</p> : null}
              {p.estado === 'Pendiente' ? (
                rechazando === p.id ? (
                  <div className="mt-3">
                    <label className="text-sm font-bold">Motivo del rechazo (obligatorio)<input className={campo} onChange={(e) => setMotivo(e.target.value)} value={motivo} /></label>
                    <div className="mt-2 flex gap-2"><button className={btnOk} onClick={() => rechazar(p.id)} type="button">Confirmar rechazo</button><button className={btnSec} onClick={() => setRechazando(null)} type="button">Cancelar</button></div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button className={btnOk} disabled={ro} onClick={() => aprobar(p.id)} type="button">Aprobar</button>
                    <button className={btnSec} disabled={ro} onClick={() => { setError(null); setRechazando(p.id); }} type="button">Rechazar</button>
                    {!ro && !esRevisor ? <span className="text-xs text-mute">Solo el perfil Revisor puede decidir.</span> : null}
                  </div>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      {nueva ? <FormPropuesta ejecutar={ejecutar} estado={estado} onAviso={onAviso} onCerrar={() => setNueva(false)} /> : null}
    </section>
  );
}

function FormPropuesta({ estado, ejecutar, onCerrar, onAviso }: { estado: Estado; ejecutar: Ejecutar; onCerrar: () => void; onAviso: (s: string) => void }) {
  const servicios = estado.entidades.servicios;
  const [sid, setSid] = useState(servicios[0]?.id ?? '');
  const s = servicios.find((x) => x.id === sid);
  const [lista, setLista] = useState('');
  const [desc, setDesc] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal onClose={onCerrar} title="Nueva propuesta de ajuste">
      <form onSubmit={(e) => {
        e.preventDefault();
        const cambios: Partial<Servicio> = {};
        if (lista !== '') cambios.precioLista = Number(lista);
        if (desc !== '') cambios.descuentoContado = Number(desc);
        if (!Object.keys(cambios).length) { setError('Indicá un nuevo precio de lista o un nuevo descuento'); return; }
        if (!motivo.trim()) { setError('Indicá el motivo de la propuesta'); return; }
        const r = ejecutar('crear_propuesta', sid, { cambios }, motivo.trim());
        if (r.ok) { onAviso('Propuesta creada. Queda pendiente de revisión.'); onCerrar(); } else setError(`No se guardó: ${r.error}`);
      }}>
        <label className="text-sm font-bold">Curso (registro)
          <select className={campo} onChange={(e) => setSid(e.target.value)} value={sid}>{servicios.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.nombre}</option>)}</select>
        </label>
        <p className="mt-2 text-sm text-mute">Versión de partida: revisión {estado.revision}{s ? ` · hoy Lista ${f(s.precioLista)}, Descuento ${f(s.descuentoContado)}` : ''}</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">Nuevo precio de lista<input className={campo} min="0" onChange={(e) => setLista(e.target.value)} type="number" value={lista} /></label>
          <label className="text-sm font-bold">Nuevo descuento contado<input className={campo} min="0" onChange={(e) => setDesc(e.target.value)} type="number" value={desc} /></label>
        </div>
        <label className="mt-3 block text-sm font-bold">Motivo (obligatorio)<input className={campo} onChange={(e) => setMotivo(e.target.value)} value={motivo} /></label>
        <Cartel error={error} />
        <div className="mt-4 flex gap-3"><button className={btnOk} type="submit">Crear propuesta</button><button className={btnSec} onClick={onCerrar} type="button">Cancelar</button></div>
      </form>
    </Modal>
  );
}

function ClaveAcceso({ estado, sesion, onEstado, onAviso }: Sub) {
  const ejecutar = useEjecutor(estado, sesion, onEstado);
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ro = sesion.perfil === 'Auditor';
  return (
    <section className="mt-10 rounded-card border-2 border-ink bg-surface p-4">
      <h3 className="font-display text-xl font-extrabold">Clave de acceso al panel</h3>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="text-sm font-bold">Nueva clave<input className={campo} disabled={ro} onChange={(e) => setClave(e.target.value)} type="password" value={clave} /></label>
        <button className={btnOk} disabled={ro} onClick={() => {
          const r = ejecutar('cambiar_clave', 'CONFIG', { clave }, 'Cambio de clave');
          if (r.ok) { setClave(''); setError(null); onAviso('La clave de acceso se cambió.'); } else setError(r.error ?? 'Error');
        }} type="button">Cambiar clave</button>
      </div>
      <Cartel error={error} />
    </section>
  );
}
