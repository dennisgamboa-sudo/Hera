// Vercel serverless: proxy de imágenes de Replicate hacia el navegador.
// El injerto de textura necesita leer los píxeles del resultado; al servirlo
// desde nuestro propio dominio evitamos cualquier bloqueo CORS del CDN.
const ALLOWED_HOSTS = ['replicate.delivery', 'replicate.com']

export default async function handler(req, res) {
  try {
    const url = req.query?.url
    if (!url) return res.status(400).json({ error: 'Falta url' })
    let host
    try {
      host = new URL(url).hostname
    } catch {
      return res.status(400).json({ error: 'URL inválida' })
    }
    if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
      return res.status(403).json({ error: 'Host no permitido' })
    }
    const r = await fetch(url)
    if (!r.ok) return res.status(502).json({ error: `Origen respondió ${r.status}` })
    const buf = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).send(buf)
  } catch (err) {
    return res.status(500).json({ error: `Error interno: ${err.message}` })
  }
}
