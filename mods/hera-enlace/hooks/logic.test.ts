import { expect, test } from 'claude-code/testing'

import {
  areaDe,
  crearEntrada,
  esHub,
  informe,
  leerFeed,
  noVistas,
  parseLog,
  publicar,
  type Commit,
} from './logic'

const HUB = 'https://raw.githubusercontent.com/dennisgamboa-sudo/Hera/HEAD/NOVEDADES.json'
const AHORA = new Date('2026-10-10T12:00:00Z')

test('reconoce el repo central y no lo confunde con hera-lab', async () => {
  expect(esHub('https://github.com/dennisgamboa-sudo/Hera', 'dennisgamboa-sudo/Hera')).toBe(true)
  expect(esHub('git@github.com:dennisgamboa-sudo/Hera.git\n', 'dennisgamboa-sudo/Hera')).toBe(true)
  expect(esHub('http://proxy@127.0.0.1:1/git/dennisgamboa-sudo/Hera', 'dennisgamboa-sudo/Hera')).toBe(true)
  expect(esHub('https://github.com/dennisgamboa-sudo/hera-lab', 'dennisgamboa-sudo/Hera')).toBe(false)
  expect(esHub('', 'dennisgamboa-sudo/Hera')).toBe(false)
})

test('clasifica cada ruta en su área', async () => {
  expect(areaDe('lab/public/cv/index.html')).toBe('cv-linkedin')
  expect(areaDe('linkedin/banner.png')).toBe('cv-linkedin')
  expect(areaDe('flow/services/processor.ts')).toBe('flow')
  expect(areaDe('lab/src/App.tsx')).toBe('lab')
  expect(areaDe('app/index.html')).toBe('app')
  expect(areaDe('.github/workflows/sync-upstream.yml')).toBe('infra')
  expect(areaDe('STRATEGY.md')).toBe('estrategia')
  expect(areaDe('raro.bin')).toBe('otros')
})

test('lee git log y descarta los commits que solo tocan el feed', async () => {
  const out =
    '\x1eaaa1111\x1ffeat(cv): nueva hoja\n\nlab/public/cv/index.html\nscripts/cv-render.mjs\n' +
    '\x1ebbb2222\x1fnovedades: 2026-10-09\n\nNOVEDADES.json\n' +
    '\x1eccc3333\x1ffix(flow): grano\n\nflow/App.tsx\n'
  const commits = parseLog(out)
  expect(commits.map(c => c.sha)).toEqual(['aaa1111', 'ccc3333'])
  expect(commits[0]?.files).toEqual(['lab/public/cv/index.html', 'scripts/cv-render.mjs'])
})

test('crea una entrada con áreas únicas, nota y tope de cambios', async () => {
  const commits: Commit[] = Array.from({ length: 14 }, (_, i) => ({
    sha: `sha${i}abcdef`,
    subject: `cambio ${i}`,
    files: [i % 2 ? 'flow/App.tsx' : 'app/index.html'],
  }))
  const e = crearEntrada(commits, AHORA, '  el CV nuevo ya está en vivo ')!
  expect(e.id).toBe('2026-10-10-sha0abc')
  expect(e.areas).toEqual(['app', 'flow'])
  expect(e.cambios.length).toBe(13)
  expect(e.cambios[12]).toBe('+2 más')
  expect(e.nota).toBe('el CV nuevo ya está en vivo')
  expect(crearEntrada([], AHORA)).toBe(undefined)
  expect('nota' in crearEntrada(commits.slice(0, 1), AHORA, '  ')!).toBe(false)
})

test('publica arriba, sin duplicar, y el receptor ve solo lo nuevo', async () => {
  const mk = (sha: string) =>
    crearEntrada([{ sha, subject: sha, files: ['app/a.html'] }], AHORA)!
  let feed = leerFeed('no es json', HUB)
  expect(feed.entradas).toEqual([])
  feed = publicar(feed, mk('aaaaaaa1'), AHORA)
  feed = publicar(feed, mk('bbbbbbb2'), AHORA)
  feed = publicar(feed, mk('bbbbbbb2'), AHORA)
  expect(feed.entradas.map(e => e.sha)).toEqual(['bbbbbbb2', 'aaaaaaa1'])
  expect(noVistas(feed, feed.entradas[1]?.id).map(e => e.sha)).toEqual(['bbbbbbb2'])
  expect(noVistas(feed, feed.entradas[0]?.id)).toEqual([])
  expect(noVistas(feed, undefined).length).toBe(2)
  expect(noVistas(feed, 'id-que-ya-no-existe').length).toBe(2)
  expect(informe(feed.entradas)).toContain('2 novedad(es)')
})
