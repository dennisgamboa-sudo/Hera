# Por qué se arruinó — y qué lo arregla

## El dato clave

Las tres fotos que conservas como "el mejor resultado" son **la salida cruda de
Nano Banana**, no el resultado del injerto. Lo confirmaste tú mismo hace varias
iteraciones: *"en mi galería veo que se han guardado planos diferentes o
posiciones del sujeto con el resultado correcto pero ninguno con la imagen real"*.

Eso significa dos cosas:

1. **El modelo ya te da la calidad que buscas.** No hay que tocar el prompt en
   busca de más realismo — el realismo ya estaba ahí.
2. **El problema siempre fue el traslado**: llevar esa textura a TU foto, con TU
   encuadre. Y ahí es donde se rompía.

---

## Las 5 cosas que rompieron el resultado

### 1. Falta de alineación real (la causa raíz del ghosting)

El injerto de frecuencias asume correspondencia **píxel a píxel**. Nano Banana no
la garantiza: reencuadra, hace zoom, desplaza la cara 5–20 px.

El código anterior solo hacía `cover-fit` centrado. Si el modelo movió la cara 12
píxeles, la alta frecuencia de un poro caía sobre un párpado. Eso es exactamente
lo que veías: doble imagen, contornos sucios, "no se ve nada".

**Ningún ajuste de prompt, intensidad o blend-mode puede arreglar esto.** Había
que medir el desplazamiento y corregirlo.

> **v4 lo arregla:** estima escala + desplazamiento con búsqueda jerárquica sobre
> gradientes (dos niveles, 96 px → 384 px) antes de extraer nada.

### 2. Se volvió a los blend-modes a mitad de camino

En el mensaje donde te dijeron *"Nuevo Motor de Mezcla (Soft-Light High-Pass)"*
se reintrodujo `soft-light`. Es literalmente el motor que ya habías señalado como
defectuoso. Volvió el ghosting y las zonas planas turbias.

> **v4 lo arregla:** cero blend-modes. Suma aritmética con soft-clip, y punto.

### 3. Los presets de iluminación

Golden hour, neon, moody, clinical… todos le piden al modelo **cambiar la luz**.
Esa diferencia de luz entra en el delta de alta frecuencia y ensucia la foto
entera. Es incompatible por diseño con un injerto de textura.

> **v4 lo arregla:** eliminados. La luz viene siempre del original.

### 4. El slider de "Nitidez / Sharpness"

Multiplicaba la alta frecuencia *después* del injerto. Eso no crea poros: crea
halos y ruido. Es el "no es real" que reportaste.

> **v4 lo sustituye** por *contraste local* extraído del **propio original**
> (banda media). Da el "cuerpo" que echabas de menos sin riesgo de identidad ni
> de ghosting, porque no viene de la IA.

### 5. Prompts apilados con vocabulario tóxico

El prompt final era `fidelidad + preset + iluminación` — tres capas. Y contenía
`hyper-realistic` y `8k`, los dos términos que el propio asistente había
identificado como generadores de piel de plástico… y que luego volvió a meter.

> **v4 lo arregla:** un solo prompt, corto, en imperativo de edición, con
> vocabulario de imperfección real (poros, vello, pecas, brillo sebáceo, grano).

---

## Lo que v4 añade de nuevo

| Mejora | Qué hace |
|---|---|
| **Alineación automática** | Corrige escala y desplazamiento del resultado de la IA antes del injerto. |
| **Mapa de confianza** | Mide por zonas si la IA respetó la estructura. Donde se desvió, atenúa el injerto solo. Es imposible que pinte rasgos nuevos. |
| **Protección del foco** | El bokeh y el fondo desenfocado reciben mucha menos textura. Se conserva la profundidad de campo. |
| **Upscale real** | Trabaja a la resolución de la IA si es mayor: estructura y color del original + detalle de la IA. |
| **Informe visible** | Bajo el resultado se imprime `tamaño · align ×1.02 (−7,3) · fidelidad 84% · 1420ms`. Ya no hace falta creerse que "está arreglado": se ve. |

---

## Archivos

| Archivo | Reemplaza a |
|---|---|
| `processor.ts` | `services/processor.ts` |
| `prompts.ts` | *(nuevo)* |
| `types.ts` | `types.ts` — sin `LIGHTING_PRESETS` ni `sharpness` |
| `App.tsx` | `App.tsx` |

`ComparisonView`, `ProcessingOverlay`, `MaskEditor`, `MaskHistory`,
`MemoryBuffer` y `FlowUI` **no se tocan** — las props son las mismas.

---

## Cómo leer el informe

```
2400×3000 · align ×1.02 (−7,3) · fidelidad 84% · 1420ms
```

- **align ×1.02 (−7,3)** → la IA había hecho un 2 % de zoom y desplazado 7 px a la
  izquierda, 3 abajo. Corregido. Antes esto era el ghosting.
- **fidelidad 84 %** → el 84 % de la imagen correlaciona bien con el original.
  - **> 75 %** — resultado fiable.
  - **50–75 %** — el modelo se desvió; el injerto se atenuó solo. Prueba el otro
    modelo Banana.
  - **< 50 %** — la IA se inventó otra foto. Cambia de modelo o reintenta.

---

## Ajuste recomendado

Empieza con **Piel Real** y los valores por defecto (textura 85 %, cuerpo 25 %).

- ¿Falta poro? → sube *textura* a 1.05, o cambia a **Macro RAW**.
- ¿Se ve ruidoso o crujiente? → baja *textura* a 0.65.
- ¿Se ve plana / apagada? → sube *cuerpo* a 0.35. Nunca por encima de 0.45.

No hay nada más que tocar. Esa es la idea.
