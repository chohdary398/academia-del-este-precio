import type { Estado, Servicio } from './motor';

const s = (n: number, nombre: string, categoria: string, detalle: string, precioLista: number, descuentoContado: number, cuotas: 1 | 3, promoDelMes: boolean, estado: Servicio['estado']): Servicio =>
  ({ id: `SRV-${String(n).padStart(2, '0')}`, nombre, categoria, detalle, precioLista, descuentoContado, cuotas, promoDelMes, estado });


type Spec = { tipo: string; entidadId: string; actor: string; perfil: 'Operación' | 'Revisor'; datos: unknown; motivo: string; detalle: Record<string, unknown>; instante?: string };
const LAURA = 'Laura (Operación)';
const MARTIN = 'Martín (Operación)';
const CARLOS = 'Carlos (Revisor)';
const SRV = (n: number) => `SRV-${String(n).padStart(2, '0')}`;
const PROMO = [true, true, false, false, false, true, false, false];
const PUBLICADOS_EN_ORIGEN = [1, 2, 3, 4, 5, 6, 7, 8];

function especificaciones(): Spec[] {
  const l: Spec[] = [];
  for (let n = 1; n <= 8; n++) l.push({ tipo: 'crear_servicio', entidadId: SRV(n), actor: LAURA, perfil: 'Operación', datos: { alta: SRV(n) }, motivo: 'Alta del curso', detalle: { creado: SRV(n), despues: { estado: 'Borrador', promoDelMes: PROMO[n - 1] } } });
  for (const n of PUBLICADOS_EN_ORIGEN) l.push({ tipo: 'publicar_servicio', entidadId: SRV(n), actor: LAURA, perfil: 'Operación', datos: {}, motivo: 'Publicación', detalle: { estado: 'Publicado', antes: { estado: 'Borrador' }, despues: { estado: 'Publicado' } } });
  l.push({ tipo: 'editar_servicio', entidadId: SRV(6), actor: MARTIN, perfil: 'Operación', datos: { descuentoContado: 5000 }, motivo: 'Promo del mes', detalle: { cambios: { descuentoContado: 5000 }, antes: { descuentoContado: 0 }, despues: { descuentoContado: 5000 } } });
  l.push({ tipo: 'pausar_servicio', entidadId: SRV(7), actor: MARTIN, perfil: 'Operación', datos: {}, motivo: 'Simulador en mantenimiento', detalle: { estado: 'Pausado', antes: { estado: 'Publicado' }, despues: { estado: 'Pausado' } } });
  l.push({ tipo: 'pausar_servicio', entidadId: SRV(8), actor: LAURA, perfil: 'Operación', datos: {}, motivo: 'Sin cupo de instructores', detalle: { estado: 'Pausado', antes: { estado: 'Publicado' }, despues: { estado: 'Pausado' } } });
  l.push({ tipo: 'crear_propuesta', entidadId: 'PROP-001', actor: LAURA, perfil: 'Operación', datos: { cambios: { precioLista: 275000 } }, motivo: 'Actualización por costo de combustible', detalle: { servicioId: 'SRV-01', cambios: { precioLista: 275000 } } });
  l.push({ tipo: 'crear_propuesta', entidadId: 'PROP-002', actor: MARTIN, perfil: 'Operación', datos: { cambios: { precioLista: 38000 } }, motivo: 'Ajuste por inflación', detalle: { servicioId: 'SRV-04', cambios: { precioLista: 38000 } } });
  l.push({ tipo: 'rechazar_propuesta', entidadId: 'PROP-002', actor: CARLOS, perfil: 'Revisor', datos: {}, motivo: 'El ajuste es mayor al previsto para el mes', detalle: { servicioId: 'SRV-04', motivo: 'El ajuste es mayor al previsto para el mes' } });
  l.push({ tipo: 'ejecutar_cierre', entidadId: 'CIE-001', actor: CARLOS, perfil: 'Revisor', datos: {}, motivo: 'Cierre de lista de precios de octubre', detalle: { servicios: 8 }, instante: '2026-10-31T21:30:00-03:00' });
  l.push({ tipo: 'crear_propuesta', entidadId: 'PROP-003', actor: LAURA, perfil: 'Operación', datos: { cambios: { precioLista: 410000 } }, motivo: 'Ajuste posterior al cierre de octubre', detalle: { servicioId: 'SRV-02', cambios: { precioLista: 410000 } }, instante: '2026-11-02T10:00:00-03:00' });
  return l;
}

function historialSemilla() {
  const specs = especificaciones();
  const eventos: Estado['eventos'] = [];
  const comandosAplicados: Estado['comandosAplicados'] = [];
  specs.forEach((x, i) => {
    const n = i + 1;
    const instante = x.instante ?? `2026-10-${String(1 + Math.floor(i / 3)).padStart(2, '0')}T${String(8 + (i % 3) * 2).padStart(2, '0')}:00:00-03:00`;
    const id = `CMD-${String(n).padStart(3, '0')}`;
    eventos.push({ id: `EVT-${String(n).padStart(3, '0')}`, comandoId: id, tipo: x.tipo, entidadId: x.entidadId, revision: n, instante, actor: x.actor, detalle: x.detalle });
    comandosAplicados.push({ id, tipo: x.tipo, entidadId: x.entidadId, actor: x.actor, perfil: x.perfil, instante, revisionEsperada: n - 1, datos: x.datos, motivo: x.motivo, resultado: 'aplicado', revisionResultante: n });
  });
  comandosAplicados.push({
    id: 'CMD-025', tipo: 'editar_servicio', entidadId: 'SRV-03', actor: MARTIN, perfil: 'Operación', instante: '2026-11-02T11:00:00-03:00', revisionEsperada: 3,
    datos: { precioLista: 200000 }, motivo: 'Ajuste', resultado: 'rechazado',
    error: 'Edición desactualizada: la revisión vigente es 24 y enviaste 3. Actualizá los datos y volvé a revisar antes de confirmar',
  });
  return { eventos, comandosAplicados };
}


export function estadoSemilla(): Estado {
  return {
    schemaVersion: 2,
    revision: 24,
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
    ...historialSemilla(),
  };
}
