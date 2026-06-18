# OpenSpec - Planificación y Especificaciones de Antimahue

Este directorio contiene las especificaciones y el estado de planificación del proyecto utilizando la metodología **Spec-Driven Development (SDD)** y persistencia local (`openspec`).

## Estructura

- `project.yaml`: Configuración general del proyecto, stack tecnológico y estado de cambios activos.
- `changes/`: Directorio que contiene las especificaciones y estado para cada cambio/feature particular. Cada cambio tiene su propia subcarpeta:
  - `changes/<change-name>/state.yaml`: Estado del cambio (fases: proposal, specs, design, tasks, apply, verify, archive).
  - `changes/<change-name>/proposal.md`: Propuesta de alto nivel con tradeoffs y alternativas.
  - `changes/<change-name>/spec.md`: Especificación técnica formal (requerimientos, APIs, modelo de datos).
  - `changes/<change-name>/design.md`: Diseño de arquitectura, componentes y UX.
  - `changes/<change-name>/tasks.md`: Lista de tareas detalladas (`task.md`).
