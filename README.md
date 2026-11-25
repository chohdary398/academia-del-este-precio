# Academia del Este — Lista de Precios y Gestión de Cursos

Aplicación web interna para asesores comerciales y administración de **Academia del Este** (Argentina). Permite consultar tarifas actualizadas en modo solo lectura para atención por WhatsApp y gestionar cursos, propuestas de ajuste de precios, auditoría inmutable, conciliación y respaldos versionados sin servicios externos.

---

## 1. Cómo correr el proyecto localmente

1. Cloná este repositorio:
   ```bash
   git clone https://github.com
   cd academia-del-este-precio
   ```
2. Instalá las dependencias (requiere Node.js 18+):
   ```bash
   npm install
   ```
3. Iniciá el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Abrí la URL local indicada en consola (habitualmente `http://localhost:5173`).

---

## 2. Persistencia en `localStorage` y preparación / reemplazo de datos sintéticos

- **Clave propia en `localStorage`:** `academia_del_este_v2`
- **Estructura versionada (`schemaVersion: 2`):** Almacena `schemaVersion`, `revision`, `configuracion`, `entidades` (`servicios`, `propuestas`, `cierres`), `eventos` confirmados inmutables y `comandosAplicados`.
- **Carga automática de semilla:** Al iniciar por primera vez (cuando `academia_del_este_v2` no existe en `localStorage`), la aplicación carga automáticamente 8 servicios iniciales (`SRV-01` a `SRV-08`: 6 `Publicado` y 2 `Pausado`), 3 propuestas (`PROP-001` a `PROP-003`), 1 cierre (`CIE-001`), comandos históricos y 24 eventos conciliados.
- **Cómo reiniciar o reemplazar los datos sintéticos:**
  1. **Reset desde la interfaz:** Ingresá al panel con perfil **Operación** o **Revisor**, andá a **Control y Exportación** → *Verificación de Reglas de Dominio y Casos Adversos* → **«Restaurar datos semilla iniciales (Reset demo)»**.
  2. **Reemplazo mediante respaldo JSON:** En **Control y Exportación** → *Restaurar Copia de Seguridad JSON*, cargá un archivo `.json` válido (`schemaVersion: 1` o `2`). Las copias `v1` migran automáticamente a `v2` conservando IDs y cantidades; las copias corruptas, truncadas o con IDs duplicados se rechazan por completo sin modificar el estado previo.
  3. **Reinicio manual desde navegador:** Eliminá la clave `academia_del_este_v2` en *DevTools → Application → Local Storage* y recargá la página.

---

## 3. Acceso al Panel, Perfiles Demo y Cómo Cambiar la Clave

- **Aviso de entorno local:** El ingreso administrativo es una validación local en el navegador con datos sintéticos; no constituye autenticación real ni bloqueo simultáneo entre computadoras.
- **Clave inicial por defecto:** `ESTE2026`
- **Perfiles locales disponibles al ingresar:**
  - **Operación** (*Laura / Martín*): alta, edición, cambio de estado (`Publicado`/`Pausado`), borrado con confirmación y creación de propuestas.
  - **Revisor** (*Carlos*): aprobación o rechazo de propuestas y ejecución de cierres (el motor prohíbe aprobar propuestas creadas por el mismo actor).
  - **Auditor** (*Sofía*): consulta de historial inmutable, conciliación y exportaciones (bloqueado para mutaciones tanto en interfaz como en el motor).
- **Cómo cambiar la clave del panel:**
  1. **Desde la interfaz:** Ingresá al panel con perfil **Operación** o **Revisor**, abrí la sección de configuración de clave en **Gestión y Propuestas**, ingresá la nueva clave y guardá (se persiste en `configuracion.claveAccesoAdmin` dentro de `academia_del_este_v2`).
  2. **Desde el código fuente:** Editá `claveAccesoAdmin: "ESTE2026"` en la configuración inicial del dominio (`src/domain/`) antes de inicializar `localStorage`.

---

## 4. Regla de Redondeo de Cuotas y Cálculo Contado

- **Precio contado:** `precioContado = precioLista - descuentoContado`. El descuento no puede superar el 50% del precio de lista (`descuentoContado <= precioLista / 2`), garantizando que el precio contado nunca sea cero ni negativo.
- **Redondeo exacto de cuotas (enteros en pesos):**
  - Para **1 cuota**: `[precioLista]`.
  - Para **3 cuotas**: las dos primeras cuotas se redondean hacia arriba al peso entero mediante `Math.ceil(precioLista / 3)` y la **tercera cuota absorbe el ajuste** (`precioLista - (cuota1 + cuota2)`), asegurando que la suma de las 3 cuotas coincida exactamente con el precio de lista sin cobrar de más.
  - **Ejemplo verificable (`$1.000` en 3 cuotas):** `Math.ceil(1000 / 3) = 334` para cuota 1 y cuota 2; cuota 3 = `1000 - (334 + 334) = 332`. Total: `334 + 334 + 332 = 1.000`.

---

## 5. Especificación Breve de Dominio

### Entidades y Relaciones
- **Servicio (`SRV-XX`)**: ítem del catálogo con dato editable (`nombre`, `categoria`, `detalleClases`, `precioLista`, `descuentoContado`, `cantidadCuotas`, `promoMes`, `estado`) y valores derivados (`precioContado`, `valoresCuotas`).
- **Propuesta (`PROP-XXX`)**: solicitud de ajuste vinculada a un `servicioId`, registra `versionPartida`, `cambiosSolicitados`, `motivo`, `creador`, `estado` (`Pendiente` | `Aprobada` | `Rechazada`) y `decisor`.
- **Cierre (`CIE-XXX`)**: consolidación periódica vinculada a servicios vigentes.
- **Comando (`CMD-XXX`)**: intención de cambio con `id` único (idempotencia), `tipo`, `entidadId`, `actor`, `perfil`, `instante`, `revisionEsperada` (concurrencia optimista) y `datos`.
- **Evento (`EVT-XXX`)**: registro inmutable generado únicamente tras confirmar un comando válido; congela valores anteriores y nuevos (`instantánea histórica`) sin reescribir antecedentes.

### Tabla de Transiciones Válidas

| Entidad | Estado Inicial | Acción / Comando | Perfil Autorizado | Estado Final | Efecto en Catálogo / Recursos |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Servicio** | *(Nuevo)* | Crear servicio | Operación | `Publicado` | Visible en lista de asesores y contadores |
| **Servicio** | `Publicado` | Pausar servicio | Operación | `Pausado` | Se oculta de asesores; sigue en administración |
| **Servicio** | `Pausado` | Publicar servicio | Operación | `Publicado` | Vuelve a ser visible para asesores |
| **Servicio** | `Publicado` / `Pausado` | Borrar (con confirmación) | Operación | *(Eliminado)* | Sale de catálogo y contadores; conserva eventos históricos |
| **Propuesta** | *(Nueva)* | Crear propuesta | Operación | `Pendiente` | No modifica precios vigentes hasta aprobación |
| **Propuesta** | `Pendiente` | Aprobar propuesta | Revisor (`actor !== creador`) | `Aprobada` | Actualiza precio del servicio, incrementa revisión y congela evento |
| **Propuesta** | `Pendiente` | Rechazar propuesta | Revisor (`actor !== creador`) | `Rechazada` | Mantiene precios vigentes sin cambios |

---

## 6. Recorrido de Demostración Sugerido

1. **Lista de Asesores (Solo lectura):** Buscar cursos, filtrar por categoría o *Promo del mes*, verificar las cuotas exactas y pulsar **«Copiar texto»** para obtener el mensaje listo para WhatsApp.
2. **Ingreso al Panel:** Pulsar **«Ingresar al Panel»**, usar clave `ESTE2026` y elegir perfil **Operación** (*Laura*), **Revisor** (*Carlos*) o **Auditor** (*Sofía*).
3. **Gestión y Propuestas:** Crear o pausar un curso (validando límite de descuento del 50%), intentar aprobar una propuesta propia (bloqueado por el motor) y aprobar `PROP-001` con un Revisor distinto.
4. **Historial y Auditoría:** Consultar eventos confirmados (sin opción de borrado) y comandos rechazados (`CMD-006`) filtrando por registro y período.
5. **Control y Exportación:** Verificar conciliación en `0 diferencias`, descargar CSV filtrado y respaldo JSON `v2`, probar restauración `v1 → v2` / rechazo de JSON inválido y ejecutar los casos del bloque **«Verificación de Reglas de Dominio y Casos Adversos»**.

---

## 7. Cómo correr la Suite de Pruebas Unitarias por Consola

El repositorio incluye pruebas unitarias automatizadas con el runner nativo de Node.js (`node:test`, sin dependencias externas) en `tests/motor.test.mjs` que verifican cuotas (`1000 -> 334, 334, 332`), límite de descuento, idempotencia, concurrencia optimista, permisos por rol y migración `v1 → v2`:

```bash
node --test tests/motor.test.mjs
```
