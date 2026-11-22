import type { Estado, Servicio } from './motor';

const s = (n: number, nombre: string, categoria: string, detalle: string, precioLista: number, descuentoContado: number, cuotas: 1 | 3, promoDelMes: boolean, estado: Servicio['estado']): Servicio =>
  ({ id: `SRV-${String(n).padStart(2, '0')}`, nombre, categoria, detalle, precioLista, descuentoContado, cuotas, promoDelMes, estado });

const cmd = (n: number, tipo: string, entidadId: string, actor: string, perfil: 'Operación' | 'Revisor', datos: unknown, motivo: string, resultado: 'aplicado' | 'rechazado', extra: object = {}) => ({
  id: `CMD-00${n}`, tipo, entidadId, actor, perfil, instante: `2026-10-0${n}T10:00:00-03:00`, revisionEsperada: n - 1, datos, motivo, resultado, ...extra,
});
const evt = (n: number, tipo: string, entidadId: string, actor: string, detalle: Record<string, unknown>) => ({
  id: `EVT-00${n}`, comandoId: `CMD-00${n}`, tipo, entidadId, revision: n, instante: `2026-10-0${n}T10:00:00-03:00`, actor, detalle,
});

export function estadoSemilla(): Estado {
  return {
    schemaVersion: 2,
    revision: 6,
    configuracion: { horarioAtencion: '7:30 a 21:30', zonaHoraria: 'America/Argentina/Buenos_Aires', claveAccesoAdmin: 'ESTE2026' },
    entidades: {
      servicios: [
        s(1, 'Curso principiante', 'Curso práctico', '10 clases de 45 minutos', 260000, 30000, 3, true, 'Publicado'),
        s(2, 'Curso intensivo', 'Curso práctico', '16 clases de 45 minutos', 390000, 30000, 3, true, 'Publicado'),
        s(3, 'Perfeccionamiento para conductores con licencia', 'Curso práctico', '6 clases de 60 minutos', 195000, 15000, 3, false, 'Publicado'),
        s(4, 'Clase suelta de 60 minutos', 'Clase suelta', '1 clase de 60 minutos', 34000, 0, 1, false, 'Publicado'),
        s(5, 'Clase de estacionamiento', 'Clase suelta', '1 clase de 30 minutos', 19000, 0, 1, false, 'Publicado'),
        s(6, 'Teórico de educación vial', 'Teórico virtual', '4 clases de 60 minutos', 45000, 5000, 1, true, 'Publicado'),
        s(7, 'Práctica en simulador', 'Simulador', '2 clases de 30 minutos', 28000, 0, 1, false, 'Pausado'),
        s(8, 'Curso de ruta y autopista', 'Curso práctico', '4 clases de 60 minutos', 150000, 0, 1, false, 'Pausado'),
      ],
      propuestas: [
        { id: 'PROP-001', servicioId: 'SRV-01', estado: 'Pendiente', creador: 'Laura (Operación)', cambios: { precioLista: 275000 }, motivo: 'Actualización por costo de combustible' },
        { id: 'PROP-002', servicioId: 'SRV-04', estado: 'Rechazada', creador: 'Martín (Operación)', cambios: { precioLista: 38000 }, motivo: 'Ajuste por inflación', decididaPor: 'Carlos (Revisor)', motivoDecision: 'El ajuste es mayor al previsto para el mes' },
        { id: 'PROP-003', servicioId: 'SRV-02', estado: 'Pendiente', creador: 'Laura (Operación)', cambios: { precioLista: 410000 }, motivo: 'Ajuste posterior al cierre de octubre' },
      ],
      cierres: [
        { id: 'CIE-001', fecha: '2026-10-31T21:30:00-03:00', descripcion: 'Cierre de lista de precios de octubre', ejecutadoPor: 'Carlos (Revisor)', servicioIds: ['SRV-01', 'SRV-02', 'SRV-03', 'SRV-04', 'SRV-05', 'SRV-06', 'SRV-07', 'SRV-08'], propuestaIds: ['PROP-002'] },
      ],
    },
    eventos: [
      evt(1, 'crear_servicio', 'SRV-01', 'Laura (Operación)', { precioLista: 260000, descuentoContado: 30000, despues: { precioLista: 260000, descuentoContado: 30000, estado: 'Borrador' } }),
      evt(2, 'publicar_servicio', 'SRV-02', 'Laura (Operación)', { estado: 'Publicado', antes: { estado: 'Borrador' }, despues: { estado: 'Publicado' } }),
      evt(3, 'editar_servicio', 'SRV-06', 'Martín (Operación)', { cambios: { descuentoContado: 5000 }, antes: { descuentoContado: 0 }, despues: { descuentoContado: 5000 } }),
      evt(4, 'pausar_servicio', 'SRV-07', 'Martín (Operación)', { estado: 'Pausado', antes: { estado: 'Publicado' }, despues: { estado: 'Pausado' } }),
      evt(5, 'pausar_servicio', 'SRV-08', 'Laura (Operación)', { estado: 'Pausado', antes: { estado: 'Publicado' }, despues: { estado: 'Pausado' } }),
    ],
    comandosAplicados: [
      cmd(1, 'crear_servicio', 'SRV-01', 'Laura (Operación)', 'Operación', { precioLista: 260000 }, 'Alta del curso', 'aplicado', { revisionResultante: 1 }),
      cmd(2, 'publicar_servicio', 'SRV-02', 'Laura (Operación)', 'Operación', {}, 'Publicación', 'aplicado', { revisionResultante: 2 }),
      cmd(3, 'editar_servicio', 'SRV-06', 'Martín (Operación)', 'Operación', { descuentoContado: 5000 }, 'Promo del mes', 'aplicado', { revisionResultante: 3 }),
      cmd(4, 'pausar_servicio', 'SRV-07', 'Martín (Operación)', 'Operación', {}, 'Simulador en mantenimiento', 'aplicado', { revisionResultante: 4 }),
      cmd(5, 'pausar_servicio', 'SRV-08', 'Laura (Operación)', 'Operación', {}, 'Sin cupo de instructores', 'aplicado', { revisionResultante: 5 }),
      { ...cmd(6, 'editar_servicio', 'SRV-03', 'Martín (Operación)', 'Operación', { precioLista: 200000 }, 'Ajuste', 'rechazado', { error: 'Edición desactualizada: la revisión vigente es 5 y enviaste 3. Actualizá los datos y volvé a revisar antes de confirmar' }), revisionEsperada: 3 },
    ],
  };
}
