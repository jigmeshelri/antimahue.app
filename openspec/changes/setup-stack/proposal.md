# Propuesta: Inicialización del Stack Tecnológico (setup-stack)

> Actualizada 2026-06-21 — reemplaza la arquitectura anterior (Astro + FastAPI + TimescaleDB en monorepo). Motivación: eliminar el API Python en Railway, simplificar a una arquitectura serverless de menor fricción (inspirada en `iot-assistant`, "parecida, no igual") y poner la **seguridad en el centro** desde el inicio.

## 1. Contexto y motivación

La propuesta original planteaba un monorepo con frontend Astro + backend FastAPI (Python) + TimescaleDB en Docker, desplegando un API Python en Railway. Al revisar las necesidades reales de Antimahue (inventario + punto de venta para una sola tienda), ese stack resultó sobre-dimensionado:

- El backend Python de `iot-assistant` existe por dos razones que Antimahue NO tiene: reconocimiento de componentes por imagen (IA de visión) e ingesta de telemetría IoT. Antimahue no procesa ninguna de las dos.
- TimescaleDB resuelve series temporales de sensores. Antimahue no tiene series temporales; las "ventas del día" son una agregación SQL normal.

Todo lo que Antimahue necesita del servidor se resuelve en TypeScript + Supabase, sin Python, sin Railway y sin Docker en producción.

## 2. Seguridad como principio rector (transversal)

Antimahue maneja **dinero** (de Angélica y de sus clientes) y **datos personales de terceros** (clientes, proveedores, RUT en los DTE). Por eso la seguridad —personal y cibernética— es un **principio rector del proyecto**, presente en cada fase de implementación, no una tarea de hardening al final.

No-negociables que condicionan toda la arquitectura:

- **El cliente es no confiable.** Al ser una SPA, todo el código vive en el browser. La autorización REAL se aplica en **RLS/Postgres**, nunca solo en el JavaScript. Un cliente manipulado no debe poder leer ni escribir lo que no le corresponde.
- **RLS deny-by-default desde el día 1** en toda tabla del schema `public`.
- **Separación de claves**: la `anon` key es pública (cliente, segura solo con RLS); la `service_role` jamás entra al bundle — solo en Edge Functions/servidor.
- **Validación e integridad server-side**: totales, montos y stock se validan con constraints de Postgres + funciones RPC. La venta es una **transacción atómica** (descuenta stock + registra pago + genera ticket, todo o nada). Un cliente alterado no puede vender con precio modificado ni dejar stock negativo.
- **Trazabilidad / auditoría**: toda operación sobre dinero o stock (venta, deshacer venta, cambio de precio/stock) queda registrada con autor, fecha y detalle.
- **PIN endurecido**: 4 dígitos es débil → rate-limiting + bloqueo temporal ante intentos fallidos. El PIN protege un token ya emitido; no es la credencial en sí.
- **Cadena de suministro**: pnpm v11 con `minimumReleaseAge` + `allowBuilds` vacío + lockfile + auditoría periódica (ver §5).
- **Transporte y sesión**: HTTPS siempre; tokens con expiración corta + refresh; manejo seguro del token en el dispositivo.
- **Datos personales**: minimización (guardar solo lo necesario) y cumplimiento de la normativa chilena de protección de datos personales (a precisar en specs).
- **Continuidad**: backups y plan de restore definidos desde el inicio (perder datos = perder dinero).
- **Mínimo privilegio** en claves, roles y políticas.

Cada `spec`, `design` y `tasks` de cada change incluye su **dimensión de seguridad explícita**; el `design` incorpora un **threat model ligero**; antes de cada merge significativo se corre un **security review** (ver §8).

## 3. Arquitectura propuesta (serverless, sin backend propio)

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Frontend | SPA: Vite + React 19 + TypeScript + Tailwind v4, empaquetada como PWA (`vite-plugin-pwa`) | Toda la UI: PIN, dashboard, venta, escáner, catálogo, paletas. App privada detrás de login. |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS + PostgREST + Edge Functions) | Datos, autenticación, almacenamiento de imágenes, API REST automática. |
| Región DB | Supabase en São Paulo (`sa-east-1`) | Menor latencia desde Chile (~70 ms medidos; USA ~150 ms). |
| Host | A confirmar (Vercel o Cloudflare Pages) — reversible | Sirve el bundle estático desde el edge (~17 ms desde Chile en ambos). |

### Por qué SPA y no Astro

La app principal es 100 % privada (detrás de PIN), sin contenido público ni SEO — el portal público y la comunidad serán una app SEPARADA (ver §6). Una app POS interactiva detrás de login es el caso natural de una SPA. Astro (content-first, MPA con islas) agregaría complejidad de SSR/hidratación sin beneficio. El handoff de diseño ya recomendaba "React + Vite → PWA".

### Lógica server-side sin Python

- Parsing de DTE XML (Tipo 33/46/39) → función del host en TS (`fast-xml-parser`) o Edge Function de Supabase.
- Asistente de armonía cromática → cálculo HSL/CIELAB en el cliente (determinista, sin IA).
- Escaneo de código de barras → cliente (Barcode Detection API).

## 4. Estructura del repositorio (simplificada)

```text
/
├── src/                   # SPA Vite + React 19 + TS
│   ├── components/         # UI (atomic / container-presentational)
│   ├── features/          # venta, catálogo, paletas, dte, auth
│   ├── lib/               # cliente Supabase, helpers
│   └── main.tsx
├── supabase/
│   └── migrations/        # SQL versionado (RLS incluido)
├── public/                # íconos PWA, manifest
├── openspec/              # especificaciones SDD
├── index.html
├── vite.config.ts
└── package.json
```

Sin `backend/`, sin `docker/`, sin `docker-compose.yml`. Supabase Cloud reemplaza la base local en Docker; para desarrollo se usa Supabase CLI solo si se necesita paridad local.

## 5. Gestión de dependencias: pnpm v11 (obligatorio)

El proyecto usa **pnpm v11** como package manager, no npm. Es una decisión de seguridad (parte del principio rector §2), no de preferencia, y es **mandatoria**:

- `minimumReleaseAge: 1440` (24 h) — no instala paquetes publicados hace menos de un día. Defensa directa contra ataques de supply-chain de ventana corta.
- `allowBuilds` vacío — bloquea lifecycle scripts (`postinstall`), el vector habitual de ejecución de malware.
- Lockfile (`pnpm-lock.yaml`) commiteado y versiones pineadas; `pnpm audit` periódico.

### Nota sobre el incidente TanStack (2026-05-11)

Si se usara TanStack Router/Start, tener presente: el 2026-05-11 se publicaron 84 versiones maliciosas en 42 paquetes `@tanstack/*` por **secuestro del pipeline de GitHub Actions** (no robo de credenciales ni falla del código de TanStack). Afectó a `@tanstack/react-router`, `vue-router`, `solid-router`, `router-core` (1.169.5/1.169.8), `react-start` (1.167.68/71) y `router-plugin` (1.167.38/41). **Limpios**: `@tanstack/query*`, `table*`, `form*`, `virtual*`, `store`. Las versiones maliciosas fueron deprecadas y removidas; usar versiones posteriores al 2026-05-12. Con `minimumReleaseAge: 1440` el riesgo queda neutralizado (se detectaron en 20-26 minutos, nunca habrían entrado). Alternativa sin la mancha del incidente: **React Router v7** (no afectado). El router exacto se decide en diseño.

## 6. Alcance (MVP) y extensibilidad

- **MVP**: un solo usuario (Angélica, admin). Sin empleados todavía.
- **Diferido a post-MVP**: múltiples usuarios y roles (admin/empleado); portal público y comunidad como **app separada** en subdominio, consumiendo el backend vía API REST (PostgREST).
- **Criterio de diseño**: el modelo de datos debe permitir agregar esas funciones sin rediseño, sin construirlas ahora. Preparar barato (tabla `profiles` con `rol`, FKs `created_by`, campos de color en productos); no construir (gestión de empleados, RLS multi-rol compleja, portal público).
- **Seguridad base**: RLS activado en todas las tablas del schema `public` desde el día 1 (Supabase expone PostgREST con la anon key). Se difiere el RLS multi-rol complejo, no el RLS en sí.

## 7. Decisiones diferidas a la fase de diseño

- Router exacto (React Router v7 vs TanStack Router).
- Host de producción (Vercel vs Cloudflare Pages) — reversible, no bloqueante.
- Estrategia del PIN (lock local del dispositivo vs desbloqueo de credencial real) + mecanismo de rate-limiting.
- Librería de estado (nanostores / zustand) y patrón del cliente Supabase.

## 8. Plan de fases (SDD) — con seguridad integrada en cada una

1. **Specs** — modelo de datos + **políticas RLS por tabla**, constraints de integridad, contrato de la función DTE, requisitos de auditoría y de protección de datos.
2. **Design** — arquitectura de carpetas, router, estrategia de auth/PIN (rate-limiting), mapeo de pantallas del handoff, y **threat model ligero** (activos, amenazas, mitigaciones).
3. **Tasks** — checklist de bootstrapping + tareas de seguridad explícitas (RLS, audit log, validaciones server-side) como parte del *done*, no opcionales.
4. **Apply** — scaffolding del proyecto y configuración base, con los guards de pnpm activos.
5. **Verify** — que la app levante, compile y conecte con Supabase + **tests de RLS** y security review antes de dar por cerrado.
