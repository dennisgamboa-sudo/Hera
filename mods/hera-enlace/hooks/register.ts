import type { EngineInterface, Register } from 'claude-code'

import {
  FEED_FILE,
  crearEntrada,
  esHub,
  informe,
  leerFeed,
  lineaEntrada,
  noVistas,
  parseLog,
  publicar,
  type Entrada,
  type Feed,
} from './logic'

type Opciones = { hub: string; hubRepo: string }

const LOG = ['log', '--no-merges', '--format=%x1e%H%x1f%s', '--name-only']

// Estado del módulo: un reload lo rehace, y session.start vuelve a dispararse.
const s = {
  hub: '',
  hubRepo: '',
  rol: 'receptor' as 'emisor' | 'receptor',
  raiz: '',
  feedRemoto: leerFeed(undefined, '') as Feed,
  pendientes: [] as Entrada[],
  fallo: '',
  informado: false,
  guardado: false,
  listo: Promise.resolve() as Promise<void>,
}

function git($: EngineInterface, args: string[]) {
  return $.process.run(['git', ...args], { cwd: s.raiz || undefined, timeoutMs: 10_000 })
}

// ── Emisor (dentro de Hera) ──────────────────────────────────────────────
async function feedLocal($: EngineInterface) {
  try {
    return leerFeed(await $.fs.read(`${s.raiz}/${FEED_FILE}`), s.hub)
  } catch {
    return leerFeed(undefined, s.hub)
  }
}

async function sinAnunciar($: EngineInterface) {
  const feed = await feedLocal($)
  const ultimo = feed.entradas[0]?.sha
  let r = ultimo ? await git($, [...LOG, `${ultimo}..HEAD`]) : undefined
  if (!r || r.exitCode !== 0) r = await git($, [...LOG, '-n', '10'])
  return { feed, commits: r.exitCode === 0 ? parseLog(r.stdout) : [] }
}

async function estadoEmisor($: EngineInterface) {
  const { commits } = await sinAnunciar($)
  $.ui.status(commits.length ? `HERA · ${commits.length} sin anunciar · /anunciar` : undefined)
  return commits.length
}

// ── Receptor (cualquier otro proyecto) ───────────────────────────────────
async function refrescar($: EngineInterface) {
  const res = await $.http.fetch(s.hub)
  if (!res.ok) {
    s.fallo = `HTTP ${res.status}`
    return
  }
  s.fallo = ''
  s.feedRemoto = leerFeed(res.text, s.hub)
  s.pendientes = noVistas(s.feedRemoto, (await $.store.get(`visto:${s.hub}`)) as string | undefined)
  if (s.pendientes.length === 0) return
  $.ui.status(`HERA · ${s.pendientes.length} novedad(es)`)
  $.ui.toast(`HERA publicó ${s.pendientes.length} novedad(es) · /novedades`)
}

async function marcarVisto($: EngineInterface) {
  if (s.guardado || !s.pendientes[0]) return
  s.guardado = true
  await $.store.set(`visto:${s.hub}`, s.pendientes[0].id)
  $.ui.status(undefined)
}

async function arrancar($: EngineInterface, cwd: string) {
  try {
    const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'], {
      cwd,
      timeoutMs: 5_000,
    })
    s.raiz = top.exitCode === 0 ? top.stdout.trim() : cwd
    const origin = await git($, ['remote', 'get-url', 'origin'])
    s.rol = esHub(origin.exitCode === 0 ? origin.stdout : '', s.hubRepo) ? 'emisor' : 'receptor'
    if (s.rol === 'emisor') await estadoEmisor($)
    else await refrescar($)
  } catch (err) {
    s.fallo = String(err)
  }
}

// ── Hooks ────────────────────────────────────────────────────────────────
export const register: Register = (on, options) => {
  const o = options as Opciones
  s.hub = o.hub
  s.hubRepo = o.hubRepo

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'novedades',
      description: 'HERA: lo nuevo del proyecto central, o lo pendiente de anunciar si estás en Hera',
    })
    await $.command.register({
      name: 'anunciar',
      description: 'HERA: publica en NOVEDADES.json los cambios sin anunciar (solo dentro de Hera)',
      argumentHint: '[nota para los otros proyectos]',
    })
    // Fuera del arranque: la red no retrasa el primer prompt.
    s.listo = new Promise(fin => $.clock.after(0, () => void arrancar($, e.cwd).then(fin)))
    return next(e)
  })

  // Tras un commit o push en Hera, el contador se pone al día solo.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    try {
      const ok = ran.deny === undefined && ran.isError !== true
      if (ok && s.rol === 'emisor' && /\bgit\s+(push|commit|merge|pull)\b/.test(e.command)) {
        const n = await estadoEmisor($)
        if (n && /\bgit\s+push\b/.test(e.command))
          $.ui.toast(`Push hecho · ${n} cambio(s) que los otros proyectos no conocen · /anunciar`)
      }
    } catch {}
    return ran
  }).catch(($, e, next) => next(e)) // el mod nunca bloquea un comando

  // El receptor informa al modelo del proyecto, no solo a la pantalla.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (s.rol !== 'receptor' || s.pendientes.length === 0) return r
    s.informado = true
    return {
      sections: [
        ...r.sections,
        { id: 'hera-enlace:novedades', text: informe(s.pendientes), scope: 'session' as const },
      ],
    }
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (s.informado) await marcarVisto($)
    return r
  })

  on('command.run', { command: 'novedades' }, async $ => {
    await s.listo
    if (s.rol === 'emisor') {
      const { commits } = await sinAnunciar($)
      if (commits.length === 0) return { text: 'Todo lo de Hera está anunciado.' }
      const lista = commits.map(c => `- ${c.sha.slice(0, 7)} ${c.subject}`).join('\n')
      return { text: `Sin anunciar (${commits.length}):\n${lista}\n\n/anunciar [nota] los publica.` }
    }
    await refrescar($)
    if (s.fallo) return { text: `No pude leer el feed de HERA (${s.fallo}): ${s.hub}` }
    const lista = s.pendientes.length ? s.pendientes : s.feedRemoto.entradas.slice(0, 3)
    if (lista.length === 0) return { text: 'HERA todavía no ha publicado novedades.' }
    const titulo = s.pendientes.length
      ? `${s.pendientes.length} novedad(es) de HERA sin ver:`
      : 'Nada nuevo. Lo último de HERA:'
    await marcarVisto($)
    return { text: `${titulo}\n${lista.map(lineaEntrada).join('\n')}` }
  })

  on('command.run', { command: 'anunciar' }, async ($, e) => {
    await s.listo
    if (s.rol !== 'emisor') return { text: `/anunciar solo funciona dentro de ${s.hubRepo}.` }
    const { feed, commits } = await sinAnunciar($)
    const ahora = new Date(await $.clock.now())
    const entrada = crearEntrada(commits, ahora, e.args)
    if (!entrada) return { text: 'Nada que anunciar: no hay commits nuevos desde el último anuncio.' }
    await $.fs.write(
      `${s.raiz}/${FEED_FILE}`,
      `${JSON.stringify(publicar(feed, entrada, ahora), null, 2)}\n`,
    )
    $.ui.status(undefined)
    return {
      text:
        `${FEED_FILE} · entrada ${entrada.id} · ${commits.length} cambio(s) en ${entrada.areas.join(', ')}\n` +
        `${lineaEntrada(entrada)}\n\n` +
        `Falta commit + push de ${FEED_FILE}. Los otros proyectos la leen cuando llega a la rama principal de ${s.hubRepo}.`,
    }
  })
}
