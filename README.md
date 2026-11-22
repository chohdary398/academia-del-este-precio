# Academia del Este — Lista de Precios y Gestión de Cursos

Aplicación web interna para asesores comerciales y administración de **Academia del Este** (Argentina). Permite consultar tarifas actualizadas en modo solo lectura para atención por WhatsApp y gestionar cursos, propuestas de ajuste de precios, auditoría inmutable, conciliación y respaldos versionados sin servicios externos.

## 1. Cómo ejecutar el proyecto localmente

1. Cloná o descargá este repositorio en tu computadora.
2. Instalá las dependencias:
   ```bash
   npm install
   ```
3. Iniciá el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Abrí la URL local indicada en la consola en el navegador.

## 2. Cómo se preparan y gestionan los datos sintéticos

- La aplicación persiste su estado completo en una única clave de `localStorage` llamada **`academia_del_este_v2`** con formato versionado (`schemaVersion: 2`).
- **Carga automática de semilla:** Al iniciar por primera vez (cuando la clave `academia_del_este_v2` no existe en `localStorage`), el sistema carga automáticamente:
  - **8 servicios iniciales** (`SRV-01` a `SRV-08`: 6 en estado `Publicado` visibles para asesores y 2 en estado `Pausado` visibles solo en administración).
  - **Historial completo de eventos y comandos** con revisiones consecutivas, propuestas de ajuste (`PROP-001` a `PROP-003`) y cierre registrado (`CIE-001`).
- **Reinicio de datos sintéticos:** Desde la pantalla **Control y Exportación** -> *Verificación de Reglas de Dominio y Casos Adversos* -> **«Restaurar datos semilla iniciales (Reset demo)»** (con perfil *Operación* o *Revisor*), se regenera el estado inicial sintético.

## 3. Acceso al Panel y cómo cambiar la clave

- **Entorno local de demostración:** El acceso administrativo utiliza una validación local en el navegador con datos sintéticos (no constituye autenticación real ni exclusión simultánea entre distintas computadoras).
- **Clave inicial por defecto:** `ESTE2026`
- **Perfiles de demostración disponibles al ingresar:**
  - **Operación** (*Laura / Martín*): alta, edición, pausado/publicación, borrado con confirmación y creación de propuestas de ajuste.
  - **Revisor** (*Carlos*): aprobación o rechazo de propuestas y ejecución de cierres (el motor prohíbe aprobar propuestas creadas por el mismo actor).
  - **Auditor** (*Sofía*): consulta de historial inmutable, conciliación y exportación (sin permisos de escritura).
- **Cómo cambiar la clave del panel:**
  1. **Desde la interfaz:** Ingresá al panel con perfil **Operación** o **Revisor**, abrí la sección de configuración de clave en **Gestión y Propuestas**, ingresá la nueva clave y guardá los cambios (se persiste en `configuracion.claveAccesoAdmin` dentro de `academia_del_este_v2`).
  2. **Desde el código fuente (semilla inicial):** Editá el valor de `claveAccesoAdmin` (por defecto `"ESTE2026"`) en el archivo de dominio/semilla antes de inicializar el almacenamiento.
