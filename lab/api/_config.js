// Receta compartida "Sharpy / Portrait" — realismo de piel estilo Magnific.
// Usada por el server Express local (server/server.js).
//
// IMPORTANTE: clarity-upscaler es un modelo COMUNITARIO de Replicate. El
// endpoint /v1/models/{owner}/{model}/predictions solo funciona para modelos
// oficiales — para los comunitarios hay que usar /v1/predictions con el hash
// de versión (si no, Replicate devuelve 404).
export const MODEL_URL = 'https://api.replicate.com/v1/models/philz1337x/clarity-upscaler'
export const PREDICTIONS_URL = 'https://api.replicate.com/v1/predictions'
export const FALLBACK_VERSION = 'dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e'

export const MAGNIFIC_STYLE = {
  prompt:
    'masterpiece, best quality, highres, raw photo, realistic skin texture, visible pores, fine facial hair, natural skin imperfections, sharp focus, 8k, professional photography',
  negative_prompt:
    '(worst quality, low quality, normal quality:2), plastic skin, smooth skin, airbrushed, waxy, blurry, 3d render, cgi, illustration, painting, cartoon, oversaturated',
  scale_factor: 2,
  dynamic: 6,
  creativity: 0.3,
  resemblance: 1.2,
  sharpen: 0,
  num_inference_steps: 18,
}

/** Construye el objeto `input` de Replicate fusionando la receta con overrides del cliente. */
export function buildInput(body) {
  const { imageDataUrl, creativity, resemblance, dynamic, scaleFactor, prompt, negativePrompt } = body || {}
  return {
    image: imageDataUrl,
    prompt: prompt || MAGNIFIC_STYLE.prompt,
    negative_prompt: negativePrompt || MAGNIFIC_STYLE.negative_prompt,
    scale_factor: scaleFactor ?? MAGNIFIC_STYLE.scale_factor,
    dynamic: dynamic ?? MAGNIFIC_STYLE.dynamic,
    creativity: creativity ?? MAGNIFIC_STYLE.creativity,
    resemblance: resemblance ?? MAGNIFIC_STYLE.resemblance,
    sharpen: MAGNIFIC_STYLE.sharpen,
    num_inference_steps: MAGNIFIC_STYLE.num_inference_steps,
    output_format: 'jpg',
  }
}

let cachedVersion = null
/** Resuelve la última versión del modelo (GET gratuito); cae al hash conocido si falla. */
export async function resolveModelVersion(key) {
  if (cachedVersion) return cachedVersion
  try {
    const r = await fetch(MODEL_URL, { headers: { Authorization: `Bearer ${key}` } })
    if (r.ok) {
      const m = await r.json().catch(() => ({}))
      if (m.latest_version && m.latest_version.id) {
        cachedVersion = m.latest_version.id
        return cachedVersion
      }
    }
  } catch {}
  return FALLBACK_VERSION
}
