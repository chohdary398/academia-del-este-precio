import { CLAVE_STORAGE, type Estado } from './motor';
import { estadoSemilla } from './semilla';

/** Lee el estado; carga la semilla solo si la clave no existe. */
export function cargarEstado(): Estado {
  try {
    const raw = localStorage.getItem(CLAVE_STORAGE);
    if (raw === null) {
      const e = estadoSemilla();
      localStorage.setItem(CLAVE_STORAGE, JSON.stringify(e));
      return e;
    }
    return JSON.parse(raw) as Estado;
  } catch {
    return estadoSemilla();
  }
}
