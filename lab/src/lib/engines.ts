// Procesamiento real de imagen por motor — todo basado en luminancia,
// sin alterar el balance de color. Cada etapa acumula las anteriores.

export type StageId = 'source' | 'geo-lock' | 'atmosphere' | 'texture' | 'final'

const STAGE_ORDER: StageId[] = ['source', 'geo-lock', 'atmosphere', 'texture', 'final']

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('img decode'))
    img.src = dataUrl
  })
}

// Box blur separable por canal (RGB), O(n) por pasada.
function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length)
  const tmp = new Float32Array(src.length)
  const r = Math.max(1, Math.round(radius))
  const div = r * 2 + 1

  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sr = 0, sg = 0, sb = 0
    for (let i = -r; i <= r; i++) {
      const x = Math.min(w - 1, Math.max(0, i))
      const p = (row + x) * 4
      sr += src[p]; sg += src[p + 1]; sb += src[p + 2]
    }
    for (let x = 0; x < w; x++) {
      const p = (row + x) * 4
      tmp[p] = sr / div; tmp[p + 1] = sg / div; tmp[p + 2] = sb / div
      const xAdd = Math.min(w - 1, x + r + 1)
      const xSub = Math.max(0, x - r)
      const pa = (row + xAdd) * 4
      const ps = (row + xSub) * 4
      sr += src[pa] - src[ps]
      sg += src[pa + 1] - src[ps + 1]
      sb += src[pa + 2] - src[ps + 2]
    }
  }

  // vertical
  for (let x = 0; x < w; x++) {
    let sr = 0, sg = 0, sb = 0
    for (let i = -r; i <= r; i++) {
      const y = Math.min(h - 1, Math.max(0, i))
      const p = (y * w + x) * 4
      sr += tmp[p]; sg += tmp[p + 1]; sb += tmp[p + 2]
    }
    for (let y = 0; y < h; y++) {
      const p = (y * w + x) * 4
      out[p] = sr / div; out[p + 1] = sg / div; out[p + 2] = sb / div
      out[p + 3] = src[p + 3]
      const yAdd = Math.min(h - 1, y + r + 1)
      const ySub = Math.max(0, y - r)
      const pa = (yAdd * w + x) * 4
      const ps = (ySub * w + x) * 4
      sr += tmp[pa] - tmp[ps]
      sg += tmp[pa + 1] - tmp[ps + 1]
      sb += tmp[pa + 2] - tmp[ps + 2]
    }
  }
  return out
}

// GEO-LOCK: nitidez fina y limpia (unsharp mask sutil, sin halos).
// Objetivo Magnific: detalle real, no "crujiente".
function applyGeoLock(data: Uint8ClampedArray, w: number, h: number, k: number) {
  const blurred = boxBlur(data, w, h, 2)
  const amount = 0.3 * k // antes 0.85 — mucho más suave
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] + (data[i] - blurred[i]) * amount
    data[i + 1] = data[i + 1] + (data[i + 1] - blurred[i + 1]) * amount
    data[i + 2] = data[i + 2] + (data[i + 2] - blurred[i + 2]) * amount
  }
}

// ATMOSPHERE: bloom apenas perceptible + viñeta mínima.
// Se baja fuerte para evitar "sombras marcadas" que se ven irreales.
function applyAtmosphere(data: Uint8ClampedArray, w: number, h: number, k: number) {
  const mask = new Uint8ClampedArray(data.length)
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const v = Math.max(0, lum - 205) * 2.4 // umbral más alto, ganancia menor
    mask[i] = v; mask[i + 1] = v; mask[i + 2] = v; mask[i + 3] = 255
  }
  const glow = boxBlur(mask, w, h, Math.max(6, Math.round(w / 90)))
  const opacity = 0.12 * k // antes 0.4
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - ((255 - data[i]) * (255 - glow[i] * opacity)) / 255
    data[i + 1] = 255 - ((255 - data[i + 1]) * (255 - glow[i + 1] * opacity)) / 255
    data[i + 2] = 255 - ((255 - data[i + 2]) * (255 - glow[i + 2] * opacity)) / 255
  }
  // viñeta muy sutil (antes 0.22 → ahora 0.07)
  const cx = w / 2, cy = h / 2
  const maxD = Math.sqrt(cx * cx + cy * cy)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxD
      const f = 1 - 0.07 * k * d * d
      const p = (y * w + x) * 4
      data[p] *= f; data[p + 1] *= f; data[p + 2] *= f
    }
  }
}

// TEXTURE-BLEND: microtextura limpia. Contraste local suave + grano MUY fino
// limitado a medios tonos (para no ensuciar cielos ni sombras).
function applyTexture(data: Uint8ClampedArray, w: number, h: number, k: number) {
  const blurred = boxBlur(data, w, h, Math.max(12, Math.round(w / 45)))
  const amount = 0.1 * k // claridad suave (antes 0.3)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] + (data[i] - blurred[i]) * amount
    data[i + 1] = data[i + 1] + (data[i + 1] - blurred[i + 1]) * amount
    data[i + 2] = data[i + 2] + (data[i + 2] - blurred[i + 2]) * amount
  }
  // grano fílmico apenas visible (antes 12 → ahora 2.5) y con máscara de medios:
  // el cielo (altas luces) y las sombras quedan limpios, sin ruido.
  const strength = 2.5 * k
  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    const mid = 1 - Math.abs(lum - 0.5) * 2 // 1 en medios, 0 en extremos
    const n = (Math.random() - 0.5) * strength * mid * mid
    data[i] += n; data[i + 1] += n; data[i + 2] += n
  }
}

// FINAL: contraste suave + pulido mínimo. Nada de curva S dura.
function applyFinal(data: Uint8ClampedArray, w: number, h: number, k: number) {
  const lut = new Uint8ClampedArray(256)
  const mix = Math.min(0.18, 0.1 * k) // antes hasta 0.55 — mucho más plano/natural
  for (let i = 0; i < 256; i++) {
    const x = i / 255
    const s = x * x * (3 - 2 * x) // smoothstep
    lut[i] = Math.round((x * (1 - mix) + s * mix) * 255)
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]]
    data[i + 1] = lut[data[i + 1]]
    data[i + 2] = lut[data[i + 2]]
  }
  const blurred = boxBlur(data, w, h, 1)
  const amount = 0.12 * k // pulido final sutil (antes 0.35)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] + (data[i] - blurred[i]) * amount
    data[i + 1] = data[i + 1] + (data[i + 1] - blurred[i + 1]) * amount
    data[i + 2] = data[i + 2] + (data[i + 2] - blurred[i + 2]) * amount
  }
}

/**
 * Procesa la imagen acumulando los motores hasta la etapa dada.
 * 'source' devuelve la original tal cual.
 */
export async function processImage(dataUrl: string, stage: StageId, intensity = 1): Promise<string> {
  const idx = STAGE_ORDER.indexOf(stage)
  if (idx <= 0) return dataUrl

  const img = await loadImage(dataUrl)
  const MAX = 1080
  let w = img.width, h = img.height
  if (w > MAX || h > MAX) {
    const scale = MAX / Math.max(w, h)
    w = Math.round(w * scale); h = Math.round(h * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  const k = intensity
  if (idx >= 1) applyGeoLock(data, w, h, k)
  if (idx >= 2) applyAtmosphere(data, w, h, k)
  if (idx >= 3) applyTexture(data, w, h, k)
  if (idx >= 4) applyFinal(data, w, h, k)

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.9)
}
