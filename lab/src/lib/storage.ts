export interface Post {
  id: string
  type: 'image' | 'carousel' | 'reel'
  image: string // dataURL
  status: 'published' | 'scheduled' | 'draft'
  date?: string
  caption?: string
  hashtags?: string[]
}

const KEY = 'HERA_LAB_V1'

export function loadPosts(): Post[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.posts) ? parsed.posts : []
  } catch {
    return []
  }
}

export function savePosts(posts: Post[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ posts, v: 1 }))
    return true
  } catch {
    // localStorage lleno — el llamador decide cómo avisar
    return false
  }
}

/**
 * Comprime una imagen para el feed (localStorage). Sube a 1350px (altura
 * nativa de Instagram 4:5) y q0.88 — bastante más nítida que el viejo 1080/0.82,
 * base más rica para el Realismo de Piel, sin reventar el almacenamiento.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read error'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode error'))
      img.onload = () => {
        const MAX = 1350
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas error'))
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.88))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Reduce un dataURL ya existente para guardarlo en el feed (localStorage).
 * El Realismo de Piel devuelve imágenes de alta resolución (~3MB) perfectas
 * para descargar, pero demasiado grandes para localStorage — el feed guarda
 * esta versión ligera; la descarga usa siempre la full-res.
 */
export function compressDataUrl(dataUrl: string, max = 1350, quality = 0.88): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onerror = () => resolve(dataUrl)
    img.onload = () => {
      let { width, height } = img
      if (width > max || height > max) {
        const scale = max / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
