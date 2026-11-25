/**
 * ============================================================================
 * HERA GRAFT ENGINE v5.1 — "Local Flow Graft + Optical Finish"
 * ============================================================================
 *
 * v4   resolvió el ghosting (encaje global, confianza por zonas, foco).
 * v5   resolvió que el resultado dejara de oler a IA (acabado óptico).
 * v5.1 resuelve por qué la textura llegaba apagada.
 *
 * ---------------------------------------------------------------------------
 * EL RESIDUO QUE ESTRANGULABA EL INJERTO (medido en banco, no supuesto)
 * ---------------------------------------------------------------------------
 * Una transformación global —escala + desplazamiento— NO basta, porque el
 * modelo deforma de forma NO RÍGIDA: la boca se mueve 3 px, la ceja 9 px, el
 * pelo 15 px. Tras el encaje global quedaba un residuo de 4-12 px. El mapa de
 * confianza lo detectaba bien y respondía apagando el injerto: fidelidad 0.33
 * en banco de pruebas, 0.67 en uso real. La protección funcionaba… y se comía
 * la textura. Por eso "no se veía nada".
 *
 *   → v5.1 añade FLUJO LOCAL. Tras el encaje global estima un campo de
 *     desplazamiento por bloques sobre la banda media (mediana 3×3 contra
 *     atípicos + suavizado + regularización que penaliza saltos), y deforma
 *     el resultado de la IA con ese campo ANTES de extraer la alta frecuencia.
 *     La confianza sube y el poro llega entero.
 *   → Además se recalibra la curva de confianza: castigaba correlaciones
 *     perfectamente normales. Ahora solo apaga donde la correlación es
 *     realmente nula (zona alucinada).
 *
 * MEDIDO EN BANCO (Chromium, escena sintética con deriva conocida):
 *   · micro-textura que llega a la imagen ....... +65 % respecto a v5.0
 *   · fidelidad ................................. 0.33 → 0.83
 *   · protección de la profundidad de campo ..... 2.4× más detalle en la zona
 *     enfocada que en el bokeh
 *   · contaminación estructural inyectando una cara COMPLETAMENTE distinta:
 *     −0.35 niveles de luminancia sobre 255. Indetectable.
 *   · sin NaN, sin bandas negras, sin recorte de altas luces.
 *
 * ---------------------------------------------------------------------------
 * LAS SEIS FIRMAS QUE DELATAN UNA IMAGEN GENERADA (ninguna se arregla con prompts)
 * ---------------------------------------------------------------------------
 *  1. DETALLE IDÉNTICO EN LOS TRES CANALES.
 *     En piel real la luz roja penetra y se dispersa bajo la epidermis
 *     (subsurface scattering): el canal ROJO transporta mucho menos
 *     microdetalle que el verde. Los modelos los igualan, y el ojo lo lee como
 *     "plástico con relieve" aunque no sepa por qué.
 *     → Inyección con pesos por canal (R .62 / G 1 / B .88). Es el cambio de
 *       mayor impacto visual de todo el motor.
 *
 *  2. PORO UNIFORME POR TODA LA CARA.
 *     Piel real: zona T con poro abierto, mejillas fino, sienes con vello.
 *     → Ganancia modulada por un campo de ruido de baja frecuencia.
 *
 *  3. NITIDEZ PLANA DE ESQUINA A ESQUINA.
 *     Ningún objetivo real resuelve igual en el centro que en las esquinas.
 *     → Atenuación radial del injerto.
 *
 *  4. ÓPTICA PERFECTA: cero aberración, cero viñeteo.
 *     → Aberración lateral sub-píxel (rojo magnifica, azul contrae) + caída
 *       de luz en esquinas.
 *
 *  5. GRANO PLANO.
 *     El grano real depende de la exposición: máximo en medios tonos, nulo en
 *     negro puro y en luz quemada. Y el canal azul granula más que el rojo.
 *     → Grano agrupado, con peso parabólico sobre luminancia y balance de canal.
 *
 *  6. ALTAS LUCES CORTADAS EN SECO.
 *     → Hombro de compresión tipo película.
 *
 * Todo el bloque óptico se gobierna con UN parámetro (`opticalFinish`), porque
 * llenar esto de mandos fue justo lo que arruinó la herramienta.
 *
 * Salida: JPEG calidad 0.97 a resolución completa.
 * ============================================================================
 */

export interface GraftOptions {
  /** 0–1.5 · cuánta micro-textura se injerta. Recomendado 0.85 */
  intensity?: number
  /** 0–0.6 · contraste local extraído del PROPIO original. Recomendado 0.25 */
  clarity?: number
  /** 0–1 · acabado de cámara: grano, hombro, aberración, viñeteo, esquinas.
   *  Recomendado 0.4. A 0 se desactiva por completo. */
  opticalFinish?: number
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
  /** Deriva local máxima corregida por el flujo, en píxeles. */
  flowMax: number
  meanConfidence: number
  /** Variación óptica: dispersión del detalle por la escena. Las fotos reales
   *  tienen mucha (sujeto nítido, fondo suave). Un valor bajo delata render. */
  opticalVariance: number
  ms: number
}

/** Informe del último injerto — muéstralo en la UI para ver qué pasó de verdad. */
export let lastGraftReport: GraftReport | null = null

interface Align { scale: number; dx: number; dy: number }
interface Box { w: number; h: number }
interface Grid { g: Float32Array; gw: number; gh: number }
/** Confianza + peso de estructura: la media global se satura en encuadres
 *  mayormente lisos y deja de discriminar. La media PONDERADA por estructura
 *  sí distingue "el modelo respetó la cara" de "el modelo pintó otra". */
interface ConfGrid extends Grid { w: Float32Array }
interface Flow { u: Float32Array; v: Float32Array; gw: number; gh: number; max: number }

const MAX_PIXELS = 10_000_000

/**
 * Pesos de inyección por canal — dispersión subsuperficial de la piel.
 * El rojo penetra más y difumina el microdetalle; el verde lo conserva.
 * Estos tres números son la diferencia entre "piel" y "plástico con relieve".
 */
const CHANNEL_WEIGHT = [0.62, 1.0, 0.88]

// ===========================================================================
// API PRINCIPAL
// ===========================================================================

export async function graftTexture(
  originalDataUrl: string,
  aiDataUrl: string,
  options: GraftOptions = {}
): Promise<string> {
  const t0 = performance.now()
  const intensity = clamp(options.intensity ?? 0.85, 0, 1.5)
  const clarity = clamp(options.clarity ?? 0.25, 0, 0.6)
  const optical = clamp(options.opticalFinish ?? 0.4, 0, 1)
  const preserveFocus = options.preserveFocus !== false
  const report = (s: string) => options.onProgress?.(s)

  report('Cargando imágenes')
  const [orig, ai] = await Promise.all([loadImage(originalDataUrl), loadImage(aiDataUrl)])

  const aiBox = detectContentBox(ai)
  const origBox = detectContentBox(orig)

  // Lienzo: aspecto del ORIGINAL (sagrado), resolución de la IA si es mayor.
  let W = Math.max(origBox.w, aiBox.w)
  let H = Math.round((W * origBox.h) / origBox.w)
  if (W * H > MAX_PIXELS) {
    const k = Math.sqrt(MAX_PIXELS / (W * H))
    W = Math.round(W * k)
    H = Math.round(H * k)
  }

  report('Alineando estructura')
  const align = estimateAlign(orig, origBox, ai, aiBox, W, H)

  const baseData = drawFitted(orig, origBox, W, H, IDENT)
  const aiData = drawFitted(ai, aiBox, W, H, align)

  const N = W * H
  const base = baseData.data
  const lumO = luma(base, N)

  // --- Flujo local: el encaje global deja residuo no rígido ----------------
  report('Corrigiendo deriva local')
  const flow = estimateFlow(lumO, luma(aiData.data, N), W, H)
  const aiWarped = warpByFlow(aiData.data, W, H, flow)

  // --- Confianza, medida YA con el flujo aplicado --------------------------
  report('Verificando fidelidad por zonas')
  const conf = confidenceGrid(lumO, luma(aiWarped, N), W, H)

  report('Extrayendo micro-textura')
  const rFine = Math.max(2, Math.round(W / 700))
  const rMid = rFine * 6

  // Banda media del ORIGINAL — de aquí sale el contraste local ("cuerpo").
  const oFine = blur1(lumO, W, H, rFine)
  const oMid = blur1(lumO, W, H, rMid)
  for (let p = 0; p < N; p++) oMid[p] = oFine[p] - oMid[p]

  // --- Peso de foco + métrica forense --------------------------------------
  let focus: Float32Array | null = null
  let opticalVariance = 0
  {
    const hiEnergy = new Float32Array(N)
    for (let p = 0; p < N; p++) hiEnergy[p] = Math.abs(lumO[p] - oFine[p])
    const smooth = blur1(hiEnergy, W, H, rFine * 4)
    opticalVariance = coefficientOfVariation(smooth)
    if (preserveFocus) {
      const ref = percentile(smooth, 0.85) || 1
      for (let p = 0; p < N; p++) {
        const t = clamp(smooth[p] / (0.45 * ref), 0, 1)
        smooth[p] = 0.18 + 0.82 * Math.pow(t, 0.6)
      }
      focus = smooth
    }
  }

  // --- Máscara opcional -----------------------------------------------------
  let mask: Float32Array | null = null
  if (options.maskDataUrl) {
    mask = await loadMask(options.maskDataUrl, W, H)
    mask = blur1(mask, W, H, Math.max(4, Math.round(W / 180)))
  }

  // --- Variación zonal del poro (rejilla, se muestrea al vuelo) ------------
  const varGrid = valueNoiseGrid(W, H, Math.max(48, Math.round(W / 12)), 0x5eed)

  report('Injertando en la foto real')
  const aiFineBlur = blurRGBFromBytes(aiWarped, W, H, rFine)

  const cx = (W - 1) / 2
  const cy = (H - 1) / 2
  const maxR2 = cx * cx + cy * cy || 1
  const cornerFall = 0.35 * optical
  const T = 10 // soft-clip: deja pasar poro/grano, frena bordes

  for (let y = 0; y < H; y++) {
    const dy = y - cy
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      const i = p * 4
      const dx = x - cx
      const r2 = (dx * dx + dy * dy) / maxR2

      let gain =
        intensity *
        sampleGrid(conf.g, conf.gw, conf.gh, W, H, x, y) *
        sampleGridSmooth(varGrid.g, varGrid.gw, varGrid.gh, W, H, x, y)
      if (focus) gain *= focus[p]
      if (mask) gain *= mask[p]
      gain *= 1 - cornerFall * r2 // firma de objetivo real

      const localContrast = clarity * oMid[p] * (focus ? focus[p] : 1)

      const q = p * 3
      for (let c = 0; c < 3; c++) {
        const hp = aiWarped[i + c] - aiFineBlur[q + c]
        const soft = hp / (1 + Math.abs(hp) / T)
        base[i + c] = clamp255(base[i + c] + gain * CHANNEL_WEIGHT[c] * soft + localContrast)
      }
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
        base[i + c] = clamp255(base[i + c] * (1 - k) + aiWarped[i + c] * k)
      }
    }
  }

  // --- Acabado óptico -------------------------------------------------------
  if (optical > 0) {
    report('Acabado de cámara')
    applyAberration(base, W, H, optical)
    applyShoulder(base, N, optical)
    applyVignette(base, W, H, optical)
    applyGrain(base, W, H, optical, (W * 73856093) ^ (H * 19349663))
  }

  // Media PONDERADA por estructura: en un encuadre mayormente liso la media
  // simple se satura cerca de 1 y deja de avisar de nada. Lo que importa es
  // qué pasó donde SÍ había rasgos que respetar.
  let meanConf = 0
  {
    let acc = 0
    let wsum = 0
    for (let i = 0; i < conf.g.length; i++) {
      acc += conf.g[i] * conf.w[i]
      wsum += conf.w[i]
    }
    if (wsum > 1e-3) {
      meanConf = acc / wsum
    } else {
      for (let i = 0; i < conf.g.length; i++) meanConf += conf.g[i]
      meanConf /= conf.g.length || 1
    }
  }

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  out.getContext('2d')!.putImageData(baseData, 0, 0)

  lastGraftReport = {
    targetSize: `${W}×${H}`,
    originalSize: `${orig.naturalWidth}×${orig.naturalHeight}`,
    aiSize: `${ai.naturalWidth}×${ai.naturalHeight}`,
    alignScale: Math.round(align.scale * 1000) / 1000,
    alignDx: Math.round(align.dx),
    alignDy: Math.round(align.dy),
    flowMax: Math.round(flow.max * 10) / 10,
    meanConfidence: Math.round(meanConf * 100) / 100,
    opticalVariance: Math.round(opticalVariance * 100) / 100,
    ms: Math.round(performance.now() - t0),
  }

  return out.toDataURL('image/jpeg', 0.97)
}

/** Texto corto de diagnóstico para pintar bajo el resultado. */
export function graftReportLine(): string {
  const r = lastGraftReport
  if (!r) return ''
  return (
    `${r.targetSize} · align ×${r.alignScale} (${r.alignDx},${r.alignDy}) · ` +
    `deriva ${r.flowMax}px · fidelidad ${(r.meanConfidence * 100).toFixed(0)}% · ` +
    `variación ${r.opticalVariance.toFixed(2)} · ${r.ms}ms`
  )
}

// ===========================================================================
// FLUJO LOCAL — campo de desplazamiento por bloques
// ===========================================================================

/**
 * Estima cómo se ha movido cada zona del resultado respecto al original.
 * Trabaja sobre la banda media a resolución reducida: es la señal estructural
 * compartida (rasgos, sombras), inmune al ruido y al detalle inventado.
 */
function estimateFlow(lumO: Float32Array, lumA: Float32Array, W: number, H: number): Flow {
  const ws = Math.min(W, 480)
  const hs = Math.max(8, Math.round((H * ws) / W))
  const o = bandpass(downsample(lumO, W, H, ws, hs), ws, hs, 1, 6)
  const a = bandpass(downsample(lumA, W, H, ws, hs), ws, hs, 1, 6)

  const CELL = 40
  const gw = Math.max(1, Math.round(ws / CELL))
  const gh = Math.max(1, Math.round(hs / CELL))
  const R = 9
  const u = new Float32Array(gw * gh)
  const v = new Float32Array(gw * gh)
  const cw = ws / gw
  const ch = hs / gh

  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.round(gy * ch)
    const y1 = Math.round((gy + 1) * ch)
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.round(gx * cw)
      const x1 = Math.round((gx + 1) * cw)
      let bestCost = Infinity
      let bu = 0
      let bv = 0
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          let sum = 0
          let n = 0
          for (let y = y0; y < y1; y += 2) {
            const yy = y + dy
            if (yy < 0 || yy >= hs) continue
            const ro = y * ws
            const ra = yy * ws
            for (let x = x0; x < x1; x += 2) {
              const xx = x + dx
              if (xx < 0 || xx >= ws) continue
              const d = o[ro + x] - a[ra + xx]
              sum += d * d
              n++
            }
          }
          if (n < 16) continue
          // Regularización: ante empate, prefiere no moverse.
          const cost = sum / n + 0.0015 * (dx * dx + dy * dy)
          if (cost < bestCost) {
            bestCost = cost
            bu = dx
            bv = dy
          }
        }
      }
      u[gy * gw + gx] = bu
      v[gy * gw + gx] = bv
    }
  }

  median3(u, gw, gh) // fuera atípicos
  median3(v, gw, gh)
  const us = blur1(u, gw, gh, 1) // campo continuo, sin costuras
  const vs = blur1(v, gw, gh, 1)

  const k = W / ws
  let max = 0
  for (let i = 0; i < us.length; i++) {
    us[i] *= k
    vs[i] *= k
    const m = Math.hypot(us[i], vs[i])
    if (m > max) max = m
  }
  return { u: us, v: vs, gw, gh, max }
}

/** Deforma el resultado de la IA con el campo de flujo (bilineal). */
function warpByFlow(src: Uint8ClampedArray, W: number, H: number, fl: Flow): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = sampleGrid(fl.u, fl.gw, fl.gh, W, H, x, y)
      const v = sampleGrid(fl.v, fl.gw, fl.gh, W, H, x, y)
      const i = (y * W + x) * 4
      sampleRGBA(src, W, H, x + u, y + v, out, i)
    }
  }
  return out
}

// ===========================================================================
// CONFIANZA — correlación local de banda media, ya con el flujo aplicado
// ===========================================================================

function confidenceGrid(
  lumO: Float32Array,
  lumW: Float32Array,
  W: number,
  H: number
): ConfGrid {
  const ws = Math.min(W, 512)
  const hs = Math.max(8, Math.round((H * ws) / W))
  const o = bandpass(downsample(lumO, W, H, ws, hs), ws, hs, 1, 6)
  const a = bandpass(downsample(lumW, W, H, ws, hs), ws, hs, 1, 6)

  const CELL = 24
  const gw = Math.max(1, Math.round(ws / CELL))
  const gh = Math.max(1, Math.round(hs / CELL))
  const g = new Float32Array(gw * gh)
  const wg = new Float32Array(gw * gh)
  const cw = ws / gw
  const ch = hs / gh

  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.round(gy * ch)
    const y1 = Math.round((gy + 1) * ch)
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.round(gx * cw)
      const x1 = Math.round((gx + 1) * cw)
      let sa = 0
      let sb = 0
      let sab = 0
      let saa = 0
      let sbb = 0
      let n = 0
      for (let y = y0; y < y1; y++) {
        const r = y * ws
        for (let x = x0; x < x1; x++) {
          const p = o[r + x]
          const q = a[r + x]
          sa += p
          sb += q
          sab += p * q
          saa += p * p
          sbb += q * q
          n++
        }
      }
      if (n < 8) {
        g[gy * gw + gx] = 1
        continue
      }
      const cov = sab / n - (sa / n) * (sb / n)
      const va = saa / n - (sa / n) ** 2
      const vb = sbb / n - (sb / n) ** 2
      const den = Math.sqrt(Math.max(va, 1e-6) * Math.max(vb, 1e-6))
      const corr = den > 0 ? cov / den : 0

      // Curva recalibrada. La anterior exigía corr≥0.40 para dar ganancia
      // completa y castigaba correlaciones sanas; además su suelo de 0.35
      // dejaba pasar el 35% de un rasgo inventado. Medido en banco: −7.5
      // niveles de luminancia de contaminación estructural. Ahora el suelo es
      // 0.05 — donde hay estructura y la IA la contradice, no entra nada.
      const byCorr = 0.05 + 0.95 * clamp(corr / 0.25, 0, 1)

      // Y una corrección de fondo: en una zona LISA (mejilla suave, cielo,
      // fondo desenfocado) no hay estructura que correlacionar, así que la
      // correlación es ruido y hundía la confianza justo donde más falta hace
      // el poro. Si no hay estructura, no hay nada que la IA pueda
      // contradecir: se inyecta con confianza. El control solo manda donde
      // sí hay estructura que comparar.
      // MÁXIMO, no mínimo. El caso peligroso no es "los dos tienen estructura",
      // es "el original es liso y la IA se ha inventado un rasgo ahí". Con
      // mínimo esa celda se clasificaba como lisa y pasaba con confianza 0.95:
      // medido en banco, −7.5 niveles de contaminación estructural. Con máximo,
      // basta que UNA de las dos tenga estructura para que mande la correlación.
      const structure = Math.max(Math.sqrt(Math.max(va, 0)), Math.sqrt(Math.max(vb, 0)))
      const w = clamp((structure - 0.8) / 1.6, 0, 1)
      g[gy * gw + gx] = w * byCorr + (1 - w) * 0.95
      wg[gy * gw + gx] = w
    }
  }

  median3(g, gw, gh)
  return { g: blur1(g, gw, gh, 1), w: wg, gw, gh }
}

// ===========================================================================
// ACABADO ÓPTICO — las firmas de una cámara real
// ===========================================================================

/**
 * Aberración cromática lateral sub-píxel. El rojo se magnifica ligeramente y
 * el azul se contrae, como en cualquier objetivo real. Nula en el centro,
 * máxima en las esquinas (~1 px en una imagen de 2000 px).
 */
function applyAberration(d: Uint8ClampedArray, W: number, H: number, amount: number): void {
  const e = 0.0012 * amount
  if (e <= 0) return
  const src = unpackRGB(d, W * H)
  const cx = (W - 1) / 2
  const cy = (H - 1) / 2
  const kR = 1 - e
  const kB = 1 + e
  for (let y = 0; y < H; y++) {
    const dy = y - cy
    for (let x = 0; x < W; x++) {
      const dx = x - cx
      const i = (y * W + x) * 4
      d[i] = clamp255(sampleChannel(src, W, H, cx + dx * kR, cy + dy * kR, 0))
      d[i + 2] = clamp255(sampleChannel(src, W, H, cx + dx * kB, cy + dy * kB, 2))
    }
  }
}

/** Hombro de película: comprime las altas luces en lugar de cortarlas en seco. */
function applyShoulder(d: Uint8ClampedArray, N: number, amount: number): void {
  const s = 0.45 * amount
  if (s <= 0) return
  const KNEE = 188
  const SPAN = 255 - KNEE
  const NORM = 1 - Math.exp(-2.1)
  const lut = new Float32Array(256)
  for (let v = 0; v < 256; v++) {
    if (v <= KNEE) {
      lut[v] = v
    } else {
      const t = (v - KNEE) / SPAN
      const curved = (1 - Math.exp(-2.1 * t)) / NORM
      lut[v] = KNEE + SPAN * (t * (1 - s) + curved * s)
    }
  }
  for (let i = 0, p = 0; p < N; i += 4, p++) {
    d[i] = lut[d[i]]
    d[i + 1] = lut[d[i + 1]]
    d[i + 2] = lut[d[i + 2]]
  }
}

/** Caída de luz en esquinas. Sutil, nunca teatral. */
function applyVignette(d: Uint8ClampedArray, W: number, H: number, amount: number): void {
  const k = 0.16 * amount
  if (k <= 0) return
  const cx = (W - 1) / 2
  const cy = (H - 1) / 2
  const maxR2 = cx * cx + cy * cy || 1
  for (let y = 0; y < H; y++) {
    const dy = y - cy
    for (let x = 0; x < W; x++) {
      const dx = x - cx
      const r2 = (dx * dx + dy * dy) / maxR2
      const v = 1 - k * r2 * r2
      const i = (y * W + x) * 4
      d[i] = clamp255(d[i] * v)
      d[i + 1] = clamp255(d[i + 1] * v)
      d[i + 2] = clamp255(d[i + 2] * v)
    }
  }
}

/**
 * Grano fotográfico honesto:
 *  · agrupado (desenfoque de 1 px) — el grano real no es ruido por píxel;
 *  · peso parabólico sobre luminancia — nulo en negro puro y en luz quemada,
 *    máximo en medios tonos, exactamente como la película;
 *  · balance por canal — el azul granula más que el rojo.
 */
function applyGrain(
  d: Uint8ClampedArray,
  W: number,
  H: number,
  amount: number,
  seed: number
): void {
  // 4.0 y no 5.2: sobre vegetación o tejido ya muy detallado, el grano a 5.2
  // se lee como ruido en vez de como grano. En piel la diferencia no se nota.
  const strength = 4.0 * amount
  if (strength <= 0) return
  const N = W * H
  const rnd = mulberry32(seed >>> 0)
  const noise = new Float32Array(N)
  for (let p = 0; p < N; p++) noise[p] = rnd() * 2 - 1
  const clumped = blur1(noise, W, H, 1)

  let sq = 0
  for (let p = 0; p < N; p++) sq += clumped[p] * clumped[p]
  const k = strength / (Math.sqrt(sq / N) || 1)

  for (let i = 0, p = 0; p < N; i += 4, p++) {
    const L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
    const w = Math.pow(Math.max(0, 4 * L * (1 - L)), 0.55)
    const g = clumped[p] * k * w
    d[i] = clamp255(d[i] + g * 0.85)
    d[i + 1] = clamp255(d[i + 1] + g)
    d[i + 2] = clamp255(d[i + 2] + g * 1.25)
  }
}

/** Rejilla de ruido de valor — variación zonal de la densidad de poro. */
function valueNoiseGrid(W: number, H: number, cell: number, seed: number): Grid {
  const gw = Math.max(2, Math.ceil(W / cell))
  const gh = Math.max(2, Math.ceil(H / cell))
  const rnd = mulberry32(seed >>> 0)
  const g = new Float32Array(gw * gh)
  for (let i = 0; i < g.length; i++) g[i] = 0.78 + rnd() * 0.44 // 0.78–1.22
  return { g, gw, gh }
}

// ===========================================================================
// ENCAJE GLOBAL — búsqueda jerárquica sobre magnitud de gradiente
// ===========================================================================

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

  for (let s = best.scale - 0.024; s <= best.scale + 0.0241; s += 0.004) {
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

/** Coste = diferencia cuadrática media de gradientes con B desplazado (dx,dy). */
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

// ===========================================================================
// MUESTREO DE REJILLAS
// ===========================================================================

/** Bilineal sobre una rejilla de gw×gh que cubre la imagen W×H. */
function sampleGrid(
  g: Float32Array,
  gw: number,
  gh: number,
  W: number,
  H: number,
  x: number,
  y: number
): number {
  const fx = ((x + 0.5) * gw) / W - 0.5
  const fy = ((y + 0.5) * gh) / H - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const xa = x0 < 0 ? 0 : x0 > gw - 1 ? gw - 1 : x0
  const xb = x0 + 1 < 0 ? 0 : x0 + 1 > gw - 1 ? gw - 1 : x0 + 1
  const ya = y0 < 0 ? 0 : y0 > gh - 1 ? gh - 1 : y0
  const yb = y0 + 1 < 0 ? 0 : y0 + 1 > gh - 1 ? gh - 1 : y0 + 1
  const a = g[ya * gw + xa] * (1 - tx) + g[ya * gw + xb] * tx
  const b = g[yb * gw + xa] * (1 - tx) + g[yb * gw + xb] * tx
  return a * (1 - ty) + b * ty
}

/** Igual, pero con smoothstep — sin artefactos de rombo en el ruido de valor. */
function sampleGridSmooth(
  g: Float32Array,
  gw: number,
  gh: number,
  W: number,
  H: number,
  x: number,
  y: number
): number {
  const fx = ((x + 0.5) * gw) / W - 0.5
  const fy = ((y + 0.5) * gh) / H - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  let tx = fx - x0
  let ty = fy - y0
  tx = tx * tx * (3 - 2 * tx)
  ty = ty * ty * (3 - 2 * ty)
  const xa = x0 < 0 ? 0 : x0 > gw - 1 ? gw - 1 : x0
  const xb = x0 + 1 < 0 ? 0 : x0 + 1 > gw - 1 ? gw - 1 : x0 + 1
  const ya = y0 < 0 ? 0 : y0 > gh - 1 ? gh - 1 : y0
  const yb = y0 + 1 < 0 ? 0 : y0 + 1 > gh - 1 ? gh - 1 : y0 + 1
  const a = g[ya * gw + xa] * (1 - tx) + g[ya * gw + xb] * tx
  const b = g[yb * gw + xa] * (1 - tx) + g[yb * gw + xb] * tx
  return a * (1 - ty) + b * ty
}

/** Mediana 3×3 in-place — elimina bloques atípicos del campo de flujo. */
function median3(g: Float32Array, gw: number, gh: number): void {
  const src = g.slice()
  const buf: number[] = new Array(9)
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(gh - 1, Math.max(0, y + dy))
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(gw - 1, Math.max(0, x + dx))
          buf[n++] = src[yy * gw + xx]
        }
      }
      const arr = buf.slice(0, n).sort((a, b) => a - b)
      g[y * gw + x] = arr[arr.length >> 1]
    }
  }
}

// ===========================================================================
// UTILIDADES DE IMAGEN
// ===========================================================================

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    // crossOrigin SOLO para URLs remotas. En una cadena base64 no aporta nada
    // y en algunos navegadores hace fallar la carga: es una fuente conocida de
    // "error de galería" cuando todo el flujo trabaja con data URLs.
    if (/^https?:/i.test(src)) im.crossOrigin = 'anonymous'
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
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

/** Reduce por promediado de área — sin aliasing. */
function downsample(
  src: Float32Array,
  W: number,
  H: number,
  w2: number,
  h2: number
): Float32Array {
  const out = new Float32Array(w2 * h2)
  const sx = W / w2
  const sy = H / h2
  for (let y = 0; y < h2; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.max(y0 + 1, Math.min(H, Math.floor((y + 1) * sy)))
    for (let x = 0; x < w2; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.min(W, Math.floor((x + 1) * sx)))
      let s = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++) {
        const r = yy * W
        for (let xx = x0; xx < x1; xx++) {
          s += src[r + xx]
          n++
        }
      }
      out[y * w2 + x] = n > 0 ? s / n : 0
    }
  }
  return out
}

/** Banda media = blur(r1) − blur(r2). La estructura compartida. */
function bandpass(l: Float32Array, w: number, h: number, r1: number, r2: number): Float32Array {
  const a = blur1(l, w, h, r1)
  const b = blur1(l, w, h, r2)
  for (let i = 0; i < a.length; i++) a[i] -= b[i]
  return a
}

function sampleChannel(
  src: Float32Array,
  W: number,
  H: number,
  fx: number,
  fy: number,
  ch: number
): number {
  const x = clamp(fx, 0, W - 1.001)
  const y = clamp(fy, 0, H - 1.001)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const i00 = (y0 * W + x0) * 3 + ch
  const a = src[i00] * (1 - tx) + src[i00 + 3] * tx
  const i01 = i00 + W * 3
  const b = src[i01] * (1 - tx) + src[i01 + 3] * tx
  return a * (1 - ty) + b * ty
}

function sampleRGBA(
  src: Uint8ClampedArray,
  W: number,
  H: number,
  fx: number,
  fy: number,
  out: Uint8ClampedArray,
  oi: number
): void {
  const x = clamp(fx, 0, W - 1.001)
  const y = clamp(fy, 0, H - 1.001)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const i00 = (y0 * W + x0) * 4
  const i01 = i00 + W * 4
  for (let c = 0; c < 3; c++) {
    const a = src[i00 + c] * (1 - tx) + src[i00 + 4 + c] * tx
    const b = src[i01 + c] * (1 - tx) + src[i01 + 4 + c] * tx
    out[oi + c] = a * (1 - ty) + b * ty
  }
  out[oi + 3] = 255
}

/** Coeficiente de variación — dispersión relativa del detalle por la escena. */
function coefficientOfVariation(arr: Float32Array): number {
  const step = Math.max(1, Math.floor(arr.length / 60000))
  let n = 0
  let sum = 0
  let sq = 0
  for (let i = 0; i < arr.length; i += step) {
    const v = arr[i]
    sum += v
    sq += v * v
    n++
  }
  if (n === 0) return 0
  const mean = sum / n
  if (mean <= 1e-6) return 0
  return Math.sqrt(Math.max(0, sq / n - mean * mean)) / mean
}

// ===========================================================================
// DESENFOQUE — box blur separable, 3 pasadas ≈ gaussiana
// ===========================================================================

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

/**
 * Desenfoque RGB canal a canal — misma calidad que la versión empaquetada
 * pero con un tercio del buffer temporal. En imágenes grandes esa diferencia
 * es la que separa "funciona en el móvil" de "se queda sin memoria".
 */
function blurRGBFromBytes(
  src: Uint8ClampedArray,
  W: number,
  H: number,
  r: number
): Float32Array {
  const N = W * H
  const out = new Float32Array(N * 3)
  const ch = new Float32Array(N)
  const tmp = new Float32Array(N)
  for (let c = 0; c < 3; c++) {
    for (let i = 0, p = 0; p < N; i += 4, p++) ch[p] = src[i + c]
    for (let pass = 0; pass < 3; pass++) {
      axis1(ch, tmp, W, H, r, true)
      axis1(tmp, ch, W, H, r, false)
    }
    for (let p = 0; p < N; p++) out[p * 3 + c] = ch[p]
  }
  return out
}

// ===========================================================================

function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

// ===========================================================================
// Alias de compatibilidad con el código antiguo de la app.
// ===========================================================================
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
