// Lógica pura del enlace: sin $, para que los tests la cubran entera.

export type Commit = { sha: string; subject: string; files: string[] }
export type Entrada = {
  id: string
  fecha: string
  sha: string
  areas: string[]
  cambios: string[]
  nota?: string
}
export type Feed = { hub: string; actualizado: string; entradas: Entrada[] }

export const FEED_FILE = 'NOVEDADES.json'
const MAX_ENTRADAS = 50
const MAX_CAMBIOS = 12
const MAX_INFORME = 5

const AREAS: [RegExp, string][] = [
  [/^(lab\/public\/cv\/|scripts\/cv-|linkedin\/)/, 'cv-linkedin'],
  [/^flow\//, 'flow'],
  [/^(lab|api)\//, 'lab'],
  [/^app\//, 'app'],
  [/^(\.github|mods|\.claude-plugin)\/|^vercel\.json$/, 'infra'],
  [/\.(md|csv|ics)$/, 'estrategia'],
]

export const areaDe = (path: string): string =>
  AREAS.find(([re]) => re.test(path))?.[1] ?? 'otros'

// owner/repo en minúsculas, venga la URL de GitHub o del proxy git.
export const repoDe = (url: string): string =>
  url
    .trim()
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .filter(Boolean)
    .slice(-2)
    .join('/')
    .toLowerCase()

export const esHub = (originUrl: string, hubRepo: string): boolean =>
  originUrl.trim() !== '' && repoDe(originUrl) === hubRepo.toLowerCase()

// Salida de: git log --format=%x1e%H%x1f%s --name-only
export const parseLog = (out: string): Commit[] =>
  out
    .split('\x1e')
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => {
      const [cabeza = '', ...files] = r.split('\n')
      const [sha = '', subject = ''] = cabeza.split('\x1f')
      return { sha, subject, files: files.map(f => f.trim()).filter(Boolean) }
    })
    // Un commit que solo toca el feed es el propio anuncio, no una novedad.
    .filter(c => !(c.files.length > 0 && c.files.every(f => f === FEED_FILE)))

export const crearEntrada = (
  commits: Commit[],
  ahora: Date,
  nota?: string,
): Entrada | undefined => {
  const [primero] = commits
  if (!primero) return undefined
  const fecha = ahora.toISOString().slice(0, 10)
  const sha = primero.sha
  const areas = [...new Set(commits.flatMap(c => c.files.map(areaDe)))].sort()
  const subjects = commits.map(c => c.subject)
  const cambios =
    subjects.length > MAX_CAMBIOS
      ? [...subjects.slice(0, MAX_CAMBIOS), `+${subjects.length - MAX_CAMBIOS} más`]
      : subjects
  const limpia = nota?.trim()
  return {
    id: `${fecha}-${sha.slice(0, 7)}`,
    fecha,
    sha,
    areas,
    cambios,
    ...(limpia ? { nota: limpia } : {}),
  }
}

export const leerFeed = (texto: string | undefined, hub: string): Feed => {
  try {
    const f = JSON.parse(texto ?? '') as Feed
    if (Array.isArray(f?.entradas)) return f
  } catch {}
  return { hub, actualizado: '', entradas: [] }
}

export const publicar = (feed: Feed, e: Entrada, ahora: Date): Feed => ({
  ...feed,
  actualizado: ahora.toISOString(),
  entradas: [e, ...feed.entradas.filter(x => x.id !== e.id)].slice(0, MAX_ENTRADAS),
})

// Las entradas más nuevas que la última vista; sin marca, solo las recientes.
export const noVistas = (feed: Feed, vistoId: string | undefined): Entrada[] => {
  const i = vistoId ? feed.entradas.findIndex(e => e.id === vistoId) : -1
  return i === -1 ? feed.entradas.slice(0, MAX_INFORME) : feed.entradas.slice(0, i)
}

export const lineaEntrada = (e: Entrada): string =>
  `- ${e.fecha} · ${e.areas.join(', ')} · ${e.cambios.join('; ')}` +
  (e.nota ? `\n  Nota: ${e.nota}` : '')

export const informe = (entradas: Entrada[]): string =>
  [
    `HERA (el proyecto central de Denno) publicó ${entradas.length} novedad(es) que este proyecto no había visto:`,
    ...entradas.slice(0, MAX_INFORME).map(lineaEntrada),
    'Si alguna afecta a lo que se trabaja aquí (un activo, un enlace, un texto, una decisión), dilo en una línea al empezar y actúa en consecuencia. Si no afecta, no la menciones.',
  ].join('\n')
