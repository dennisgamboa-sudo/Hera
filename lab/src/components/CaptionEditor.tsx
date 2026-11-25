import { useState } from 'react'
import { Hash, Sparkles, Send, Copy, Check, Info } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

interface CaptionEditorProps {
  onSave: (caption: string, hashtags: string[]) => void
  initialCaption?: string
  initialHashtags?: string[]
  postType?: string
}

const MAISON_HASHTAGS = [
  '#HeraMaison', '#DigitalLuxury', '#VirtualCouture', '#CryptoFashion',
  '#AlgorithmicDesign', '#FutureLuxury', '#DigitalCraftsmanship',
  '#SpatialDesign', '#MetaverseAesthetic', '#CodedElegance',
  '#TechMaison', '#VirtualAtelier', '#GenerativeFashion',
]

export function CaptionEditor({ onSave, initialCaption = '', initialHashtags = [], postType = 'Digital Object' }: CaptionEditorProps) {
  const [caption, setCaption] = useState(initialCaption)
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>(initialHashtags)
  const [isSaved, setIsSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSave = () => {
    onSave(caption, selectedHashtags)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const copyToClipboard = () => {
    const fullText = `${caption}\n\n${selectedHashtags.join(' ')}`
    navigator.clipboard?.writeText(fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold tracking-widest text-xs uppercase flex items-center gap-2 text-white">
          <Sparkles className="w-4 h-4 text-purple-400" /> Editor de Narrativa Maison
        </h3>
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">Tipo: {postType}</span>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Escribe la historia de este objeto digital..."
            className="min-h-[120px] bg-black/40 border-white/10 text-white text-sm focus:border-purple-500/50 transition-all rounded-xl resize-none"
          />
          <div className="absolute bottom-3 right-3 text-[10px] font-mono text-gray-500">
            {caption.length}/2200
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Hash className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Hashtags Sugeridos (Maison)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MAISON_HASHTAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleHashtag(tag)}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                  selectedHashtags.includes(tag)
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                    : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        <Button
          onClick={handleSave}
          className="flex-1 bg-white text-black hover:bg-gray-200 rounded-xl h-11 font-bold text-xs"
        >
          {isSaved ? <Check className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {isSaved ? 'GUARDADO' : 'GUARDAR POST'}
        </Button>
        <Button
          variant="outline"
          onClick={copyToClipboard}
          className="w-11 h-11 rounded-xl border-white/10 hover:bg-white/5 p-0"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex gap-3">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-400 leading-tight">
          La inteligencia de HERA recomienda publicar este objeto a las{' '}
          <span className="text-white font-bold">18:30 CET</span> para maximizar el engagement en audiencias de diseño digital.
        </p>
      </div>
    </div>
  )
}
