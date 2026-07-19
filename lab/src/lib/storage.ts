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
 * Comprime una imagen a máx 1080px de lado mayor, JPEG q0.82,
 * para que quepan ~15-25 posts en localStorage (~5MB).
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read error'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode error'))
      img.onload = () => {
        const MAX = 1080
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
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
