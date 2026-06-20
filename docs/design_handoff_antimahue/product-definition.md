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

## Fuera del MVP (v2+)

- Tienda online / e-commerce
- Integración con medios de pago electrónicos (Transbank, MercadoPago)
- Reportes avanzados (ventas por período, producto más vendido, margen)
- Control de caja (apertura/cierre, arqueo)
- Órdenes de compra a proveedores
- Impresión de etiquetas con código de barras propio
- Fidelización de clientes
- Facturación electrónica / integración SII

## Stack candidato (a confirmar en diseño técnico)

Dado el perfil (web-responsive, multi-dispositivo, hosting simple):

- **Frontend**: PWA con framework moderno — funciona en navegador de cualquier
  dispositivo, se puede "instalar" como app
- **Backend**: API con base de datos PostgreSQL. Supabase es buen candidato
  (hosting managed, auth integrada, tier gratuito generoso)
- **Escaneo**: Browser Barcode Detection API o librería como `html5-qrcode`

Esto se define en detalle durante la fase de diseño técnico (SDD).

## Próximos pasos

1. Angélica revisa este documento → ajustamos lo que no calce
2. Refinamos atributos de producto (los que ella realmente usa para buscar/filtrar)
3. Definimos stack técnico final
4. Iniciamos SDD: propuesta → diseño → specs → tareas → implementación

---

## Opciones analizadas pero descartadas para importación de compras (futura referencia)

Para el MVP se evaluaron tres opciones de importación de documentos tributarios chilenos, decidiendo implementar únicamente la carga de XML de DTE por robustez. Se dejan las alternativas registradas para futuras iteraciones:

- **Lectura de PDF y OCR de facturas/boletas:** Descartada por la falta de un formato visual estándar entre los distintos proveedores. El parsing de texto o OCR introduce un riesgo altísimo de inconsistencia de datos en cantidades o costos unitarios.
- **Escaneo del Timbre Electrónico DTE (TED / código PDF417):** Descartado para la carga de inventario. El timbre PDF417 sólo contiene datos consolidados de la factura (RUT emisor, folio, total, neto, etc.) pero no tiene el detalle de los ítems ni cantidades. Puede servir en el futuro para registro contable rápido, pero no para control de stock.
