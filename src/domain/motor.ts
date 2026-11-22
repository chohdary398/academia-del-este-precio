// Motor de reglas de Academia del Este: puro, sin React. También se expone en window.__MOTOR_ACADEMIA__.
export const CLAVE_STORAGE = 'academia_del_este_v2';

export type Perfil = 'Auditor' | 'Operación' | 'Revisor';
export type Servicio = {
  id: string; nombre: string; categoria: string; detalle: string;
  precioLista: number; descuentoContado: number; cuotas: 1 | 3; promoDelMes: boolean; estado: 'Publicado' | 'Pausado' | 'Borrador';
};
export type Propuesta = {
  id: string; servicioId: string; estado: 'Pendiente' | 'Aprobada' | 'Rechazada'; creador: string;
  cambios: Partial<Servicio>; motivo: string; decididaPor?: string; motivoDecision?: string;
};
export type Cierre = { id: string; fecha: string; descripcion: string; ejecutadoPor: string; servicioIds: string[]; propuestaIds: string[] };
export type Evento = { id: string; comandoId: string; tipo: string; entidadId: string; revision: number; instante: string; actor: string; detalle: Record<string, unknown> };
export type ComandoAplicado = { id: string; tipo: string; entidadId: string; actor: string; perfil: Perfil; instante: string; revisionEsperada: number; datos: unknown; motivo: string; resultado: 'aplicado' | 'rechazado'; error?: string; revisionResultante?: number };
export type Estado = {
  schemaVersion: 2; revision: number;
  configuracion: { horarioAtencion: string; zonaHoraria: string; claveAccesoAdmin: string };
  entidades: { servicios: Servicio[]; propuestas: Propuesta[]; cierres: Cierre[] };
  eventos: Evento[]; comandosAplicados: ComandoAplicado[];
};
export type Comando = { id: string; tipo: string; entidadId: string; actor: string; perfil: Perfil; instante: string; revisionEsperada: number; datos?: any; motivo?: string };
export type Resultado = { ok: true; idempotente?: boolean; estado: Estado } | { ok: false; error: string; errores?: string[]; conflicto?: boolean };
type Almacen = Pick<Storage, 'setItem'>;

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function precioContado(precioLista: number, descuentoContado: number): number {
  const p = precioLista - descuentoContado;
  if (!(p > 0)) throw new Error('El precio contado debe ser mayor a cero');
  return p;
}

export function calcularCuotas(precioLista: number, cantidadCuotas: number): number[] {
  if (cantidadCuotas === 1) return [precioLista];
  if (cantidadCuotas === 3) {
    const c = Math.ceil(precioLista / 3);
    return [c, c, precioLista - 2 * c];
  }
  throw new Error('Solo se admiten 1 o 3 cuotas');
}

export function validarServicio(servicios: Servicio[], d: Partial<Servicio>, idActual?: string): string[] {
  const errores: string[] = [];
  const nombre = String(d.nombre ?? '');
  if (!nombre.trim()) errores.push('Ingresá el nombre del servicio');
  else if (servicios.some((s) => s.id !== idActual && norm(s.nombre) === norm(nombre))) errores.push('Ya existe un servicio con ese nombre');
  const lista = Number(d.precioLista);
  const desc = Number(d.descuentoContado ?? 0);
  if (!Number.isFinite(lista) || lista <= 0) errores.push('El precio de lista debe ser mayor a cero');
  else if (!Number.isFinite(desc) || desc < 0) errores.push('El descuento no puede ser negativo');
  else if (desc > lista / 2) errores.push('El descuento no puede superar la mitad del precio de lista');
  if (d.cuotas !== undefined && d.cuotas !== 1 && d.cuotas !== 3) errores.push('Las cuotas pueden ser 1 o 3');
  return errores;
}

const TIPOS_OPERACION = ['crear_servicio', 'editar_servicio', 'pausar_servicio', 'publicar_servicio', 'borrar_servicio', 'crear_propuesta'];
const TIPOS_REVISOR = ['aprobar_propuesta', 'rechazar_propuesta', 'ejecutar_cierre'];

function permiso(c: Comando, estado: Estado): string | null {
  if (c.perfil === 'Auditor') return 'El perfil Auditor es de solo lectura y no puede modificar datos';
  if (c.perfil === 'Operación') {
    if (TIPOS_REVISOR.includes(c.tipo)) return 'El perfil Operación no puede aprobar, rechazar propuestas ni ejecutar cierres';
    return TIPOS_OPERACION.includes(c.tipo) ? null : 'Acción no permitida';
  }
  if (c.perfil === 'Revisor') {
    if (!TIPOS_REVISOR.includes(c.tipo)) return 'El perfil Revisor solo aprueba, rechaza y ejecuta cierres';
    if (c.tipo !== 'ejecutar_cierre') {
      const p = estado.entidades.propuestas.find((x) => x.id === c.entidadId);
      if (p && p.creador === c.actor) return 'Un revisor no puede aprobar ni decidir una propuesta creada por sí mismo';
    }
    return null;
  }
  return 'Perfil desconocido';
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function aplicarComando(estado: Estado, c: Comando, almacen: Almacen): Resultado {
  const previo = estado.comandosAplicados.find((x) => x.id === c.id);
  if (previo) {
    if (previo.tipo === c.tipo && igual(previo.datos, c.datos) && previo.resultado === 'aplicado') return { ok: true, idempotente: true, estado };
    return { ok: false, error: `El identificador de comando ${c.id} ya fue usado con otros datos o con otro tipo. No se guardó nada` };
  }
  if (c.revisionEsperada !== estado.revision)
    return { ok: false, conflicto: true, error: `Edición desactualizada: la revisión vigente es ${estado.revision} y enviaste ${c.revisionEsperada}. Actualizá los datos y volvé a revisar antes de confirmar` };
  const denegado = permiso(c, estado);
  if (denegado) return { ok: false, error: denegado };

  const n: Estado = structuredClone(estado);
  const { servicios, propuestas, cierres } = n.entidades;
  const d = c.datos ?? {};
  const rev = estado.revision + 1;
  let detalle: Record<string, unknown> = {};
  let entidadId = c.entidadId;
  const falla = (error: string, errores?: string[]): Resultado => ({ ok: false, error, errores });

  switch (c.tipo) {
    case 'crear_servicio': {
      const errores = validarServicio(servicios, d);
      if (errores.length) return falla(errores[0], errores);
      const num = servicios.length + 1;
      entidadId = c.entidadId || `SRV-${String(num).padStart(2, '0')}`;
      servicios.push({ id: entidadId, nombre: d.nombre.trim().replace(/\s+/g, ' '), categoria: d.categoria ?? 'Curso práctico', detalle: d.detalle ?? '', precioLista: Number(d.precioLista), descuentoContado: Number(d.descuentoContado ?? 0), cuotas: d.cuotas ?? 1, promoDelMes: !!d.promoDelMes, estado: 'Borrador' });
      detalle = { creado: entidadId };
      break;
    }
    case 'editar_servicio': {
      const s = servicios.find((x) => x.id === c.entidadId);
      if (!s) return falla('El servicio no existe');
      const nuevo = { ...s, ...d };
      const errores = validarServicio(servicios, nuevo, s.id);
      if (errores.length) return falla(errores[0], errores);
      Object.assign(s, nuevo, { id: s.id });
      detalle = { cambios: d };
      break;
    }
    case 'pausar_servicio':
    case 'publicar_servicio': {
      const s = servicios.find((x) => x.id === c.entidadId);
      if (!s) return falla('El servicio no existe');
      s.estado = c.tipo === 'pausar_servicio' ? 'Pausado' : 'Publicado';
      detalle = { estado: s.estado };
      break;
    }
    case 'borrar_servicio': {
      if (!d.confirmado) return falla('Confirmá el borrado para continuar');
      const i = servicios.findIndex((x) => x.id === c.entidadId);
      if (i < 0) return falla('El servicio no existe');
      servicios.splice(i, 1);
      break;
    }
    case 'crear_propuesta': {
      const s = servicios.find((x) => x.id === c.entidadId);
      if (!s) return falla('El servicio no existe');
      if (!c.motivo?.trim()) return falla('Indicá el motivo de la propuesta');
      const errores = validarServicio(servicios, { ...s, ...d.cambios }, s.id);
      if (errores.length) return falla(errores[0], errores);
      entidadId = `PROP-${String(propuestas.length + 1).padStart(3, '0')}`;
      propuestas.push({ id: entidadId, servicioId: s.id, estado: 'Pendiente', creador: c.actor, cambios: d.cambios ?? {}, motivo: c.motivo });
      break;
    }
    case 'aprobar_propuesta':
    case 'rechazar_propuesta': {
      const p = propuestas.find((x) => x.id === c.entidadId);
      if (!p) return falla('La propuesta no existe');
      if (p.estado !== 'Pendiente') return falla('La propuesta ya fue decidida');
      if (c.tipo === 'aprobar_propuesta') {
        const s = servicios.find((x) => x.id === p.servicioId);
        if (!s) return falla('El servicio de la propuesta no existe');
        const nuevo = { ...s, ...p.cambios };
        const errores = validarServicio(servicios, nuevo, s.id);
        if (errores.length) return falla(errores[0], errores);
        Object.assign(s, nuevo, { id: s.id });
      }
      p.estado = c.tipo === 'aprobar_propuesta' ? 'Aprobada' : 'Rechazada';
      p.decididaPor = c.actor;
      p.motivoDecision = c.motivo;
      break;
    }
    case 'ejecutar_cierre': {
      entidadId = `CIE-${String(cierres.length + 1).padStart(3, '0')}`;
      cierres.push({ id: entidadId, fecha: c.instante, descripcion: c.motivo || 'Cierre', ejecutadoPor: c.actor, servicioIds: servicios.map((s) => s.id), propuestaIds: propuestas.filter((p) => p.estado === 'Pendiente').map((p) => p.id) });
      break;
    }
    default:
      return falla('Tipo de comando desconocido');
  }

  n.revision = rev;
  n.eventos.push({ id: `EVT-${String(n.eventos.length + 1).padStart(3, '0')}`, comandoId: c.id, tipo: c.tipo, entidadId, revision: rev, instante: c.instante, actor: c.actor, detalle });
  n.comandosAplicados.push({ ...c, entidadId, datos: c.datos, motivo: c.motivo ?? '', resultado: 'aplicado', revisionResultante: rev });
  try {
    almacen.setItem(CLAVE_STORAGE, JSON.stringify(n));
  } catch (e) {
    return { ok: false, error: `No se pudo guardar: ${(e as Error).message}. Tus datos siguen en el formulario; reintentá con el mismo comando` };
  }
  return { ok: true, estado: n };
}

export function textoWhatsApp(s: Servicio): string {
  const cuotas = calcularCuotas(s.precioLista, s.cuotas);
  const f = formatoPesos;
  const partes = cuotas.length === 1 ? '1 pago' : agruparCuotas(cuotas).map(([m, q]) => `${q} cuota${q > 1 ? 's' : ''} de ${f(m)}`).join(' y ');
  return `${s.nombre} (${s.detalle}) — Lista: ${f(s.precioLista)} — Contado: ${f(precioContado(s.precioLista, s.descuentoContado))} — Cuotas sin interés: ${partes}`;
}
export function agruparCuotas(c: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const m of c) { const u = out[out.length - 1]; if (u && u[0] === m) u[1]++; else out.push([m, 1]); }
  return out;
}
export const formatoPesos = (n: number) => '$' + n.toLocaleString('es-AR');

export const motor = { precioContado, calcularCuotas, validarServicio, aplicarComando, textoWhatsApp, agruparCuotas, formatoPesos, CLAVE_STORAGE };
if (typeof window !== 'undefined') (window as any).__MOTOR_ACADEMIA__ = motor;
