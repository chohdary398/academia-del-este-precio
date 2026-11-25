import test from 'node:test';
import assert from 'node:assert/strict';

function calcularCuotas(precioLista, cantidadCuotas) {
  if (cantidadCuotas === 1) return [precioLista];
  if (cantidadCuotas === 3) {
    const c1 = Math.ceil(precioLista / 3);
    const c2 = Math.ceil(precioLista / 3);
    const c3 = precioLista - (c1 + c2);
    return [c1, c2, c3];
  }
  throw new Error('Cantidad de cuotas no soportada');
}

function calcularContado(precioLista, descuentoContado) {
  if (precioLista <= 0) throw new Error('Precio de lista inválido');
  if (descuentoContado < 0 || descuentoContado > precioLista / 2) {
    throw new Error('El descuento no puede superar la mitad del precio de lista');
  }
  return precioLista - descuentoContado;
}

function ejecutarComando(estado, cmd) {
  if (cmd.perfil === 'Auditor') {
    return { ok: false, error: 'Permiso denegado: el perfil Auditor es de solo lectura' };
  }
  const previo = estado.comandosAplicados.find((c) => c.id === cmd.id);
  if (previo) {
    if (JSON.stringify(previo.datos) === JSON.stringify(cmd.datos) && previo.tipo === cmd.tipo) {
      return { ok: true, idempotente: true, estado };
    }
    return { ok: false, error: 'Conflicto de idempotencia: ID repetido con distintos datos' };
  }
  if (cmd.revisionEsperada !== estado.revision) {
    return { ok: false, error: 'Edición desactualizada: revisión esperada no coincide' };
  }
  if (cmd.tipo === 'APROBAR_PROPUESTA') {
    if (cmd.perfil !== 'Revisor') {
      return { ok: false, error: 'Solo un Revisor puede aprobar propuestas' };
    }
    const prop = estado.propuestas.find((p) => p.id === cmd.entidadId);
    if (!prop) return { ok: false, error: 'Propuesta inexistente' };
    if (prop.creador === cmd.actor) {
      return { ok: false, error: 'Un revisor no puede aprobar una propuesta creada por sí mismo' };
    }
  }
  const nuevoEstado = {
    ...estado,
    revision: estado.revision + 1,
    comandosAplicados: [...estado.comandosAplicados, cmd],
  };
  return { ok: true, estado: nuevoEstado };
}

function migrarSnapshot(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || !Array.isArray(data.entidades?.servicios)) {
    throw new Error('Copia corrupta o truncada');
  }
  const ids = new Set();
  for (const s of data.entidades.servicios) {
    if (ids.has(s.id)) throw new Error(`ID duplicado detectado: ${s.id}`);
    ids.add(s.id);
  }
  if (data.schemaVersion === 1) {
    return {
      schemaVersion: 2,
      revision: 1,
      entidades: data.entidades,
      eventos: [],
      comandosAplicados: [],
    };
  }
  if (data.schemaVersion === 2) return data;
  throw new Error('Versión de esquema desconocida');
}

test('1. Cuotas que reconcilian con el total (1000 -> 334, 334, 332)', () => {
  const cuotas = calcularCuotas(1000, 3);
  assert.deepEqual(cuotas, [334, 334, 332]);
  assert.equal(cuotas.reduce((a, b) => a + b, 0), 1000);
});

test('2. Validación de precio contado y límite de descuento del 50%', () => {
  assert.equal(calcularContado(260000, 30000), 230000);
  assert.throws(() => calcularContado(100000, 60000), /mitad del precio/);
});

test('3. Idempotencia: mismo ID con mismos datos vs distintos datos', () => {
  const base = { revision: 1, propuestas: [], comandosAplicados: [] };
  const cmd = { id: 'CMD-100', tipo: 'EDITAR', perfil: 'Operación', actor: 'Laura', revisionEsperada: 1, datos: { precio: 50000 } };
  const res1 = ejecutarComando(base, cmd);
  assert.equal(res1.ok, true);
  assert.equal(res1.estado.revision, 2);

  const res2 = ejecutarComando(res1.estado, cmd);
  assert.equal(res2.ok, true);
  assert.equal(res2.idempotente, true);
  assert.equal(res2.estado.revision, 2);

  const res3 = ejecutarComando(res1.estado, { ...cmd, datos: { precio: 99999 } });
  assert.equal(res3.ok, false);
});

test('4. Concurrencia optimista: rechaza revisión desactualizada', () => {
  const base = { revision: 5, propuestas: [], comandosAplicados: [] };
  const res = ejecutarComando(base, { id: 'CMD-101', tipo: 'EDITAR', perfil: 'Operación', actor: 'Laura', revisionEsperada: 4, datos: {} });
  assert.equal(res.ok, false);
  assert.match(res.error, /desactualizada/);
});

test('5. Separación de roles: Auditor bloqueado y Revisor no aprueba propuesta propia', () => {
  const base = {
    revision: 3,
    propuestas: [{ id: 'PROP-01', creador: 'Carlos' }],
    comandosAplicados: [],
  };
  const resAuditor = ejecutarComando(base, { id: 'CMD-102', tipo: 'EDITAR', perfil: 'Auditor', actor: 'Sofía', revisionEsperada: 3, datos: {} });
  assert.equal(resAuditor.ok, false);

  const resAutoAprobacion = ejecutarComando(base, { id: 'CMD-103', tipo: 'APROBAR_PROPUESTA', entidadId: 'PROP-01', perfil: 'Revisor', actor: 'Carlos', revisionEsperada: 3, datos: {} });
  assert.equal(resAutoAprobacion.ok, false);
  assert.match(resAutoAprobacion.error, /sí mismo/);
});

test('6. Migración v1 -> v2 válida y rechazo de copia con IDs duplicados o truncada', () => {
  const v1 = { schemaVersion: 1, entidades: { servicios: [{ id: 'SRV-01', nombre: 'Curso' }] } };
  const migrado = migrarSnapshot(v1);
  assert.equal(migrado.schemaVersion, 2);
  assert.equal(migrado.revision, 1);
  assert.equal(migrado.entidades.servicios[0].id, 'SRV-01');

  const duplicado = { schemaVersion: 1, entidades: { servicios: [{ id: 'SRV-01' }, { id: 'SRV-01' }] } };
  assert.throws(() => migrarSnapshot(duplicado), /duplicado/);
  assert.throws(() => migrarSnapshot('{"schemaVersion":1,"entidades":'));
});
