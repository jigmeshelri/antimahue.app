# Antimahue — Definición de Producto v0.1

> Documento vivo. Se actualiza a medida que refinamos con Angélica.

## Visión

Antimahue es un asistente simple de inventario y ventas para la tienda de lanas,
algodón, hilos, palillos y crochets de Angélica. No es un CRM ni un e-commerce.
Es una herramienta que se adapta a cómo ella ya trabaja — interacción directa con
el cliente — y le quita la carga mental de recordar precios, stock y cuentas.

## Principios de diseño

1. **Cero fricción** — Cada tarea frecuente se resuelve en 2 toques o menos.
2. **Lenguaje familiar** — Usar palabras que Angélica ya usa ("ovillo", "madeja",
   "palillo"), no jerga de sistemas.
3. **Visible, no oculto** — La información importante (stock bajo, total del día)
   está a la vista sin navegar.
4. **Teléfono-first** — El teléfono es el dispositivo principal durante la venta.
   Tablet y computador para administración.
5. **Tolerante a errores** — Deshacer, confirmar antes de acciones destructivas,
   nada de diálogos de confirmación innecesarios.

## Usuarios

| Rol           | Quién            | Necesita                                            |
| ------------- | ---------------- | --------------------------------------------------- |
| Vendedora     | Angélica         | Escanear, vender, consultar stock al vuelo          |
| Administradora | Angélica        | Cargar productos, ver valor inventario, ver reportes |
| Vendedor      | Empleado (1-2)   | Solo escanear y vender (sin acceso a costos ni proveedores) |

MVP: los 3 roles existen con autenticación simple (PIN de 4 dígitos).

## Funcionalidades — MVP (v1)

### 1. Catálogo de productos

- Código de barras (EAN/UPC del fabricante, escaneable con cámara)
- Nombre descriptivo
- Atributos: tipo (lana, algodón, hilo, palillo, crochet, accesorio), marca,
  grosor, color, peso/metraje
- **Costo** (lo que pagó Angélica al proveedor)
- **Precio de venta**
- **Stock actual** (unidades)
- **Stock mínimo** (hereda un default global; cada producto puede tener el propio)
- **Proveedor** asociado
- Imagen (opcional, desde la cámara)

### 2. Lectura de código de barras

- Escanear con la cámara del teléfono/tablet
- Código no encontrado en el sistema → ofrecer crear producto nuevo ahí mismo
- Código existe → mostrar info del producto y stock disponible

### 3. Venta simple

- Escanea productos o busca por nombre
- La pantalla de venta muestra: productos, cantidades, precios unitarios, total
- Al confirmar la venta:
  - Descuenta stock automáticamente
  - Registra medio de pago (efectivo, transferencia, débito, crédito)
  - Genera ticket simple
- **Deshacer última venta** — restaura el stock

### 4. Proveedores

- Nombre, contacto, teléfono
- Lista de productos que provee
- Historial de compras (fecha, productos, costo)
- **Importación de compras desde DTE (XML):** Carga automática de productos, cantidades y costos unitarios mediante la subida del archivo XML de la Factura Electrónica (DTE Tipo 33/46) o Boleta Electrónica (DTE Tipo 39) del proveedor.

### 5. Dashboard / pantalla principal

- **Alertas**: productos bajo stock mínimo (visibles apenas abre la app)
- **Valor total del inventario** (a costo y a precio de venta)
- **Ventas del día** (total, desglose por medio de pago)
- **Búsqueda rápida** (por nombre o escaneo) — siempre accesible

### 6. Ticket simple

- Datos de la tienda (nombre, logo si hay)
- Productos, cantidades, precios
- Total y medio de pago
- Fecha y hora
- Formato: apto para imprimir (ticket térmico 80mm) y para compartir por WhatsApp

### 7. Autenticación simple

- PIN de 4 dígitos por usuario
- Angélica: acceso completo
- Empleados: solo ventas (sin ver costos, proveedores, valor de inventario)

### 8. Asistente de Combinación de Colores (Uso Interno)

- **Asistente de Armonía Cromática:** Estructura el proceso en tres pasos:
  1. **Selección Base:** Elección de una lana inicial (color semilla).
  2. **Regla de Diseño:** Selección de la relación deseada: colores "parecidos" (análogos), complementarios (contraste directo), o tríadas (opuestos).
  3. **Recomendación de Inventario:** El sistema calcula los colores óptimos según la regla y sugiere automáticamente hilados del catálogo que estén en stock y que más se acerquen a la armonía deseada.
- **Diseñador de Paletas Interactivo:** Una pantalla visual donde se arrastran y ordenan los hilados seleccionados para ver cómo se ven las hebras juntas antes de cortar o vender.
- **Verificación de Stock en Tiempo Real:** Alertas visuales sobre si los colores sugeridos para la paleta están disponibles, bajo stock mínimo, o agotados.
- **Registro de Pedidos Pendientes:** Permite asociar colores agotados elegidos en la paleta a una nota de encargo del cliente, facilitando la lista de compras del próximo pedido a proveedores.


## Fuera del MVP (v2+)

- Tienda online / e-commerce
- Integración con medios de pago electrónicos (Transbank, MercadoPago)
- Reportes avanzados (ventas por período, producto más vendido, margen)
- Control de caja (apertura/cierre, arqueo)
- Órdenes de compra a proveedores
- Impresión de etiquetas con código de barras propio
- Fidelización de clientes, Portal Público y Asistente para Clientes (Web/PWA):
  - Acceso público (sin necesidad de iniciar sesión) al catálogo de lanas disponibles y stock actual (ocultando precios de costo y datos de administración).
  - Diseñador de paletas web para clientes con la opción de exportar el proyecto y enviarlo a Angélica por WhatsApp para reservar stock.
- Comunidad Antimahue:
  - Registro opcional para clientes de la tienda.
  - Guardar paletas y proyectos personales en perfiles.
  - "Muro de Proyectos": un espacio donde los clientes pueden subir fotos de sus tejidos terminados, indicando el patrón que usaron y enlazando directamente los productos y colores de lanas del catálogo de Antimahue que emplearon.
- Facturación electrónica / integración SII
- Login social (Google) para el enroll del personal — en MVP el enroll es email+contraseña una vez por dispositivo + PIN local; se reevalúa junto al Portal Público / Comunidad Antimahue

## Stack (cerrado 2026-06-21)

- **Frontend**: SPA con Vite 6 + React 19 + Tailwind 4 + TypeScript, PWA vía `vite-plugin-pwa`; routing con React Router v7; estado con nanostores.
- **Backend**: Supabase directo (PostgreSQL, Auth, Storage, RLS, PostgREST), región `sa-east-1` (São Paulo). Sin backend propio.
- **Host**: Cloudflare Workers Static Assets — LIVE en `antimahue.com`.
- **Package manager**: pnpm 11.
- **Escaneo de códigos**: Barcode Detection API o `html5-qrcode` — a definir en el change `catalogo`.

La fuente de verdad técnica es `openspec/project.yaml` y el change archivado `openspec/changes/archive/2026-06-22-setup-stack/`.

## Próximos pasos

Roadmap SDD aprobado (2026-07-05):

1. `data-model` — schema del dominio (productos, proveedores, ventas, movimientos) + RLS por rol
2. `auth-pin` — pantalla PIN, enroll, roles en UI
3. `catalogo` — CRUD de productos + escáner de códigos
4. `venta` — carrito, cobro, descuento de stock, deshacer, ticket
5. `dashboard` — alertas de stock, valor de inventario, ventas del día
6. `proveedores-dte` — proveedores + importación XML DTE (al final: la carga inicial del catálogo es incremental vía escáner)

`color-palette-assistant` retoma su fase specs después de `catalogo`.

---

## Opciones analizadas pero descartadas para importación de compras (futura referencia)

Para el MVP se evaluaron tres opciones de importación de documentos tributarios chilenos, decidiendo implementar únicamente la carga de XML de DTE por robustez. Se dejan las alternativas registradas para futuras iteraciones:

- **Lectura de PDF y OCR de facturas/boletas:** Descartada por la falta de un formato visual estándar entre los distintos proveedores. El parsing de texto o OCR introduce un riesgo altísimo de inconsistencia de datos en cantidades o costos unitarios.
- **Escaneo del Timbre Electrónico DTE (TED / código PDF417):** Descartado para la carga de inventario. El timbre PDF417 sólo contiene datos consolidados de la factura (RUT emisor, folio, total, neto, etc.) pero no tiene el detalle de los ítems ni cantidades. Puede servir en el futuro para registro contable rápido, pero no para control de stock.
