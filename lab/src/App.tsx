import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ChevronRight,
  Layers,
  Sparkles,
  Blend,
  Gem,
  Play,
  Pause,
  Instagram,
  Calendar as CalendarIcon,
  Settings,
  Search,
  Grid3X3,
  Image as ImageIcon,
  Share2,
  Download,
  Loader2,
  Eye,
} from 'lucide-react'
import { EngineVisualizer } from './components/EngineVisualizer'
import { MoodboardGrid } from './components/MoodboardGrid'
import { Scheduler } from './components/Scheduler'
import { CarouselStudio } from './components/CarouselStudio'
import { ResultSheet } from './components/ResultSheet'
import { DiffusionProcessor } from './components/DiffusionProcessor'
import { Button } from './components/ui/button'
import { Post, loadPosts, savePosts, newId, compressDataUrl } from './lib/storage'
import { processImage, StageId } from './lib/engines'
import { DeliverItem } from './lib/download'

const stages = [
  {
    id: 'source',
    title: 'ORIGEN',
    subtitle: 'FUENTE',
    description:
      'Imagen original del producto en estado puro. Preparada para iniciar el proceso de transformación digital a través de los motores de procesamiento.',
    icon: Gem,
    color: 'from-gray-500/20 to-white/20',
  },
  {
    id: 'geo-lock',
    title: 'GEO-LOCK',
    subtitle: 'MOTOR DE ANÁLISIS GEOMÉTRICO',
    description:
      'Escaneo y bloqueo de datos geométricos del producto. Este motor analiza 145,000 vértices con precisión del 99.6%, generando una malla 3D ultra densa que captura cada detalle microscópico de la geometría.',
    icon: Layers,
    color: 'from-blue-500/20 to-cyan-500/20',
    engineData: {
      precision: '99.6%',
      vertices: '145K',
      scanType: '3A',
      meshDensity: 'Ultra',
    },
  },
  {
    id: 'atmosphere',
    title: 'ATMOSPHERE',
    subtitle: 'MOTOR DE CAPAS ATMOSFÉRICAS',
    description:
      'Construcción del mundo alrededor del producto. El motor genera múltiples capas atmosféricas que envuelven la pieza, simulando iluminación volumétrica avanzada con índice de refracción 1.52 para lograr realismo fotográfico.',
    icon: Sparkles,
    color: 'from-amber-500/20 to-orange-500/20',
    engineData: {
      layers: 'Multi',
      lighting: 'Volumetric',
      ior: '1.52',
      depth: 'Advanced',
    },
  },
  {
    id: 'texture',
    title: 'TEXTURE-BLEND',
    subtitle: 'MOTOR DE MEZCLA DE TEXTURAS',
    description:
      'Envoltorio del Scan 3D con perfiles ópticos de lente y materiales. El sistema PSM (Photo Surface Mixing) mezcla texturas a nivel molecular para lograr un acabado ultra realista que replica la superficie física exacta.',
    icon: Blend,
    color: 'from-purple-500/20 to-pink-500/20',
    engineData: {
      optics: 'Lens Profile',
      psm: 'Active',
      blend: 'Ultra',
      quality: 'Max',
    },
  },
  {
    id: 'final',
    title: 'PIEZA FINAL',
    subtitle: 'RENDERIZADO FOTOREALISTA 4K',
    description:
      'El producto original, ahora vive en su escena final. Renderizado en 4K a 60fps con dirección de arte profesional. La combinación de los tres motores anteriores resulta en una pieza digital indistinguible de la realidad.',
    icon: Gem,
    color: 'from-yellow-500/20 to-amber-500/20',
    isFinal: true,
    engineData: {
      output: '4K',
      format: 'Video',
      art: 'Direction',
      fps: '60',
    },
  },
]

export default function App() {
  const [activeStage, setActiveStage] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [view, setView] = useState<'engines' | 'moodboard'>('moodboard')
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [posts, setPosts] = useState<Post[]>(() => loadPosts())
  const [storageFull, setStorageFull] = useState(false)

  // Persistir cada cambio
  useEffect(() => {
    const ok = savePosts(posts)
    setStorageFull(!ok)
  }, [posts])

  useEffect(() => {
    if (!isAutoPlaying || view !== 'engines') return

    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length)
    }, 7000)

    return () => clearInterval(interval)
  }, [isAutoPlaying, view])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleReorder = useCallback((from: number, to: number) => {
    setPosts((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const handleAdd = useCallback((added: Post[]) => {
    setPosts((prev) => [...prev, ...added])
  }, [])

  const handleDelete = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    setSelectedPost((prev) => (prev?.id === id ? null : prev))
  }, [])

  const handleUpdate = useCallback((id: string, patch: Partial<Post>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const currentStage = stages[activeStage]

  // La imagen que procesan los motores: post seleccionado, o el primero del feed
  const engineImage = selectedPost?.image ?? posts[0]?.image

  // ── Procesamiento real por motor ──
  const [processed, setProcessed] = useState<string | undefined>(undefined)
  const [processingStage, setProcessingStage] = useState(false)
  const [compare, setCompare] = useState(false)
  const [showStudio, setShowStudio] = useState(false)
  const [intensity, setIntensity] = useState(1)
  const [sheet, setSheet] = useState<DeliverItem[] | null>(null)
  const [diffusionSource, setDiffusionSource] = useState<string | null>(null)
  const processCache = useRef<Map<string, string>>(new Map())

  const stageId = currentStage.id as StageId

  useEffect(() => {
    let cancelled = false
    if (!engineImage) {
      setProcessed(undefined)
      return
    }
    if (stageId === 'source') {
      setProcessed(engineImage)
      return
    }
    const key = `${stageId}:${intensity}:${engineImage.length}:${engineImage.slice(100, 132)}`
    const cached = processCache.current.get(key)
    if (cached) {
      setProcessed(cached)
      return
    }
    setProcessingStage(true)
    processImage(engineImage, stageId, intensity)
      .then((out) => {
        if (cancelled) return
        processCache.current.set(key, out)
        setProcessed(out)
      })
      .catch(() => {
        if (!cancelled) setProcessed(engineImage)
      })
      .finally(() => {
        if (!cancelled) setProcessingStage(false)
      })
    return () => {
      cancelled = true
    }
  }, [engineImage, stageId, intensity])

  const downloadFinal = () => {
    if (!processed) return
    setSheet([{ url: processed, name: 'HERA_pieza_final.jpg' }])
  }

  const addFinalToFeed = () => {
    if (!processed) return
    handleAdd([{ id: newId(), type: 'image', image: processed, status: 'draft', caption: selectedPost?.caption }])
    setView('moodboard')
  }

  const addCarouselToFeed = (slides: string[]) => {
    handleAdd(slides.map((img) => ({ id: newId(), type: 'carousel' as const, image: img, status: 'draft' as const })))
  }

  const counts = {
    published: posts.filter((p) => p.status === 'published').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    drafts: posts.filter((p) => p.status === 'draft').length,
  }

  return (
    <div className="size-full bg-black text-white overflow-hidden relative font-sans">
      {/* Background elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(20,20,20,1)_0%,rgba(0,0,0,1)_100%)]" />
        <motion.div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            transform: `perspective(1000px) rotateX(60deg) translateY(${mousePosition.y * 50}px) translateX(${mousePosition.x * 20}px)`,
          }}
        />
      </div>

      {/* Sidebar / Navigation */}
      <div className="absolute left-0 top-0 bottom-0 w-16 md:w-20 bg-white/5 border-r border-white/10 z-50 flex flex-col items-center py-8 gap-8 backdrop-blur-xl">
        <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-bold text-xl tracking-tighter shadow-lg">
          H
        </div>
        <div className="flex flex-col gap-6 mt-12">
          <button
            onClick={() => setView('moodboard')}
            className={`p-3 rounded-xl transition-all cursor-pointer ${view === 'moodboard' ? 'bg-white text-black' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
          >
            <Grid3X3 className="w-6 h-6" />
          </button>
          <button
            onClick={() => setView('engines')}
            className={`p-3 rounded-xl transition-all cursor-pointer ${view === 'engines' ? 'bg-white text-black' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
          >
            <Layers className="w-6 h-6" />
          </button>
          <button className="p-3 rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
            <CalendarIcon className="w-6 h-6" />
          </button>
          <button className="p-3 rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
            <Search className="w-6 h-6" />
          </button>
        </div>
        <div className="mt-auto">
          <button className="p-3 rounded-xl text-gray-500 hover:text-white transition-all cursor-pointer">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="absolute top-0 left-16 md:left-20 right-0 z-40 p-4 md:p-8 flex justify-between items-center backdrop-blur-md bg-black/20">
        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-[0.2em] flex items-center gap-3">
            HERA{' '}
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono text-gray-400">LAB_v2.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col text-right mr-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Estado Sistema</span>
            <span className="text-xs text-green-400 font-mono flex items-center justify-end gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> ONLINE
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 border border-white/20" />
        </div>
      </header>

      {/* Main View Area */}
      <main className="absolute inset-0 left-16 md:left-20 pt-20 md:pt-28 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === 'moodboard' ? (
            <motion.div
              key="moodboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5 }}
              className="px-2 md:px-4"
            >
              {/* Profile Header */}
              <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6 md:gap-8 mb-8 md:mb-12 py-4">
                <div className="w-24 h-24 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shrink-0">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden border-2 border-black">
                    <div className="text-2xl md:text-4xl font-bold tracking-tighter">HERA</div>
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                    <h2 className="text-2xl font-light tracking-wide">hera_digital_lab</h2>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-white text-black hover:bg-gray-200">
                        Editar Perfil
                      </Button>
                      <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
                        Ver Archivo
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-center md:justify-start gap-8 mb-4 font-mono text-sm">
                    <div>
                      <span className="font-bold text-white">{counts.published}</span> publicados
                    </div>
                    <div>
                      <span className="font-bold text-white">{counts.scheduled}</span> programados
                    </div>
                    <div>
                      <span className="font-bold text-white">{counts.drafts}</span> borradores
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 max-w-md mx-auto md:mx-0">
                    <span className="font-bold text-white">HERA • Hybrid Visual Architecture</span>
                    <br />
                    Visual lab. Powered by GEO-LOCK & TEXTURE-BLEND engines.
                    <br />
                    <span className="text-blue-400">@theeyeofhera</span>
                  </p>
                </div>
              </div>

              <MoodboardGrid
                posts={posts}
                onReorder={handleReorder}
                onAdd={handleAdd}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                storageFull={storageFull}
                onSelectPost={(post) => {
                  setSelectedPost(post)
                  setView('engines')
                }}
              />

              {/* Layout additional sections */}
              <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mt-4 pb-24 px-2">
                <div className="md:col-span-2">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full backdrop-blur-xl">
                    <h3 className="font-bold tracking-widest text-xs uppercase mb-6 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-purple-400" /> Creador de Carruseles
                    </h3>
                    <div
                      onClick={() => setShowStudio(true)}
                      className="aspect-video bg-black/40 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-4 group cursor-pointer hover:border-white/40 transition-all"
                    >
                      <div className="p-4 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-8 h-8 text-gray-500 group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-xs text-gray-400 font-mono text-center px-4">
                        ABRIR ESTUDIO — slides editoriales 1080×1350
                      </p>
                      <p className="text-[10px] text-gray-600 font-mono text-center px-4">
                        estilos cinematic · minimal · clean · nota · cierre / paletas desert · studio · noir
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Scheduler />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="engines"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="size-full flex items-center justify-center p-4 pb-32"
            >
              <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Info Panel */}
                <motion.div
                  className="space-y-4 md:space-y-6 lg:order-1 z-10"
                  style={{ transform: `translate(${mousePosition.x * 10}px, ${mousePosition.y * 10}px)` }}
                >
                  <div className="flex items-center gap-3 md:gap-4 mb-4">
                    {currentStage.icon && (
                      <motion.div
                        className="relative"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                      >
                        <div className="absolute inset-0 bg-white/10 rounded-full blur-xl" />
                        <currentStage.icon className="w-10 h-10 md:w-12 md:h-12 text-white relative z-10" />
                      </motion.div>
                    )}
                    <div>
                      <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-none uppercase">
                        {currentStage.title}
                      </h2>
                      <p className="text-xs md:text-sm text-gray-400 mt-1 md:mt-2 uppercase tracking-[0.3em]">
                        {currentStage.subtitle}
                      </p>
                    </div>
                  </div>

                  <motion.p className="text-base md:text-lg lg:text-xl text-gray-300 leading-relaxed max-w-lg">
                    {currentStage.description}
                  </motion.p>

                  {currentStage.engineData && (
                    <div className="grid grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                      {Object.entries(currentStage.engineData).map(([key, value]) => (
                        <div key={key}>
                          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{key}</div>
                          <div className="text-lg font-mono text-white">{value as string}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 md:gap-4 pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                      className="rounded-full px-8 h-12 bg-white/10 text-white hover:bg-white/20 border-white/20"
                    >
                      {isAutoPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      {isAutoPlaying ? 'PAUSAR MOTOR' : 'INICIAR PROCESO'}
                    </Button>
                    <Button
                      onClick={() => setActiveStage((prev) => (prev + 1) % stages.length)}
                      className="rounded-full px-8 h-12 bg-white text-black hover:bg-gray-200"
                    >
                      SIGUIENTE FASE <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>

                  {stageId !== 'source' && engineImage && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mr-1">Intensidad</span>
                      {[
                        { label: 'SUAVE', v: 0.6 },
                        { label: 'MEDIO', v: 1 },
                        { label: 'FUERTE', v: 1.7 },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => setIntensity(opt.v)}
                          className={`text-[10px] px-3 py-1.5 rounded-full border uppercase tracking-wider transition-all cursor-pointer ${
                            intensity === opt.v
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 border-white/15 text-gray-500 hover:border-white/40'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {currentStage.isFinal && processed && engineImage && (
                    <>
                      <div className="flex flex-wrap gap-3 pt-2">
                        <Button
                          onClick={downloadFinal}
                          className="rounded-full px-8 h-12 bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:opacity-90 font-bold"
                        >
                          <Download className="w-4 h-4 mr-2" /> GUARDAR PIEZA
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={addFinalToFeed}
                          className="rounded-full px-8 h-12 bg-white/10 text-white hover:bg-white/20 border border-white/20"
                        >
                          <Instagram className="w-4 h-4 mr-2" /> AÑADIR AL FEED
                        </Button>
                        <Button
                          onClick={() => setDiffusionSource(processed)}
                          className="rounded-full px-8 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 font-bold"
                        >
                          <Sparkles className="w-4 h-4 mr-2" /> REALISMO DE PIEL
                        </Button>
                      </div>

                      {/* Receta IA — realismo de piel (difusión externa) */}
                      <div className="mt-4 p-5 bg-white/5 border border-white/10 rounded-2xl space-y-3 max-w-lg">
                        <h3 className="text-[10px] font-bold tracking-widest uppercase text-purple-300 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5" /> Motor IA · Realismo de piel (Magnific / Krea)
                        </h3>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          La reconstrucción de poros y micro-texturas necesita un modelo de difusión en GPU — corre en tu
                          herramienta IA. Guarda la pieza de arriba, súbela allí y aplica esta receta exacta:
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="bg-black/40 rounded-lg px-3 py-2"><span className="text-gray-500">Engine</span><br /><span className="text-white">Sharpy</span></div>
                          <div className="bg-black/40 rounded-lg px-3 py-2"><span className="text-gray-500">Optimized for</span><br /><span className="text-white">Portrait / Films</span></div>
                          <div className="bg-black/40 rounded-lg px-3 py-2"><span className="text-gray-500">Creativity</span><br /><span className="text-white">1–2 (bajo)</span></div>
                          <div className="bg-black/40 rounded-lg px-3 py-2"><span className="text-gray-500">Resemblance</span><br /><span className="text-white">70–90 (alto)</span></div>
                          <div className="bg-black/40 rounded-lg px-3 py-2"><span className="text-gray-500">HDR</span><br /><span className="text-white">0</span></div>
                          <div className="bg-black/40 rounded-lg px-3 py-2"><span className="text-gray-500">Fractality</span><br /><span className="text-white">moderado</span></div>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigator.clipboard?.writeText('raw photo, realistic skin texture, pores, natural lighting, 8k, photography')}
                            className="text-[10px] border-white/15"
                          >
                            Copiar prompt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigator.clipboard?.writeText('plastic, smooth skin, airbrushed, 3d render, illustration')}
                            className="text-[10px] border-white/15"
                          >
                            Copiar negative
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>

                {/* 3D Visualization */}
                <div className="relative lg:order-2">
                  <div className="relative aspect-square">
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-white/10"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                    />
                    <div className="absolute inset-12 md:inset-16 rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-black/40 backdrop-blur-sm">
                      <EngineVisualizer engineId={currentStage.id} image={compare ? engineImage : processed ?? engineImage} />
                      {processingStage && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
                          <Loader2 className="w-8 h-8 animate-spin text-white/80" />
                          <span className="text-[10px] font-mono tracking-[0.3em] text-white/60 uppercase">Procesando…</span>
                        </div>
                      )}
                      {stageId !== 'source' && engineImage && !processingStage && (
                        <button
                          onPointerDown={() => setCompare(true)}
                          onPointerUp={() => setCompare(false)}
                          onPointerLeave={() => setCompare(false)}
                          className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-mono tracking-widest uppercase text-white/80 border border-white/20 cursor-pointer select-none"
                        >
                          <Eye className="w-3.5 h-3.5" /> {compare ? 'ORIGINAL' : 'COMPARAR'}
                        </button>
                      )}
                    </div>
                    {/* Floating decorative elements */}
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-white rounded-full opacity-20"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                          y: [0, -40, 0],
                          opacity: [0.1, 0.4, 0.1],
                        }}
                        transition={{ duration: 3 + i, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Engine Selector Bottom */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-30">
                {stages.map((stage, i) => (
                  <button
                    key={stage.id}
                    onClick={() => setActiveStage(i)}
                    className={`group relative w-12 h-12 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${activeStage === i ? 'bg-white text-black border-white' : 'bg-black/50 text-gray-500 border-white/10 hover:border-white/30'}`}
                  >
                    <stage.icon className="w-5 h-5" />
                    <span className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/20 px-2 py-1 rounded text-[10px] whitespace-nowrap">
                      {stage.title}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Estudio de Carrusel */}
      <AnimatePresence>
        {showStudio && (
          <CarouselStudio posts={posts} onClose={() => setShowStudio(false)} onAddToFeed={addCarouselToFeed} />
        )}
      </AnimatePresence>

      {/* Hoja de guardado (iOS-compatible) */}
      <AnimatePresence>
        {sheet && <ResultSheet items={sheet} title="Guardar pieza" onClose={() => setSheet(null)} />}
      </AnimatePresence>

      {/* Diffusion Processor Modal */}
      <AnimatePresence>
        {diffusionSource && (
          <DiffusionProcessor
            sourceImage={diffusionSource}
            onSuccess={async (resultUrl) => {
              // El feed guarda una copia ligera (localStorage); la descarga usa full-res.
              const feedImage = await compressDataUrl(resultUrl)
              handleAdd([{
                id: newId(),
                type: 'image',
                image: feedImage,
                status: 'draft',
                caption: 'AI Enhanced — Skin Realism',
              }])
              setDiffusionSource(null)
              setView('moodboard')
            }}
            onClose={() => setDiffusionSource(null)}
          />
        )}
      </AnimatePresence>

      {/* Footer Status Bar */}
      <div className="absolute bottom-0 left-16 md:left-20 right-0 h-12 bg-black/50 backdrop-blur-xl border-t border-white/10 flex items-center justify-between px-4 md:px-8 z-50">
        <div className="text-[10px] font-mono text-gray-500 tracking-widest uppercase truncate">
          POSTS: {posts.length} | ENGINE: ACTIVE
        </div>
        <div className="flex gap-4 shrink-0">
          <a href="https://www.instagram.com/theeyeofhera/" target="_blank" rel="noreferrer">
            <Instagram className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" />
          </a>
          <Share2 className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" />
        </div>
      </div>
    </div>
  )
}
