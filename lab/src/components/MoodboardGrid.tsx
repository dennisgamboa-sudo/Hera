import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Instagram,
  LayoutGrid,
  Clapperboard,
  Plus,
  Box,
  Maximize2,
  X,
  Smartphone,
  Download,
  Trash2,
  Loader2,
} from 'lucide-react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { ImageWithFallback } from './figma/ImageWithFallback'
import { CaptionEditor } from './CaptionEditor'
import { Button } from './ui/button'
import { Post, compressImage, newId } from '../lib/storage'

const ItemType = 'POST'
const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

const STATUS_CYCLE: Post['status'][] = ['draft', 'scheduled', 'published']

interface DraggablePostProps {
  post: Post
  index: number
  movePost: (dragIndex: number, hoverIndex: number) => void
  onSelect: (post: Post) => void
  onDelete: (id: string) => void
  onCycleStatus: (id: string) => void
  onCycleType: (id: string) => void
}

function DraggablePost({ post, index, movePost, onSelect, onDelete, onCycleStatus, onCycleType }: DraggablePostProps) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const [, drop] = useDrop({
    accept: ItemType,
    hover(item: { index: number }) {
      if (item.index === index) return
      movePost(item.index, index)
      item.index = index
    },
  })

  return (
    <div
      ref={(node) => drag(drop(node)) as any}
      className={`relative aspect-[4/5] cursor-move group overflow-hidden bg-white/5 border border-white/5 transition-opacity ${isDragging ? 'opacity-30' : 'opacity-100'}`}
    >
      <ImageWithFallback src={post.image} alt={`Post ${post.id}`} className="w-full h-full object-cover" />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCycleType(post.id)
            }}
            title="Cambiar tipo"
            className="cursor-pointer"
          >
            {post.type === 'carousel' ? (
              <Instagram className="w-5 h-5 text-white" />
            ) : post.type === 'reel' ? (
              <Clapperboard className="w-5 h-5 text-white" />
            ) : (
              <LayoutGrid className="w-5 h-5 text-white" />
            )}
          </button>
          <Box
            className="w-5 h-5 text-cyan-400 cursor-pointer hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(post)
            }}
          />
          <Trash2
            className="w-5 h-5 text-red-400/80 cursor-pointer hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(post.id)
            }}
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelect(post)
          }}
          className="text-[10px] font-bold tracking-widest text-white uppercase cursor-pointer"
        >
          AR VIEW + CAPTION
        </button>
      </div>

      {/* Status Indicator — tap para cambiar draft → scheduled → published */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onCycleStatus(post.id)
        }}
        className={`absolute top-2 left-2 text-[8px] font-bold px-1.5 py-0.5 rounded cursor-pointer z-10 ${
          post.status === 'published'
            ? 'bg-green-500/80 text-black'
            : post.status === 'scheduled'
            ? 'bg-blue-500 text-white'
            : 'bg-white/20 backdrop-blur-md border border-white/20 text-white'
        }`}
      >
        {post.status === 'published' ? 'LIVE' : post.status === 'scheduled' ? post.date || 'SCHEDULED' : 'DRAFT'}
      </button>

      {/* Caption dot */}
      {post.caption && (
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.9)]" />
      )}
    </div>
  )
}

interface MoodboardGridProps {
  posts: Post[]
  onReorder: (from: number, to: number) => void
  onAdd: (posts: Post[]) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: Partial<Post>) => void
  onSelectPost: (post: Post) => void
  storageFull: boolean
}

export function MoodboardGrid({ posts, onReorder, onAdd, onDelete, onUpdate, onSelectPost, storageFull }: MoodboardGridProps) {
  const [showAR, setShowAR] = useState(false)
  const [activePost, setActivePost] = useState<Post | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const movePost = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      onReorder(dragIndex, hoverIndex)
    },
    [onReorder]
  )

  const openAR = (post: Post) => {
    setActivePost(post)
    setShowAR(true)
  }

  const cycleStatus = (id: string) => {
    const post = posts.find((p) => p.id === id)
    if (!post) return
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(post.status) + 1) % STATUS_CYCLE.length]
    onUpdate(id, { status: next })
  }

  const cycleType = (id: string) => {
    const order: Post['type'][] = ['image', 'carousel', 'reel']
    const post = posts.find((p) => p.id === id)
    if (!post) return
    const next = order[(order.indexOf(post.type) + 1) % order.length]
    onUpdate(id, { type: next })
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    const added: Post[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      try {
        const dataUrl = await compressImage(file)
        added.push({ id: newId(), type: 'image', image: dataUrl, status: 'draft' })
      } catch {
        // saltar archivos ilegibles
      }
    }
    if (added.length) onAdd(added)
    setUploading(false)
  }

  const exportConfig = (format: 'json' | 'csv') => {
    const data = posts.map((p, i) => ({
      order: i + 1,
      id: p.id,
      type: p.type,
      status: p.status,
      date: p.date || 'TBD',
      caption: p.caption || '',
      hashtags: (p.hashtags || []).join(' '),
    }))

    let blob: Blob
    let filename: string

    if (format === 'json') {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      filename = `HERA_Feed_Config_${new Date().toISOString().split('T')[0]}.json`
    } else {
      const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
      const csv =
        'Order,ID,Type,Status,Date,Caption,Hashtags\n' +
        data.map((d) => [d.order, d.id, d.type, d.status, d.date, esc(d.caption), esc(d.hashtags)].join(',')).join('\n')
      blob = new Blob([csv], { type: 'text/csv' })
      filename = `HERA_Feed_Config_${new Date().toISOString().split('T')[0]}.csv`
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const Backend = isTouchDevice ? TouchBackend : HTML5Backend
  const backendOptions = isTouchDevice ? { enableMouseEvents: true, delayTouchStart: 200 } : undefined

  return (
    <DndProvider backend={Backend} options={backendOptions as any}>
      <div className="w-full max-w-4xl mx-auto px-4 pb-20">
        {/* Feed Navigation */}
        <div className="flex justify-between items-center border-t border-white/10 mt-8">
          <div className="flex gap-6 md:gap-12 -mt-px">
            <button className="flex items-center gap-2 py-4 border-t border-white text-xs font-bold tracking-widest uppercase">
              <LayoutGrid className="w-4 h-4" /> FEED (4:5)
            </button>
            <button className="hidden md:flex items-center gap-2 py-4 border-t border-transparent text-gray-500 text-xs font-bold tracking-widest uppercase hover:text-white transition-colors">
              <Clapperboard className="w-4 h-4" /> REELS
            </button>
            <button className="hidden md:flex items-center gap-2 py-4 border-t border-transparent text-gray-500 text-xs font-bold tracking-widest uppercase hover:text-white transition-colors">
              <Smartphone className="w-4 h-4" /> AR PREVIEW
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportConfig('csv')}
              className="text-[10px] h-8 border-white/10 bg-white/5 hover:bg-white/10"
            >
              <Download className="w-3 h-3 mr-1" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportConfig('json')}
              className="text-[10px] h-8 border-white/10 bg-white/5 hover:bg-white/10"
            >
              <Download className="w-3 h-3 mr-1" /> JSON
            </Button>
          </div>
        </div>

        {storageFull && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-300">
            Almacenamiento del navegador lleno — borra posts antiguos o exporta la config antes de subir más.
          </div>
        )}

        <div className="grid grid-cols-3 gap-1 md:gap-2 mt-4">
          {posts.map((post, index) => (
            <DraggablePost
              key={post.id}
              index={index}
              post={post}
              movePost={movePost}
              onSelect={openAR}
              onDelete={onDelete}
              onCycleStatus={cycleStatus}
              onCycleType={cycleType}
            />
          ))}

          <motion.div
            whileHover={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[4/5] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-white hover:border-white/30 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
              {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-center px-2">
              {uploading ? 'Procesando...' : 'Subir Activo HERA'}
            </span>
          </motion.div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {posts.length === 0 && (
          <p className="text-center text-[11px] text-gray-600 mt-6 font-mono tracking-widest uppercase">
            Feed vacío — toca "Subir Activo HERA" para empezar a construirlo
          </p>
        )}

        {/* AR Preview + Caption Overlay */}
        <AnimatePresence>
          {showAR && activePost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl overflow-y-auto p-4"
            >
              <button
                onClick={() => setShowAR(false)}
                className="fixed top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-10 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-full py-12">
                <div className="relative aspect-[9/16] max-h-[70vh] mx-auto w-full max-w-sm bg-gradient-to-b from-gray-900 to-black rounded-[3rem] border-[8px] border-white/10 overflow-hidden shadow-2xl">
                  <ImageWithFallback src={activePost.image} className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.div
                      animate={{
                        rotateY: 360,
                        y: [0, -20, 0],
                      }}
                      transition={{
                        rotateY: { duration: 10, repeat: Infinity, ease: 'linear' },
                        y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                      }}
                      className="w-48 h-48 relative"
                    >
                      <div className="absolute inset-0 border-2 border-cyan-400/50 rounded-full animate-pulse" />
                      <div className="absolute inset-4 border border-white/20 rounded-full animate-spin" style={{ animationDuration: '8s' }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Box className="w-14 h-14 text-cyan-400" />
                      </div>
                    </motion.div>
                    <div className="mt-10 text-center space-y-2">
                      <div className="text-cyan-400 font-mono text-xs tracking-[0.3em]">TRACKING ACTIVE</div>
                      <div className="text-white text-xl font-bold uppercase tracking-widest">Visualización AR</div>
                    </div>
                  </div>

                  <div className="absolute bottom-10 left-0 right-0 px-8 flex justify-between items-center">
                    <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <Maximize2 className="w-5 h-5" />
                    </div>
                    <div className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/40" />
                    </div>
                    <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pb-8">
                  <CaptionEditor
                    key={activePost.id}
                    initialCaption={activePost.caption || ''}
                    initialHashtags={activePost.hashtags || []}
                    onSave={(cap, tags) => {
                      onUpdate(activePost.id, { caption: cap, hashtags: tags })
                    }}
                    postType={activePost.type === 'reel' ? 'Digital Motion' : 'Digital Object'}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Precisión AR</div>
                      <div className="text-xl font-mono text-cyan-400">99.8%</div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Latencia</div>
                      <div className="text-xl font-mono text-cyan-400">12ms</div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      onClick={() => {
                        onSelectPost(activePost)
                        setShowAR(false)
                      }}
                      className="flex-1 bg-white text-black hover:bg-gray-200 py-6 rounded-2xl font-bold"
                    >
                      PROCESAR EN MOTORES 3D
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DndProvider>
  )
}
