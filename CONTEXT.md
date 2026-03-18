# Contexto del Sistema

## Resumen

Este repositorio implementa un sistema de gestion para una tienda de productos naturales con:

- `frontend/`: aplicacion React + Vite
- `backend/`: API Express + SQLite
- `backend/database/tienda.db`: base de datos canonica actual

El sistema cubre:

- autenticacion con JWT
- gestion de productos
- POS (punto de venta)
- historial de ventas
- notas de credito
- caja diaria
- reportes
- importacion y actualizacion de productos/precios
- configuracion de comisiones y coeficientes

## Stack

### Frontend

- React 18
- Vite
- Tailwind + Bootstrap mezclados segun pantalla
- Axios para consumo de API
- React Router v6
- React Toastify

### Backend

- Node.js
- Express
- SQLite con SQL manual, sin ORM
- JWT
- PDFKit

## Estructura principal

### Frontend

- `frontend/src/App.jsx`: router principal
- `frontend/src/services/api.js`: cliente API centralizado
- `frontend/src/components/AppModal.jsx`: modal base reutilizable
- `frontend/src/components/ProductModal.jsx`: ABM de producto
- `frontend/src/components/BarcodeScanner.jsx`: escaner de codigos
- `frontend/src/pages/Login.jsx`: login
- `frontend/src/pages/Pos.jsx`: punto de venta
- `frontend/src/pages/Products.jsx`: gestion de productos
- `frontend/src/pages/Sales.jsx`: historial de ventas y notas de credito
- `frontend/src/pages/caja.jsx`: caja diaria
- `frontend/src/pages/cajaSummary.js`: helper contable del resumen de caja
- `frontend/src/pages/reportes/*`: reportes

### Backend

- `backend/server.js`: crea y arranca la app Express
- `backend/src/config/database.js`: conexion, inicializacion y migraciones sobre SQLite
- `backend/src/controllers/auth.controller.js`: login/register
- `backend/src/controllers/product.controller.js`: productos, codigos, exportacion
- `backend/src/controllers/sale.controller.js`: ventas, ticket PDF, refunds
- `backend/src/controllers/cash.controller.js`: caja diaria, movimientos, reportes
- `backend/src/controllers/report.controller.js`: reportes operativos
- `backend/src/routes/*.routes.js`: rutas por dominio

## Base de datos valida

La base valida de trabajo es:

- `backend/database/tienda.db`

Durante una intervencion previa se tomo como canonica una copia subida por el usuario. Sobre esa base se ajustaron migraciones y codigo para compatibilidad real.

## Estado funcional actual

### Ya estabilizado

- login con JWT
- arranque del sistema con un solo comando desde raiz
- venta POS con impacto en caja
- comision por metodo de pago
- nota de credito con impacto en caja
- cierre de caja
- reportes principales
- rutas administrativas protegidas
- varios modales nativos reemplazados por modales propios

### Script de arranque unico

Desde la raiz del repo:

```bash
npm start
```

Esto levanta:

- backend
- frontend
- apertura automatica del navegador

Archivos involucrados:

- `package.json`
- `scripts/dev.js`

## Convenciones UI acordadas

### Mantener

- los banners tipo `Alert` de Bootstrap estan permitidos

### No usar

- `alert()`
- `window.confirm()`

### Regla

Los mensajes interactivos o confirmaciones deben ir con modal propio del sistema.

Para eso se creo:

- `frontend/src/components/AppModal.jsx`

Los modales custom ya migrados a ese componente:

- `ProductModal`
- `BarcodeScanner`
- varios modales de `Pos.jsx`
- modales de informacion y eliminacion en `Products.jsx`
- modales de detalle y refund en `Sales.jsx`

Pendiente de unificacion total:

- `frontend/src/pages/caja.jsx` aun usa `react-bootstrap` `Modal`

## Hallazgos tecnicos importantes

### 1. Caja y ventas

Problema original:

- la caja duplicaba importes en reportes porque combinaba:
  - movimientos de caja (`cash_movements`)
  - ventas y refunds (`sales` / `refunds`)

Correccion aplicada:

- en backend, el reporte de caja ahora separa:
  - ingresos manuales
  - ventas
  - egresos manuales
  - comisiones
  - notas de credito

Archivos clave:

- `backend/src/controllers/cash.controller.js`
- `frontend/src/pages/cajaSummary.js`
- `frontend/src/pages/caja.jsx`

Resultado validado:

- con apertura `1000`
- ingreso manual `200`
- venta `2`
- comision `0.06`
- nota de credito `2`

El cierre correcto obtenido fue:

- antes de refund: `1201.94`
- despues de refund: `1199.94`

### 2. Fecha de caja vs fecha real de venta

El sistema maneja dos ideas de fecha:

- `created_at`: timestamp real del evento
- `date`: fecha operativa de la caja

Esto importa porque una caja abierta para un dia puede registrar movimientos con `date` de esa caja aunque el timestamp real sea otro.

### 3. Movimiento manual de caja

Problema original:

- insertaba el movimiento y luego actualizaba el `date` con `MAX(id)`, lo cual era fragil ante concurrencia

Correccion aplicada:

- ahora inserta `date` directamente en el `INSERT`

### 4. Timestamp fijo en caja

Problema original:

- habia timestamps calculados una sola vez al cargar el modulo

Correccion aplicada:

- ahora se toma el timestamp al momento real de cada operacion

## POS

### Estado actual

- no permite concretar venta sin caja abierta
- informa esto con modal, no con `alert` ni `confirm`
- boton cancelar usa modal de confirmacion propio
- usa `cashAPI.getSession()` para verificar si la caja esta abierta

Archivo clave:

- `frontend/src/pages/Pos.jsx`

## Productos

### Estado actual

- exportacion de Excel con mensajes en modal propio
- eliminacion de producto con modal propio

Archivo clave:

- `frontend/src/pages/Products.jsx`

## Sales

### Estado actual

- detalle de venta y refund usan modal propio unificado
- descarga de ticket PDF y nota de credito PDF activa

Archivo clave:

- `frontend/src/pages/Sales.jsx`

## Reportes

### Ajustes ya hechos

- endpoints frontend/backend alineados
- export de descuentos corregido
- fallback en PDF de descuentos cuando falla dependencia externa

Archivo clave:

- `backend/src/controllers/report.controller.js`

## Seguridad

Rutas administrativas que quedaron protegidas:

- coeficientes
- comisiones
- sale types
- importador

## Migraciones y esquema

Se normalizaron cambios de schema sobre la base real para soportar:

- `schema_migrations`
- `sale_types`
- `commission_settings`
- `sale_commissions`
- `sales.sale_type_id`
- `cash_sessions.closed_at`
- `cash_movements.date`

Archivo principal:

- `backend/src/config/database.js`

## Testing y validacion

### Hecho

- smoke test backend
- build frontend
- varias pruebas reales sobre copia temporal de la base

Archivos:

- `backend/smoke-test.js`
- `.github/workflows/test.yml`

### Limitacion observada

En esta sandbox hubo restricciones para procesos hijos y algunos comandos `npm run`, pero en entorno local real el flujo principal se valido.

## Decisiones de implementacion tomadas

1. No reescribir el sistema completo.
2. Mantener compatibilidad funcional primero.
3. Tomar la base SQLite real como fuente de verdad.
4. Corregir por capas:
   - DB
   - backend
   - frontend
   - UX
5. Evitar borrados destructivos sobre datos reales sin confirmacion.

## Pendientes recomendados

### Alta prioridad

- migrar los modales de `caja.jsx` a `AppModal` si se quiere una unificacion visual total
- seguir reemplazando cualquier UI nativa del navegador si reaparece

### Media prioridad

- modularizar mas `caja.jsx`
- revisar tamaño del bundle del frontend
- unificar aun mas estilos entre Bootstrap y Tailwind

### Baja prioridad

- documentar endpoints en archivo aparte
- agregar smoke tests adicionales para reportes y exportaciones

## Regla para futuras intervenciones

Antes de tocar caja, ventas, comisiones o refunds:

1. revisar `cash.controller.js`
2. revisar `sale.controller.js`
3. revisar `cajaSummary.js`
4. validar sobre copia temporal de `tienda.db`

Antes de tocar UI de mensajes:

1. no introducir `alert()` ni `window.confirm()`
2. usar `AppModal` para modales custom
3. se permiten banners `Alert`

## Comandos utiles

### Desarrollo

```bash
npm start
```

### Build frontend

```bash
cd frontend
npm run build
```

### Smoke test backend

```bash
cd backend
node smoke-test.js
```

## Cierre

Este archivo resume:

- que hace el sistema
- como esta estructurado
- que cambios criticos ya se hicieron
- que convenciones deben respetarse
- donde estan los puntos sensibles del negocio

Debe leerse como contexto base antes de futuras intervenciones importantes.
