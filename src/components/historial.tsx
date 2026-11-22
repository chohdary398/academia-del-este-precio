'use client';

import { useMemo, useState } from 'react';
import { formatoPesos, type ComandoAplicado, type Estado, type Evento } from '@/domain/motor';

const ETIQUETAS: Record<string, string> = {
  nombre: 'Nombre', categoria: 'Categoría', detalle: 'Detalle', precioLista: 'Precio Lista',
  descuentoContado: 'Descuento contado', cuotas: 'Cuotas', promoDelMes: 'Promo del mes', estado: 'Estado',
};
const TIPOS: Record<string, string> = {
  crear_servicio: 'Alta de servicio', editar_servicio: 'Actualización de servicio', publicar_servicio: 'Publicación de servicio',
  pausar_servicio: 'Pausa de servicio', borrar_servicio: 'Baja de servicio', crear_propuesta: 'Creación de propuesta',
  aprobar_propuesta: 'Aprobación de propuesta', rechazar_propuesta: 'Rechazo de propuesta', ejecutar_cierre: 'Cierre de lista',
  cambiar_clave: 'Cambio de clave de acceso',
};
const tipoLegible = (t: string) => TIPOS[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ');
const PRECIO = ['precioLista', 'descuentoContado'];
const ALTAS = ['crear_servicio', 'borrar_servicio', 'publicar_servicio', 'pausar_servicio'];

const valor = (k: string, v: unknown) => {
  if (v === undefined || v === null) return '—';
  if (PRECIO.includes(k) && typeof v === 'number') return formatoPesos(v);
  if (k === 'cuotas') return v === 1 ? '1 pago' : `${v} cuotas`;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v);
};
const personaPerfil = (actor: string) => actor.replace(/\s*\((.*)\)\s*$/, ' — $1');

type Dict = Record<string, unknown>;
const dic = (x: unknown): Dict => (x && typeof x === 'object' ? (x as Dict) : {});

/** Valores congelados antes/después, leídos del evento: no se recalculan desde el estado actual. */
function instantanea(e: Evento): { clave: string; antes: string; despues: string }[] {
  const d = e.detalle;
  const antes = dic(d.antes);
  const despues = dic(d.despues ?? d.cambios ?? (e.tipo === 'ejecutar_cierre' || e.tipo === 'cambiar_clave' || e.tipo === 'rechazar_propuesta' ? {} : { precioLista: d.precioLista, descuentoContado: d.descuentoContado }));
  const claves = Array.from(new Set([...Object.keys(despues), ...Object.keys(antes)])).filter((k) => ETIQUETAS[k]);
  return claves.map((k) => ({ clave: ETIQUETAS[k], antes: valor(k, antes[k]), despues: valor(k, despues[k]) }));
}

function cambiaPrecio(e: Evento) {
  const d = e.detalle;
  const ks = [...Object.keys(dic(d.cambios)), ...Object.keys(dic(d.despues))];
  return ks.some((k) => PRECIO.includes(k)) && e.tipo !== 'crear_servicio' && e.tipo !== 'rechazar_propuesta';
}

function efecto(e: Evento): string {
  const d = e.detalle;
  const antes = dic(d.antes);
  switch (e.tipo) {
    case 'crear_servicio': return '+1 servicio en el catálogo';
    case 'borrar_servicio': return '−1 servicio del catálogo';
    case 'publicar_servicio': return `Estado: ${valor('estado', antes.estado)} → Publicado${antes.estado === 'Publicado' ? '' : ' (+1 servicio publicado)'}`;
    case 'pausar_servicio': return `Estado: ${valor('estado', antes.estado)} → Pausado (−1 servicio publicado)`;
    case 'editar_servicio': return cambiaPrecio(e) ? 'Cambio de precio sin alterar histórico' : 'Datos del servicio actualizados sin alterar histórico';
    case 'crear_propuesta': return '+1 propuesta pendiente';
    case 'aprobar_propuesta': return cambiaPrecio(e) ? 'Propuesta aprobada: cambio de precio aplicado sin alterar histórico' : 'Propuesta aprobada: cambios aplicados al servicio';
    case 'rechazar_propuesta': return 'Propuesta rechazada: el servicio no cambió';
    case 'ejecutar_cierre': return '+1 cierre registrado';
    case 'cambiar_clave': return 'Clave de acceso actualizada';
    default: return 'Movimiento registrado';
  }
}

type Fila = { ev: Evento; cmd?: ComandoAplicado };

export function Historial({ estado }: { estado: Estado }) {
  const zona = estado.configuracion.zonaHoraria;
  const { servicios, propuestas } = estado.entidades;

  const [vista, setVista] = useState<'movimientos' | 'comandos'>('movimientos');
  const [registro, setRegistro] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'aplicados' | 'rechazados' | 'precios' | 'altas'>('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const fechaHora = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { timeZone: zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' h';
  const dia = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: zona });
  const hoy = () => dia(new Date().toISOString());

  const nombres = useMemo(() => {
    const m = new Map<string, string>();
    servicios.forEach((s) => m.set(s.id, s.nombre));
    estado.eventos.forEach((e) => {
      if (!m.has(e.entidadId) && typeof e.detalle.borrado === 'string') m.set(e.entidadId, `${e.detalle.borrado} (dado de baja)`);
      if (!m.has(e.entidadId) && typeof e.detalle.nombre === 'string') m.set(e.entidadId, e.detalle.nombre);
    });
    return m;
  }, [servicios, estado.eventos]);
  const nombreEntidad = (id: string) => {
    const p = propuestas.find((x) => x.id === id);
    if (p) return `${id} · propuesta sobre ${nombres.get(p.servicioId) ?? p.servicioId}`;
    return nombres.get(id) ? `${id} · ${nombres.get(id)}` : id;
  };
  /** Un servicio abarca sus propias propuestas. */
  const coincideRegistro = (entidadId: string) => {
    if (!registro) return true;
    if (entidadId === registro) return true;
    return propuestas.some((p) => p.id === entidadId && p.servicioId === registro);
  };
  const enPeriodo = (iso: string) => {
    const d = dia(iso);
    return (!desde || d >= desde) && (!hasta || d <= hasta);
  };

  const cmdPorId = useMemo(() => new Map(estado.comandosAplicados.map((c) => [c.id, c])), [estado.comandosAplicados]);
  const filas: Fila[] = useMemo(() => [...estado.eventos].reverse().map((ev) => ({ ev, cmd: cmdPorId.get(ev.comandoId) })), [estado.eventos, cmdPorId]);
  const comandos = useMemo(() => [...estado.comandosAplicados].reverse(), [estado.comandosAplicados]);

  const filasVis = filas.filter(({ ev }) => {
    if (!coincideRegistro(ev.entidadId) || !enPeriodo(ev.instante)) return false;
    if (tipo === 'rechazados') return false;
    if (tipo === 'precios') return cambiaPrecio(ev);
    if (tipo === 'altas') return ALTAS.includes(ev.tipo);
    return true;
  });
  const comandosVis = comandos.filter((c) => {
    if (!coincideRegistro(c.entidadId) || !enPeriodo(c.instante)) return false;
    if (tipo === 'aplicados') return c.resultado === 'aplicado';
    if (tipo === 'rechazados') return c.resultado === 'rechazado';
    if (tipo === 'precios') {
      const ev = estado.eventos.find((e) => e.comandoId === c.id);
      return ev ? cambiaPrecio(ev) : PRECIO.some((k) => k in dic(dic(c.datos).cambios ?? c.datos));
    }
    if (tipo === 'altas') return ALTAS.includes(c.tipo);
    return true;
  });

  const hayFiltros = registro !== '' || tipo !== 'todos' || desde !== '' || hasta !== '';
  const limpiar = () => { setRegistro(''); setTipo('todos'); setDesde(''); setHasta(''); };
  const total = vista === 'movimientos' ? filas.length : comandos.length;
  const visibles = vista === 'movimientos' ? filasVis.length : comandosVis.length;

  const campo = 'w-full rounded-md border-2 border-ink bg-surface px-3 py-2';
  const rapido = 'rounded-md border-2 border-ink bg-surface px-3 py-2 text-sm font-bold hover:bg-accent';
  const opcionesServicio = servicios.map((s) => [s.id, `${s.id} · ${s.nombre}`] as const);
  nombres.forEach((n, id) => { if (!servicios.some((s) => s.id === id) && id.startsWith('SRV')) opcionesServicio.push([id, `${id} · ${n}`]); });

  return (
    <div>
      <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Historial y Auditoría</h2>
      <p className="mt-2 max-w-prose text-mute">
        Registro inmutable: los movimientos confirmados y los comandos recibidos no se pueden editar ni borrar. Cada valor se guarda tal como estaba en el momento del cambio.
      </p>

      <div className="mt-6 flex gap-2" role="tablist">
        {(['movimientos', 'comandos'] as const).map((k) => (
          <button
            aria-selected={vista === k}
            className={`rounded-md border-2 border-ink px-4 py-2 font-bold ${vista === k ? 'bg-ink text-white' : 'bg-surface hover:bg-paper'}`}
            key={k}
            onClick={() => setVista(k)}
            role="tab"
            type="button"
          >
            {k === 'movimientos' ? `Movimientos (${estado.eventos.length})` : `Log de comandos (${estado.comandosAplicados.length})`}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm font-bold">
          Registro / Servicio
          <select className={`${campo} mt-1 font-normal`} onChange={(e) => setRegistro(e.target.value)} value={registro}>
            <option value="">Todos los registros</option>
            {opcionesServicio.map(([id, txt]) => (
              <option key={id} value={id}>{txt}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Tipo de acción o estado
          <select className={`${campo} mt-1 font-normal`} onChange={(e) => setTipo(e.target.value as typeof tipo)} value={tipo}>
            <option value="todos">Todos</option>
            <option value="aplicados">Aplicados</option>
            <option value="rechazados">Rechazados</option>
            <option value="precios">Ajustes de precio</option>
            <option value="altas">Altas / Bajas / Estados</option>
          </select>
        </label>
        <label className="block text-sm font-bold">
          Desde
          <input className={`${campo} mt-1 font-normal`} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} type="date" value={desde} />
        </label>
        <label className="block text-sm font-bold">
          Hasta
          <input className={`${campo} mt-1 font-normal`} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} type="date" value={hasta} />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <button className={rapido} onClick={() => { setDesde(hoy()); setHasta(hoy()); }} type="button">Hoy</button>
          <button
            className={rapido}
            onClick={() => {
              const [y, m, d] = hoy().split('-').map(Number);
              setDesde(new Date(Date.UTC(y, m - 1, d - 6)).toISOString().slice(0, 10));
              setHasta(hoy());
            }}
            type="button"
          >
            Últimos 7 días
          </button>
          <button className={rapido} onClick={() => { setDesde(''); setHasta(''); }} type="button">Todo el historial</button>
        </div>
      </div>

      <p aria-live="polite" className="mt-4 font-bold">
        {visibles} de {total} {vista === 'movimientos' ? (total === 1 ? 'movimiento' : 'movimientos') : (total === 1 ? 'comando' : 'comandos')}
      </p>

      {visibles === 0 ? (
        <div className="mt-3 rounded-card border-2 border-dashed border-line bg-surface p-8 text-center">
          <p className="font-display text-xl font-extrabold">No hay resultados para estos filtros</p>
          <p className="mx-auto mt-2 max-w-prose text-mute">
            {vista === 'movimientos' && tipo === 'rechazados'
              ? 'Los comandos rechazados no generan movimientos. Los encontrás en el log de comandos.'
              : total === 0 ? 'Todavía no hay registros.' : 'Probá con otro registro, otro tipo de acción u otro período.'}
          </p>
          {hayFiltros ? (
            <button className="mt-4 rounded-md border-2 border-ink bg-accent px-5 py-3 font-bold" onClick={limpiar} type="button">Limpiar filtros</button>
          ) : null}
        </div>
      ) : vista === 'movimientos' ? (
        <ul className="mt-3 grid gap-4">
          {filasVis.map(({ ev, cmd }) => {
            const snap = instantanea(ev);
            return (
              <li className="rounded-card border border-line border-l-8 border-l-brand bg-surface p-4" key={ev.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-display text-lg font-extrabold">{tipoLegible(ev.tipo)}</p>
                  <p className="text-sm font-bold tabular-nums text-mute">
                    {ev.id} · {ev.comandoId}
                  </p>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Dato t="Fecha y hora" v={fechaHora(ev.instante)} />
                  <Dato t="Actor y perfil" v={personaPerfil(ev.actor)} />
                  <Dato t="Entidad afectada" v={nombreEntidad(ev.entidadId)} />
                  <Dato t="Motivo" v={cmd?.motivo || tipoLegible(ev.tipo)} />
                  <Dato t="Revisión" v={`Rev. ${ev.revision - 1} → Rev. ${ev.revision}`} />
                  <Dato t="Efecto" v={efecto(ev)} />
                </dl>
                {snap.length ? (
                  <div className="mt-3 rounded-md bg-paper p-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-mute">Valores congelados (antes → después)</p>
                    <ul className="mt-1 grid gap-1">
                      {snap.map((r) => (
                        <li className="break-words tabular-nums" key={r.clave}>
                          <span className="font-semibold">{r.clave}:</span> {r.antes} → {r.despues}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-3 grid gap-4">
          {comandosVis.map((c) => {
            const ok = c.resultado === 'aplicado';
            const ev = estado.eventos.find((e) => e.comandoId === c.id);
            return (
              <li className={`rounded-card border border-line border-l-8 bg-surface p-4 ${ok ? 'border-l-brand' : 'border-l-[#B3261E]'}`} key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 break-words font-display text-lg font-extrabold">
                    {c.id} · {tipoLegible(c.tipo)}
                  </p>
                  <span className={`rounded-sm px-2 py-0.5 text-xs font-bold text-white ${ok ? 'bg-brand' : 'bg-[#B3261E]'}`}>{ok ? 'Aplicado' : 'Rechazado'}</span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Dato t="Fecha y hora" v={fechaHora(c.instante)} />
                  <Dato t="Actor y perfil" v={`${c.actor.replace(/\s*\(.*\)\s*$/, '')} — ${c.perfil}`} />
                  <Dato t="Entidad" v={nombreEntidad(c.entidadId)} />
                  <Dato t="Motivo" v={c.motivo || '—'} />
                  <Dato t="Revisión enviada" v={`Rev. ${c.revisionEsperada}`} />
                  <Dato t="Resultado" v={ok ? `Evento ${ev?.id ?? '—'} · Rev. ${c.revisionResultante ?? ''}` : 'Sin efecto ni evento de dominio'} />
                </dl>
                {!ok ? (
                  <p className="mt-3 break-words rounded-md bg-[#FBE9E7] p-3 text-sm font-semibold text-[#8C1D18]">Condición que falló: {c.error}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-mute">{t}</dt>
      <dd className="break-words">{v}</dd>
    </div>
  );
}
