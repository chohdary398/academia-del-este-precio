'use client';

import { useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/modal';
import { Gestion, type Sesion } from '@/components/gestion';
import { Historial } from '@/components/historial';
import {
  agruparCuotas,
  calcularCuotas,
  formatoPesos,
  precioContado,
  textoWhatsApp,
  type Estado,
  type Servicio,
} from '@/domain/motor';
import { cargarEstado } from '@/domain/store';

const f = formatoPesos;
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function textoCuotas(s: Servicio): string {
  const c = calcularCuotas(s.precioLista, s.cuotas);
  if (c.length === 1) return `1 pago de ${f(c[0])}`;
  return agruparCuotas(c)
    .map(([m, q]) => `${q} cuota${q > 1 ? 's' : ''} de ${f(m)}`)
    .join(' y ');
}

const botonFuerte =
  'rounded-md border-2 border-ink px-5 py-3 font-bold shadow-[4px_4px_0_var(--color-ink)] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none';

export default function Home() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [vista, setVista] = useState<'lista' | 'gestion' | 'historial' | 'control'>('lista');
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [copiando, setCopiando] = useState<Servicio | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    setEstado(cargarEstado());
    try {
      const s = sessionStorage.getItem('academia_sesion');
      if (s) setSesion(JSON.parse(s));
    } catch {}
  }, []);

  function entrar(s: Sesion) {
    sessionStorage.setItem('academia_sesion', JSON.stringify(s));
    setSesion(s);
    setEstado(cargarEstado());
    setPidiendoClave(false);
    setVista('gestion');
    window.scrollTo({ top: 0 });
  }
  function salir() {
    sessionStorage.removeItem('academia_sesion');
    setSesion(null);
    setVista('lista');
  }

  const publicados = useMemo(() => (estado?.entidades.servicios ?? []).filter((s) => s.estado === 'Publicado'), [estado]);
  const categorias = useMemo(() => [...new Set(publicados.map((s) => s.categoria))], [publicados]);
  const visibles = useMemo(() => {
    const q = sinTildes(busqueda);
    return publicados.filter((s) => {
      if (q && !sinTildes(s.nombre).includes(q)) return false;
      if (filtro === 'promo') return s.promoDelMes;
      if (filtro !== 'todos') return s.categoria === filtro;
      return true;
    });
  }, [publicados, busqueda, filtro]);

  const enPanel = vista !== 'lista' && sesion !== null && estado !== null;

  return (
    <main>
      {/* Encabezado institucional */}
      <section className="on-dark relative overflow-hidden bg-brand text-white">
        <div aria-hidden className="absolute -right-10 -top-10 hidden size-36 rounded-full bg-accent sm:block md:hidden" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 md:grid-cols-[1.4fr_1fr] lg:pb-20 lg:pt-20">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-sm bg-surface px-3 py-1.5 text-sm font-bold text-ink">
              <svg aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="square" />
              </svg>
              {estado ? (
                <>Horario de clases: {estado.configuracion.horarioAtencion}</>
              ) : (
                <span aria-label="Cargando horario" className="inline-block h-4 w-44 animate-pulse rounded-sm bg-paper" />
              )}
            </p>
            <h1 className="mt-6 font-display text-6xl font-black leading-[0.9] tracking-tight sm:text-8xl lg:text-9xl">
              Academia
              <br />
              del Este
            </h1>
            <p className="mt-5 font-display text-xl font-bold sm:text-2xl">Lista de precios y gestión de cursos</p>
            {!sesion ? (
              <button
                className={`${botonFuerte} mt-8 bg-accent text-ink hover:bg-surface`}
                onClick={() => setPidiendoClave(true)}
                type="button"
              >
                Ingresar al Panel
              </button>
            ) : null}
          </div>
          <svg aria-hidden className="hidden w-full max-w-sm justify-self-end md:block" viewBox="0 0 400 400">
            <rect className="fill-brand-dark" height="400" width="400" />
            <circle className="fill-accent" cx="285" cy="125" r="90" />
            <path className="fill-surface" d="M0 400V190a210 210 0 0 1 210 210z" />
            <rect className="fill-ink" height="150" width="170" x="230" y="250" />
            <path className="stroke-accent" d="M242 325h146" fill="none" strokeDasharray="20 12" strokeWidth="8" />
            <path className="fill-brand" d="M40 40h110L40 150z" />
          </svg>
        </div>
        <div aria-hidden className="h-3 bg-ink [background-image:repeating-linear-gradient(90deg,var(--color-accent)_0_28px,transparent_28px_48px)] [background-position:center] [background-size:100%_4px] [background-repeat:no-repeat]" />
      </section>

      {/* Banda de pagos */}
      <section className="bg-accent text-ink">
        <p className="mx-auto max-w-6xl px-4 py-5 font-display text-xl font-extrabold leading-snug sm:px-6 sm:py-6 sm:text-3xl">
          3 cuotas sin interés con tarjeta o promo mensual pagando en efectivo, débito o transferencia
        </p>
      </section>

      {sesion ? (
        <nav aria-label="Vistas del panel" className="border-b-2 border-ink bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
            {([['lista', 'Lista Asesores'], ['gestion', 'Gestión y Propuestas'], ['historial', 'Historial y Auditoría'], ['control', 'Control y Exportación']] as const).map(([k, l]) => (
              <button
                aria-current={vista === k ? 'page' : undefined}
                className={`rounded-md border-2 border-ink px-4 py-2 font-bold ${vista === k ? 'bg-ink text-white' : 'bg-surface hover:bg-paper'}`}
                key={k}
                onClick={() => { setEstado(cargarEstado()); setVista(k); }}
                type="button"
              >
                {l}
              </button>
            ))}
            <span className="ml-auto text-sm font-bold">Activo: {sesion.actor}</span>
            <button className="rounded-md border-2 border-ink bg-accent px-4 py-2 font-bold hover:bg-surface" onClick={salir} type="button">
              Cambiar perfil / Salir
            </button>
          </div>
        </nav>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16" id="lista">
        {estado === null ? (
          <div aria-label="Cargando la lista" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div className="h-80 animate-pulse rounded-card bg-surface" key={i} />
            ))}
          </div>
        ) : enPanel && vista === 'gestion' ? (
          <Gestion estado={estado} onEstado={setEstado} recargar={() => setEstado(cargarEstado())} sesion={sesion} />
        ) : enPanel && vista === 'historial' ? (
          <Historial estado={estado} />
        ) : enPanel ? (
          <div>
            <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Control y Exportación</h2>
            <p className="mt-3 text-mute">Esta pantalla se habilita en la próxima etapa.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Lista de precios</h2>
              <div className="w-full sm:max-w-sm">
                <label className="text-sm font-bold" htmlFor="buscador">
                  Buscá un curso por nombre
                </label>
                <input
                  autoComplete="off"
                  className="mt-1 w-full rounded-md border-2 border-ink bg-surface px-4 py-3 placeholder:text-mute"
                  id="buscador"
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Por ejemplo, intensivo"
                  type="search"
                  value={busqueda}
                />
              </div>
            </div>

            <div aria-label="Filtrar por categoría" className="mt-6 flex flex-wrap gap-2" role="group">
              {[
                { clave: 'todos', texto: 'Todos' },
                { clave: 'promo', texto: 'Promo del mes' },
                ...categorias.map((c) => ({ clave: c, texto: c })),
              ].map((o) => {
                const activo = filtro === o.clave;
                return (
                  <button
                    aria-pressed={activo}
                    className={`rounded-md border-2 border-ink px-4 py-2 text-sm font-bold transition-colors ${
                      activo ? (o.clave === 'promo' ? 'bg-accent text-ink' : 'bg-ink text-white') : 'bg-surface hover:bg-accent/50'
                    }`}
                    key={o.clave}
                    onClick={() => setFiltro(o.clave)}
                    type="button"
                  >
                    {o.texto}
                  </button>
                );
              })}
            </div>

            <p aria-live="polite" className="mt-6 text-sm text-mute">
              {visibles.length === 1 ? 'Mostrando 1 servicio' : `Mostrando ${visibles.length} servicios`}
            </p>

            {visibles.length === 0 ? (
              <div className="mt-4 rounded-card border-2 border-dashed border-line bg-surface p-8">
                <p className="font-display text-xl font-extrabold">No encontramos servicios con ese criterio.</p>
                <p className="mt-1 text-mute">Revisá el nombre que escribiste o elegí otro filtro.</p>
                <button
                  className="mt-4 rounded-md border-2 border-ink bg-accent px-4 py-2 font-bold transition-colors hover:bg-surface"
                  onClick={() => {
                    setBusqueda('');
                    setFiltro('todos');
                  }}
                  type="button"
                >
                  Ver todos los servicios
                </button>
              </div>
            ) : (
              <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibles.map((s) => {
                  const contado = precioContado(s.precioLista, s.descuentoContado);
                  return (
                    <li className="flex" key={s.id}>
                      <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
                        <div aria-hidden className={`h-2 ${s.promoDelMes ? 'bg-accent' : 'bg-brand'}`} />
                        <div className="flex-1 p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold text-brand">{s.categoria}</p>
                            {s.promoDelMes ? (
                              <span className="rounded-sm bg-accent px-2 py-0.5 text-xs font-extrabold text-ink">Promo del mes</span>
                            ) : null}
                          </div>
                          <h3 className="mt-2 break-words font-display text-2xl font-extrabold leading-tight tracking-tight">{s.nombre}</h3>
                          <p className="mt-1 text-mute">{s.detalle}</p>
                          <dl className="mt-5 flex items-baseline justify-between gap-3 border-t border-line/50 pt-3">
                            <dt className="text-sm font-semibold text-mute">Precio de Lista</dt>
                            <dd className="text-lg font-semibold">{f(s.precioLista)}</dd>
                          </dl>
                        </div>
                        <div className="on-dark bg-brand px-5 py-4 text-white">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-sm font-semibold">Precio Contado</p>
                            <p className="font-display text-3xl font-black tracking-tight">{f(contado)}</p>
                          </div>
                          {s.descuentoContado > 0 ? (
                            <p className="mt-2 inline-block rounded-sm bg-accent px-2 py-0.5 text-sm font-extrabold text-ink">
                              Ahorrás {f(s.descuentoContado)}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-white/85">Sin descuento por pago contado</p>
                          )}
                        </div>
                        <div className="p-5">
                          <p className="text-sm font-semibold text-mute">{s.cuotas === 1 ? 'Pago' : 'Cuotas sin interés'}</p>
                          <p className="mt-0.5 font-semibold">{textoCuotas(s)}</p>
                          <button
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-ink bg-surface px-4 py-2.5 font-bold transition-colors hover:bg-accent"
                            onClick={() => setCopiando(s)}
                            type="button"
                          >
                            <svg aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                              <rect height="13" width="13" x="8" y="8" />
                              <path d="M16 8V3H3v13h5" />
                            </svg>
                            Copiar texto
                          </button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {pidiendoClave && estado ? (
        <ModalClave onCerrar={() => setPidiendoClave(false)} onEntrar={entrar} />
      ) : null}
      {copiando ? <ModalCopiar onCerrar={() => setCopiando(null)} servicio={copiando} /> : null}
    </main>
  );
}

const ACTORES: { actor: string; perfil: Sesion['perfil'] }[] = [
  { actor: 'Laura (Operación)', perfil: 'Operación' },
  { actor: 'Martín (Operación)', perfil: 'Operación' },
  { actor: 'Carlos (Revisor)', perfil: 'Revisor' },
  { actor: 'Sofía (Auditor)', perfil: 'Auditor' },
];

function ModalClave({ onCerrar, onEntrar }: { onCerrar: () => void; onEntrar: (s: Sesion) => void }) {
  const [clave, setClave] = useState('');
  const [actor, setActor] = useState('');
  const [errorActor, setErrorActor] = useState(false);
  const [error, setError] = useState(false);

  return (
    <Modal onClose={onCerrar} title="Ingresar al Panel">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const a = ACTORES.find((x) => x.actor === actor);
          if (!a) { setErrorActor(true); return; }
          if (clave === cargarEstado().configuracion.claveAccesoAdmin) onEntrar(a);
          else setError(true);
        }}
      >
        <label className="text-sm font-bold" htmlFor="clave">
          Clave de acceso
        </label>
        <input
          aria-describedby={error ? 'clave-error' : undefined}
          aria-invalid={error}
          autoComplete="off"
          autoFocus
          className="mt-1 w-full rounded-md border-2 border-ink bg-surface px-4 py-3"
          id="clave"
          onChange={(e) => {
            setClave(e.target.value);
            setError(false);
          }}
          type="password"
          value={clave}
        />
        <label className="mt-4 block text-sm font-bold" htmlFor="actor">
          Actor y perfil de demo
        </label>
        <select
          className="mt-1 w-full rounded-md border-2 border-ink bg-surface px-4 py-3"
          id="actor"
          onChange={(e) => { setActor(e.target.value); setErrorActor(false); }}
          value={actor}
        >
          <option value="">Elegí un actor…</option>
          {ACTORES.map((a) => (
            <option key={a.actor} value={a.actor}>{a.actor.replace(' (', ' — ').replace(')', '')}</option>
          ))}
        </select>
        {errorActor ? <p className="mt-2 text-sm font-bold" role="alert">Elegí con qué actor y perfil vas a ingresar.</p> : null}
        <p className="mt-4 rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm font-bold">
          Entorno de demostración local con datos sintéticos en este navegador. No constituye autenticación real ni bloqueo simultáneo entre computadoras.
        </p>
        {error ? (
          <p className="mt-2 text-sm font-bold text-ink" id="clave-error" role="alert">
            La clave no es correcta. Revisá que esté bien escrita e intentá de nuevo.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={`${botonFuerte} bg-brand text-white hover:bg-brand-dark`} type="submit">
            Ingresar
          </button>
          <button className="rounded-md border-2 border-ink px-5 py-3 font-bold transition-colors hover:bg-paper" onClick={onCerrar} type="button">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalCopiar({ servicio, onCerrar }: { servicio: Servicio; onCerrar: () => void }) {
  const [texto, setTexto] = useState(() => textoWhatsApp(servicio));
  const [estadoCopia, setEstadoCopia] = useState<'nada' | 'ok' | 'fallo'>('nada');

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstadoCopia('ok');
    } catch {
      setEstadoCopia('fallo');
    }
  }

  return (
    <Modal onClose={onCerrar} title={`Texto para WhatsApp: ${servicio.nombre}`}>
      <label className="text-sm font-bold" htmlFor="texto-wsp">
        Revisá el mensaje y editalo si hace falta
      </label>
      <textarea
        className="mt-1 min-h-40 w-full rounded-md border-2 border-ink bg-surface px-4 py-3 leading-6"
        id="texto-wsp"
        onChange={(e) => {
          setTexto(e.target.value);
          setEstadoCopia('nada');
        }}
        value={texto}
      />
      <div aria-live="polite" className="min-h-8" role="status">
        {estadoCopia === 'ok' ? (
          <p className="mt-3 rounded-sm bg-brand px-3 py-2 font-bold text-white">¡Texto copiado para WhatsApp!</p>
        ) : estadoCopia === 'fallo' ? (
          <p className="mt-3 rounded-sm bg-accent px-3 py-2 font-bold text-ink">
            No pudimos copiar solos. Seleccioná el texto y copialo con el teclado.
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={`${botonFuerte} bg-brand text-white hover:bg-brand-dark`} onClick={copiar} type="button">
          Copiar
        </button>
        <button className="rounded-md border-2 border-ink px-5 py-3 font-bold transition-colors hover:bg-paper" onClick={onCerrar} type="button">
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
