import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Loader2, X, Eye, Sparkles, Wand2, Download } from 'lucide-react'
import { Button } from './ui/button'
import { callDiffusionAPI, checkDiffusionAPI, saveDiffusionImage, BUILD_TAG, MAGNIFIC_PRESETS, DiffusionParams } from '../lib/diffusion'

interface DiffusionProcessorProps {
  sourceImage: string
  onSuccess: (resultUrl: string) => void
  onClose: () => void
}

type PresetKey = keyof typeof MAGNIFIC_PRESETS

export function DiffusionProcessor({ sourceImage, onSuccess, onClose }: DiffusionProcessorProps) {
  const [preset, setPreset] = useState<PresetKey>('balanced')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compare, setCompare] = useState(false)
  const [progress, setProgress] = useState(0)
  const [health, setHealth] = useState<{ ok: boolean; verdict: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = async () => {
    if (!result || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveDiffusionImage(result)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  // Auto-diagnóstico al abrir: comprueba key y conexión con Replicate (sin coste).
  useEffect(() => {
    let cancelled = false
    checkDiffusionAPI().then((h) => {
      if (!cancelled) setHealth(h)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const run = async () => {
    setProcessing(true)
    setError(null)
    setResult(null)
    setProgress(0)

    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) clearInterval(progressInterval)
        return Math.min(p + Math.random() * 12, 92)
      })
    }, 2200)

    const { label: _l, hint: _h, ...params } = MAGNIFIC_PRESETS[preset]
    try {
      const resultUrl = await callDiffusionAPI(sourceImage, params as DiffusionParams)
      clearInterval(progressInterval)
      setProgress(100)
      setResult(resultUrl)
    } catch (err) {
      clearInterval(progressInterval)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setProgress(0)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="max-w-2xl mx-auto p-4 md:p-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold tracking-[0.2em] uppercase flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" /> Realismo de Piel
          </h2>
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-gray-500 font-mono mb-3 -mt-2">
          Motor: Clarity Upscaler · estilo Magnific "Sharpy" — reconstruye poros y micro-textura por difusión
        </p>

        {/* Estado de conexión IA (auto-diagnóstico) */}
        <div
          className={`mb-5 px-4 py-2.5 rounded-xl border text-[11px] font-mono leading-relaxed flex items-start gap-2 ${
            health === null
              ? 'bg-white/5 border-white/10 text-gray-500'
              : health.ok
                ? 'bg-green-500/10 border-green-500/25 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}
        >
          <span className="shrink-0 mt-0.5">
            {health === null ? '…' : health.ok ? '✅' : '⛔'}
          </span>
          <span className="break-words">
            {health === null ? 'Comprobando conexión IA…' : health.verdict}{' '}
            <span className="opacity-50">· build {BUILD_TAG}</span>
          </span>
        </div>

        <div className="space-y-6">
          {/* Imagen de entrada */}
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-3">
              Imagen base (FINAL stage)
            </p>
            <div className="relative aspect-video bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center">
              <img src={sourceImage} alt="Source" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Selector de preset — solo antes de procesar y sin resultado */}
          {!processing && !result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 mb-3">
                  Intensidad del realismo
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(MAGNIFIC_PRESETS) as PresetKey[]).map((k) => {
                    const p = MAGNIFIC_PRESETS[k]
                    const on = preset === k
                    return (
                      <button
                        key={k}
                        onClick={() => setPreset(k)}
                        className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                          on
                            ? 'bg-purple-500/15 border-purple-500/50'
                            : 'bg-white/5 border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className={`text-[11px] font-bold tracking-wider uppercase ${on ? 'text-purple-300' : 'text-white'}`}>
                          {p.label}
                        </div>
                        <div className="text-[9px] text-gray-500 leading-tight mt-1">{p.hint}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Parámetros del preset elegido */}
              <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                <div className="bg-black/40 rounded-lg px-2 py-2 text-center">
                  <div className="text-gray-500">Creativity</div>
                  <div className="text-white">{MAGNIFIC_PRESETS[preset].creativity}</div>
                </div>
                <div className="bg-black/40 rounded-lg px-2 py-2 text-center">
                  <div className="text-gray-500">Resembl.</div>
                  <div className="text-white">{MAGNIFIC_PRESETS[preset].resemblance}</div>
                </div>
                <div className="bg-black/40 rounded-lg px-2 py-2 text-center">
                  <div className="text-gray-500">HDR</div>
                  <div className="text-white">{MAGNIFIC_PRESETS[preset].dynamic}</div>
                </div>
                <div className="bg-black/40 rounded-lg px-2 py-2 text-center">
                  <div className="text-gray-500">Scale</div>
                  <div className="text-white">{MAGNIFIC_PRESETS[preset].scaleFactor}x</div>
                </div>
              </div>

              <Button
                onClick={run}
                className="w-full h-13 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 font-bold rounded-2xl"
              >
                <Wand2 className="w-4 h-4 mr-2" /> GENERAR REALISMO
              </Button>
              <p className="text-[10px] text-gray-600 text-center">
                Tarda ~30–60s · coste aprox. $0.015 por imagen
              </p>
            </motion.div>
          )}

          {/* Procesamiento */}
          {processing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl text-center space-y-4"
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                <p className="text-sm font-mono tracking-widest uppercase text-purple-300">Procesando...</p>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                El modelo de difusión está reconstruyendo <span className="font-bold">poros</span>,{' '}
                <span className="font-bold">micro-texturas</span> e{' '}
                <span className="font-bold">imperfecciones naturales</span>
              </p>
              <div className="pt-2">
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-2 font-mono">{Math.round(progress)}%</p>
              </div>
              <p className="text-[10px] text-gray-600 pt-1">Tiempo estimado: 30–60 segundos</p>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-3"
            >
              <p className="text-[12px] font-bold text-red-300">⚠️ Error en procesamiento</p>
              <p className="text-[12px] text-red-100 font-mono break-words bg-black/40 rounded-lg p-3 leading-relaxed">{error}</p>
              <div className="text-[10px] text-gray-400 space-y-1">
                <p><span className="font-bold">Pista según el código:</span></p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li><b>401/403</b> → la API key es inválida o está desactivada</li>
                  <li><b>402</b> → falta saldo/tarjeta en Replicate</li>
                  <li><b>422</b> → parámetro no aceptado por el modelo</li>
                  <li><b>500</b> → falta la variable REPLICATE_API_KEY en Vercel</li>
                </ul>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={run} className="text-[10px]">Reintentar</Button>
                <Button size="sm" variant="secondary" onClick={onClose} className="text-[10px]">Cancelar</Button>
              </div>
            </motion.div>
          )}

          {/* Resultado */}
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="text-[11px] font-bold tracking-widest uppercase text-green-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Procesamiento completado
              </div>

              <div>
                <div className="relative aspect-video bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center">
                  <motion.img
                    key={compare ? 'source' : 'result'}
                    src={compare ? sourceImage : result}
                    alt={compare ? 'Original' : 'Result'}
                    className="w-full h-full object-contain"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                  <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-mono tracking-widest uppercase text-white/80 border border-white/20">
                    {compare ? '👁 ORIGINAL' : '✨ MEJORADO'}
                  </div>
                </div>
                <button
                  onPointerDown={() => setCompare(true)}
                  onPointerUp={() => setCompare(false)}
                  onPointerLeave={() => setCompare(false)}
                  className="w-full mt-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-mono tracking-wider uppercase text-gray-400 cursor-pointer transition-all select-none"
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1" />
                  Mantén pulsado para comparar
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={save}
                  disabled={saving}
                  className="w-full h-12 bg-white text-black hover:bg-gray-200 font-bold rounded-xl"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparando JPG…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" /> GUARDAR IMAGEN (JPG máx. calidad)
                    </>
                  )}
                </Button>
                {saveError && (
                  <p className="text-[10px] text-red-300 text-center font-mono">{saveError}</p>
                )}
                <Button
                  onClick={() => onSuccess(result)}
                  className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 font-bold rounded-xl"
                >
                  Usar este resultado
                </Button>
                <Button
                  onClick={() => { setResult(null); setCompare(false) }}
                  variant="secondary"
                  className="w-full h-10 bg-white/10 text-white hover:bg-white/20 rounded-xl"
                >
                  Probar otra intensidad
                </Button>
              </div>
              <p className="text-[10px] text-gray-500 text-center pt-1">
                "Usar este resultado" lo añade al feed como nuevo post
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
