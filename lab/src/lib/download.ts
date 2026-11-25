// Entrega de imágenes compatible con iOS: share sheet nativo, o vista para
// mantener-pulsado-y-guardar. a.download solo funciona fiable en desktop.

export interface DeliverItem {
  url: string // dataURL
  name: string
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/data:(.*?);/)?.[1] || 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function itemsToFiles(items: DeliverItem[]): File[] {
  return items.map((it) => new File([dataUrlToBlob(it.url)], it.name, { type: 'image/jpeg' }))
}

export function canShareFiles(items: DeliverItem[]): boolean {
  try {
    const nav = navigator as any
    if (!nav.canShare) return false
    return nav.canShare({ files: itemsToFiles(items.slice(0, 1)) })
  } catch {
    return false
  }
}

export async function shareImages(items: DeliverItem[]): Promise<boolean> {
  try {
    const files = itemsToFiles(items)
    await (navigator as any).share({ files, title: 'HERA' })
    return true
  } catch {
    return false
  }
}

export function desktopDownload(items: DeliverItem[]) {
  items.forEach((it, i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(dataUrlToBlob(it.url))
      a.download = it.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    }, i * 300)
  })
}
