# Propuesta: Asistente de Combinación de Colores (color-palette-assistant)

Esta propuesta detalla la visión, el diseño conceptual y el plan de implementación para el **Asistente de Combinación de Colores** de Antimahue, diseñado para facilitar a Angélica y sus clientes la creación de paletas cromáticas armónicas mapeadas en tiempo real con el inventario de la tienda.

---

## 1. Contexto y Objetivos

El proceso de tejer es inherentemente visual. Uno de los mayores desafíos para las personas que tejen es seleccionar colores de lana que combinen armoniosamente para sus proyectos y verificar que haya suficiente stock disponible. 

Para abordar esto sin sobrecargar el alcance (scope) del MVP, proponemos una estrategia en dos etapas:
1. **MVP (v1) - Uso Interno:** Una herramienta integrada en la aplicación privada de Angélica. Ella la utilizará en el mostrador para asesorar y simular combinaciones con los clientes en tiempo real, permitiendo registrar encargos en caso de que falte stock.
2. **Post-MVP (v2+) - Portal Público y Comunidad:** Una ruta pública sin autenticación para que los clientes diseñen paletas desde sus casas y las envíen por WhatsApp, y una sección con login (Comunidad) para guardar perfiles de diseño y compartir fotos de tejidos terminados (Muro de Proyectos).

---

## 2. Diseño Conceptual y Técnico (MVP)

El asistente funcionará bajo las leyes de la **teoría de color** estructurada en tres pasos lógicos:

### Paso 1: Color Semilla (Base)
El usuario selecciona un hilado inicial desde el catálogo (por ejemplo, una lana Merino que el cliente ya sabe que quiere usar para su proyecto).

### Paso 2: Relación Cromática (Armonía)
El usuario elige el tipo de armonía visual:
* **Colores Parecidos (Análogos):** Vecinos en el círculo cromático. Ideal para degradados y transiciones suaves.
* **Colores Complementarios (Contraste Directo):** Colores opuestos en el círculo cromático. Produce un contraste vibrante.
* **Tríadas / Opuestos (Contraste Triádico):** Tres colores equidistantes. Ofrece paletas coloridas pero equilibradas.

### Paso 3: Mapeo y Sugerencia de Inventario
En lugar de mostrar colores ideales en un círculo cromático que no existen en stock, la aplicación calculará matemáticamente los colores ideales teóricos y sugerirá automáticamente **hilados reales del catálogo** que se aproximen más.

#### Algoritmo de Distancia de Color
En el frontend (React), representaremos cada producto del catálogo con un valor en espacio de color **HSL (Hue, Saturation, Lightness)** o **RGB**. Utilizaremos el cálculo de la distancia euclidiana en el espacio de color (o diferencia perceptual CIELAB si buscamos precisión extrema) para ordenar y sugerir los hilados más cercanos:

$$\Delta E = \sqrt{(H_1 - H_2)^2 + (S_1 - S_2)^2 + (L_1 - L_2)^2}$$

*(Ajustando la componente de tono (H) para que sea circular en $360^\circ$)*.

---

## 3. Alternativas y Tradeoffs

### Opción A (Elegida): Asistente Interno (MVP) + Comunidad (v2+)
* **Tradeoff:** Angélica debe asistir al cliente usando la app en su tablet/celular. 
* **Por qué se elige:** Permite validar el algoritmo de recomendación de lanas, aprender qué atributos de color usan los clientes y evitar la enorme complejidad de seguridad y autenticación externa de un portal público en la v1.

### Opción B: Portal Público sin Login (v1)
* **Tradeoff:** Permitía a los clientes armar paletas desde sus casas enviando por WhatsApp, pero requería exponer endpoints de stock de Supabase públicamente de forma segura en una etapa muy temprana. Se posterga a la v2.

### Opción C: Comunidad Completa con Login (v1)
* **Tradeoff:** Red social de tejedoras completa desde el inicio. Descartada inmediatamente por ir en contra del principio de "Cero fricción" y exceder el alcance del MVP.

---

## 4. Cambios Propuestos

### Documentación de Producto
* **[product-definition.md](file:///home/sergio/repos/inaction/antimahue/docs/product-definition.md):** 
  * Agregar la subsección `8. Asistente de Combinación de Colores (Uso Interno)` dentro de funcionalidades del MVP (v1).
  * Agregar el portal público y la comunidad en la sección `Fuera del MVP (v2+)`.

### Base de Datos
* Agregar campos de color a la tabla de productos (ej. `color_hex` o componentes `color_h`, `color_s`, `color_l`) para permitir la búsqueda indexada o el cálculo en frontend.
