// Conciliación, exportación y restauración. Puro, sin React.
import { calcularCuotas, formatoPesos, precioContado, type Estado, type Servicio } from './motor';

export type Fila = { clave: string; etiqueta: string; fuente: number; eventos: number };
export type Conciliacion = { filas: Fila[]; diferencias: Fila[] };


/** Reconstruye contadores desde el historial de eventos. */
export function contadoresDesdeEventos(e: Estado) {
  const srv = new Map<string, { estado?: string; promo?: boolean }>();
  const prop = new Map<string, string>();
  let cierres = 0;
  for (const ev of e.eventos) {
    const d = (ev.detalle ?? {}) as Record<string, any>;
    const despues = (d.despues ?? {}) as Record<string, any>;
    switch (ev.tipo) {
      case 'crear_servicio': srv.set(ev.entidadId, { estado: despues.estado, promo: !!despues.promoDelMes }); break;
      case 'borrar_servicio': srv.delete(ev.entidadId); break;
      case 'publicar_servicio': case 'pausar_servicio': case 'editar_servicio': case 'aprobar_propuesta': {
        const id = ev.tipo === 'aprobar_propuesta' ? d.servicioId : ev.entidadId;
        const s = srv.get(id);
        if (s) {
          if (despues.estado) s.estado = despues.estado;
          if (typeof despues.promoDelMes === 'boolean') s.promo = despues.promoDelMes;
        }
        if (ev.tipo === 'aprobar_propuesta') prop.set(ev.entidadId, 'Aprobada');
        break;
      }
      case 'crear_propuesta': prop.set(ev.entidadId, 'Pendiente'); break;
      case 'rechazar_propuesta': prop.set(ev.entidadId, 'Rechazada'); break;
      case 'ejecutar_cierre': cierres++; break;
    }
  }
  const sv = [...srv.values()];
  const pv = [...prop.values()];
  return {
    total: sv.length, publicados: sv.filter((s) => s.estado === 'Publicado').length, pausados: sv.filter((s) => s.estado === 'Pausado').length,
    promo: sv.filter((s) => s.promo).length, pendientes: pv.filter((p) => p === 'Pendiente').length,
    aprobadas: pv.filter((p) => p === 'Aprobada').length, rechazadas: pv.filter((p) => p === 'Rechazada').length, cierres,
  };
}

export function conciliar(e: Estado): Conciliacion {
  const { servicios, propuestas, cierres } = e.entidades;
  const r = contadoresDesdeEventos(e);
  const filas: Fila[] = [
    { clave: 'total', etiqueta: 'Servicios activos', fuente: servicios.length, eventos: r.total },
    { clave: 'publicados', etiqueta: 'Servicios publicados', fuente: servicios.filter((s) => s.estado === 'Publicado').length, eventos: r.publicados },
    { clave: 'pausados', etiqueta: 'Servicios pausados', fuente: servicios.filter((s) => s.estado === 'Pausado').length, eventos: r.pausados },
    { clave: 'promo', etiqueta: 'Servicios en promo del mes', fuente: servicios.filter((s) => s.promoDelMes).length, eventos: r.promo },
    { clave: 'pendientes', etiqueta: 'Propuestas pendientes', fuente: propuestas.filter((p) => p.estado === 'Pendiente').length, eventos: r.pendientes },
    { clave: 'aprobadas', etiqueta: 'Propuestas aprobadas', fuente: propuestas.filter((p) => p.estado === 'Aprobada').length, eventos: r.aprobadas },
    { clave: 'rechazadas', etiqueta: 'Propuestas rechazadas', fuente: propuestas.filter((p) => p.estado === 'Rechazada').length, eventos: r.rechazadas },
    { clave: 'cierres', etiqueta: 'Cierres confirmados', fuente: cierres.length, eventos: r.cierres },
  ];
  return { filas, diferencias: filas.filter((f) => f.fuente !== f.eventos) };
}

/** Porcentaje entero o "Sin datos" si el denominador es cero. */
export function porcentaje(parte: number, total: number): string {
  if (!(total > 0)) return 'Sin datos';
  return `${Math.round((parte / total) * 100)}%`;
}
export function promedioDescuento(servicios: Servicio[]): string {
  const con = servicios.filter((s) => s.descuentoContado > 0);
  if (con.length === 0) return 'Sin datos';
  const prom = con.reduce((a, s) => a + s.descuentoContado, 0) / con.length;
  return formatoPesos(Math.round(prom));
}

const celda = (v: string | number) => {
  const t = String(v);
  return /[",;\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export function filtrarServicios(servicios: Servicio[], estado: string, categoria: string) {
  return servicios.filter((s) => (estado === 'Todos' || s.estado === estado) && (categoria === 'Todas' || s.categoria === categoria));
}
export function generarCSV(servicios: Servicio[]): string {
  const cab = ['ID', 'Nombre', 'Categoría', 'Clases', 'Precio Lista', 'Descuento Contado', 'Precio Contado', 'Cuotas', 'Cuota 1', 'Cuota 2', 'Cuota 3', 'Promo del Mes', 'Estado'];
  const filas = servicios.map((s) => {
    const c = calcularCuotas(s.precioLista, s.cuotas);
    return [s.id, s.nombre, s.categoria, s.detalle, s.precioLista, s.descuentoContado, precioContado(s.precioLista, s.descuentoContado), s.cuotas, c[0] ?? '', c[1] ?? '', c[2] ?? '', s.promoDelMes ? 'Sí' : 'No', s.estado];
  });
  return '﻿' + [cab, ...filas].map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n';
}

export function copiaJSON(e: Estado): string {
  return JSON.stringify({ schemaVersion: 2, revision: e.revision, configuracion: e.configuracion, entidades: e.entidades, eventos: e.eventos, comandosAplicados: e.comandosAplicados, fechaExportacion: new Date().toISOString() }, null, 2);
}

export type Validacion = { ok: true; estado: Estado; aviso: string } | { ok: false; motivo: string };
const esObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const dup = (ids: string[]) => ids.find((id, i) => ids.indexOf(id) !== i);

/** Valida el texto completo sin tocar el almacenamiento. v1 se migra a v2. */
export function validarCopia(texto: string): Validacion {
  let j: unknown;
  try { j = JSON.parse(texto); } catch (e) { return { ok: false, motivo: `El archivo está truncado o no es un JSON válido (${(e as Error).message})` }; }
  if (!esObj(j)) return { ok: false, motivo: 'El contenido no es un objeto de copia de seguridad' };
  const v = j.schemaVersion;
  if (v !== 1 && v !== 2) return { ok: false, motivo: `Versión de copia desconocida: ${v === undefined ? 'no informada' : JSON.stringify(v)}. Solo se admiten las versiones 1 y 2` };
  if (!esObj(j.entidades)) return { ok: false, motivo: 'Falta "entidades" en la copia' };
  const en = j.entidades;
  if (!Array.isArray(en.servicios)) return { ok: false, motivo: 'Falta la lista "entidades.servicios"' };
  if (en.propuestas !== undefined && !Array.isArray(en.propuestas)) return { ok: false, motivo: '"entidades.propuestas" no es una lista' };
  if (en.cierres !== undefined && !Array.isArray(en.cierres)) return { ok: false, motivo: '"entidades.cierres" no es una lista' };
  let aviso = 'Copia v2 válida';
  if (v === 2) {
    if (!Array.isArray(j.eventos)) return { ok: false, motivo: 'Falta la lista "eventos" en la copia v2' };
    if (!Array.isArray(j.comandosAplicados)) return { ok: false, motivo: 'Falta la lista "comandosAplicados" en la copia v2' };
    if (typeof j.revision !== 'number' || !Number.isFinite(j.revision)) return { ok: false, motivo: 'Falta la "revision" numérica en la copia v2' };
  } else aviso = 'Copia v1 detectada y migrada válidamente a v2';
  const servicios = en.servicios as any[];
  const propuestas = (en.propuestas ?? []) as any[];
  const cierres = (en.cierres ?? []) as any[];
  const eventos = (v === 2 ? j.eventos : []) as any[];
  for (const [n, l] of [['servicios', servicios], ['propuestas', propuestas], ['cierres', cierres], ['eventos', eventos]] as const) {
    const mala = l.findIndex((x) => !esObj(x) || typeof x.id !== 'string' || !x.id);
    if (mala >= 0) return { ok: false, motivo: `El registro ${mala + 1} de "${n}" no tiene un ID válido` };
  }
  for (const [n, l] of [['servicios', servicios], ['propuestas', propuestas], ['eventos', eventos]] as const) {
    const d = dup(l.map((x) => x.id));
    if (d) return { ok: false, motivo: `ID duplicado en ${n}: ${d}` };
  }
  for (const s of servicios) {
    if (typeof s.nombre !== 'string' || !(Number(s.precioLista) > 0)) return { ok: false, motivo: `El servicio ${s.id} tiene nombre o precio de lista inválido` };
    if (!['Publicado', 'Pausado', 'Borrador'].includes(s.estado)) return { ok: false, motivo: `El servicio ${s.id} tiene un estado desconocido: ${JSON.stringify(s.estado)}` };
  }
  const idsS = new Set(servicios.map((s) => s.id));
  const idsP = new Set(propuestas.map((p) => p.id));
  for (const p of propuestas) if (!idsS.has(p.servicioId)) return { ok: false, motivo: `La propuesta ${p.id} apunta al servicio inexistente ${p.servicioId}` };
  for (const c of cierres) {
    for (const id of c.servicioIds ?? []) if (!idsS.has(id)) return { ok: false, motivo: `El cierre ${c.id} apunta al servicio inexistente ${id}` };
    for (const id of c.propuestaIds ?? []) if (!idsP.has(id)) return { ok: false, motivo: `El cierre ${c.id} apunta a la propuesta inexistente ${id}` };
  }
  const idsC = new Set(cierres.map((c) => c.id));
  for (const ev of eventos) {
    const t: string = String(ev.tipo);
    const ok = t.includes('servicio') ? idsS.has(ev.entidadId) || t === 'borrar_servicio' || t === 'crear_servicio'
      : t.includes('propuesta') ? idsP.has(ev.entidadId) : t === 'ejecutar_cierre' ? idsC.has(ev.entidadId) : true;
    if (!ok) return { ok: false, motivo: `El evento ${ev.id} apunta a un registro inexistente: ${ev.entidadId}` };
  }
  const ant = (v === 2 ? j.comandosAplicados : []) as any[];
  const dc = dup(ant.map((c) => c?.id));
  if (dc) return { ok: false, motivo: `ID duplicado en comandosAplicados: ${dc}` };
  const cfg = esObj(j.configuracion) ? j.configuracion : {};
  const estado: Estado = {
    schemaVersion: 2, revision: v === 2 ? j.revision : 1,
    configuracion: { horarioAtencion: cfg.horarioAtencion ?? '7:30 a 21:30', zonaHoraria: cfg.zonaHoraria ?? 'America/Argentina/Buenos_Aires', claveAccesoAdmin: cfg.claveAccesoAdmin ?? 'ESTE2026' },
    entidades: { servicios: servicios as any, propuestas: propuestas as any, cierres: cierres as any },
    eventos: eventos as any, comandosAplicados: ant as any,
  };
  return { ok: true, estado, aviso };
}
