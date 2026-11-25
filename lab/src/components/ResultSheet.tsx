import { motion } from 'motion/react'
import { X, Share2, Download, Hand } from 'lucide-react'
import { Button } from './ui/button'
import { DeliverItem, canShareFiles, shareImages, desktopDownload } from '../lib/download'

interface ResultSheetProps {
  items: DeliverItem[]
  title: string
  onClose: () => void
}

export function ResultSheet({ items, title, onClose }: ResultSheetProps) {
  const shareable = canShareFiles(items)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="max-w-lg mx-auto p-4 pb-24">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-black/80 backdrop-blur py-3 z-10">
          <h3 className="text-sm font-bold tracking-widest uppercase">{title}</h3>
          <button onClick={onClose} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 mb-5">
          {shareable && (
            <Button
              onClick={() => shareImages(items)}
              className="w-full h-13 py-4 bg-white text-black hover:bg-gray-200 rounded-2xl font-bold"
            >
              <Share2 className="w-4 h-4 mr-2" /> GUARDAR EN FOTOS ({items.length})
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => desktopDownload(items)}
            className="w-full py-4 bg-white/10 text-white hover:bg-white/20 rounded-2xl"
          >
            <Download className="w-4 h-4 mr-2" /> DESCARGAR ARCHIVO{items.length > 1 ? 'S' : ''}
          </Button>
        </div>

        <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl flex gap-3 mb-5">
          <Hand className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            En iPhone también puedes <span className="text-white font-bold">mantener pulsada</span> cualquier imagen de abajo y elegir{' '}
            <span className="text-white font-bold">"Guardar en Fotos"</span>.
          </p>
        </div>

        {/* Imágenes a tamaño completo para long-press */}
        <div className="space-y-4">
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-white/10">
              <img src={it.url} alt={it.name} className="w-full h-auto" />
              <div className="px-3 py-2 text-[10px] font-mono text-gray-500 bg-white/5">{it.name}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
