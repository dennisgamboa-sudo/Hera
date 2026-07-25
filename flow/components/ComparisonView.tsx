/**
 * ============================================================================
 * ComparisonView v4.0 — visor antes/después con geometría garantizada
 * ============================================================================
 *
 * EL BUG QUE ARREGLA (el "montaje" / "doble imagen" de siempre):
 *
 *   El original y el resultado tienen dimensiones intrínsecas distintas
 *   (el motor hace upscale a la resolución de la IA). Si los dos <img> se
 *   dejan dimensionar solos —o con object-contain sobre cajas de distinta
 *   proporción— cada uno se dibuja a una escala diferente. Resultado: en la
 *   mitad izquierda ves la foto pequeña y en la derecha un trozo ampliado.
 *   Parece un collage de dos fotos. NO lo es: es la misma foto a dos escalas.
 *
 * LA SOLUCIÓN:
 *
 *   1. Se calcula un `frame` con la proporción EXACTA del original, ajustado
 *      por contención al espacio disponible. Ese frame es el único sistema de
 *      coordenadas del visor.
 *   2. Las dos imágenes se pintan dentro del frame con `object-fit: fill` y
 *      `inset-0`. Al coincidir el frame con la proporción del original, `fill`
 *      se ve igual que `contain` PERO fuerza a ambas a ocupar exactamente los
 *      mismos píxeles. Es geométricamente imposible que se descuadren, aunque
 *      el resultado venga con 1 px de diferencia por redondeo.
 *   3. El deslizador opera en coordenadas del frame, no del contenedor, así
 *      que el corte cae siempre donde está el cursor incluso con bandas negras.
 *
 * CONVENCIÓN (Opción B): Original a la IZQUIERDA, Texturizado a la DERECHA.
 *   clipPath: inset(0 0 0 pos%) recorta el lado izquierdo de la capa superior,
 *   dejando el resultado visible a la derecha. Las etiquetas coinciden.
 * ============================================================================
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

interface ComparisonViewProps {
  imageA: string | null
  imageB: string | null
  hasInput: boolean
  isProcessing: boolean
  error: string | null
  onSelect: () => void
  labelA?: string
  labelB?: string
  isComparisonMode?: boolean
}

export function ComparisonView({
  imageA,
  imageB,
  hasInput,
  isProcessing,
  error,
  onSelect,
  labelA = 'Original',
  labelB = 'Texturizado',
}: ComparisonViewProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [aspect, setAspect] = useState<number | null>(null)
  const [pos, setPos] = useState(50)
  const [dragging, setDragging] = useState(false)

  // --- Proporción tomada del ORIGINAL (imageA manda siempre) ---------------
  useEffect(() => {
    if (!imageA) {
      setAspect(null)
      return
    }
    let cancelled = false
    const im = new Image()
    im.onload = () => {
      if (!cancelled && im.naturalHeight > 0) {
        setAspect(im.naturalWidth / im.naturalHeight)
      }
    }
    im.src = imageA
    return () => {
      cancelled = true
    }
  }, [imageA])

  // Al cargar una imagen nueva el deslizador vuelve al centro.
  useEffect(() => {
    setPos(50)
  }, [imageA])

  // --- Medida del contenedor ------------------------------------------------
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // --- Frame: contención exacta de la proporción del original --------------
  let frameW = 0
  let frameH = 0
  if (stage.w > 0 && stage.h > 0 && aspect) {
    const pad = 32
    const availW = Math.max(1, stage.w - pad * 2)
    const availH = Math.max(1, stage.h - pad * 2)
    if (availW / availH > aspect) {
      frameH = availH
      frameW = frameH * aspect
    } else {
      frameW = availW
      frameH = frameW / aspect
    }
  }

  // --- Arrastre del deslizador (en coordenadas del FRAME) ------------------
  const updateFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width <= 0) return
    const p = ((clientX - r.left) / r.width) * 100
    setPos(p < 0 ? 0 : p > 100 ? 100 : p)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      e.preventDefault()
      updateFromClientX(e.clientX)
    }
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, updateFromClientX])

  const showSplit = !!imageA && !!imageB

  // --- Estado vacío ---------------------------------------------------------
  if (!hasInput) {
    return (
      <div
        ref={stageRef}
        className="flex-1 relative flex items-center justify-center bg-black min-h-0"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-3xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-white/40">image</span>
          </div>
          <div className="text-center">
            <p className="text-[13px] font-black tracking-[4px] uppercase text-white/80">
              Hera Skin Lab
            </p>
            <p className="text-[10px] text-white/30 mt-2 tracking-wider">
              Carga una foto para empezar
            </p>
          </div>
          <button
            type="button"
            onClick={onSelect}
            className="px-8 h-12 bg-white text-black rounded-2xl text-[11px] font-black tracking-[4px] uppercase hover:bg-gray-200 transition-all"
          >
            Cargar Foto
          </button>
          {error && (
            <p className="text-[10px] text-red-400/80 font-mono max-w-xs text-center">{error}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={stageRef}
      className="flex-1 relative flex items-center justify-center bg-black min-h-0 overflow-hidden"
    >
      {frameW > 0 && frameH > 0 && (
        <div
          ref={frameRef}
          className="relative select-none"
          style={{ width: frameW, height: frameH }}
          onPointerDown={(e) => {
            if (!showSplit) return
            e.preventDefault()
            setDragging(true)
            updateFromClientX(e.clientX)
          }}
        >
          {/* ---- Capa A: ORIGINAL (fondo, siempre completa) ---------------- */}
          {imageA && (
            <img
              src={imageA}
              alt={labelA}
              draggable={false}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ objectFit: 'fill' }}
            />
          )}

          {/* ---- Capa B: RESULTADO (encima, recortada por la izquierda) ---- */}
          {imageB && (
            <img
              src={imageB}
              alt={labelB}
              draggable={false}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                objectFit: 'fill',
                clipPath: showSplit ? `inset(0 0 0 ${pos}%)` : undefined,
              }}
            />
          )}

          {/* ---- Etiquetas -------------------------------------------------- */}
          {showSplit && (
            <>
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur border border-white/10 pointer-events-none">
                <div className="text-[7px] font-mono uppercase tracking-[3px] text-white/40">
                  A
                </div>
                <div className="text-[9px] font-black uppercase tracking-[2px] text-white">
                  {labelA}
                </div>
              </div>
              <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur border border-white/10 text-right pointer-events-none">
                <div className="text-[7px] font-mono uppercase tracking-[3px] text-white/40">
                  B
                </div>
                <div className="text-[9px] font-black uppercase tracking-[2px] text-white">
                  {labelB}
                </div>
              </div>

              {/* ---- Línea y tirador ---------------------------------------- */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `${pos}%`, transform: 'translateX(-0.5px)' }}
              >
                <div className="w-px h-full bg-white/80 shadow-[0_0_12px_rgba(0,0,0,.8)]" />
              </div>
              <div
                className="absolute top-1/2 flex items-center justify-center rounded-full bg-white text-black shadow-2xl"
                style={{
                  left: `${pos}%`,
                  width: 40,
                  height: 40,
                  transform: 'translate(-50%,-50%)',
                  cursor: dragging ? 'grabbing' : 'grab',
                }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDragging(true)
                }}
              >
                <span className="material-symbols-outlined text-[20px]">unfold_more</span>
              </div>
            </>
          )}
        </div>
      )}

      {error && !isProcessing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30">
          <p className="text-[10px] text-red-200 font-mono">{error}</p>
        </div>
      )}
    </div>
  )
}
