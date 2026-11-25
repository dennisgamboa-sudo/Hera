/**
 * ============================================================================
 * HERA SKIN LAB — types + prompts v5.0
 * ============================================================================
 *
 * REGLAS DE PROMPT QUE NO SE ROMPEN (cada una se rompió antes y arruinó la foto):
 *
 *  1. PROHIBIDO: "8k", "hyper-realistic", "ultra detailed", "masterpiece".
 *     Los modelos los interpretan como "perfección digital" → piel de plástico.
 *
 *  2. PROHIBIDO: prompts de iluminación (golden hour, neon, moody, studio...).
 *     Le piden a la IA CAMBIAR la luz. Esa diferencia entra en el delta del
 *     injerto y ensucia toda la foto. La luz viene del original, siempre.
 *
 *  3. PROHIBIDO: apilar prompts (fidelidad + preset + iluminación).
 *     Cuanto más largo, más se aleja el modelo del encuadre. UNO solo.
 *
 *  4. El prompt es INSTRUCCIÓN DE EDICIÓN sobre la referencia, no descripción
 *     de una foto nueva. Nano Banana respeta el encuadre en imperativo.
 *
 *  5. Vocabulario de imperfección real, no de calidad abstracta.
 *
 * ELIMINADO respecto a v3: LIGHTING_PRESETS, sharpness, recommendation.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// PROMPTS
// ---------------------------------------------------------------------------

export type PresetId = 'skin' | 'raw' | 'universal'

export interface TexturePreset {
  id: PresetId
  label: string
  hint: string
  icon: string
  /** Valores recomendados para el motor de injerto */
  intensity: number
  clarity: number
  /** Acabado de cámara: grano, hombro, aberración, viñeteo, esquinas */
  optical: number
  prompt: string
}

/** Ancla de encuadre. Corta y en imperativo — se antepone a todos los presets. */
const FRAME_LOCK =
  'Keep the exact same framing, crop, camera distance, pose and lighting as the reference. Do not zoom, do not recompose, do not change the face.'

export const PRESETS: TexturePreset[] = [
  {
    id: 'skin',
    label: 'Piel Real',
    hint: 'El equilibrio de los mejores resultados',
    icon: 'face',
    intensity: 0.85,
    clarity: 0.25,
    optical: 0.55,
    prompt:
      `${FRAME_LOCK} Re-render the skin with real photographic texture: visible pores, ` +
      `fine vellus hair, freckles and moles, uneven skin tone, natural sebaceous sheen, ` +
      `subtle blemishes. Unretouched editorial photograph on medium format film.`,
  },
  {
    id: 'raw',
    label: 'Macro RAW',
    hint: 'Detalle dermatológico marcado',
    icon: 'blur_on',
    intensity: 1.05,
    clarity: 0.3,
    optical: 0.65,
    prompt:
      `${FRAME_LOCK} Skin texture macro photography quality: deep open pores, ` +
      `individual vellus hairs, dermal micro-relief, freckles, capillaries, ` +
      `dry skin flakes on lips, stubble follicles. Unretouched analog film grain, ` +
      `no smoothing, no beauty retouch.`,
  },
  {
    id: 'universal',
    label: 'Universal',
    hint: 'Paisaje, objeto, tejido, producto',
    icon: 'texture',
    intensity: 0.8,
    clarity: 0.28,
    optical: 0.45,
    prompt:
      `${FRAME_LOCK} Re-render every surface with authentic material micro-texture: ` +
      `fibre, grain, scratches, dust, weave and imperfection appropriate to each material. ` +
      `Sharp analog photograph, natural film grain, no digital smoothing.`,
  },
]

/** Si tu SDK no acepta negativos, ya están neutralizados por omisión arriba. */
export const NEGATIVE_PROMPT =
  'plastic skin, airbrushed, waxy, smooth skin, beauty filter, 3d render, cgi, ' +
  'soft focus, blurry, different face, different pose, different crop, zoomed in, ' +
  'oversaturated, hdr look'

/** Construye el prompt final. UNO solo. Sin capas. */
export function buildPrompt(preset: TexturePreset, userNote?: string): string {
  const note = userNote?.trim()
  return note ? `${preset.prompt} ${note}` : preset.prompt
}

/** Aspect ratio del original — que la IA genere en la MISMA proporción. */
export function aspectRatioOf(
  width: number,
  height: number
): '1:1' | '16:9' | '9:16' | '4:3' | '3:4' {
  const r = width / height
  if (r > 1.55) return '16:9'
  if (r > 1.15) return '4:3'
  if (r < 0.64) return '9:16'
  if (r < 0.87) return '3:4'
  return '1:1'
}

// ---------------------------------------------------------------------------
// TIPOS DE APP
// ---------------------------------------------------------------------------

export type BananaModel = '🍌 Nano Banana Pro' | '🍌 Nano Banana 2'

export const MODELS: BananaModel[] = ['🍌 Nano Banana Pro', '🍌 Nano Banana 2']

export type ProcessingStep =
  | 'Generando textura'
  | 'Cargando imágenes'
  | 'Alineando estructura'
  | 'Extrayendo micro-textura'
  | 'Verificando fidelidad por zonas'
  | 'Injertando en la foto real'
  | 'Corrigiendo deriva local'
  | 'Reconstruyendo anatomía'
  | 'Acabado de cámara'

export interface SourceImage {
  base64: string
  mimeType: string
  mediaId: string
}

export interface ComparisonState {
  active: boolean
  imageA: string | null
  imageB: string | null
  labelA: string
  labelB: string
}

export interface AppState {
  original: SourceImage | null
  processed: string | null
  mask: string | null
  maskHistory: string[]
  memorySlots: (string | null)[]
  comparison: ComparisonState
  isProcessing: boolean
  structureRepair: boolean
  error: string | null
  selectedModel: BananaModel
}
