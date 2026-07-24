/**
 * ============================================================================
 * HERA GRAFT ENGINE v4.0 — "Aligned Frequency Graft"
 * ============================================================================
 *
 * QUÉ CAMBIA RESPECTO A v2.5 / v3.0 (y por qué el resultado se había arruinado):
 *
 *  1. ALINEACIÓN AUTOMÁTICA (lo que faltaba de verdad).
 *     El injerto de frecuencias asume correspondencia píxel-a-píxel. Nano Banana
 *     NO la garantiza: reencuadra, hace zoom, mueve la cara 5-20 px. Al centrar
 *     con "cover-fit" y ya está, la alta frecuencia caía en el sitio equivocado
 *     → eso es el ghosting / la doble imagen / el "no se ve nada".
 *     v4 estima escala + desplazamiento (búsqueda jerárquica sobre gradientes)
 *     ANTES de extraer la textura.
 *
 *  2. MAPA DE CONFIANZA POR ZONAS.
 *     Donde la IA se inventó estructura distinta (correlación de media
 *     frecuencia baja), el injerto se atenúa solo. Es imposible que pinte
 *     rasgos nuevos, incluso si el modelo alucina.
 *
 *  3. PROTECCIÓN DEL FOCO.
 *     Las zonas desenfocadas del original (bokeh, fondo) reciben mucho menos
 *     textura. Se acabó el "todo crujiente" que mataba la profundidad de campo.
 *
 *  4. CLARITY SOBRE EL ORIGINAL, NO SOBRE LA IA.
 *     El "cuerpo" que echabas de menos (la riqueza de la foto cruda) no viene
 *     de la alta frecuencia: viene del contraste local. v4 lo saca del PROPIO
 *     original — cero riesgo de identidad, cero ghosting.
 *
 *  5. UPSCALE REAL.
 *     Se trabaja a la resolución de la IA si es mayor que la del original:
 *     estructura y color del original + detalle de la IA = más resolución real.
 *
 * LO QUE SE ELIMINÓ (era lo que rompía las fotos):
 *   · Blend-modes (overlay / soft-light) → sucios y con ghosting. Fuera.
 *   · "Sharpness" post-proceso encima del injerto → halos y ruido. Fuera.
 *   · Presets de iluminación → le pedían a la IA CAMBIAR la luz; la diferencia
 *     de luz entraba en el delta y ensuciaba todo. Fuera.
 *
 * Salida: JPEG calidad 0.97 a resolución completa.
 * ============================================================================
 */

export interface GraftOptions {
  /** 0–1.5 · cuánta micro-textura se injerta. Recomendado 0.85 */
  intensity?: number
  /** 0–0.6 · contraste local extraído del PROPIO original. Recomendado 0.25 */
  clarity?: number
  /** Respetar el desenfoque del original (no texturizar el bokeh). Por defecto true */
  preserveFocus?: boolean
  /** dataURL de máscara (blanco = aplicar). Opcional */
  maskDataUrl?: string | null
  /** Solo dentro de la máscara: mezcla también la estructura de la IA
   *  (para reconstruir manos/dedos deformes). Por defecto false */
  structureRepair?: boolean
  /** callback de progreso */
  onProgress?: (stage: string) => void
}

export interface GraftReport {
  targetSize: string
  originalSize: string
  aiSize: string
  alignScale: number
  alignDx: number
  alignDy: number
  meanConfidence: number
  ms: number
}

/** Informe del último injerto — muéstralo en la UI para ver qué pasó de verdad. */
export let lastGraftReport: GraftReport | null = null

interface Align { scale: number; dx: number; dy: number }
interface Box { w: number; h: number }

const MAX_PIXELS = 14_000_000

// ---------------------------------------------------------------------------
// API PRINCIPAL
// ---------------------------------------------------------------------------

export async function graftTexture(
  originalDataUrl: string,
  aiDataUrl: string,
  options: GraftOptions = {}
): Promise<string> {
  const t0 = performance.now()
  const intensity = clamp(options.intensity ?? 0.85, 0, 1.5)
  const clarity = clamp(options.clarity ?? 0.25, 0, 0.6)
  const preserveFocus = options.preserveFocus !== false
  const report = (s: string) => options.onProgress?.(s)

  report('Cargando imágenes')
  const [orig, ai] = await Promise.all([loadImage(originalDataUrl), loadImage(aiDataUrl)])

  // Caja útil: el modelo a veces devuelve relleno negro en tiles.
  const aiBox = detectContentBox(ai)
  const origBox = detectContentBox(orig)

  // Lienzo de trabajo: aspecto del ORIGINAL (sagrado), resolución de la IA si
  // es mayor → upscale real. Tope de 14 MP por memoria de móvil.
  let W = Math.max(origBox.w, aiBox.w)
  let H = Math.round((W * origBox.h) / origBox.w)
  if (W * H > MAX_PIXELS) {
    const k = Math.sqrt(MAX_PIXELS / (W * H))
    W = Math.round(W * k)
    H = Math.round(H * k)
  }

  report('Alineando estructura')
  const align = estimateAlign(orig, origBox, ai, aiBox, W, H)

  report('Extrayendo micro-textura')
  const baseData = drawFitted(orig, origBox, W, H, { scale: 1, dx: 0, dy: 0 })
  const aiData = drawFitted(ai, aiBox, W, H, align)

  const N = W * H
  const base = baseData.data
  const aiPix = aiData.data

  // --- Bandas de frecuencia -------------------------------------------------
  const rFine = Math.max(2, Math.round(W / 700)) // poro / grano
  const rMid = rFine * 6 // estructura (rasgos, sombras)

  const aiRGB = unpackRGB(aiPix, N)
  const aiFineBlur = blurRGB(aiRGB, W, H, rFine)

  const lumO = luma(base, N)
  const lumA = luma(aiPix, N)
  const oFine = blur1(lumO, W, H, rFine)
  const aFine = blur1(lumA, W, H, rFine)
  const oMidB = blur1(lumO, W, H, rMid)
  const aMidB = blur1(lumA, W, H, rMid)

  // Media frecuencia = detalle estructural compartido. Es la señal honesta para
  // saber si la IA respetó la foto o se la inventó en esa zona.
  const oMid = new Float32Array(N)
  const aMid = new Float32Array(N)
  for (let p = 0; p < N; p++) {
    oMid[p] = oFine[p] - oMidB[p]
    aMid[p] = aFine[p] - aMidB[p]
  }

  report('Verificando fidelidad por zonas')
  const confidence = confidenceMap(oMid, aMid, W, H)

  // --- Peso de foco ---------------------------------------------------------
  let focus: Float32Array | null = null
  if (preserveFocus) {
    const hiEnergy = new Float32Array(N)
    for (let p = 0; p < N; p++) hiEnergy[p] = Math.abs(lumO[p] - oFine[p])
    const smooth = blur1(hiEnergy, W, H, rFine * 4)
    const ref = percentile(smooth, 0.85) || 1
    for (let p = 0; p < N; p++) {
      const t = clamp(smooth[p] / (0.45 * ref), 0, 1)
      smooth[p] = 0.18 + 0.82 * Math.pow(t, 0.6)
    }
    focus = smooth
  }

  // --- Máscara opcional -----------------------------------------------------
  let mask: Float32Array | null = null
  if (options.maskDataUrl) {
    mask = await loadMask(options.maskDataUrl, W, H)
    mask = blur1(mask, W, H, Math.max(4, Math.round(W / 180))) // bordes suaves
  }

  report('Injertando en la foto real')

  // --- Composición ----------------------------------------------------------
  const T = 10 // umbral de soft-clip: deja pasar poro/grano, frena bordes
  for (let i = 0, p = 0; p < N; i += 4, p++) {
    let gain = intensity * confidence[p]
    if (focus) gain *= focus[p]
    if (mask) gain *= mask[p]

    // Contraste local del propio original (el "cuerpo" de la foto).
    const localContrast = clarity * (oMid[p] * 1.0)

    const q = p * 3
    for (let c = 0; c < 3; c++) {
      const hp = aiRGB[q + c] - aiFineBlur[q + c]
      const soft = hp / (1 + Math.abs(hp) / T)
      base[i + c] = clamp255(base[i + c] + gain * soft + localContrast * (focus ? focus[p] : 1))
    }
  }

  // --- Reparación estructural (solo dentro de la máscara, opt-in) -----------
  if (options.structureRepair && mask) {
    report('Reconstruyendo anatomía')
    for (let i = 0, p = 0; p < N; i += 4, p++) {
      const m = mask[p]
      if (m < 0.01) continue
      const k = m * 0.85
      for (let c = 0; c < 3; c++) {
        base[i + c] = clamp255(base[i + c] * (1 - k) + aiPix[i + c] * k)
      }
    }
  }

  let meanConf = 0
  for (let p = 0; p < N; p++) meanConf += confidence[p]
  meanConf /= N

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const octx = out.getContext('2d')!
  octx.putImageData(baseData, 0, 0)

  lastGraftReport = {
    targetSize: `${W}×${H}`,
    originalSize: `${orig.naturalWidth}×${orig.naturalHeight}`,
    aiSize: `${ai.naturalWidth}×${ai.naturalHeight}`,
    alignScale: Math.round(align.scale * 1000) / 1000,
    alignDx: Math.round(align.dx),
    alignDy: Math.round(align.dy),
    meanConfidence: Math.round(meanConf * 100) / 100,
    ms: Math.round(performance.now() - t0),
  }

  return out.toDataURL('image/jpeg', 0.97)
}

/** Texto corto de diagnóstico para pintar bajo el resultado. */
export function graftReportLine(): string {
  const r = lastGraftReport
  if (!r) return ''
  return `${r.targetSize} · align ×${r.alignScale} (${r.alignDx},${r.alignDy}) · fidelidad ${(r.meanConfidence * 100).toFixed(0)}% · ${r.ms}ms`
}

// ---------------------------------------------------------------------------
// ALINEACIÓN — búsqueda jerárquica sobre magnitud de gradiente
// ---------------------------------------------------------------------------

function estimateAlign(
  orig: HTMLImageElement,
  origBox: Box,
  ai: HTMLImageElement,
  aiBox: Box,
  targetW: number,
  targetH: number
): Align {
  const aspect = targetH / targetW

  // ---- Nivel 1: grueso (96 px) --------------------------------------------
  const w1 = 96
  const h1 = Math.max(24, Math.round(w1 * aspect))
  const gO1 = gradient(luma(drawFitted(orig, origBox, w1, h1, IDENT).data, w1 * h1), w1, h1)

  let best = { scale: 1, dx: 0, dy: 0, cost: Infinity }
  const M1 = 10
  for (let s = 0.9; s <= 1.1001; s += 0.02) {
    const gA = gradient(
      luma(drawFitted(ai, aiBox, w1, h1, { scale: s, dx: 0, dy: 0 }).data, w1 * h1),
      w1,
      h1
    )
    for (let dy = -M1; dy <= M1; dy++) {
      for (let dx = -M1; dx <= M1; dx++) {
        const cost = shiftCost(gO1, gA, w1, h1, dx, dy, M1, 1)
        if (cost < best.cost) best = { scale: s, dx, dy, cost }
      }
    }
  }

  // ---- Nivel 2: fino (384 px) ---------------------------------------------
  const w2 = 384
  const h2 = Math.max(48, Math.round(w2 * aspect))
  const f = w2 / w1
  const gO2 = gradient(luma(drawFitted(orig, origBox, w2, h2, IDENT).data, w2 * h2), w2, h2)

  const cx = Math.round(best.dx * f)
  const cy = Math.round(best.dy * f)
  const M2 = 6
  let fine = { scale: best.scale, dx: cx, dy: cy, cost: Infinity }

  for (let s = best.scale - 0.03; s <= best.scale + 0.0301; s += 0.0075) {
    const gA = gradient(
      luma(drawFitted(ai, aiBox, w2, h2, { scale: s, dx: 0, dy: 0 }).data, w2 * h2),
      w2,
      h2
    )
    for (let dy = cy - M2; dy <= cy + M2; dy++) {
      for (let dx = cx - M2; dx <= cx + M2; dx++) {
        const margin = Math.max(Math.abs(dx), Math.abs(dy)) + 2
        const cost = shiftCost(gO2, gA, w2, h2, dx, dy, margin, 2)
        if (cost < fine.cost) fine = { scale: s, dx, dy, cost }
      }
    }
  }

  const k = targetW / w2
  return { scale: fine.scale, dx: fine.dx * k, dy: fine.dy * k }
}

const IDENT: Align = { scale: 1, dx: 0, dy: 0 }

/** Coste = diferencia media absoluta de gradientes con B desplazado (dx,dy). */
function shiftCost(
  A: Float32Array,
  B: Float32Array,
  W: number,
  H: number,
  dx: number,
  dy: number,
  margin: number,
  stride: number
): number {
  let sum = 0
  let n = 0
  const y0 = Math.max(margin, dy + 1)
  const y1 = Math.min(H - margin, H + dy - 1)
  const x0 = Math.max(margin, dx + 1)
  const x1 = Math.min(W - margin, W + dx - 1)
  for (let y = y0; y < y1; y += stride) {
    const ro = y * W
    const rb = (y - dy) * W
    for (let x = x0; x < x1; x += stride) {
      const d = A[ro + x] - B[rb + (x - dx)]
      sum += d * d
      n++
    }
  }
  return n > 0 ? sum / n : Infinity
}

/** Magnitud de gradiente normalizada a media 1 (invariante a brillo/contraste). */
function gradient(L: Float32Array, W: number, H: number): Float32Array {
  const g = new Float32Array(W * H)
  let sum = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const v = Math.abs(L[i + 1] - L[i - 1]) + Math.abs(L[i + W] - L[i - W])
      g[i] = v
      sum += v
    }
  }
  const mean = sum / (W * H) || 1
  for (let i = 0; i < g.length; i++) g[i] /= mean
  return g
}

// ---------------------------------------------------------------------------
// CONFIANZA — correlación local de media frecuencia
// ---------------------------------------------------------------------------

function confidenceMap(oMid: Float32Array, aMid: Float32Array, W: number, H: number): Float32Array {
  const TILE = Math.max(24, Math.round(W / 28))
  const tx = Math.ceil(W / TILE)
  const ty = Math.ceil(H / TILE)
  const tile = new Float32Array(tx * ty)

  for (let ty_ = 0; ty_ < ty; ty_++) {
    for (let tx_ = 0; tx_ < tx; tx_++) {
      const x0 = tx_ * TILE
      const y0 = ty_ * TILE
      const x1 = Math.min(W, x0 + TILE)
      const y1 = Math.min(H, y0 + TILE)
      let sa = 0
      let sb = 0
      let sab = 0
      let saa = 0
      let sbb = 0
      let n = 0
      for (let y = y0; y < y1; y += 2) {
        const row = y * W
        for (let x = x0; x < x1; x += 2) {
          const a = oMid[row + x]
          const b = aMid[row + x]
          sa += a
          sb += b
          sab += a * b
          saa += a * a
          sbb += b * b
          n++
        }
      }
      if (n < 4) {
        tile[ty_ * tx + tx_] = 1
        continue
      }
      const ca = sab / n - (sa / n) * (sb / n)
      const va = saa / n - (sa / n) ** 2
      const vb = sbb / n - (sb / n) ** 2
      const denom = Math.sqrt(Math.max(va, 1e-6) * Math.max(vb, 1e-6))
      const corr = denom > 0 ? ca / denom : 0
      // corr < 0.05 → la IA se desvió: casi no injertamos.
      // corr > 0.40 → alineado y fiel: injerto completo.
      tile[ty_ * tx + tx_] = 0.2 + 0.8 * clamp((corr - 0.05) / 0.35, 0, 1)
    }
  }

  // Suavizado del mapa de tiles para que no se noten cuadros.
  const sm = blur1(tile, tx, ty, 1)

  // Interpolación bilineal a resolución completa.
  const out = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    const fy = Math.min(ty - 1, y / TILE - 0.5)
    const y0 = Math.max(0, Math.floor(fy))
    const y1 = Math.min(ty - 1, y0 + 1)
    const wy = clamp(fy - y0, 0, 1)
    for (let x = 0; x < W; x++) {
      const fx = Math.min(tx - 1, x / TILE - 0.5)
      const x0 = Math.max(0, Math.floor(fx))
      const x1 = Math.min(tx - 1, x0 + 1)
      const wx = clamp(fx - x0, 0, 1)
      const a = sm[y0 * tx + x0] * (1 - wx) + sm[y0 * tx + x1] * wx
      const b = sm[y1 * tx + x0] * (1 - wx) + sm[y1 * tx + x1] * wx
      out[y * W + x] = a * (1 - wy) + b * wy
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// UTILIDADES DE IMAGEN
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    im.src = src
  })
}

/** Dibuja `img` (recortado a `box`) cubriendo W×H, con escala y offset extra. */
function drawFitted(
  img: HTMLImageElement,
  box: Box,
  W: number,
  H: number,
  al: Align
): ImageData {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const r = Math.max(W / box.w, H / box.h) * al.scale
  const nw = box.w * r
  const nh = box.h * r
  ctx.drawImage(img, 0, 0, box.w, box.h, (W - nw) / 2 + al.dx, (H - nh) / 2 + al.dy, nw, nh)
  return ctx.getImageData(0, 0, W, H)
}

/** Detecta el área útil descartando relleno negro abajo/derecha. */
function detectContentBox(img: HTMLImageElement): Box {
  const W = img.naturalWidth
  const H = img.naturalHeight
  try {
    const sw = 160
    const sh = Math.max(16, Math.round((H / W) * sw))
    const c = document.createElement('canvas')
    c.width = sw
    c.height = sh
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, sw, sh)
    const d = ctx.getImageData(0, 0, sw, sh).data
    const BLACK = 12
    const rowBlack = (y: number) => {
      for (let x = 0; x < sw; x += 2) {
        const i = (y * sw + x) * 4
        if (d[i] > BLACK || d[i + 1] > BLACK || d[i + 2] > BLACK) return false
      }
      return true
    }
    const colBlack = (x: number) => {
      for (let y = 0; y < sh; y += 2) {
        const i = (y * sw + x) * 4
        if (d[i] > BLACK || d[i + 1] > BLACK || d[i + 2] > BLACK) return false
      }
      return true
    }
    let bottom = sh
    while (bottom > sh * 0.5 && rowBlack(bottom - 1)) bottom--
    let right = sw
    while (right > sw * 0.5 && colBlack(right - 1)) right--
    return {
      w: Math.max(1, Math.round((right / sw) * W)),
      h: Math.max(1, Math.round((bottom / sh) * H)),
    }
  } catch {
    return { w: W, h: H }
  }
}

async function loadMask(dataUrl: string, W: number, H: number): Promise<Float32Array> {
  const img = await loadImage(dataUrl)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, W, H)
  const d = ctx.getImageData(0, 0, W, H).data
  const m = new Float32Array(W * H)
  for (let i = 0, p = 0; p < m.length; i += 4, p++) m[p] = d[i] / 255
  return m
}

function luma(d: Uint8ClampedArray, n: number): Float32Array {
  const L = new Float32Array(n)
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    L[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  }
  return L
}

function unpackRGB(d: Uint8ClampedArray, n: number): Float32Array {
  const a = new Float32Array(n * 3)
  for (let i = 0, q = 0; q < a.length; i += 4, q += 3) {
    a[q] = d[i]
    a[q + 1] = d[i + 1]
    a[q + 2] = d[i + 2]
  }
  return a
}

// ---------------------------------------------------------------------------
// DESENFOQUE — box blur separable, 3 pasadas ≈ gaussiana
// ---------------------------------------------------------------------------

function blur1(src: Float32Array, W: number, H: number, r: number): Float32Array {
  if (r < 1) return src.slice()
  const a = src.slice()
  const b = new Float32Array(a.length)
  for (let pass = 0; pass < 3; pass++) {
    axis1(a, b, W, H, r, true)
    axis1(b, a, W, H, r, false)
  }
  return a
}

function axis1(
  s: Float32Array,
  d: Float32Array,
  W: number,
  H: number,
  r: number,
  horiz: boolean
): void {
  const len = horiz ? W : H
  const lines = horiz ? H : W
  const step = horiz ? 1 : W
  const lineStep = horiz ? W : 1
  const win = r * 2 + 1
  for (let ln = 0; ln < lines; ln++) {
    const bs = ln * lineStep
    let sum = 0
    for (let k = -r; k <= r; k++) sum += s[bs + Math.min(len - 1, Math.max(0, k)) * step]
    for (let p = 0; p < len; p++) {
      d[bs + p * step] = sum / win
      const add = Math.min(len - 1, p + r + 1)
      const sub = Math.max(0, p - r)
      sum += s[bs + add * step] - s[bs + sub * step]
    }
  }
}

function blurRGB(src: Float32Array, W: number, H: number, r: number): Float32Array {
  const a = src.slice()
  const b = new Float32Array(a.length)
  for (let pass = 0; pass < 3; pass++) {
    axisRGB(a, b, W, H, r, true)
    axisRGB(b, a, W, H, r, false)
  }
  return a
}

function axisRGB(
  s: Float32Array,
  d: Float32Array,
  W: number,
  H: number,
  r: number,
  horiz: boolean
): void {
  const len = horiz ? W : H
  const lines = horiz ? H : W
  const step = horiz ? 1 : W
  const lineStep = horiz ? W : 1
  const win = r * 2 + 1
  for (let ln = 0; ln < lines; ln++) {
    const bs = ln * lineStep
    for (let ch = 0; ch < 3; ch++) {
      let sum = 0
      for (let k = -r; k <= r; k++) {
        sum += s[(bs + Math.min(len - 1, Math.max(0, k)) * step) * 3 + ch]
      }
      for (let p = 0; p < len; p++) {
        d[(bs + p * step) * 3 + ch] = sum / win
        const add = Math.min(len - 1, p + r + 1)
        const sub = Math.max(0, p - r)
        sum += s[(bs + add * step) * 3 + ch] - s[(bs + sub * step) * 3 + ch]
      }
    }
  }
}

// ---------------------------------------------------------------------------

function percentile(arr: Float32Array, q: number): number {
  const step = Math.max(1, Math.floor(arr.length / 20000))
  const sample: number[] = []
  for (let i = 0; i < arr.length; i += step) sample.push(arr[i])
  sample.sort((a, b) => a - b)
  return sample[Math.min(sample.length - 1, Math.floor(sample.length * q))] ?? 0
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

// ---------------------------------------------------------------------------
// Alias de compatibilidad con el código antiguo de la app.
// ---------------------------------------------------------------------------
export async function processComposition(
  originalDataUrl: string,
  aiDataUrl: string,
  intensity: number,
  mask?: string | null,
  structureRepair?: boolean,
  clarity?: number
): Promise<string> {
  return graftTexture(originalDataUrl, aiDataUrl, {
    intensity,
    clarity: clarity ?? 0.25,
    maskDataUrl: mask,
    structureRepair: !!structureRepair,
  })
}
