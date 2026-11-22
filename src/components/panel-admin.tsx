'use client';

import { formatoPesos, type Estado } from '@/domain/motor';

const TIPOS: Record<string, string> = {
  crear_servicio: 'Alta de servicio',
  publicar_servicio: 'Publicación de servicio',
  editar_servicio: 'Edición de servicio',
  pausar_servicio: 'Pausa de servicio',
};
const tipoLegible = (t: string) => TIPOS[t] ?? (t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' '));

const TONOS: Record<string, string> = {
  Publicado: 'bg-brand text-white',
  Aprobada: 'bg-brand text-white',
  Pausado: 'bg-accent text-ink',
  Pendiente: 'bg-accent text-ink',
  Borrador: 'bg-paper text-ink border border-line',
  Rechazada: 'bg-ink text-white',
};

function Etiqueta({ valor }: { valor: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-bold ${TONOS[valor] ?? 'bg-paper text-ink'}`}>
      {valor}
    </span>
  );
}

function Seccion({ titulo, cantidad, children }: { titulo: string; cantidad: number; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h3 className="flex items-baseline gap-3 border-b-2 border-ink pb-2 font-display text-2xl font-extrabold tracking-tight">
        {titulo}
        <span className="text-base font-bold text-mute">{cantidad}</span>
      </h3>
      {children}
    </section>
  );
}

const th = 'px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-mute sm:px-4';
const td = 'px-3 py-3 align-top sm:px-4';
const tabla = 'mt-3 overflow-hidden rounded-card border border-line bg-surface';

export function PanelAdmin({ estado, onVolver }: { estado: Estado; onVolver: () => void }) {
  const { servicios, propuestas, cierres } = estado.entidades;
  const zona = estado.configuracion.zonaHoraria;
  const nombre = (id: string) => servicios.find((s) => s.id === id)?.nombre ?? id;
  const fecha = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { timeZone: zona, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Panel de gestión</h2>
          <p className="mt-2 max-w-prose text-mute">
            Vista de solo lectura: acá ves todos los servicios, las propuestas de cambio, los cierres y el registro de eventos.
          </p>
        </div>
        <button
          className="rounded-md border-2 border-ink bg-surface px-5 py-3 font-bold shadow-[4px_4px_0_var(--color-ink)] transition hover:bg-accent active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          onClick={onVolver}
          type="button"
        >
          Volver a la lista
        </button>
      </div>

      <Seccion cantidad={servicios.length} titulo="Servicios">
        <div className={tabla}>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper">
              <tr>
                <th className={th}>Servicio</th>
                <th className={`${th} hidden md:table-cell`}>Categoría</th>
                <th className={`${th} hidden text-right sm:table-cell`}>Lista</th>
                <th className={`${th} hidden text-right sm:table-cell`}>Contado</th>
                <th className={`${th} hidden lg:table-cell`}>Cuotas</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {servicios.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} min-w-0 break-words`}>
                    <p className="font-semibold">{s.nombre}</p>
                    <p className="mt-0.5 break-words text-xs text-mute">
                      {s.id} · {s.detalle}
                      {s.promoDelMes ? ' · Promo del mes' : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-mute sm:hidden">
                      Lista {formatoPesos(s.precioLista)} · Contado {formatoPesos(s.precioLista - s.descuentoContado)}
                    </p>
                  </td>
                  <td className={`${td} hidden md:table-cell`}>{s.categoria}</td>
                  <td className={`${td} hidden text-right sm:table-cell`}>{formatoPesos(s.precioLista)}</td>
                  <td className={`${td} hidden text-right font-semibold sm:table-cell`}>{formatoPesos(s.precioLista - s.descuentoContado)}</td>
                  <td className={`${td} hidden lg:table-cell`}>{s.cuotas === 1 ? '1 pago' : '3 cuotas'}</td>
                  <td className={td}>
                    <Etiqueta valor={s.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion cantidad={propuestas.length} titulo="Propuestas">
        {propuestas.length === 0 ? (
          <p className="mt-3 text-mute">Todavía no hay propuestas de cambio.</p>
        ) : (
          <div className={tabla}>
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper">
                <tr>
                  <th className={th}>Propuesta</th>
                  <th className={`${th} hidden md:table-cell`}>Creador</th>
                  <th className={`${th} hidden md:table-cell`}>Motivo</th>
                  <th className={th}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {propuestas.map((p) => (
                  <tr key={p.id}>
                    <td className={`${td} min-w-0 break-words`}>
                      <p className="font-semibold">
                        {p.id} · {nombre(p.servicioId)}
                      </p>
                      <p className="mt-0.5 break-words text-xs text-mute md:hidden">
                        {p.creador} · {p.motivo}
                      </p>
                      {p.motivoDecision ? (
                        <p className="mt-0.5 break-words text-xs text-mute">
                          Decisión de {p.decididaPor}: {p.motivoDecision}
                        </p>
                      ) : null}
                    </td>
                    <td className={`${td} hidden md:table-cell`}>{p.creador}</td>
                    <td className={`${td} hidden md:table-cell`}>{p.motivo}</td>
                    <td className={td}>
                      <Etiqueta valor={p.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion cantidad={cierres.length} titulo="Cierres">
        {cierres.length === 0 ? (
          <p className="mt-3 text-mute">Todavía no se hizo ningún cierre.</p>
        ) : (
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {cierres.map((c) => (
              <li className="rounded-card border border-line border-l-8 border-l-brand bg-surface p-4" key={c.id}>
                <p className="text-xs font-bold text-mute">
                  {c.id} · {fecha(c.fecha)}
                </p>
                <p className="mt-1 break-words font-display text-lg font-extrabold leading-snug">{c.descripcion}</p>
                <p className="mt-2 text-sm text-mute">
                  Ejecutado por {c.ejecutadoPor}. Incluye {c.servicioIds.length} servicios y {c.propuestaIds.length} propuestas.
                </p>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion cantidad={estado.eventos.length} titulo="Eventos">
        {estado.eventos.length === 0 ? (
          <p className="mt-3 text-mute">Todavía no hay eventos registrados.</p>
        ) : (
          <div className={tabla}>
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper">
                <tr>
                  <th className={th}>Evento</th>
                  <th className={`${th} hidden md:table-cell`}>Quién</th>
                  <th className={`${th} hidden md:table-cell`}>Cuándo</th>
                  <th className={`${th} text-right`}>N.º</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {estado.eventos.map((e) => (
                  <tr key={e.id}>
                    <td className={`${td} min-w-0 break-words`}>
                      <p className="font-semibold">{tipoLegible(e.tipo)}</p>
                      <p className="mt-0.5 break-words text-xs text-mute">
                        {e.entidadId} · {nombre(e.entidadId)}
                      </p>
                      <p className="mt-0.5 break-words text-xs text-mute md:hidden">
                        {e.actor} · {fecha(e.instante)}
                      </p>
                    </td>
                    <td className={`${td} hidden md:table-cell`}>{e.actor}</td>
                    <td className={`${td} hidden md:table-cell`}>{fecha(e.instante)}</td>
                    <td className={`${td} text-right font-semibold`}>{e.revision}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <div className="mt-10">
        <button
          className="rounded-md border-2 border-ink bg-surface px-5 py-3 font-bold shadow-[4px_4px_0_var(--color-ink)] transition hover:bg-accent active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          onClick={onVolver}
          type="button"
        >
          Volver a la lista
        </button>
      </div>
    </div>
  );
}
