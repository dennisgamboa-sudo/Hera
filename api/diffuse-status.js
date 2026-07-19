// Vercel serverless (raíz del repo): consulta el estado de una predicción.
const KEY = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN

export default async function handler(req, res) {
  try {
    const id = req.query?.id
    if (!id) return res.status(400).json({ error: 'Falta id' })
    if (!KEY) return res.status(500).json({ error: 'Falta REPLICATE_API_KEY en Vercel.' })

    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      return res.status(200).json({ status: 'failed', error: `Replicate ${r.status}: ${text.slice(0, 200)}` })
    }
    const data = await r.json()
    const resultUrl =
      data.status === 'succeeded'
        ? Array.isArray(data.output)
          ? data.output[0]
          : data.output
        : null
    return res.status(200).json({ status: data.status, resultUrl, error: data.error || null })
  } catch (err) {
    return res.status(200).json({ status: 'failed', error: `Error interno: ${err.message}` })
  }
}
