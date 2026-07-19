import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { PREDICTIONS_URL, buildInput, resolveModelVersion } from '../api/_config.js'

// Cargar .env.local que vive junto a este archivo (server/.env.local),
// sin importar desde qué carpeta se arranque el proceso.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env.local') })

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json({ limit: '50mb' }))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: 'clarity-upscaler (Magnific-style)', timestamp: new Date().toISOString() })
})

// Mismos endpoints que las funciones serverless de Vercel (api/diffuse-*.js),
// para que el frontend use rutas relativas idénticas en local y en producción.
app.post('/api/diffuse-start', async (req, res) => {
  try {
    const body = req.body || {}
    if (!body.imageDataUrl) return res.status(400).json({ error: 'Missing imageDataUrl' })
    if (!process.env.REPLICATE_API_KEY) {
      return res.status(500).json({ error: 'Server misconfigured: missing REPLICATE_API_KEY' })
    }
    const version = await resolveModelVersion(process.env.REPLICATE_API_KEY)
    const r = await fetch(PREDICTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, input: buildInput(body) }),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      return res.status(r.status).json({ error: 'Replicate API error', details: err })
    }
    const data = await r.json()
    console.log('[diffuse-start] prediction', data.id, data.status)
    return res.json({ id: data.id, status: data.status })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message })
  }
})

app.get('/api/diffuse-status', async (req, res) => {
  try {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_KEY}` },
    })
    if (!r.ok) return res.status(r.status).json({ error: 'Failed to check prediction status' })
    const data = await r.json()
    const resultUrl =
      data.status === 'succeeded' ? (Array.isArray(data.output) ? data.output[0] : data.output) : null
    return res.json({ status: data.status, resultUrl, error: data.error || null })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`[server] ✨ HERA diffusion server (Magnific-style) on http://localhost:${PORT}`)
  console.log(`[server] Model: philz1337x/clarity-upscaler`)
  console.log(`[server] API key: ${process.env.REPLICATE_API_KEY ? '✅ configured' : '❌ MISSING'}`)
})
