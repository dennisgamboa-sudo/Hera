/** Etiqueta visible de versión — sube el número en cada cambio para poder
 *  verificar de un vistazo qué build está desplegado. */
export const BUILD_TAG = 'v2.2'

export interface DiffusionResponse {
  resultUrl: string
}

/** Parámetros estilo Magnific ("Sharpy"). Todos opcionales — el server tiene defaults. */
export interface DiffusionParams {
  creativity?: number // 0–1  · bajo = fiel, alto = inventa detalle
  resemblance?: number // 0–3 · alto = pega al original
  dynamic?: number // 1–50 · HDR
  scaleFactor?: 2 | 4
  prompt?: string
  negativePrompt?: string
  /** 0–1 · cuánta micro-textura de la IA se injerta sobre la foto ORIGINAL (cliente). */
  textureStrength?: number
}

/** Presets tipo Magnific.
 *  ARQUITECTURA "INJERTO": la IA genera una versión con micro-textura rica,
 *  pero NO usamos su imagen — solo extraemos su detalle fino (alta frecuencia)
 *  y lo injertamos sobre los píxeles ORIGINALES. La cara, la luz y el grano
 *  de la foto original quedan intactos por construcción: es matemáticamente
 *  imposible que cambie la identidad. textureStrength controla el injerto. */
export const MAGNIFIC_PRESETS: Record<string, DiffusionParams & { label: string; hint: string }> = {
  subtle: { label: 'SUTIL', hint: 'Textura ligera · cara 100% intacta', creativity: 0.3, resemblance: 1.3, dynamic: 4, scaleFactor: 2, textureStrength: 0.5 },
  balanced: { label: 'EQUILIBRADO', hint: 'Poros y definición real (recomendado)', creativity: 0.3, resemblance: 1.3, dynamic: 4, scaleFactor: 2, textureStrength: 0.8 },
  strong: { label: 'FUERTE', hint: 'Máxima textura · cara 100% intacta', creativity: 0.35, resemblance: 1.2, dynamic: 5, scaleFactor: 2, textureStrength: 1.1 },
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Auto-test de conexión: ¿está la key en el servidor y es válida? (GET, sin coste) */
export async function checkDiffusionAPI(): Promise<{ ok: boolean; verdict: string }> {
  try {
    const r = await fetch('/api/diffuse-start')
    if (!r.ok) return { ok: false, verdict: `El endpoint /api no responde (HTTP ${r.status}).` }
    const data = await r.json()
    if (typeof data.ok === 'boolean') return data
    return { ok: false, verdict: 'Respuesta inesperada del servidor.' }
  } catch (e) {
    return { ok: false, verdict: 'No se pudo contactar al servidor /api.' }
  }
}

/**
 * Procesa la imagen con el modelo de difusión y luego INJERTA solo la
 * micro-textura del resultado sobre la foto original (ver graftTexture).
 * Devuelve un data-URL JPG listo para mostrar y guardar.
 */
export async function callDiffusionAPI(imageDataUrl: string, params: DiffusionParams = {}): Promise<string> {
  // 1) Arrancar la predicción
  const startRes = await fetch('/api/diffuse-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, ...params }),
  })
  const startData = await startRes.json().catch(() => ({}))
  // El servidor devuelve el error REAL de Replicate en el campo `error`.
  if (startData.error) throw new Error(startData.error)
  if (!startRes.ok) throw new Error(`API error: ${startRes.status}`)
  const id = startData.id
  if (!id) throw new Error('El servidor no devolvió id de predicción')

  // 2) Polling del estado (hasta ~3 min)
  let remoteUrl: string | null = null
  for (let i = 0; i < 90; i++) {
    await sleep(2000)
    const statusRes = await fetch(`/api/diffuse-status?id=${encodeURIComponent(id)}`)
    if (!statusRes.ok) continue
    const data = await statusRes.json()
    if (data.status === 'succeeded' && data.resultUrl) {
      remoteUrl = data.resultUrl as string
      break
    }
    if (data.status === 'failed') throw new Error(data.error || 'Diffusion processing failed')
    if (data.status === 'canceled') throw new Error('Prediction was canceled')
  }
  if (!remoteUrl) throw new Error('Processing timeout (exceeded 3 minutes)')

  // 3) Injerto de textura: identidad garantizada. NUNCA devolvemos la imagen
  //    cruda de la IA (repinta la cara) — si el injerto falla, es un error.
  const strength = params.textureStrength ?? 0.8
  return graftTexture(imageDataUrl, remoteUrl, strength)
}

/**
 * INJERTO DE MICRO-TEXTURA (frequency graft, técnica de retoque editorial):
 *   salida = original + strength × (resultadoIA − blur(resultadoIA))
 * La estructura, el color, la luz y la CARA vienen al 100% de la original;
 * de la IA solo se toma el detalle de alta frecuencia (poros, pestañas,
 * tejido, hierba). Así se obtiene el "detalle Magnific" sin cambiar la persona.
 */
async function graftTexture(originalDataUrl: string, resultUrl: string, strength: number): Promise<string> {
  const [origBmp, resBmp] = await Promise.all([loadBitmap(originalDataUrl), loadBitmap(resultUrl)])

  // El modelo puede devolver RELLENO negro (padding de tiles) abajo/derecha.
  // 1) Detectamos la caja real de contenido escaneando filas/columnas negras.
  // 2) El lienzo final SIEMPRE tiene el aspecto de la ORIGINAL, y el contenido
  //    del resultado se mapea entero sobre él (si vino comprimido, se restaura).
  const content = detectContentBox(resBmp)
  const srcW = content.w
  const srcH = content.h

  let W = srcW
  let H = Math.round(srcW / (origBmp.width / origBmp.height))
  const MAX_PIXELS = 8_000_000
  if (W * H > MAX_PIXELS) {
    const k = Math.sqrt(MAX_PIXELS / (W * H))
    W = Math.round(W * k)
    H = Math.round(H * k)
  }

  const draw = (bmp: ImageBitmap, cropW: number, cropH: number) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, cropW, cropH, 0, 0, W, H)
    return { canvas: c, ctx, data: ctx.getImageData(0, 0, W, H) }
  }

  const orig = draw(origBmp, origBmp.width, origBmp.height)
  const res = draw(resBmp, srcW, srcH)
  origBmp.close()
  resBmp.close()

  // Blur del resultado (3 pasadas de box blur ≈ gaussiana) para aislar la alta frecuencia.
  const radius = Math.max(3, Math.round(W / 550))
  const blurred = boxBlurRGB(res.data.data, W, H, radius)

  const o = orig.data.data
  const r = res.data.data
  const n = W * H * 4
  // SOFT-CLIP: deja pasar la micro-textura (amplitud baja: poros, grano) y
  // bloquea los trazos estructurales (amplitud alta: cejas, bordes, líneas).
  // Así el injerto NUNCA dibuja rasgos — solo aporta piel.
  const T = 8
  for (let i = 0; i < n; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = r[i + c] - blurred[i + c]
      o[i + c] = o[i + c] + strength * (d / (1 + Math.abs(d) / T))
    }
    // alpha se queda como está
  }
  orig.ctx.putImageData(orig.data, 0, 0)
  return orig.canvas.toDataURL('image/jpeg', 0.95)
}

/**
 * Detecta la caja real de contenido del resultado: escanea (a baja resolución)
 * filas desde abajo y columnas desde la derecha que sean uniformemente negras
 * (relleno del modelo) y devuelve el ancho/alto útiles en píxeles del bitmap.
 */
function detectContentBox(bmp: ImageBitmap): { w: number; h: number } {
  const SAMPLE = 160
  const sw = SAMPLE
  const sh = Math.max(16, Math.round((bmp.height / bmp.width) * SAMPLE))
  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, sw, sh)
  const d = ctx.getImageData(0, 0, sw, sh).data
  const BLACK = 12 // umbral: por debajo es relleno, el grano real supera esto

  const rowIsBlack = (y: number) => {
    for (let x = 0; x < sw; x += 2) {
      const i = (y * sw + x) * 4
      if (d[i] > BLACK || d[i + 1] > BLACK || d[i + 2] > BLACK) return false
    }
    return true
  }
  const colIsBlack = (x: number) => {
    for (let y = 0; y < sh; y += 2) {
      const i = (y * sw + x) * 4
      if (d[i] > BLACK || d[i + 1] > BLACK || d[i + 2] > BLACK) return false
    }
    return true
  }

  let bottom = sh
  while (bottom > sh * 0.5 && rowIsBlack(bottom - 1)) bottom--
  let right = sw
  while (right > sw * 0.5 && colIsBlack(right - 1)) right--

  return {
    w: Math.round((right / sw) * bmp.width),
    h: Math.round((bottom / sh) * bmp.height),
  }
}

async function loadBitmap(url: string): Promise<ImageBitmap> {
  // Las URLs remotas (replicate.delivery) se sirven vía nuestro proxy /api
  // para esquivar CORS; si el proxy falla, intentamos el CDN directo.
  const candidates = /^https?:/i.test(url)
    ? [`/api/fetch-image?url=${encodeURIComponent(url)}`, url]
    : [url]
  let lastErr: unknown = null
  for (const u of candidates) {
    try {
      const r = await fetch(u)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const blob = await r.blob()
      return await createImageBitmap(blob)
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(`No se pudo cargar la imagen para el injerto (${lastErr instanceof Error ? lastErr.message : 'error'})`)
}

/** Box blur separable (3 iteraciones ≈ gaussiana), solo canales RGB. */
function boxBlurRGB(src: Uint8ClampedArray, W: number, H: number, radius: number): Float32Array {
  let a = new Float32Array(W * H * 3)
  for (let i = 0, j = 0; j < a.length; i += 4, j += 3) {
    a[j] = src[i]
    a[j + 1] = src[i + 1]
    a[j + 2] = src[i + 2]
  }
  let b = new Float32Array(a.length)
  for (let pass = 0; pass < 3; pass++) {
    blurAxis(a, b, W, H, radius, true)
    blurAxis(b, a, W, H, radius, false)
  }
  return a
}

function blurAxis(src: Float32Array, dst: Float32Array, W: number, H: number, radius: number, horizontal: boolean) {
  const len = horizontal ? W : H
  const lines = horizontal ? H : W
  const stridePx = horizontal ? 1 : W
  const lineStartPx = horizontal ? W : 1
  const win = radius * 2 + 1
  for (let line = 0; line < lines; line++) {
    const base = line * lineStartPx
    for (let ch = 0; ch < 3; ch++) {
      // suma inicial con borde extendido (clamp)
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const idx = base + Math.min(len - 1, Math.max(0, k)) * stridePx
        sum += src[idx * 3 + ch]
      }
      for (let p = 0; p < len; p++) {
        dst[(base + p * stridePx) * 3 + ch] = sum / win
        const addP = Math.min(len - 1, p + radius + 1)
        const subP = Math.max(0, p - radius)
        sum += src[(base + addP * stridePx) * 3 + ch] - src[(base + subP * stridePx) * 3 + ch]
      }
    }
  }
}

/**
 * Guardar la imagen resultante en máxima calidad.
 * Convierte a JPG 95% a resolución completa y lo entrega con el menú nativo
 * de compartir en iOS ("Guardar imagen") o descarga directa en escritorio.
 */
export async function saveDiffusionImage(resultUrl: string, filename = 'hera-realismo.jpg'): Promise<void> {
  const response = await fetch(resultUrl)
  if (!response.ok) throw new Error('No se pudo descargar la imagen del servidor')
  const sourceBlob = await response.blob()

  let jpegBlob: Blob
  if (sourceBlob.type === 'image/jpeg') {
    jpegBlob = sourceBlob
  } else {
    const bitmap = await createImageBitmap(sourceBlob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo convertir a JPG'))), 'image/jpeg', 0.95)
    })
  }

  const file = new File([jpegBlob], filename, { type: 'image/jpeg' })

  // SOLO en móvil/tablet: hoja nativa de compartir → "Guardar imagen" va a Fotos.
  // En escritorio (Mac/PC) la hoja no permite descargar → descarga directa clásica.
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent))
  if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      // Usuario canceló la hoja → no es error; cualquier otro fallo → descarga clásica.
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(jpegBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
