'use client';

import { useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/modal';
import { aplicarComando, calcularCuotas, CLAVE_STORAGE, type Comando, type Estado } from '@/domain/motor';
import { conciliar, copiaJSON, filtrarServicios, generarCSV, porcentaje, promedioDescuento, validarCopia, type Validacion } from '@/domain/control';
import { estadoSemilla } from '@/domain/semilla';
import { falloPendiente, simularFalloProximoGuardado } from '@/domain/store';
import type { Sesion } from '@/components/gestion';

const btn = 'inline-flex min-h-11 items-center justify-center rounded-md border-2 border-ink px-4 py-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const btnP = `${btn} bg-brand text-white hover:bg-brand-dark`;
const btnS = `${btn} bg-surface hover:bg-paper`;
const sel = 'mt-1 w-full rounded-md border-2 border-ink bg-surface px-3 py-2.5';

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const marca = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 min-w-0 rounded-card border-2 border-ink bg-surface p-4 sm:p-6">
      <h3 className="font-display text-xl font-extrabold sm:text-2xl">{titulo}</h3>
      {children}
    </section>
  );
}

export function Control({ estado, sesion, onEstado }: { estado: Estado; sesion: Sesion; onEstado: (e: Estado) => void }) {
  const [fe, setFe] = useState('Todos');
  const [fc, setFc] = useState('Todas');
  const [texto, setTexto] = useState('');
  const [val, setVal] = useState<Validacion | null>(null);
  const [confirmando, setConfirmando] = useState<'restaurar' | 'reset' | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [lab, setLab] = useState<string[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const soloLectura = sesion.perfil === 'Auditor';

  const conc = useMemo(() => conciliar(estado), [estado]);
  const servicios = estado.entidades.servicios;
  const categorias = useMemo(() => [...new Set(servicios.map((s) => s.categoria))], [servicios]);
  const filtrados = useMemo(() => filtrarServicios(servicios, fe, fc), [servicios, fe, fc]);
  const publicados = servicios.filter((s) => s.estado === 'Publicado').length;

  function guardar(e: Estado, msg: string) {
    try {
      localStorage.setItem(CLAVE_STORAGE, JSON.stringify(e));
    } catch (err) {
      setAviso({ ok: false, texto: `No se pudo guardar: ${(err as Error).message}. No se modificó nada.` });
      return;
    }
    onEstado(e);
    setAviso({ ok: true, texto: msg });
  }
  function validar() {
    setAviso(null);
    setVal(validarCopia(texto));
  }
  async function leerArchivo(f?: File) {
    if (!f) return;
    const t = await f.text();
    setTexto(t);
    setAviso(null);
    setVal(validarCopia(t));
  }
  function confirmar() {
    if (confirmando === 'restaurar' && val?.ok) guardar(val.estado, `Copia restaurada: ${val.estado.entidades.servicios.length} servicios, ${val.estado.eventos.length} eventos. ${val.aviso}.`);
    if (confirmando === 'reset') {
      guardar(estadoSemilla(), 'Datos semilla restaurados. Solo se reinició la clave de esta aplicación.');
      setVal(null);
    }
    setConfirmando(null);
  }

  function correrLab() {
    const falso = { setItem() {} };
    const out: string[] = [];
    const c = calcularCuotas(1000, 3);
    out.push(`1) Cuotas: ${c.join(' + ')} = ${c.reduce((a, b) => a + b, 0)} ${c.join('+') === '334+334+332' ? '— correcto' : '— ERROR'}`);
    const base: Estado = structuredClone(estado);
    const sv = base.entidades.servicios.find((s) => s.estado === 'Publicado') ?? base.entidades.servicios[0];
    if (!sv) {
      out.push('2) a 4) No hay servicios para probar. Restaurá los datos semilla.');
    } else {
      const cmd: Comando = { id: 'LAB-001', tipo: 'pausar_servicio', entidadId: sv.id, actor: 'Laboratorio (Operación)', perfil: 'Operación', instante: new Date().toISOString(), revisionEsperada: base.revision, datos: {}, motivo: 'Prueba' };
      const r1 = aplicarComando(base, cmd, falso);
      const r2 = r1.ok ? aplicarComando(r1.estado, cmd, falso) : r1;
      const n1 = r1.ok ? r1.estado.eventos.length : -1;
      const n2 = r2.ok ? r2.estado.eventos.length : -1;
      out.push(`2a) Mismo ID dos veces: 1.ª ${r1.ok ? 'aplicado' : 'rechazado'}, 2.ª ${r2.ok && r2.idempotente ? 'ignorado (idempotente)' : 'NO idempotente'}. Eventos nuevos: ${n2 - base.eventos.length} (esperado: 1)`);
      const r3 = r1.ok ? aplicarComando(r1.estado, { ...cmd, datos: { distinto: true } }, falso) : r1;
      out.push(`2b) Mismo ID con datos distintos: ${r3.ok ? 'ACEPTADO (error)' : `rechazado — ${r3.error}`}`);
      const viejo: Comando = { ...cmd, id: 'LAB-002', revisionEsperada: Math.max(0, base.revision - 1) };
      const r4 = aplicarComando(base, viejo, falso);
      out.push(`3) Revisión vieja (${viejo.revisionEsperada} vs. ${base.revision}): ${r4.ok ? 'ACEPTADO (error)' : `rechazado — ${r4.error}`}. Revisión actual sin cambios: ${estado.revision}`);
    }
    out.push('4) Usá el botón de abajo y luego guardá una edición en Gestión: el formulario conserva lo escrito y reintenta con el mismo ID de comando.');
    out.push('Estas pruebas corren sobre una copia en memoria: tus datos no se tocan.');
    setLab(out);
  }

  const tarjeta = (f: (typeof conc.filas)[number]) => {
    const dif = f.fuente - f.eventos;
    return (
      <li className="min-w-0 rounded-md border border-line p-3" key={f.clave}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 font-bold">{f.etiqueta}</span>
          <span className="shrink-0 text-sm tabular-nums text-mute">Registros: <b className="text-ink">{f.fuente}</b> · Eventos: <b className="text-ink">{f.eventos}</b></span>
        </div>
        {dif === 0 ? (
          <span className="mt-2 inline-block rounded-md bg-brand px-2 py-1 text-sm font-bold text-white">Conciliado (0 diferencias)</span>
        ) : (
          <span className="mt-2 inline-block max-w-full break-words rounded-md border-2 border-red-700 bg-red-50 px-2 py-1 text-sm font-bold text-red-800">
            Diferencia de {dif > 0 ? '+' : ''}{dif}: registros {f.fuente}, eventos {f.eventos}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="min-w-0">
      <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Control y Exportación</h2>

      <Seccion titulo="Conciliación en vivo">
        <p className="mt-1 text-mute">Totales de los registros actuales contra los reconstruidos desde el historial de eventos.</p>
        <div className={`mt-3 rounded-md border-2 px-3 py-2 font-bold ${conc.diferencias.length ? 'border-red-700 bg-red-50 text-red-800' : 'border-brand bg-brand/10 text-brand-dark'}`} role="status">
          {conc.diferencias.length === 0 ? 'Conciliado (0 diferencias)' : `${conc.diferencias.length} concepto${conc.diferencias.length > 1 ? 's' : ''} con diferencias: ${conc.diferencias.map((d) => d.etiqueta).join(', ')}`}
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{conc.filas.map(tarjeta)}</ul>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line p-3">
            <dt className="text-sm text-mute">Servicios publicados sobre el total</dt>
            <dd className="font-display text-2xl font-black tabular-nums">{porcentaje(publicados, servicios.length)}</dd>
          </div>
          <div className="rounded-md border border-line p-3">
            <dt className="text-sm text-mute">Descuento promedio por pago contado</dt>
            <dd className="font-display text-2xl font-black tabular-nums">{promedioDescuento(servicios)}</dd>
          </div>
        </dl>
      </Seccion>

      <Seccion titulo="Exportación CSV">
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Estado
            <select className={sel} onChange={(e) => setFe(e.target.value)} value={fe}>
              {['Todos', 'Publicado', 'Pausado'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            Categoría
            <select className={sel} onChange={(e) => setFc(e.target.value)} value={fc}>
              {['Todas', ...categorias].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 font-bold tabular-nums" role="status">Se van a exportar {filtrados.length} de {servicios.length} registros.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className={btnP} disabled={filtrados.length === 0} onClick={() => descargar(`servicios-${marca()}.csv`, generarCSV(filtrados), 'text/csv;charset=utf-8')} type="button">Exportar CSV filtrado</button>
          <button className={btnS} onClick={() => descargar(`copia-academia-v2-${marca()}.json`, copiaJSON(estado), 'application/json')} type="button">Exportar Copia JSON (v2)</button>
        </div>
        {filtrados.length === 0 && <p className="mt-2 text-mute">No hay registros con ese filtro.</p>}
      </Seccion>

      <Seccion titulo="Restaurar Copia de Seguridad JSON">
        {soloLectura ? (
          <p className="mt-2 text-mute">El perfil Auditor es de solo lectura y no puede restaurar copias.</p>
        ) : (
          <>
            <p className="mt-1 text-mute">Se valida todo antes de tocar los datos. Si algo falla, no se cambia nada.</p>
            <input accept=".json,application/json" aria-label="Elegí un archivo de copia" className="mt-3 block w-full max-w-full text-sm" onChange={(e) => { leerArchivo(e.target.files?.[0]); e.target.value = ''; }} ref={archivo} type="file" />
            <label className="mt-3 block text-sm font-bold" htmlFor="pegar-json">O pegá el texto JSON</label>
            <textarea className="mt-1 h-32 w-full rounded-md border-2 border-ink bg-surface p-3 font-mono text-sm" id="pegar-json" onChange={(e) => { setTexto(e.target.value); setVal(null); }} value={texto} />
            <button className={`${btnP} mt-3`} disabled={!texto.trim()} onClick={validar} type="button">Validar y Restaurar</button>
            {val && !val.ok && <p className="mt-3 break-words rounded-md border-2 border-red-700 bg-red-50 px-4 py-3 font-bold text-red-800" role="alert">Restauración rechazada: {val.motivo}. No se modificó nada.</p>}
            {val?.ok && (
              <div className="mt-3 rounded-md border-2 border-brand bg-brand/10 px-4 py-3" role="status">
                <p className="font-bold">{val.aviso}</p>
                <p className="mt-1 tabular-nums">{val.estado.entidades.servicios.length} servicios, {val.estado.entidades.propuestas.length} propuestas, {val.estado.eventos.length} eventos.</p>
                <button className={`${btnP} mt-3`} onClick={() => setConfirmando('restaurar')} type="button">Restaurar esta copia</button>
              </div>
            )}
          </>
        )}
        {aviso && <p className={`mt-3 break-words rounded-md border-2 px-4 py-3 font-bold ${aviso.ok ? 'border-brand bg-brand/10' : 'border-red-700 bg-red-50 text-red-800'}`} role="status">{aviso.texto}</p>}
      </Seccion>

      <details className="mt-6 rounded-card border-2 border-ink bg-surface p-4 sm:p-6">
        <summary className="cursor-pointer font-display text-xl font-extrabold sm:text-2xl">Verificación de Reglas de Dominio y Casos Adversos</summary>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={btnP} onClick={correrLab} type="button">Ejecutar pruebas 1 a 3</button>
        </div>
        {lab && <ul className="mt-3 space-y-2 break-words">{lab.map((l) => <li className="rounded-md border border-line p-3 tabular-nums" key={l}>{l}</li>)}</ul>}
        <div className="mt-4 border-t border-line pt-4">
          <button className={btnS} onClick={() => { simularFalloProximoGuardado(); setFallo(true); }} type="button">Simular próximo guardado con error de almacenamiento</button>
          {fallo && <p className="mt-2 font-bold" role="status">{falloPendiente() ? 'El próximo guardado va a fallar una sola vez. Probalo guardando una edición en Gestión y Propuestas.' : 'El fallo simulado ya se usó.'}</p>}
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <button className={btnS} disabled={soloLectura} onClick={() => setConfirmando('reset')} type="button">Restaurar datos semilla iniciales (Reset demo)</button>
        </div>
      </details>

      {confirmando && (
        <Modal onClose={() => setConfirmando(null)} title="Confirmá la restauración">
          <div className="p-5">
            <p>{confirmando === 'restaurar' ? 'Se reemplazarán los datos actuales de esta aplicación por la copia validada. ¿Confirmás?' : 'Se reemplazarán los datos actuales por los datos semilla iniciales. Solo se reinicia la clave de esta aplicación. ¿Confirmás?'}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button className={btnS} onClick={() => setConfirmando(null)} type="button">Cancelar</button>
              <button className={btnP} onClick={confirmar} type="button">Confirmo</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
