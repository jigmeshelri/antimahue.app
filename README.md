<div align="center">

<img src="docs/assets/logo.svg" width="112" alt="Logo de Antimahue: una hoja de otoño clara sobre fondo rojo" />

# Antimahue

**Inventario y punto de venta para una tienda de lanas,<br/>pensado para atender el mostrador con el teléfono en la mano.**

<a href="https://antimahue.com"><img src="https://img.shields.io/badge/EN_VIVO-antimahue.com-C84030?style=for-the-badge&labelColor=2D1F14" alt="En vivo en antimahue.com" /></a>

<p>
  <img src="https://img.shields.io/badge/React_19-2D1F14?style=for-the-badge&logo=react&logoColor=E8C090" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite_6-2D1F14?style=for-the-badge&logo=vite&logoColor=E8C090" alt="Vite 6" />
  <img src="https://img.shields.io/badge/TypeScript-2D1F14?style=for-the-badge&logo=typescript&logoColor=E8C090" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_4-2D1F14?style=for-the-badge&logo=tailwindcss&logoColor=E8C090" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/PWA-2D1F14?style=for-the-badge&logo=pwa&logoColor=E8C090" alt="PWA" />
  <img src="https://img.shields.io/badge/Supabase-2D1F14?style=for-the-badge&logo=supabase&logoColor=E8C090" alt="Supabase" />
  <img src="https://img.shields.io/badge/Cloudflare-2D1F14?style=for-the-badge&logo=cloudflare&logoColor=E8C090" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/pnpm_11-2D1F14?style=for-the-badge&logo=pnpm&logoColor=E8C090" alt="pnpm 11" />
</p>

</div>

---

## La tienda primero

Antimahue existe para una tienda real: el local de lanas, algodón, hilos, palillos y crochet que Angélica atiende en Chile. No es un e-commerce ni un CRM — es la herramienta que le quita de la cabeza los precios, el stock y las cuentas mientras conversa con la clienta del otro lado del mostrador.

Es una PWA: se abre desde el navegador del teléfono, se instala como una app y usa la cámara para leer códigos de barras.

## Qué resuelve

- 🧶 **Catálogo vivo** — cada ovillo con su marca, grosor, color y stock; un código desconocido ofrece crear el producto ahí mismo.
- 🛒 **Venta en dos toques** — escanear y cobrar; el stock se descuenta solo y sale el ticket.
- 📦 **Stock a la vista** — el stock bajo y el total del día se ven sin ir a buscarlos.
- 🧾 **Compras sin digitación** — la factura electrónica chilena (XML del DTE) carga los productos de una vez.
- 🎨 **Asistente de color** *(en diseño)* — sugiere combinaciones (análogas, complementarias, tríadas) usando el stock real de la tienda.
- 🔐 **Roles con PIN** — quien vende no ve costos ni proveedores; la administración queda para la dueña.

## Principios que mandan

| Principio | En la práctica |
| --- | --- |
| Cero fricción | Toda tarea frecuente se resuelve en dos toques o menos |
| Lenguaje familiar | «Ovillo», «madeja», «palillo» — nada de jerga de sistemas |
| Visible, no oculto | Stock bajo y total del día siempre a la vista |
| Teléfono primero | El teléfono manda durante la venta; tablet y computador para administrar |
| Tolerante a errores | Deshacer antes que confirmar: la venta no se interrumpe con diálogos |

## Cómo está construido

| Capa | Servicio | Qué aporta |
| --- | --- | --- |
| Interfaz | **React 19 + Vite 6 + Tailwind 4** (TypeScript) | SPA instalable (PWA), teléfono-first, con la paleta propia «Terraza» y tipografía DM Sans |
| Datos y acceso | **Supabase** (PostgreSQL, región São Paulo) | Base de datos, sesiones y reglas de acceso por fila (RLS): la autorización vive en la base, no en el navegador |
| Publicación | **Cloudflare Workers** (Static Assets) | La app se sirve desde el borde de la red, con cabeceras de seguridad estrictas |
| Paquetes | **pnpm 11** | Dependencias con protecciones contra ataques de cadena de suministro |

## Seguridad

La tienda maneja dinero y datos de terceros, así que la seguridad es un principio de diseño y no una capa final: acceso denegado por defecto en la base de datos, el navegador nunca conoce claves privilegiadas, y el PIN se guarda con derivación de clave (PBKDF2). **Ninguna credencial vive en este repositorio.**

## Para desarrollar

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm build     # typecheck + bundle PWA
```

El detalle técnico — specs, decisiones de arquitectura y flujo de trabajo — vive en [`openspec/`](openspec/) y [`docs/`](docs/). Este README es la puerta de entrada, no el plano.

---

<div align="center">

Hecho con cariño para el mostrador de una tienda de lanas 🧶

</div>
