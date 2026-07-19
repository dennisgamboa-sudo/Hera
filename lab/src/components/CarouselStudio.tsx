import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Download, Plus, ChevronLeft, ChevronRight, Trash2, Loader2, Instagram, Type, ImagePlus } from 'lucide-react'
import { Button } from './ui/button'
import { Post, newId } from '../lib/storage'
import { renderSlide, SlideConfig, SlideStyle, PaletteId, PALETTES } from '../lib/carousel'
import { ResultSheet } from './ResultSheet'
import { DeliverItem } from '../lib/download'

interface CarouselStudioProps {
  posts: Post[]
  onClose: () => void
  onAddToFeed: (slides: string[]) => void
}

const STYLES: { id: SlideStyle; label: string; needsImage: boolean }[] = [
  { id: 'cinematic', label: 'Cinematic', needsImage: true },
  { id: 'minimal', label: 'Minimal', needsImage: true },
  { id: 'clean', label: 'Clean', needsImage: true },
  { id: 'note', label: 'Nota', needsImage: false },
  { id: 'closer', label: 'Cierre', needsImage: false },
]

export function CarouselStudio({ posts, onClose, onAddToFeed }: CarouselStudioProps) {
  const [slides, setSlides] = useState<SlideConfig[]>([])
  const [palette, setPalette] = useState<PaletteId>('desert')
  const [active, setActive] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [picking, setPicking] = useState(false)
  const [exporting, setExporting] = useState(false)

  const activeSlide = slides[active]

  // Re-render de la preview al cambiar el slide activo o la paleta
  useEffect(() => {
    let cancelled = false
    if (!activeSlide) {
      setPreview(null)
      return
    }
    setRendering(true)
    renderSlide(activeSlide, palette)
      .then((url) => {
        if (!cancelled) setPreview(url)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setRendering(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeSlide, palette])

  const patchActive = useCallback(
    (patch: Partial<SlideConfig>) => {
      setSlides((prev) => prev.map((s, i) => (i === active ? { ...s, ...patch } : s)))
    },
    [active]
  )

  const addFromPost = (post: Post) => {
    setSlides((prev) => [...prev, { id: newId(), style: prev.length === 0 ? 'cinematic' : 'minimal', image: post.image }])
    setActive(slides.length)
    setPicking(false)
  }

  const addCard = (style: 'note' | 'closer') => {
    setSlides((prev) => [
      ...prev,
      { id: newId(), style, note: style === 'note' ? 'todo lo que vuela, cae.' : undefined },
    ])
    setActive(slides.length)
  }

  const removeActive = () => {
    setSlides((prev) => prev.filter((_, i) => i !== active))
    setActive((a) => Math.max(0, a - 1))
  }

  const move = (dir: -1 | 1) => {
    setSlides((prev) => {
      const next = [...prev]
      const target = active + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[active], next[target]] = [next[target], next[active]]
      return next
    })
    setActive((a) => Math.min(Math.max(0, a + dir), slides.length - 1))
  }

  const renderAll = async (): Promise<string[]> => {
    const out: string[] = []
    for (const s of slides) {
      out.push(await renderSlide(s, palette))
    }
    return out
  }

  const [sheet, setSheet] = useState<DeliverItem[] | null>(null)

  const downloadAll = async () => {
    setExporting(true)
    try {
      const rendered = await renderAll()
      setSheet(rendered.map((url, i) => ({ url, name: `HERA_carrusel_${String(i + 1).padStart(2, '0')}.jpg` })))
    } finally {
      setExporting(false)
    }
  }

  const downloadOne = () => {
    if (!preview) return
    setSheet([{ url: preview, name: `HERA_slide_${String(active + 1).padStart(2, '0')}.jpg` }])
  }

  const addToFeed = async () => {
    setExporting(true)
    try {
      const rendered = await renderAll()
      onAddToFeed(rendered)
      onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold tracking-[0.2em] uppercase flex items-center gap-3">
            <Instagram className="w-5 h-5 text-purple-400" /> Estudio de Carrusel
          </h2>
          <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paleta global */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Paleta</span>
          {(Object.keys(PALETTES) as PaletteId[]).map((pid) => (
            <button
              key={pid}
              onClick={() => setPalette(pid)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] transition-all cursor-pointer ${
                palette === pid ? 'border-white text-white bg-white/10' : 'border-white/15 text-gray-500 hover:border-white/40'
              }`}
            >
              <span className="w-3 h-3 rounded-full border border-white/30" style={{ background: PALETTES[pid].accent }} />
              {PALETTES[pid].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Preview */}
          <div>
            <div className="relative aspect-[4/5] bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex items-center justify-center">
              {preview ? (
                <img src={preview} alt="Slide preview" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-gray-600 px-8">
                  <ImagePlus className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-xs font-mono tracking-widest uppercase">Añade un slide para empezar</p>
                </div>
              )}
              {rendering && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-white/70" />
                </div>
              )}
              {slides.length > 0 && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-mono">
                  {active + 1} / {slides.length}
                </div>
              )}
            </div>

            {/* Navegación + orden */}
            {slides.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActive((a) => Math.max(0, a - 1))} disabled={active === 0} className="border-white/15">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setActive((a) => Math.min(slides.length - 1, a + 1))} disabled={active >= slides.length - 1} className="border-white/15">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => move(-1)} disabled={active === 0} className="border-white/15 text-[10px]">
                    ← MOVER
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => move(1)} disabled={active >= slides.length - 1} className="border-white/15 text-[10px]">
                    MOVER →
                  </Button>
                  <Button variant="outline" size="sm" onClick={removeActive} className="border-red-500/30 text-red-400 text-[10px]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="space-y-5">
            {/* Añadir slides */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-4">Añadir slide</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPicking(true)} className="bg-white text-black hover:bg-gray-200 text-[11px]">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Foto del feed
                </Button>
                <Button size="sm" variant="secondary" onClick={() => addCard('note')} className="bg-white/10 text-white text-[11px]">
                  <Type className="w-3.5 h-3.5 mr-1" /> Tarjeta nota
                </Button>
                <Button size="sm" variant="secondary" onClick={() => addCard('closer')} className="bg-white/10 text-white text-[11px]">
                  <Type className="w-3.5 h-3.5 mr-1" /> Cierre HERA
                </Button>
              </div>
              {posts.length === 0 && (
                <p className="text-[10px] text-gray-600 mt-3 font-mono">Sube fotos al feed primero para usarlas aquí.</p>
              )}
            </div>

            {/* Editor del slide activo */}
            {activeSlide && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Slide {active + 1}</h3>

                {/* Estilo */}
                <div className="flex flex-wrap gap-2">
                  {STYLES.filter((s) => (activeSlide.image ? true : !s.needsImage)).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => patchActive({ style: s.id })}
                      className={`text-[10px] px-3 py-1.5 rounded-full border uppercase tracking-wider transition-all cursor-pointer ${
                        activeSlide.style === s.id
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                          : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/25'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Campos según estilo */}
                {activeSlide.style === 'cinematic' && (
                  <input
                    value={activeSlide.title || ''}
                    onChange={(e) => patchActive({ title: e.target.value })}
                    placeholder="Título del slide (ej: EL VERANO MUERE JOVEN)"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 outline-none"
                  />
                )}
                {activeSlide.style === 'note' && (
                  <textarea
                    value={activeSlide.note || ''}
                    onChange={(e) => patchActive({ note: e.target.value })}
                    placeholder="Texto de la nota (ej: todo lo que vuela, cae.)"
                    rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 outline-none resize-none"
                  />
                )}
                <input
                  value={activeSlide.handle || ''}
                  onChange={(e) => patchActive({ handle: e.target.value })}
                  placeholder="@theeyeofhera"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-gray-600 focus:border-purple-500/50 outline-none"
                />
              </div>
            )}

            {/* Export */}
            {slides.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Exportar · 1080×1350</h3>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={downloadOne} disabled={!preview} className="bg-white text-black hover:bg-gray-200 text-[11px]">
                    <Download className="w-3.5 h-3.5 mr-1" /> Este slide
                  </Button>
                  <Button size="sm" onClick={downloadAll} disabled={exporting} className="bg-white text-black hover:bg-gray-200 text-[11px]">
                    {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                    Todos ({slides.length})
                  </Button>
                  <Button size="sm" variant="secondary" onClick={addToFeed} disabled={exporting} className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px]">
                    <Instagram className="w-3.5 h-3.5 mr-1" /> Añadir al feed
                  </Button>
                </div>
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  Consejo del kit: abre con tu foto más fuerte en estilo Cinematic, guarda los créditos (Cierre) para el final.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Hoja de guardado (iOS-compatible) */}
        <AnimatePresence>
          {sheet && <ResultSheet items={sheet} title="Guardar carrusel" onClose={() => setSheet(null)} />}
        </AnimatePresence>

        {/* Selector de fotos del feed */}
        <AnimatePresence>
          {picking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl overflow-y-auto p-6"
            >
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold tracking-widest uppercase">Elige una foto del feed</h3>
                  <button onClick={() => setPicking(false)} className="p-2 bg-white/10 rounded-full cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {posts.map((post) => (
                    <button key={post.id} onClick={() => addFromPost(post)} className="aspect-[4/5] overflow-hidden rounded-lg border border-white/10 hover:border-white/50 transition-all cursor-pointer">
                      <img src={post.image} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                {posts.length === 0 && (
                  <p className="text-center text-gray-600 text-xs font-mono py-12">El feed está vacío — sube fotos primero.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
