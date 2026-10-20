# hera-enlace

Hera es el proyecto central. Cuando cambia, este mod se lo cuenta a los demás proyectos.

Hera publica y los demás solo leen. Nada se escribe en otros repos: Hera deja
sus novedades en `NOVEDADES.json`, en la raíz y en la rama principal, y cada
proyecto lo lee desde la URL pública. No hace falta token porque el repo es público.

## Instalar

En cada proyecto donde quieras el mod, escribe esto en el prompt de Claude Code:

```
/plugin install hera-enlace --marketplace dennisgamboa-sudo/Hera
```

Responde `y` para añadir el marketplace y elige el ámbito de usuario: así carga
en todos tus proyectos, Hera incluido.

## Qué hace

**Dentro de Hera**

- La barra de estado muestra `HERA · 3 sin anunciar` cuando hay commits que los demás proyectos todavía no conocen.
- Después de cada `git push` aparece un aviso con esa cuenta.
- `/anunciar [nota]` añade una entrada a `NOVEDADES.json`: los commits nuevos, sin merges, agrupados por área (cv-linkedin, flow, lab, app, infra, estrategia) y tu nota. Después hay que hacer commit y push de ese archivo.
- `/novedades` enseña lo que queda por anunciar.

**En cualquier otro proyecto**

- Al abrir la sesión lee el feed y, si hay novedades, muestra `HERA · 2 novedades` y un aviso.
- Se las pasa al Claude de ese proyecto, que solo las menciona si afectan al trabajo de ahí.
- Al acabar el primer turno quedan marcadas como vistas.
- `/novedades` las enseña cuando quieras.

## Leer el feed sin el mod

En cualquier script, por ejemplo el `estado.sh` de la puesta al día del Mac:

```
curl -s https://raw.githubusercontent.com/dennisgamboa-sudo/Hera/HEAD/NOVEDADES.json
```

## Límites

- Solo cuenta lo que ha llegado a la rama principal de Hera. Un anuncio hecho desde una rama sin fusionar nadie lo ve hasta el merge.
- GitHub cachea la URL raw unos 5 minutos.
- Solo funciona con una sesión de Claude Code abierta. El feed sí se puede leer siempre, con el `curl` de arriba.

## Opciones

Se cambian en `/config` si el repo central se mueve:

- `hub`: la URL raw de `NOVEDADES.json`.
- `hubRepo`: el repo que publica (`dennisgamboa-sudo/Hera`). En cualquier otro, el mod solo lee.

## Desarrollo

```
claude plugin validate mods/hera-enlace
claude plugin test mods/hera-enlace
```

`hooks/logic.ts` es lógica pura con sus tests. `hooks/register.ts` conecta esa
lógica con git, la red y la interfaz.
