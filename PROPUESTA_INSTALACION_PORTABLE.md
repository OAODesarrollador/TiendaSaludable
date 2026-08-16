# Propuesta de empaquetado e instalación — Tienda Natural POS

## 1. Objetivo

Convertir el sistema actual en una aplicación instalable para Windows que pueda trasladarse a otra PC dentro de un único archivo ZIP y ponerse en funcionamiento sin conocimientos técnicos.

La experiencia final esperada es:

1. El usuario copia `TiendaNatural-Setup-x.y.z.zip` a la PC destino.
2. Descomprime el ZIP y ejecuta `Instalar Tienda Natural.exe`.
3. El instalador verifica el equipo, instala todos los componentes incluidos, conserva o importa los datos si corresponde y crea el acceso directo **Tienda Natural** en el escritorio.
4. El usuario abre el sistema con doble clic. No instala Node.js, npm ni paquetes manualmente y no usa una consola.

> Alcance recomendado inicialmente: Windows 10/11 de 64 bits. Un paquete generado para Windows no debe considerarse portable a macOS o Linux.

## 2. Diagnóstico del sistema actual

### Arquitectura encontrada

- Frontend: React 18 y Vite 5.
- Backend: Node.js, Express y API REST.
- Persistencia: SQLite en `backend/database/tienda.db`.
- Puertos actuales: frontend `3000`, backend `5000`.
- El frontend usa `/api` y Vite redirige esas solicitudes al backend durante desarrollo.
- Hay un endpoint de control básico: `GET /api/health`.
- Existen archivos `.bat` para instalar, iniciar y detener el sistema.
- Hay módulos nativos, especialmente `sqlite3` y `canvas`, que deben compilarse o incluir binarios compatibles con la arquitectura de Windows y la versión de Node usada.

### Problemas que impiden distribuirlo actualmente

1. `Start_all.bat` requiere que Node.js y npm ya estén disponibles. Si no lo están, solamente pide descargarlos.
2. En cada instalación ejecuta `npm install`, por lo que depende de internet, del registro npm y de que los módulos nativos puedan instalarse correctamente.
3. El frontend se inicia con Vite y el backend con herramientas propias de desarrollo. Vite y `nodemon` no deben formar parte del arranque de producción.
4. Hay tres conjuntos de dependencias (`raíz`, `backend` y `frontend`) y tres carpetas `node_modules`, lo que aumenta el tamaño y la posibilidad de inconsistencias.
5. La documentación no coincide: `README.md` e `INSTRUCCIONES.txt` mencionan puertos y archivos que no reflejan completamente los scripts vigentes.
6. `Start.bat` y el backend intentan terminar por PID cualquier proceso que ocupe los puertos 3000/5000. Esto puede cerrar programas ajenos y además exige permisos elevados innecesariamente.
7. `stop.bat` termina todos los procesos `node.exe`, incluidos los de otras aplicaciones.
8. La base de datos, archivos subidos y backups están dentro del árbol de la aplicación. Una actualización o desinstalación podría sobrescribir o eliminar datos del negocio.
9. Los backups se acumulan sin una política visible de retención.
10. La configuración sensible está en archivos `.env` del proyecto. Debe separarse del paquete, generarse en instalación y nunca exponerse en logs ni documentación.
11. El backend aún no sirve el `frontend/dist`; por eso hoy se necesitan dos procesos/puertos.
12. Incluir las carpetas `node_modules` actuales directamente en un ZIP no es una solución reproducible: pueden contener dependencias de desarrollo, binarios ligados a otra versión de Node y archivos innecesarios.

## 3. Solución recomendada

### Decisión de arquitectura

Mantener React + Express + SQLite, pero producir una distribución Windows autocontenida:

- Compilar React una sola vez durante la generación del paquete.
- Hacer que Express sirva `frontend/dist` y la API desde un único puerto local, por ejemplo `127.0.0.1:5000`.
- Incluir dentro del instalador una versión fija de Node.js para Windows x64 y solamente las dependencias de producción del backend.
- Ejecutar un lanzador propio que inicie el backend sin ventana de consola, espere el control de salud y abra el navegador predeterminado.
- Crear el instalador con **Inno Setup** (alternativa equivalente: NSIS). El instalador y todo lo necesario se entregan dentro de un único ZIP.

Esta opción requiere menos cambios y genera un paquete menor que convertir toda la aplicación a Electron. Electron puede evaluarse más adelante si se necesita una ventana de escritorio independiente del navegador, impresión/kiosco más controlada o actualización automática integrada.

### Estructura propuesta en la PC instalada

```text
%ProgramFiles%\Tienda Natural\
  app\                    # backend y frontend ya compilado
  runtime\node.exe        # runtime fijo incluido
  launcher\TiendaNatural.exe
  version.json

%ProgramData%\Tienda Natural\
  data\tienda.db
  uploads\
  backups\
  config\app.env
  logs\
```

El programa se instala en `Program Files`, pero los datos modificables se guardan en `ProgramData`. Así, reparar o actualizar la aplicación no reemplaza ventas, productos, imágenes ni backups.

Si la aplicación será utilizada por una única cuenta de Windows y no se desea solicitar permisos administrativos, se puede usar `%LocalAppData%\Programs\Tienda Natural` para el programa y `%LocalAppData%\Tienda Natural` para los datos. Debe elegirse una modalidad y probarse de forma consistente.

## 4. Procesos a implementar

### Fase 1 — Preparar el modo producción

1. Fijar una versión LTS concreta de Node y declarar `engines` en los paquetes.
2. Consolidar el flujo de construcción en la raíz:
   - instalación reproducible con `npm ci`;
   - compilación de frontend con `npm run build`;
   - instalación exclusiva de dependencias de producción para el artefacto final;
   - prueba de humo del artefacto, no del código de desarrollo.
3. Configurar Express para servir los archivos estáticos de `frontend/dist` y devolver `index.html` en rutas del frontend.
4. Usar un único origen y puerto. La API continúa bajo `/api`, eliminando CORS y el proxy Vite en producción.
5. Escuchar solamente en `127.0.0.1`, salvo que se decida expresamente permitir acceso desde otros equipos de la red.
6. Eliminar del arranque de producción `vite`, `nodemon` y cualquier `npm install`.
7. Reemplazar la lógica que mata procesos por una detección segura:
   - si `/api/health` identifica la misma aplicación, reutilizarla y abrirla;
   - si el puerto pertenece a otro programa, mostrar un error legible o usar un puerto libre permitido;
   - guardar el PID propio y detener únicamente ese proceso.

### Fase 2 — Separar aplicación y datos

1. Definir rutas absolutas mediante variables de entorno, como `DB_PATH`, `UPLOADS_PATH`, `BACKUP_PATH` y `LOG_PATH`.
2. En el primer inicio:
   - crear carpetas con permisos adecuados;
   - generar un `JWT_SECRET` aleatorio;
   - copiar una base inicial o crear el esquema;
   - ejecutar migraciones versionadas e idempotentes;
   - crear el usuario inicial mediante un asistente o exigir cambio de contraseña al primer ingreso.
3. Al instalar sobre una copia existente, detectar `backend/database/tienda.db` y ofrecer una importación explícita. Nunca reemplazar silenciosamente una base existente.
4. Antes de cada actualización o migración, crear un backup verificable.
5. Aplicar retención, por ejemplo 30 backups diarios y 12 mensuales, configurable.
6. Añadir funciones visibles de **Exportar respaldo** e **Importar respaldo**. Para trasladar una tienda existente, el respaldo debe incluir al menos base SQLite, uploads y metadatos de versión.

> El ZIP del instalador distribuye el programa. Los datos reales de una tienda deben viajar en un respaldo separado y protegido; incrustarlos en cada instalador aumenta el riesgo de pérdida o exposición.

### Fase 3 — Crear el lanzador de un solo clic

Implementar `TiendaNatural.exe` como un lanzador pequeño, sin consola, que:

1. Determine sus rutas sin asumir una letra de disco o carpeta fija.
2. Compruebe que están presentes `runtime/node.exe`, el backend, los assets del frontend y la configuración.
3. Compruebe permisos de lectura/escritura en la carpeta de datos y espacio libre mínimo.
4. Verifique la integridad/versión de la base con `PRAGMA integrity_check` y las migraciones pendientes.
5. Inicie exclusivamente el `node.exe` incluido, con las rutas de datos configuradas.
6. Espere hasta que `/api/health` responda correctamente, con tiempo máximo y reintentos.
7. Abra `http://127.0.0.1:5000` en el navegador predeterminado.
8. Si el inicio falla, muestre un mensaje comprensible y la ubicación del log, sin cerrar otros procesos.
9. Impida dos instancias mediante un mutex o archivo de bloqueo validado.

El instalador debe crear:

- acceso directo **Tienda Natural** en escritorio y menú Inicio;
- acceso **Diagnóstico de Tienda Natural**;
- desinstalador;
- opcionalmente, inicio automático con Windows, desactivado por defecto.

### Fase 4 — Instalador con chequeos y reparación

El instalador debe contener todo lo requerido; no debe descargar Node ni ejecutar npm en la PC del usuario.

Chequeos previos:

- Windows 10/11 x64 compatible;
- espacio disponible;
- permisos y ruta de instalación;
- existencia de una instalación anterior;
- procesos de la propia aplicación activos;
- acceso de escritura a la ubicación de datos;
- presencia de WebView no es necesaria si se usa el navegador predeterminado.

Acciones del instalador:

1. Validar la firma/hash del contenido.
2. Instalar archivos de aplicación y runtime.
3. Crear las carpetas de datos sin sobrescribirlas en una actualización.
4. Ejecutar un `post-install-check` con el mismo runtime incluido.
5. Crear accesos directos con icono propio.
6. Registrar versión instalada y permitir **Reparar**, **Actualizar** y **Desinstalar**.
7. En la desinstalación, conservar los datos por defecto y ofrecer su eliminación como una opción separada, claramente advertida.

### Fase 5 — Script de construcción del paquete único

Crear un comando para el responsable técnico, por ejemplo:

```powershell
npm run release:windows
```

Este comando debe ejecutarse en una máquina de construcción limpia y realizar automáticamente:

1. Limpiar solamente directorios temporales de build.
2. Ejecutar `npm ci` desde los lockfiles.
3. Ejecutar pruebas y compilar el frontend.
4. Preparar el backend con dependencias de producción.
5. Reconstruir/verificar `sqlite3` y `canvas` contra la versión fija de Node x64.
6. Descargar o tomar de caché el runtime oficial fijado y verificar su SHA-256.
7. Generar `version.json`, licencias de terceros y manifiesto de hashes.
8. Compilar el instalador.
9. Instalarlo silenciosamente en un entorno limpio de prueba, ejecutar el smoke test y desinstalarlo.
10. Crear el único entregable:

```text
release/TiendaNatural-Setup-x.y.z.zip
  Instalar Tienda Natural.exe
  LEEME.txt
  SHA256SUMS.txt
```

El usuario final solamente recibe ese ZIP. npm, Inno Setup y las herramientas de compilación existen únicamente en la PC/CI que genera la versión.

## 5. Chequeo de salud propuesto

Ampliar `/api/health` para que el instalador y el lanzador puedan validar, sin exponer secretos:

```json
{
  "status": "ok",
  "appVersion": "1.0.0",
  "database": "ok",
  "schemaVersion": 12,
  "dataDirectoryWritable": true,
  "uploadsDirectoryWritable": true
}
```

Agregar un comando local `diagnose` que controle:

- archivos y hashes esenciales;
- runtime esperado;
- carga de módulos nativos (`sqlite3`, `canvas`);
- integridad y apertura de SQLite;
- esquema actualizado;
- escritura y eliminación de un archivo temporal en datos/uploads/logs;
- disponibilidad del puerto;
- inicio del servidor y respuesta de `/api/health`;
- presencia del frontend compilado.

Debe generar un informe en `logs/diagnostico-AAAA-MM-DD-HHMMSS.txt`, omitiendo contraseñas, tokens y contenido comercial.

## 6. Seguridad y confiabilidad

- No solicitar administrador cada vez que se abre el POS. Solo el instalador lo requiere si instala en `Program Files`.
- Firmar el instalador y el lanzador con certificado de firma de código para reducir advertencias de Windows SmartScreen. Es recomendable para distribución real, aunque implica adquirir y proteger un certificado.
- Generar secretos por instalación; no empaquetar `.env` reales.
- No publicar la API en toda la red y no abrir reglas de firewall si el sistema será solo local.
- Usar transacciones y backups antes de migrar la base.
- Escribir logs con rotación y límite de tamaño.
- Excluir de la entrega fuentes, pruebas, backups históricos, caches y dependencias de desarrollo.
- Mantener inventario de licencias de dependencias.
- No afirmar compatibilidad de copia directa entre arquitecturas: debe existir un paquete separado si en el futuro se soporta Windows ARM64.

## 7. Estrategia de actualización

Cada versión debe tener número SemVer y migraciones de base asociadas.

Proceso recomendado:

1. El instalador detecta la versión anterior.
2. Detiene únicamente el proceso de Tienda Natural.
3. Crea y valida un backup.
4. Reemplaza archivos de programa, nunca datos.
5. Ejecuta migraciones idempotentes.
6. Inicia, consulta `/api/health` y, si falla, conserva logs y ofrece restauración.

En una primera etapa las actualizaciones pueden distribuirse como un nuevo ZIP completo. La actualización automática puede añadirse después, con manifiestos firmados y canal estable, pero no es requisito para lograr una instalación de un clic.

## 8. Pruebas obligatorias antes de entregar

Probar en máquinas virtuales limpias, sin Node.js ni herramientas de desarrollo:

- Windows 10 x64 y Windows 11 x64;
- usuario administrador durante instalación y usuario estándar durante uso;
- instalación sin internet;
- ruta con espacios y caracteres acentuados;
- primer inicio y segundo inicio;
- acceso directo de escritorio;
- base nueva e importación de base existente;
- actualización conservando ventas, productos y archivos;
- puerto ocupado por otra aplicación;
- dos intentos simultáneos de apertura;
- reinicio inesperado durante uso;
- generación de PDF, Excel, códigos de barras y uso de cámara/lector;
- backup, restauración y desinstalación conservando datos;
- diagnóstico con un archivo faltante y con una base dañada de prueba.

## 9. Criterios de aceptación

La tarea se considera terminada cuando:

- existe un único ZIP versionado con instalador, instrucciones mínimas y hashes;
- funciona en una PC limpia sin Node.js, npm ni internet;
- no se ejecuta `npm install` en el equipo destino;
- el acceso directo abre el sistema con un doble clic y sin consola visible;
- el lanzador espera un health check real antes de abrir el navegador;
- los datos sobreviven a reparación, actualización y desinstalación normal;
- ningún script finaliza procesos ajenos;
- el diagnóstico identifica archivos faltantes, módulo nativo incompatible, puerto ocupado y base no escribible;
- la instalación y actualización pasan una prueba automatizada de humo;
- existe procedimiento probado de backup/restauración y migración a otra PC.

## 10. Orden de implementación sugerido

1. Unificar frontend y backend en modo producción y en un solo puerto.
2. Externalizar base, uploads, backups, logs y configuración.
3. Crear migraciones, health check ampliado y comando de diagnóstico.
4. Crear el lanzador y su control de instancia/PID.
5. Preparar el artefacto reproducible con runtime y dependencias de producción.
6. Crear el instalador y accesos directos.
7. Implementar exportación/importación de respaldo.
8. Automatizar `release:windows` y las pruebas en Windows limpio.
9. Firmar y publicar el ZIP versionado.

## 11. Entregables técnicos esperados

- configuración de producción de Express y frontend;
- módulo central de rutas de datos;
- migraciones versionadas;
- lanzador `TiendaNatural.exe`;
- diagnóstico/health check;
- definición de instalador Inno Setup;
- iconos y accesos directos;
- script `release:windows`;
- manifiesto de hashes y licencias;
- pruebas de instalación, actualización y smoke test;
- manual breve para usuario final y manual de generación para mantenimiento.

Esta propuesta evita trasladar el entorno de desarrollo a cada PC. El entorno técnico se usa una sola vez para construir una versión; el usuario recibe una aplicación cerrada, reproducible, instalable y con sus datos separados de los binarios.
