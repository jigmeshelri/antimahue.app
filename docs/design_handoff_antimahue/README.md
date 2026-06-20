# Handoff: Antimahue — App de inventario y ventas

**Versión:** 1.0 · Diseño MVP  
**Fecha:** Junio 2025  
**Diseñado para:** Angélica — tienda de lanas, algodón, hilos, palillos y crochet

---

## Overview

Antimahue es una PWA de inventario y punto de venta para una tienda artesanal. No es un e-commerce ni un CRM: es una herramienta para que Angélica y sus empleados puedan vender, consultar stock y gestionar proveedores desde el teléfono.

**Principios de diseño:**
- Cero fricción — cada tarea frecuente en ≤ 2 toques
- Lenguaje familiar — "ovillo", "madeja", "palillo", no jerga técnica
- Teléfono-first — diseñado para móvil durante la venta
- Tolerante a errores — deshacer última venta, sin diálogos innecesarios

---

## Sobre los archivos de diseño

Los archivos `.dc.html` incluidos en este paquete son **prototipos de referencia en HTML**, no código de producción. El objetivo es **recrear estas interfaces en el stack elegido** (React PWA recomendado) usando los patrones y librerías del proyecto real. Los prototipos muestran comportamiento, layout, colores, tipografía y flujo de navegación exactos.

**Fidelidad:** Alta (hi-fi). Los diseños son pixel-perfect con colores, tipografía, espaciado e interacciones finales. El desarrollador debe replicar visualmente estos diseños en la plataforma destino.

---

## Stack técnico recomendado

```
Frontend:   React + Vite → PWA (installable, offline-first)
Backend:    Supabase (PostgreSQL + Auth + Storage)
Barcode:    Browser Barcode Detection API / html5-qrcode
DTE:        Parser de XML (fast-xml-parser o similar)
Fuentes:    DM Sans (Google Fonts)
Íconos:     Phosphor Icons (@phosphor-icons/react)
```

---

## Sistema visual — Variación "Terraza"

### Paleta de colores

```
/* Marca / Identidad */
--color-hoja:         #C84030   /* rojo otoño — ícono de app */
--color-hoja-deep:    #8A2010   /* rojo profundo — gradiente ícono */
--color-terracota:    #C17B4A   /* terracota — headers, CTA secundario */
--color-madera:       #8B5E3C   /* madera oscura — nav activo, botones */
--color-corteza:      #2D1F14   /* marrón muy oscuro — nav bg, CTA primario */

/* Fondos */
--bg-pantalla:        #F5EED8   /* pergamino cálido — fondo de pantalla */
--bg-card:            #FDFAF4   /* blanco cálido — fondo de tarjetas */

/* Bordes */
--border-sand:        #D9C3A0   /* arena — bordes de cards e inputs */
--border-sand-light:  #E8D5B7   /* arena claro — separadores */

/* Texto */
--text-primary:       #2D1F14   /* marrón oscuro — texto principal */
--text-secondary:     #B09070   /* marrón medio — labels, subtítulos */
--text-muted:         #8B6255   /* marrón suave — placeholders */

/* Nav */
--nav-bg:             #2D1F14
--nav-active:         #E8C090   /* ámbar dorado — ítem activo del nav */
--nav-inactive:       rgba(250,240,224,0.3)

/* Estados de stock */
--stock-ok:           #6B9E6B   /* verde — stock normal */
--stock-low:          #C9860A   /* ámbar — stock bajo */
--stock-low-bg:       #FEF3C7
--stock-out:          #C84A3A   /* rojo — sin stock */
--stock-out-bg:       rgba(200,74,58,0.08)
--stock-out-border:   rgba(200,74,58,0.2)

/* Éxito */
--success:            #3A8A3A
--success-bg:         #E8F2E8
--success-border:     #B0D4B0

/* Terracota claro (alertas, headers) */
--terracota-alert-bg:     rgba(200,74,58,0.08)
--terracota-alert-border: rgba(200,74,58,0.18)
```

### Tipografía

```
Familia: DM Sans (Google Fonts)
Import:  https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap

Escala:
  --text-hero:      26px / 700 / tracking -0.025em   /* saludo principal dashboard */
  --text-title:     22px / 700 / tracking -0.025em   /* títulos de sección header */
  --text-heading:   17px / 600                        /* título de pantalla (nav bar) */
  --text-stat:      22px / 700 / tracking -0.03em    /* cifras estadísticas */
  --text-total:     26px / 700 / tracking -0.03em    /* total de venta */
  --text-price:     15px / 700                        /* precio de ítem */
  --text-body:      14px / 500-600                    /* nombre de producto */
  --text-body-sm:   13px / 400-500                    /* texto general */
  --text-label:     12px / 400-500                    /* subtítulos */
  --text-caption:   11px / 400-500                    /* notas, stock info */
  --text-tiny:      10px / 500-600 / uppercase / tracking 0.06em  /* section labels */
```

### Espaciado y radios

```
/* Border radius */
--radius-card:     12px
--radius-card-sm:  10px
--radius-button:   12px
--radius-input:    10px
--radius-badge:    20px
--radius-icon:     9-11px
--radius-pill:     20px

/* Padding estándar */
--screen-h-pad:   15px   /* padding horizontal de pantalla */
--card-pad:       12-14px
--header-pad-h:   22px
--header-pad-v:   6px top / 16-18px bottom

/* Gaps */
--gap-cards:      9px
--gap-items:      7-8px
--gap-sections:   10px
```

### Sombras

```
/* No se usan box-shadows en cards — se prefieren borders */
/* Solo en el marco del teléfono (no aplicable en prod) */
```

### Transiciones

```
/* Navegación entre pantallas */
--nav-duration: 300ms
--nav-easing:   cubic-bezier(0.4, 0, 0.2, 1)
--nav-out-offset: translateX(-12%)   /* pantalla saliente */
--nav-in-forward: translateX(100%)   /* pantalla entrante (forward) */
--nav-in-back:    translateX(-12%)   /* pantalla entrante (back) */

/* Scanner found overlay */
--scanner-overlay-duration: 400ms
--scanner-overlay-easing:   cubic-bezier(0.4, 0, 0.2, 1)

/* PIN dot fill */
--pin-dot-duration: 150ms
```

### Ícono de app

SVG path del ícono de hoja de maple (viewBox 0 0 100 100):
```
M50 90 L46 76 L26 75 L32 62 L11 59 L26 47 L15 30 L35 36 L50 7 L65 36 L85 30 L74 47 L89 59 L68 62 L74 75 L54 76 Z
```
- Fondo ícono: `linear-gradient(160deg, #C84030, #8A2010)`
- Fill hoja: `#FAF0E0`
- Border-radius ícono app: ~22% del tamaño (ej. 36px en 160px)

---

## Pantallas y especificaciones

### Arquitectura de navegación

```
[PIN] ──────────────────────→ [Dashboard]
                                   │
                    ┌──────────────┴──────────────┐
                    ↓                             ↓
              [Venta]                       [Catálogo]
                │                               │
         ┌──────┴──────┐                   [Detalle]
         ↓             ↓                       │
     [Escáner]      [Ticket]           [Proveedor]
                                            │
                                         [DTE Import]
```

---

### 01 · PIN — Inicio de sesión

**Propósito:** Autenticación por PIN de 4 dígitos. Diferencia roles (admin/vendedor).

**Layout:**
- Fondo: `#F5EED8` a pantalla completa
- Contenido centrado verticalmente
- Status bar altura: 54px (color fondo, texto `#2D1F14`)

**Elementos:**
- Ícono app: 70×70px, border-radius 17px, gradiente `#C84030→#8A2010`, box-shadow `0 8px 24px rgba(140,32,16,0.3)`
- Título "Antimahue": 26px/700, color `#2D1F14`
- Subtítulo "Angélica · Administradora": 13px/400, color `#B09070`
- Label "INGRESA TU PIN": 12px/600, uppercase, tracking 0.06em, color `#8B6255`

**PIN dots (×4):**
- Tamaño: 13×13px, border-radius 50%
- Vacío: background transparent, border `2px solid #D9C3A0`
- Lleno: background `#8B5E3C`, sin border
- Transición: 150ms all ease

**Teclado numérico:**
- Grid 3 columnas, gap 12px
- Cada tecla: 66×66px, border-radius 50%
- Background: `#FDFAF4`, border: `1px solid #D9C3A0`
- Font: 22px/500, color `#2D1F14`
- Backspace: ícono Phosphor `BackspaceIcon`, 22px, color `#B09070`, sin fondo/border
- Celda vacía (posición [9,0]): empty div

**Comportamiento:**
- Al completar 4 dígitos: esperar 350ms → navegar a Dashboard
- Resetear dots después de navegar
- Todo PIN de 4 dígitos funciona en el MVP (validación real en backend)

**Home indicator:** 134×5px, border-radius 3px, `rgba(45,31,20,0.15)`, 32px de altura

---

### 02 · Dashboard — Pantalla principal

**Propósito:** Resumen del día. Alertas de stock, ventas y desglose de pagos.

**Header (terracota a full):**
- Status bar: 54px, fondo `#C17B4A`, texto blanco `#FAF0E0`
- Contenido header: padding `6px 22px 18px`
  - Izquierda: ícono app 36×36px (`rgba(0,0,0,0.18)` bg) + columna "Buenos días" (12px/400, `rgba(250,240,224,0.6)`) + "Angélica" (24px/700, `#FAF0E0`)
  - Derecha: bell icon button 38×38px (`rgba(0,0,0,0.14)` bg, border-radius 11px) + dot de notificación 8px rojo `#F5D780` con border `2px solid #C17B4A`
- Transición: div 12px altura; mitad terracota, mitad pergamino con border-radius `12px 12px 0 0`

**Body (pergamino):**
- Fondo: `#F5EED8`
- Padding: `13px 15px 0`, gap entre secciones: `9px`

**1. Alerta strip:**
- Fondo: `rgba(200,74,58,0.08)`, border: `1px solid rgba(200,74,58,0.18)`, border-radius: 10px
- Padding: `10px 13px`
- Layout: flex row, gap 9px
- Ícono: `WarningCircle` 17px, color `#C84A3A`
- Texto: 13px/500, color `#A33A2A`
- Link "Ver →": 12px/600, color `#8B5E3C`

**2. Stats (2 tarjetas en fila):**
- Cada tarjeta: `flex:1`, fondo `#FDFAF4`, border `1px solid #D9C3A0`, border-radius 12px, padding `13px 14px`
- Ícono section: 14px, color `#8B5E3C` + label 10px/600 uppercase tracking 0.06em color `#B09070`
- Número: 22px/700, color `#2D1F14`, tracking -0.03em
- Subtítulo: 11px, color `#B09070`

**3. Desglose de pagos:**
- 1 tarjeta ancha con 3 columnas separadas por divisores `1px solid #D9C3A0`
- Cada columna: label 10px `#B09070` + valor 16px/600 `#2D1F14`
- Columnas: Efectivo | Transfer. | Débito

**4. Lista de alertas de stock:**
- Header: "Alertas de stock" (13px/600) + "Ver todo" link (12px/600, `#8B5E3C`)
- Cada ítem: fondo `#FDFAF4`, border `1px solid #D9C3A0`, border-radius 10px, padding `10px 13px`
  - Dot de estado: 8px círculo (naranja `#C9860A` o rojo `#C84A3A`)
  - Nombre: 13px/500 `#2D1F14`
  - Info: 11px `#B09070`
  - Badge: 11px/600, padding `3px 8px`, border-radius 20px
    - "Bajo": color `#8B5E3C`, bg `#E8D5B7`
    - "Agotado": color `#C84A3A`, bg `rgba(200,74,58,0.1)`
  - Ítems "Agotado": fondo `#FEF5F2`, border `rgba(200,74,58,0.2)`

**Bottom nav:**
- Fondo: `#2D1F14`, altura: 58px, padding: `0 6px`
- 4 tabs: flex:1 cada uno, flex-col, align-items center, gap 3px
- Ícono: 21px; activo `#E8C090`, inactivo `rgba(250,240,224,0.3)`
- Label: 10px; activo font-weight 600, inactivo 400
- Tabs: Inicio (House), Venta (ShoppingCartSimple), Catálogo (Books), Más (DotsThreeCircle)

**Home indicator:** 26px altura, fondo `#2D1F14`, indicador `rgba(250,240,224,0.2)`

---

### 03 · Venta — Pantalla de venta

**Propósito:** Carrito de compra activo. Escanear/buscar productos y confirmar venta.

**Header:**
- Misma estructura terracota que Dashboard
- Back button: 36×36px, `rgba(0,0,0,0.14)` bg, border-radius 10px, ícono ArrowLeft 18px `#FAF0E0`
- Título "Nueva venta": 17px/600 `#FAF0E0`, centrado

**Barra de búsqueda (sobre fondo pergamino):**
- Padding: `11px 15px`
- Input search: flex:1, fondo `#FDFAF4`, border `1px solid #D9C3A0`, border-radius 10px, padding `11px 13px`
  - Ícono MagnifyingGlass 16px `#B09070` + placeholder 14px `#B09070`
- Botón escáner: 46×46px, fondo `#8B5E3C`, border-radius 10px
  - Ícono Barcode 24px `#FAF0E0`

**Items del carrito:**
- Fondo body: `#F5EED8`, padding `4px 15px 0`, gap: 8px
- Cada ítem: fondo `#FDFAF4`, border `1px solid #D9C3A0`, border-radius 12px, padding `12px 13px`
  - Header ítem: nombre 14px/600 `#2D1F14` + precio 15px/700 `#2D1F14`
  - Subtítulo: detalles 12px `#B09070`
  - Footer ítem: "N × $precio" label + stepper
  
**Stepper (−/qty/+):**
- Border: `1px solid #D9C3A0`, border-radius 8px, overflow hidden
- Botón −: 30×28px, fondo `#F5EED8`, font-size 15px, color `#8B6255`
- Cantidad: 32×28px, borders laterales `1px solid #D9C3A0`, fondo `#FDFAF4`, 14px/600 `#2D1F14`
- Botón +: 30×28px, fondo `#8B5E3C`, font-size 15px, color `#FAF0E0`, font-weight 500

**Sección de pago (bottom sheet fijo):**
- Fondo: `#FDFAF4`, border-top: `1px solid #D9C3A0`, padding: `13px 15px 10px`
- Total: "Total" (14px `#B09070`) + importe (26px/700 `#2D1F14`, tracking -0.03em)
- Medios de pago: 4 botones flex, gap 7px, border-radius 8px, padding `9px 3px`
  - Activo: fondo `#8B5E3C`, texto 12px/600 `#FAF0E0`
  - Inactivo: border `1px solid #D9C3A0`, texto 12px `#B09070`
- CTA "Confirmar venta · $X": fondo `#2D1F14`, border-radius 12px, padding 15px, 16px/700 `#F5EED8`

---

### 04 · Escáner — Cámara

**Propósito:** Escanear código de barras con la cámara. Muestra el producto encontrado.

**Layout:**
- Pantalla completa oscura: fondo `radial-gradient(ellipse at 40% 40%, #1A1614, #070604)`
- Status bar 54px, fondo `#0C0B09`, texto `#F5ECD8`
- Nav bar: fondo `#0C0B09`, border-bottom `1px solid rgba(255,255,255,0.05)`
  - Botón X: 36×36px, `rgba(255,255,255,0.08)` bg, ícono X `#F5ECD8`
  - Título: 17px/600 `#F5ECD8`

**Viewfinder:**
- Contenedor: 260×170px, centrado en el área de cámara
- Efecto viñeta: `box-shadow: 0 0 0 600px rgba(0,0,0,0.55)` en el viewfinder
- 4 esquinas: L-shapes 22×22px, border 3px solid `#FAF0E0`, border-radius 2px
- Animación: CSS keyframe `cornerpulse` (opacity 1 → 0.35 → 1, 1.6s ease-in-out infinite)

**Scan beam:**
- Posición absolute, left/right 6px, height 2px
- Background: `linear-gradient(to right, transparent 0%, #C84030 30%, #C84030 70%, transparent 100%)`
- Animación: `scanbeam` (top: 6px → 152px → 6px, 2.2s ease-in-out infinite)

**Help text:** "Apunta al código de barras", 14px/400, `rgba(250,240,224,0.55)`

**Product found overlay (bottom sheet):**
- Position: absolute, bottom 0, left 0, right 0
- Fondo: `#FDFAF4`, border-radius `16px 16px 0 0`, border-top `1px solid #D9C3A0`, padding `14px 15px 10px`
- Handle: 36×4px, border-radius 2px, color `#D9C3A0`, centrado
- Animación entrada: `transform: translateY(100%) → translateY(0)`, 400ms, easing estándar
- Trigger: automático 1.8 segundos después de abrir el escáner
- Contenido: imagen 54×54px + nombre/precio + stepper + CTA "Agregar a la venta"

---

### 05 · Ticket de venta

**Propósito:** Comprobante generado al confirmar una venta. Compartir o imprimir.

**Header:** terracota estándar + botón X (no back arrow)

**Área de éxito:**
- Círculo check: 52×52px, border-radius 50%, fondo `#D4EBD4`, border `2px solid #8ECA8E`
- Ícono Check: 26px/bold, color `#3A8A3A`
- Animación: `checkpop` (scale 0 → 1.25 → 1, opacity 0 → 1, 0.5s, delay 0.15s)
- Texto: "¡Venta registrada!" 17px/700 `#2D1F14` + fecha 12px `#B09070`

**Tarjeta de recibo:**
- Fondo: `#FFFFFF`, border `1px solid #D9C3A0`, border-radius 12px
- Header: logo + "ANTIMAHUE" + email
- Separator: `1px dashed #D9C3A0`
- Ítems: nombre (13px/500 `#2D1F14`) + "× N" (11px `#B09070`) + precio (14px/600 `#2D1F14`)
- Total: "TOTAL" label + importe grande + medio de pago
- Footer: "¡Gracias por tu compra!"

**Acciones:**
- WhatsApp: fondo `#25D366`, texto blanco, ícono WhatsApp
- Nueva venta: fondo `#2D1F14`, texto `#F5EED8`

---

### 06 · Catálogo

**Propósito:** Lista completa de productos con estado de stock y filtros.

**Header:** terracota con título "Catálogo" + botón + (agregar producto)

**Búsqueda + filtros:**
- Input search: igual que en Venta
- Chips de filtro: flex row, gap 7px, overflow hidden (horizontal scroll en móvil real)
  - Activo (Todos): fondo `#8B5E3C`, texto 12px/600 `#FAF0E0`, border-radius 20px
  - Inactivo: fondo `#FDFAF4`, border `1px solid #D9C3A0`, texto 12px `#8B6255`

**Lista de productos:**
- Padding: `0 15px`
- Cada ítem: flex row, gap 12px, padding `12px 0`, border-bottom `1px solid #E8D5B7`
- Miniatura: 40×40px, border-radius 8px (foto o indicador de color)
- Nombre: 14px/500 `#2D1F14`, text-overflow ellipsis
- Subtítulo: 11px `#B09070`
- Precio: 13px/600 `#2D1F14` (derecha)
- Stock: 11px/500 (verde `#6B9E6B`, ámbar `#C9860A "⚠"`, rojo `#C84A3A "Sin stock"`)

**Nav:** Catálogo activo (`#E8C090`), resto inactivos

---

### 07 · Detalle de producto

**Propósito:** Info completa de un producto. Costos y márgenes solo para admin.

**Header:** terracota con back button + nombre del producto + botón editar (Pencil icon)

**Imagen:** 148px de altura, border-radius 12px, overflow hidden, object-fit cover

**Info del producto:**
- Nombre: 20px/700 `#2D1F14`, tracking -0.02em
- Detalles: 13px `#B09070`
- Badge de stock: "N en stock", fondo `#E8F2E8`, border `1px solid #B0D4B0`, border-radius 20px

**Tarjeta admin (bloqueada para empleados):**
- Label: ícono LockSimple 13px `#B09070` + "Solo administradora" 10px/600 uppercase `#B09070`
- 3 columnas: Costo | Venta | Margen
- Separadas por `1px solid #D9C3A0`
- Valores: 18px/700 `#2D1F14` (margen: `#5A8A5A` verde)

**Tarjeta stock/proveedor:**
- Stock mínimo + proveedor (como link `color: #8B5E3C`)

**CTA:** "Agregar a venta", fondo `#2D1F14`, ícono ShoppingCartSimple `#E8C090`

---

### 08 · Proveedor

**Propósito:** Info de contacto del proveedor, productos y historial de compras.

**Header:** terracota + back button + nombre proveedor + botón teléfono

**Secciones:**
1. **Contacto:** teléfono + email + ciudad (ícono + texto, separados por `1px #E8D5B7`)
2. **Productos que provee:** lista de 3 ítems con miniatura, nombre y costo/stock
3. **Historial de compras:** 2 filas, fecha + unidades + tipo DTE + monto
4. **CTA:** "Importar factura DTE", fondo `#2D1F14`, ícono FileText `#E8C090`

---

### 09 · Importar DTE

**Propósito:** Cargar XML de factura electrónica y previsualizar antes de importar.

**Header:** terracota + back button + "Importar DTE"

**Estado "DTE leído":**
- Badge verde: ícono CheckCircle `#3A8A3A` + "Factura electrónica leída" 13px/600 `#2A6A2A`
- Fondo: `#E8F2E8`, border `1px solid #B0D4B0`

**Datos del documento:**
- Tarjeta: Emisor | RUT | Fecha (labels uppercase 11px `#B09070` + valor 12px/500 `#2D1F14`)

**Tabla de ítems:**
- Cada fila: nombre + "× N unidades" + total + "precio c/u" (10px `#B09070`)

**Total:** 20px/700 `#2D1F14`

**CTA:** "Importar al inventario", fondo `#2D1F14`, ícono CheckCircle `#E8C090`
- Nota: "Se agregarán N unidades al inventario" (12px centrado `#B09070`)

---

## Ticket térmico — Especificaciones de impresión

```
Papel:    80mm (ancho útil ~72mm = ~272px a 96dpi)
Fuente:   DM Mono (monospace)
Color:    Solo negro (#000) sobre blanco
@page:    size: 80mm auto; margin: 4mm;

Elementos (de arriba a abajo):
  1. Store header (nombre, email, teléfono) — centrado
  2. Separador: 1px dashed #CCC
  3. Fecha, N° ticket, vendedor
  4. Separador dashed
  5. Ítems: nombre + "  × N" + precio (justify-content space-between)
  6. Separador dashed
  7. Subtotal + TOTAL + medio de pago
  8. Separador dashed
  9. Footer: ¡Gracias! + tagline
```

Ver archivo: `Ticket Térmico.dc.html` para referencia exacta.

---

## Interacciones y comportamiento

### Navegación entre pantallas
```
Dirección forward:
  - Pantalla saliente: transform translateX(-12%), 300ms
  - Pantalla entrante: desde translateX(100%) → 0, 300ms
  - Easing: cubic-bezier(0.4, 0, 0.2, 1)

Dirección back (volver):
  - Pantalla saliente: transform translateX(100%), 300ms
  - Pantalla entrante: desde translateX(-12%) → 0, 300ms
```

### Scanner
- Delay antes de mostrar overlay "producto encontrado": 1.8 segundos
- Overlay entra desde abajo: translateY(100%) → 0, 400ms
- Al salir del scanner: cancelar timeout pendiente

### PIN
- Cada dígito: dot fill animado (scale 1.2), 150ms
- Al completar 4 dígitos: esperar 350ms → navegar a Dashboard
- Reset dots: después de navegar

### Alerta de check (ticket)
- Animación: scale 0 → 1.25 → 1, opacity 0 → 1
- Duración: 500ms, delay 150ms
- Easing: cubic-bezier(0.34, 1.56, 0.64, 1) (spring)

---

## Gestión de estado

### Variables de estado necesarias (por pantalla)

**Global / App:**
- `currentUser`: { id, name, role: 'admin' | 'employee' }
- `currentScreen`: string
- `navHistory`: string[]

**Dashboard:**
- `salesSummary`: { total, count, byPaymentMethod: { cash, transfer, debit, credit } }
- `inventoryValue`: { atCost, atPrice }
- `stockAlerts`: Alert[]

**Venta:**
- `cartItems`: CartItem[] (productId, name, price, qty, details)
- `selectedPaymentMethod`: 'cash' | 'transfer' | 'debit' | 'credit'
- `total`: computed

**Catálogo:**
- `products`: Product[]
- `activeFilter`: string
- `searchQuery`: string

**Escáner:**
- `scannerState`: 'scanning' | 'found' | 'notFound'
- `foundProduct`: Product | null
- `scanQty`: number

---

## Assets

| Archivo | Uso |
|---|---|
| `assets/lana-orquidea-azul.jpg` | Foto de producto real (Lana Orquídea Socks) |
| `assets/logo-original.jpg` | Logo original de la tienda (referencia) |

**Ícono de app:** SVG inline (ver Design Tokens → Ícono de app)  
**Íconos de UI:** Phosphor Icons — variante `fill` (solid)

Íconos usados:
```
House, ShoppingCartSimple, Books, DotsThreeCircle,
Bell, ArrowLeft, MagnifyingGlass, Barcode, X, Plus,
WarningCircle, TrendUp, ArchiveBox, Check, Receipt,
FileText, Phone, EnvelopeSimple, MapPin, LockSimple,
Pencil, CheckCircle, Image, Backspace, WhatsappLogo
```

---

## Archivos incluidos

| Archivo | Descripción |
|---|---|
| `README.md` | Este documento |
| `Antimahue Prototipo.dc.html` | Prototipo interactivo — 9 pantallas navegables |
| `Ticket Térmico.dc.html` | Ticket de 80mm con botón de impresión |
| `Antimahue Logo.dc.html` | Sistema de marca completo |
| `product-definition.md` | Definición de producto original (Angélica) |
| `assets/lana-orquidea-azul.jpg` | Foto de producto real |
| `assets/logo-original.jpg` | Logo artesanal original de la tienda |

---

## Próximos pasos post-handoff

1. **Validar diseño con Angélica** — mostrar prototipo interactivo, recoger feedback
2. **Diseño técnico (SDD)** — definir modelos de datos, endpoints de Supabase, auth strategy
3. **Implementación MVP** — comenzar por flujo crítico: Venta → Ticket → Stock update
4. **DTE parser** — definir librería XML, mapeo de campos DTE Tipo 33/46/39 a modelo de producto
5. **Testing con Angélica** — sesiones de usabilidad con datos reales de la tienda

---

*Diseño creado con Claude · Junio 2025*
