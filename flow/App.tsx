/**
 * ============================================================================
 * HERA SKIN LAB — App v4.0
 * ============================================================================
 * Versión SIMPLIFICADA a propósito. Se ha quitado todo lo que degradaba la
 * imagen y se ha dejado únicamente lo que produce el resultado bueno:
 *
 *   FUERA → presets de iluminación, slider de "nitidez/sharpness",
 *           panel de análisis con valores "ideales", prompts apilados.
 *   DENTRO → 3 presets de textura, intensidad, contraste local (clarity),
 *            motor de injerto v4 con alineación, slots de memoria, máscara.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react'
import { Flow } from 'flow-sdk'
import { graftTexture, graftReportLine } from './services/processor'
import {
  PRESETS,
  TexturePreset,
  buildPrompt,
  aspectRatioOf,
  AppState,
  BananaModel,
  MODELS,
  ProcessingStep,
} from './types'
import { ComparisonView } from './components/ComparisonView'
import { ProcessingOverlay } from './components/ProcessingOverlay'
import { MaskEditor } from './components/MaskEditor'
import { MaskHistory } from './components/MaskHistory'
import { MemoryBuffer } from './components/MemoryBuffer'
import { SectionLabel, PillButton, RangeSlider } from './components/FlowUI'

export default function App() {
  const [state, setState] = useState<AppState>({
    original: null,
    processed: null,
    mask: null,
    maskHistory: [],
    memorySlots: [null, null, null, null],
    comparison: {
      active: false,
      imageA: null,
      imageB: null,
      labelA: 'Original',
      labelB: 'Texturizado',
    },
    isProcessing: false,
    structureRepair: false,
    error: null,
    selectedModel: '🍌 Nano Banana Pro',
  })

  const [preset, setPreset] = useState<TexturePreset>(PRESETS[0])
  const [intensity, setIntensity] = useState(PRESETS[0].intensity)
  const [clarity, setClarity] = useState(PRESETS[0].clarity)
  const [step, setStep] = useState<ProcessingStep>('Generando textura')
  const [report, setReport] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  const [isEditingMask, setIsEditingMask] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    const id = 'hera-v4-css'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; cursor: pointer; padding: 12px 0; }
      input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 1px; background: #333; border-radius: 9999px; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 0 15px rgba(255,255,255,.3); margin-top: -7px; cursor: grab; border: 1px solid #000; transition: all .2s; }
      input[type=range]::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.3); }
      html, body, #root { margin:0; padding:0; width:100%; height:100%; background:#010101; font-family:'Google Sans Text',sans-serif; -webkit-font-smoothing:antialiased; }
      .panel-blur { backdrop-filter: blur(100px); background: rgba(0,0,0,.96); }
    `
    document.head.appendChild(style)
  }, [])

  /** Al cambiar de preset se aplican sus valores recomendados. */
  const choosePreset = (p: TexturePreset) => {
    setPreset(p)
    setIntensity(p.intensity)
    setClarity(p.clarity)
  }

  const handleSelect = async () => {
    try {
      const media = await Flow.media.select({ filter: 'image' })
      setState((prev) => ({
        ...prev,
        original: { base64: media.base64, mimeType: media.mimeType, mediaId: media.mediaId },
        processed: null,
        mask: null,
        maskHistory: [],
        error: null,
      }))
      setReport('')
    } catch {
      /* cancelado por el usuario */
    }
  }

  const processImage = async () => {
    if (!state.original) return
    setState((p) => ({ ...p, isProcessing: true, error: null }))
    setStep('Generando textura')

    try {
      const originalUrl = `data:${state.original.mimeType};base64,${state.original.base64}`

      // Dimensiones reales → misma proporción para la IA (evita el reencuadre).
      const img = new Image()
      img.src = originalUrl
      await new Promise((res) => {
        img.onload = res
      })
      const ar = aspectRatioOf(img.naturalWidth, img.naturalHeight)

      // UN SOLO PROMPT. Sin capas de iluminación. Sin "8k". Sin "hyper-realistic".
      const result = await Flow.generate.image({
        prompt: buildPrompt(preset),
        referenceImageMediaIds: [state.original.mediaId],
        modelDisplayName: state.selectedModel,
        aspectRatio: ar,
      })

      const processed = await graftTexture(
        originalUrl,
        `data:${result.mimeType};base64,${result.base64}`,
        {
          intensity,
          clarity,
          preserveFocus: true,
          maskDataUrl: state.mask,
          structureRepair: state.structureRepair && !!state.mask,
          onProgress: (s) => setStep(s as ProcessingStep),
        }
      )

      setReport(graftReportLine())
      setState((p) => ({ ...p, processed, isProcessing: false }))
    } catch {
      setState((p) => ({
        ...p,
        isProcessing: false,
        error: 'Fallo en el motor de injerto. Reintenta.',
      }))
    }
  }

  const handleSave = async () => {
    if (!state.processed) return
    setSaveStatus('saving')
    try {
      await Flow.save({
        base64: state.processed.split(',')[1],
        mimeType: 'image/jpeg',
        name: 'HERA_SKIN_V4',
      })
      setSaveStatus('done')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }

  const originalUrl = state.original
    ? `data:${state.original.mimeType};base64,${state.original.base64}`
    : null

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden select-none">
      <main className="flex-1 relative flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 bg-black/80 backdrop-blur-2xl flex items-center justify-between px-8 z-50">
          <div className="flex flex-col">
            <h1 className="text-[11px] font-black tracking-[10px] text-white uppercase">
              Hera Skin Lab
            </h1>
            <span className="text-[7px] font-mono text-white/30 uppercase tracking-[4px]">
              Aligned Frequency Graft v4.0
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              {MODELS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setState((p) => ({ ...p, selectedModel: m as BananaModel }))}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[1px] transition-all ${
                    state.selectedModel === m ? 'bg-white text-black' : 'text-white/40 hover:text-white'
                  }`}
                >
                  {m.replace('🍌 Nano Banana ', '')}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setState((p) => ({
                  ...p,
                  comparison: { ...p.comparison, active: !p.comparison.active },
                }))
              }
              className={`flex items-center gap-3 px-5 py-2 rounded-xl border transition-all ${
                state.comparison.active
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 border-white/10 text-white/40'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">compare</span>
              <span className="text-[9px] font-black uppercase tracking-[2px]">Slots A/B</span>
            </button>
          </div>
        </header>

        <ComparisonView
          imageA={
            state.comparison.active && state.comparison.imageA
              ? state.comparison.imageA
              : originalUrl
          }
          imageB={
            state.comparison.active && state.comparison.imageB
              ? state.comparison.imageB
              : state.processed
          }
          hasInput={!!state.original}
          isProcessing={state.isProcessing}
          error={state.error}
          onSelect={handleSelect}
          labelA={state.comparison.active ? state.comparison.labelA : 'Original'}
          labelB={state.comparison.active ? state.comparison.labelB : 'Texturizado'}
          isComparisonMode={state.comparison.active}
        />

        {report && !state.isProcessing && (
          <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
            <span className="text-[9px] font-mono text-white/25 tracking-wider">{report}</span>
          </div>
        )}

        <ProcessingOverlay isVisible={state.isProcessing} step={step} />
      </main>

      <aside className="w-[320px] h-full border-l border-white/10 flex flex-col panel-blur z-50">
        <div className="flex-1 flex flex-col gap-8 overflow-y-auto px-6 py-8">
          <PillButton
            variant={state.original ? 'outline' : 'solid'}
            icon={
              <span className="material-symbols-outlined">
                {state.original ? 'refresh' : 'add_photo_alternate'}
              </span>
            }
            onClick={handleSelect}
            className="w-full h-12 !rounded-2xl"
          >
            <span className="text-[11px] font-black tracking-[4px] uppercase">
              {state.original ? 'Cambiar Foto' : 'Cargar Foto'}
            </span>
          </PillButton>

          {state.original && (
            <>
              <div className="flex flex-col gap-4">
                <SectionLabel>Tipo de textura</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => choosePreset(p)}
                      className={`flex flex-col items-center justify-center aspect-square rounded-xl border transition-all ${
                        preset.id === p.id
                          ? 'bg-white/10 border-white/40'
                          : 'bg-white/5 border-white/5 opacity-40 hover:opacity-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px] text-white">
                        {p.icon}
                      </span>
                      <span className="text-[7px] mt-1 font-black uppercase text-white/60">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-white/30 leading-relaxed">{preset.hint}</p>
              </div>

              <div className="flex flex-col gap-6 bg-white/[0.02] p-5 rounded-2xl border border-white/5">
                <RangeSlider
                  label="Textura de piel"
                  value={intensity}
                  min={0}
                  max={1.5}
                  step={0.05}
                  formatValue={(v: number) => `${(v * 100).toFixed(0)}%`}
                  onChange={setIntensity}
                  idealValue={preset.intensity}
                />
                <RangeSlider
                  label="Cuerpo / contraste local"
                  value={clarity}
                  min={0}
                  max={0.6}
                  step={0.02}
                  formatValue={(v: number) => `${(v * 100).toFixed(0)}%`}
                  onChange={setClarity}
                  idealValue={preset.clarity}
                />
              </div>

              <PillButton
                variant="solid"
                icon={<span className="material-symbols-outlined text-[20px]">brush</span>}
                onClick={processImage}
                disabled={state.isProcessing}
                className="w-full h-16 !rounded-3xl"
              >
                <span className="text-[12px] font-black tracking-[6px] uppercase">
                  Generar Realismo
                </span>
              </PillButton>

              <MemoryBuffer
                slots={state.memorySlots}
                currentProcessed={state.processed}
                onSaveToSlot={(i: number) =>
                  setState((p) => {
                    const s = [...p.memorySlots]
                    s[i] = p.processed
                    return { ...p, memorySlots: s }
                  })
                }
                onLoadFromSlot={(i: number) =>
                  setState((p) => (p.memorySlots[i] ? { ...p, processed: p.memorySlots[i] } : p))
                }
                onSetAsA={(i: number) =>
                  setState((p) =>
                    p.memorySlots[i]
                      ? {
                          ...p,
                          comparison: {
                            ...p.comparison,
                            active: true,
                            imageA: p.memorySlots[i],
                            labelA: `Slot ${i + 1}`,
                          },
                        }
                      : p
                  )
                }
                onSetAsB={(i: number) =>
                  setState((p) =>
                    p.memorySlots[i]
                      ? {
                          ...p,
                          comparison: {
                            ...p.comparison,
                            active: true,
                            imageB: p.memorySlots[i],
                            labelB: `Slot ${i + 1}`,
                          },
                        }
                      : p
                  )
                }
                activeA={null}
                activeB={null}
                isComparison={state.comparison.active}
              />

              {/* ---- Avanzado: máscara + reparación anatómica (opt-in) ---- */}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center justify-between w-full text-white/40 hover:text-white transition-colors"
                >
                  <SectionLabel>Avanzado</SectionLabel>
                  <span className="material-symbols-outlined text-[16px]">
                    {showAdvanced ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="flex flex-col gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                    <MaskHistory
                      history={state.maskHistory}
                      current={state.mask}
                      onSelect={(m: string) => setState((p) => ({ ...p, mask: m }))}
                      onAdd={() => setIsEditingMask(true)}
                    />
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[9px] uppercase tracking-[2px] text-white/50">
                        Reparar anatomía en la máscara
                      </span>
                      <input
                        type="checkbox"
                        checked={state.structureRepair}
                        onChange={(e) =>
                          setState((p) => ({ ...p, structureRepair: e.target.checked }))
                        }
                      />
                    </label>
                    <p className="text-[8px] text-white/25 leading-relaxed">
                      Solo dentro del área pintada, mezcla también la estructura de la IA. Úsalo
                      para dedos o manos deformes. Fuera de la máscara nunca se toca nada.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {state.processed && (
          <footer className="p-6 border-t border-white/5 bg-black/40">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus !== 'idle'}
              className="w-full h-12 bg-white text-black rounded-2xl flex items-center justify-center gap-4 hover:bg-gray-200 transition-all"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">
                {saveStatus === 'done' ? 'verified' : 'save_alt'}
              </span>
              <span className="text-[10px] font-black tracking-[4px] uppercase">
                {saveStatus === 'saving' ? 'Exportando...' : 'Guardar Master'}
              </span>
            </button>
          </footer>
        )}
      </aside>

      {isEditingMask && originalUrl && (
        <MaskEditor
          image={originalUrl}
          initialMask={state.mask}
          onSave={(mask: string) => {
            setState((p) => ({
              ...p,
              mask,
              maskHistory: [mask, ...p.maskHistory].slice(0, 10),
            }))
            setIsEditingMask(false)
          }}
          onCancel={() => setIsEditingMask(false)}
        />
      )}
    </div>
  )
}
