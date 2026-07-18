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
}

/** Presets tipo Magnific listos para usar.
 *  Calibración anti-deriva: creativity baja + resemblance alta = misma cara,
 *  misma luz, solo gana micro-textura. dynamic bajo evita el look HDR "de IA". */
export const MAGNIFIC_PRESETS: Record<string, DiffusionParams & { label: string; hint: string }> = {
  subtle: { label: 'SUTIL', hint: 'Idéntica a la original, piel afinada', creativity: 0.1, resemblance: 1.6, dynamic: 3, scaleFactor: 2 },
  balanced: { label: 'EQUILIBRADO', hint: 'Fiel + textura real (recomendado)', creativity: 0.18, resemblance: 1.5, dynamic: 4, scaleFactor: 2 },
  strong: { label: 'FUERTE', hint: 'Más detalle · puede alterar rasgos', creativity: 0.3, resemblance: 1.3, dynamic: 6, scaleFactor: 2 },
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
 * Procesa la imagen con el modelo de difusión.
 * Arranca la predicción y hace polling al estado hasta terminar.
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
  for (let i = 0; i < 90; i++) {
    await sleep(2000)
    const statusRes = await fetch(`/api/diffuse-status?id=${encodeURIComponent(id)}`)
    if (!statusRes.ok) continue
    const data = await statusRes.json()
    if (data.status === 'succeeded' && data.resultUrl) return data.resultUrl as string
    if (data.status === 'failed') throw new Error(data.error || 'Diffusion processing failed')
    if (data.status === 'canceled') throw new Error('Prediction was canceled')
  }
  throw new Error('Processing timeout (exceeded 3 minutes)')
}

/**
 * Guardar la imagen resultante en máxima calidad.
 * Convierte el PNG remoto a JPG 95% a resolución completa y lo entrega con
 * el menú nativo de compartir en iOS ("Guardar imagen") o descarga directa
 * en escritorio. Un solo toque — sin "guardar como".
 */
export async function saveDiffusionImage(resultUrl: string, filename = 'hera-realismo.jpg'): Promise<void> {
  const response = await fetch(resultUrl)
  if (!response.ok) throw new Error('No se pudo descargar la imagen del servidor')
  const sourceBlob = await response.blob()

  // Re-encodar a JPG de alta calidad a resolución completa (mejor para Instagram).
  const bitmap = await createImageBitmap(sourceBlob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo convertir a JPG'))), 'image/jpeg', 0.95)
  })

  const file = new File([jpegBlob], filename, { type: 'image/jpeg' })

  // iOS/Android: hoja nativa de compartir → "Guardar imagen" va directo a Fotos.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
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
