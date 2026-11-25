import { useState, ImgHTMLAttributes } from 'react'
import { ImageOff } from 'lucide-react'

export function ImageWithFallback(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [error, setError] = useState(false)
  const { className, ...rest } = props

  if (error || !props.src) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-gray-600 ${className ?? ''}`}>
        <ImageOff className="w-6 h-6" />
      </div>
    )
  }

  return <img {...rest} className={className} onError={() => setError(true)} />
}
