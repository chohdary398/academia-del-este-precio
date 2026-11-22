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

let fallarProximoGuardado = false;
export const simularFalloProximoGuardado = () => { fallarProximoGuardado = true; };
export const falloPendiente = () => fallarProximoGuardado;
/** Almacén real de la app; permite hacer fallar un único guardado para verificar el reintento. */
export const almacenApp = {
  setItem(k: string, v: string) {
    if (fallarProximoGuardado) {
      fallarProximoGuardado = false;
      throw new Error('almacenamiento lleno (simulado)');
    }
    localStorage.setItem(k, v);
  },
};
