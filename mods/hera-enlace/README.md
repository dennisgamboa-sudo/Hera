# hera-enlace

Cada hilo de Claude empieza sabiendo cómo están tus proyectos y qué los une, y lo
que decides en ese hilo vuelve al panel.

La fuente es el panel **Una cosa a la vez**
(https://claude.ai/artifact/HGA7i5nSaiXkbdVj42Kjem), en concreto su base de datos:

- `panel/info`: los proyectos, cada uno con su paso, su cifra y dónde está.
- `panel/hilos`: lo que un proyecto le da a otro.
- `plan/progreso`: los bloques cerrados, día a día.
- `cerebro/memoria`: lo que ya sabes y decidiste, en notas.

## Qué hace

**Informar, en cualquier hilo y en cualquier repo**

- Al abrir la sesión lee el panel y le pasa a Claude los proyectos (estado, siguiente paso y cifra) y los hilos entre ellos.
- Le pasa también el veredicto de cada proyecto (foco, en prueba, mínimo…) y hasta cuándo vale. Los aparcados, fusionados y cerrados van aparte, para que Claude no los empuje.
- Del Cerebro le pasa hasta 12 reglas y decisiones que ya tomaste, para que no las contradiga. Las notas que aún esperan tu sí no cuentan.
- Claude nombra el proyecto que toca el hilo y avisa cuando un cambio llega a los proyectos que ese alimenta.
- Si llevas más de 3 días sin cerrar un bloque, la barra de estado lo dice con los días reales. De viernes a lunes no cuenta como abandono.
- `/estado` vuelve a leer el panel y te enseña los proyectos.

**Actualizar**

- `/cierre` le pide a Claude que lleve lo decidido al panel:
  - cómo queda el paso de cada proyecto, en formato antes → después;
  - el logro, si se terminó algo de verdad;
  - qué les llega a los proyectos conectados por sus hilos;
  - hasta 2 notas nuevas para el Cerebro, que esperan tu sí en el panel.
- Claude solo escribe en el panel cuando le das el OK, y siempre sobre la versión que leyó, para no pisar cambios hechos desde el móvil.

Si el mod no puede leer el panel, Claude igualmente sabe dónde está y lo lee cuando el hilo toca un proyecto.

## Instalar

En el prompt de Claude Code, una sola vez:

```
/plugin marketplace add dennisgamboa-sudo/Hera
/plugin install hera-enlace@hera
```

Responde `y` y elige el ámbito de usuario: así carga en todos tus hilos y en todos tus repos.

## Opciones

- `panel`: la URL del artifact del panel. Se cambia en `/config` si algún día lo rehaces.

## Desarrollo

```
claude plugin validate mods/hera-enlace
claude plugin test mods/hera-enlace
```

`hooks/logic.ts` es lógica pura con sus tests. `hooks/register.ts` conecta esa
lógica con el panel y con la interfaz.
