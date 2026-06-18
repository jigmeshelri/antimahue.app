# Propuesta: Inicialización del Stack Tecnológico (setup-stack)

Esta propuesta detalla la arquitectura inicial y el plan para bootstraping de la infraestructura del proyecto Antimahue.

## Alternativas y Estructura del Repositorio

Para manejar el frontend, backend y base de datos, proponemos una estructura de monorrepo limpio:

```text
/
├── frontend/             # Astro 6 + React 19 + Tailwind v4 + TS
├── backend/              # FastAPI (Python 3.12) + IA (Claude/GPT-4o)
├── docker/               # Configuraciones específicas de contenedores
├── openspec/             # Especificaciones SDD (este directorio)
├── docker-compose.yml    # Orquestación local (TimescaleDB, Postgres)
├── .envrc                # Variables de entorno y secretos locales
└── AGENTS.md             # Documentación de agentes
```

---

## 1. Frontend (Astro 6 + React 19 + Tailwind v4)

### Enfoque de Integración
* **Astro 6** actuará como el orquestador principal del frontend, proveyendo enrutamiento basado en archivos, excelente performance por default (islas de interactividad), y SSR (Server-Side Rendering) híbrido.
* **React 19** se utilizará mediante el integrador oficial `@astrojs/react` para componentes que requieran interactividad compleja (como dashboards o flujos dinámicos).
* **Tailwind CSS v4**: Utilizaremos el nuevo `@tailwindcss/vite` integrado directamente en la configuración de Vite de Astro 6. Tailwind v4 elimina la necesidad de un archivo `tailwind.config.js` y usa directivas nativas de CSS v4 (`@theme`, `@import "tailwindcss";`).

---

## 2. Backend (FastAPI + Python 3.12)

### Enfoque y Estructura
* Usaremos **FastAPI** estructurado de la siguiente forma:
  ```text
  backend/
  ├── app/
  │   ├── api/             # Routers y endpoints
  │   ├── core/            # Configuración, seguridad y clientes de LLMs (Claude/GPT)
  │   ├── models/          # Modelos Pydantic y esquemas de base de datos
  │   ├── services/        # Lógica de negocio (IA integrador, DB manager)
  │   └── main.py          # Punto de entrada de la aplicación
  ├── requirements.txt     # Dependencias de Python
  └── .venv/               # Entorno virtual local (aislado)
  ```
* Seguiremos la guía de la skill `managing-python-dependencies` usando un entorno virtual exclusivo para el backend.

---

## 3. Base de Datos y Docker (Supabase + TimescaleDB)

### Orquestación Local
Proponemos levantar la base de datos localmente utilizando Docker para asegurar consistencia:
* **PostgreSQL 16 con la extensión TimescaleDB** (imagen oficial `timescale/timescaledb:latest-pg16`) corriendo en un contenedor de Docker.
* **Integración con Supabase**: 
  * *Opción A (Recomendada)*: Usar el cliente de Supabase apuntando al proyecto cloud para autenticación y base de datos en staging/producción, mientras que para desarrollo local y almacenamiento de series temporales (métricas) usamos el contenedor de TimescaleDB directamente.
  * *Opción B*: Configurar el CLI de Supabase localmente para correr todo el stack de Supabase (Postgres, Auth, Storage, etc.) mediante Docker, integrándole TimescaleDB. Esto es más pesado pero provee una paridad exacta con Supabase local.

Recomendamos la **Opción A** por simplicidad inicial, usando el Postgres/TimescaleDB local en Docker y configurando el cliente de base de datos para interactuar con él, y migrando el esquema a Supabase Cloud cuando esté listo.

---

## Plan de Ejecución de Fases (SDD)

1. **Specs (Especificación Técnica)**: Definición formal de dependencias exactas, puertos, configuraciones de variables de entorno y esquemas básicos de datos.
2. **Design (Diseño)**: Diseño de la arquitectura de comunicación Frontend-Backend y el modelo de datos.
3. **Tasks (Plan de Tareas)**: Generación del checklist detallado de comandos de instalación y creación de archivos base.
4. **Apply (Aplicación)**: Instalación física del frontend (Vite/Astro), el backend (FastAPI), y los archivos Docker.
5. **Verify (Verificación)**: Comprobación de que todo levanta y compila (sin romper la regla de no compilar después de cambios de producción, verificaremos la inicialización de los servicios locales).
