// Renderizador de slides editoriales HERA — 1080x1350 (4:5), listo para Instagram.
// Estilos y paletas según el kit editorial: cinematic / minimal / clean / note / closer.

export type SlideStyle = 'cinematic' | 'minimal' | 'clean' | 'note' | 'closer'
export type PaletteId = 'desert' | 'studio' | 'noir'

export interface SlideConfig {
  id: string
  style: SlideStyle
  image?: string // dataURL — requerido para cinematic/minimal/clean
  title?: string // cinematic
  note?: string // note
  handle?: string
}

export const PALETTES: Record<PaletteId, { bg: string; accent: string; text: string; label: string }> = {
  desert: { bg: '#1a120b', accent: '#c9a96a', text: '#f5efe4', label: 'Desert' },
  studio: { bg: '#101014', accent: '#aab7c9', text: '#f2f4f7', label: 'Studio' },
  noir: { bg: '#0a0a0a', accent: '#ffffff', text: '#f0f0f0', label: 'Noir' },
}

const W = 1080
const H = 1350

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('img decode'))
    img.src = dataUrl
  })
}

function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(W / img.width, H / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  try {
    ;(ctx as any).letterSpacing = `${px}px`
  } catch {
    /* no soportado — degradación aceptable */
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function renderSlide(config: SlideConfig, paletteId: PaletteId): Promise<string> {
  const p = PALETTES[paletteId]
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const handle = config.handle || '@theeyeofhera'

  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, W, H)

  const hasImage = !!config.image && config.style !== 'note' && config.style !== 'closer'
  if (hasImage) {
    const img = await loadImage(config.image!)
    coverDraw(ctx, img)
  }

  if (config.style === 'cinematic') {
    // scrim inferior para legibilidad
    const grad = ctx.createLinearGradient(0, H * 0.55, 0, H)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.72)')
    ctx.fillStyle = grad
    ctx.fillRect(0, H * 0.55, W, H * 0.45)

    // marca superior
    setSpacing(ctx, 10)
    ctx.font = '600 34px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = p.text
    ctx.fillText('HERA', 72, 108)
    ctx.fillStyle = p.accent
    ctx.fillRect(72, 128, 56, 3)
    setSpacing(ctx, 0)

    // título grande
    if (config.title) {
      setSpacing(ctx, 2)
      ctx.font = '86px Georgia, "Times New Roman", serif'
      ctx.fillStyle = p.text
      const lines = wrapText(ctx, config.title.toUpperCase(), W - 144)
      const lineH = 100
      let y = H - 120 - (lines.length - 1) * lineH
      for (const line of lines) {
        ctx.fillText(line, 72, y)
        y += lineH
      }
      setSpacing(ctx, 0)
    }

    // handle
    setSpacing(ctx, 6)
    ctx.font = '28px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = p.accent
    ctx.fillText(handle, 72, H - 56)
    setSpacing(ctx, 0)
  }

  if (config.style === 'minimal') {
    setSpacing(ctx, 6)
    ctx.font = '26px "Helvetica Neue", Arial, sans-serif'
    const w = ctx.measureText(handle).width
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(W - w - 96, H - 92, w + 48, 52)
    ctx.fillStyle = p.text
    ctx.fillText(handle, W - w - 72, H - 58)
    setSpacing(ctx, 0)
  }

  // clean: la foto pura, sin nada

  if (config.style === 'note') {
    // tarjeta de concepto: fondo plano, texto centrado serif
    ctx.fillStyle = p.accent
    ctx.fillRect(W / 2 - 28, 200, 56, 3)

    const text = config.note || ''
    ctx.font = 'italic 54px Georgia, "Times New Roman", serif'
    ctx.fillStyle = p.text
    ctx.textAlign = 'center'
    const lines = wrapText(ctx, text, W - 260)
    const lineH = 78
    let y = H / 2 - ((lines.length - 1) * lineH) / 2
    for (const line of lines) {
      ctx.fillText(line, W / 2, y)
      y += lineH
    }

    setSpacing(ctx, 8)
    ctx.font = '26px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = p.accent
    ctx.fillText(handle, W / 2, H - 120)
    setSpacing(ctx, 0)
    ctx.textAlign = 'left'
  }

  if (config.style === 'closer') {
    ctx.textAlign = 'center'
    setSpacing(ctx, 24)
    ctx.font = '600 120px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = p.text
    ctx.fillText('HERA', W / 2, H / 2 - 40)
    setSpacing(ctx, 10)
    ctx.font = '30px "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = p.accent
    ctx.fillText('HYBRID VISUAL ARCHITECTURE', W / 2, H / 2 + 40)
    setSpacing(ctx, 6)
    ctx.font = '32px Georgia, "Times New Roman", serif'
    ctx.fillStyle = p.text
    ctx.fillText(`sigue la historia · ${handle}`, W / 2, H / 2 + 140)
    setSpacing(ctx, 0)
    ctx.textAlign = 'left'
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}
