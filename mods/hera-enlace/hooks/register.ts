import type { EngineInterface, Register } from 'claude-code'

import {
  avisos,
  cierre,
  contexto,
  contextoSinLectura,
  docDeTexto,
  lineaProyecto,
  ultimoBloque,
  type Aviso,
  type Hilo,
  type Nota,
  type Progreso,
  type Proyecto,
} from './logic'

type Opciones = { panel: string }

// Estado del módulo: un reload lo rehace, y session.start vuelve a dispararse.
const s = {
  panel: '',
  proyectos: [] as Proyecto[],
  hilos: [] as Hilo[],
  notas: [] as Nota[],
  avisos: [] as Aviso[],
  leido: false,
  fallo: '',
  listo: Promise.resolve() as Promise<void>,
}

async function leerDoc<T>($: EngineInterface, collection: string, doc_id: string) {
  const r = await $.tool.call({ tool: 'ArtifactData', action: 'get', url: s.panel, collection, doc_id })
  if (r.deny !== undefined || r.isError) throw new Error(r.deny ?? r.text ?? 'ArtifactData falló')
  return docDeTexto<T>(r.text ?? '')
}

// El Cerebro es opcional: si no está o falla, la sesión sigue sin él.
async function leerMemoria($: EngineInterface): Promise<Nota[]> {
  try {
    const memoria = await leerDoc<{ notas?: Nota[] }>($, 'cerebro', 'memoria')
    return memoria?.data.notas ?? []
  } catch {
    return []
  }
}

async function leerPanel($: EngineInterface) {
  try {
    const info = await leerDoc<{ proyectos?: Proyecto[] }>($, 'panel', 'info')
    const hilos = await leerDoc<{ hilos?: Hilo[] }>($, 'panel', 'hilos')
    const progreso = await leerDoc<{ dias?: Progreso }>($, 'plan', 'progreso')
    s.proyectos = info?.data.proyectos ?? []
    s.hilos = hilos?.data.hilos ?? []
    s.notas = await leerMemoria($)
    s.avisos = avisos(ultimoBloque(progreso?.data.dias ?? {}), new Date(await $.clock.now()))
    s.leido = s.proyectos.length > 0
    s.fallo = s.leido ? '' : 'el panel no devolvió proyectos'
  } catch (err) {
    s.leido = false
    s.fallo = String(err)
  }
  $.ui.status(s.avisos.length ? `HERA · ${s.avisos.map(a => a.corto).join(' · ')}` : undefined)
}

export const register: Register = (on, options) => {
  s.panel = (options as Opciones).panel

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'estado',
      description: 'HERA: tus proyectos y sus hilos, leídos ahora del panel',
    })
    await $.command.register({
      name: 'cierre',
      description: 'HERA: lleva lo decidido en este hilo al panel y a los proyectos conectados',
    })
    // Fuera del arranque: la lectura no retrasa la sesión.
    s.listo = new Promise(fin => $.clock.after(0, () => void leerPanel($).then(fin)))
    return next(e)
  })

  // Informar: cada hilo empieza sabiendo cómo están los proyectos y qué los une.
  on('prompt.compose', async ($, e, next) => {
    await s.listo
    const r = await next(e)
    const text = s.leido
      ? contexto({ panel: s.panel, proyectos: s.proyectos, hilos: s.hilos, avisos: s.avisos, notas: s.notas })
      : contextoSinLectura(s.panel)
    return { sections: [...r.sections, { id: 'hera-enlace:panel', text, scope: 'session' as const }] }
  })

  on('command.run', { command: 'estado' }, async $ => {
    await s.listo
    await leerPanel($)
    if (!s.leido) return { text: `No pude leer el panel (${s.fallo}): ${s.panel}` }
    const lista = s.proyectos.map(p => `- ${lineaProyecto(p)}`).join('\n')
    const alertas = s.avisos.map(a => `- ${a.texto}`).join('\n')
    return { text: `${alertas ? `${alertas}\n\n` : ''}${lista}\n\n${s.hilos.length} hilos entre proyectos · ${s.notas.filter(n => !n.pro).length} notas en el Cerebro.` }
  })

  // Actualizar: lo decidido en el hilo vuelve al panel, con tu OK.
  on('command.run', { command: 'cierre' }, async $ => {
    void $.prompt.submit({ text: cierre(s.panel) })
    return { text: 'Cierre en marcha: Claude prepara cómo queda cada proyecto y qué les llega a los conectados.' }
  })
}
