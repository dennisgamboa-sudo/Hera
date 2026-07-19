import { motion } from 'motion/react'
import { Gem } from 'lucide-react'

interface EngineVisualizerProps {
  engineId: string
  image?: string
}

function Placeholder({ tint }: { tint: string }) {
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${tint} flex items-center justify-center`}>
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.08, 1] }}
        transition={{ rotate: { duration: 24, repeat: Infinity, ease: 'linear' }, scale: { duration: 4, repeat: Infinity } }}
        className="opacity-30"
      >
        <Gem className="w-24 h-24 text-white" />
      </motion.div>
      <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-mono text-white/40 tracking-[0.3em] uppercase">
        Sube un activo para procesar
      </div>
    </div>
  )
}

export function EngineVisualizer({ engineId, image }: EngineVisualizerProps) {
  if (engineId === 'source') {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-gray-900 to-black">
        {image ? (
          <img src={image} alt="Source" className="w-full h-full object-contain" />
        ) : (
          <Placeholder tint="from-gray-800 to-black" />
        )}

        <motion.div
          className="absolute inset-0 border-4 border-dashed border-gray-400"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
      </div>
    )
  }

  if (engineId === 'geo-lock') {
    return (
      <div className="relative w-full h-full bg-black overflow-hidden">
        {image ? (
          <img src={image} alt="Geo Lock" className="w-full h-full object-cover opacity-40" />
        ) : (
          <Placeholder tint="from-blue-950 to-black" />
        )}

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.line
              key={`h-${i}`}
              x1="0"
              y1={i * 20}
              x2="400"
              y2={i * 20}
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: i * 0.05, repeat: Infinity }}
            />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.line
              key={`v-${i}`}
              x1={i * 20}
              y1="0"
              x2={i * 20}
              y2="400"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, delay: i * 0.05, repeat: Infinity }}
            />
          ))}

          <motion.polygon
            points="200,120 260,200 200,280 140,200"
            fill="none"
            stroke="rgba(59, 130, 246, 0.8)"
            strokeWidth="2"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '200px 200px' }}
          />

          {Array.from({ length: 8 }).map((_, i) => (
            <motion.circle
              key={`point-${i}`}
              cx={200 + Math.cos((i / 8) * Math.PI * 2) * 60}
              cy={200 + Math.sin((i / 8) * Math.PI * 2) * 60}
              r="3"
              fill="rgba(59, 130, 246, 1)"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [1, 0.5, 1],
              }}
              transition={{ duration: 1, delay: i * 0.1, repeat: Infinity }}
            />
          ))}
        </svg>

        <div className="absolute top-4 left-4 space-y-1">
          <motion.div
            className="text-xs font-mono text-cyan-400"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ANALYZING VERTICES...
          </motion.div>
          <div className="text-xs font-mono text-cyan-300">MESH DENSITY: ULTRA</div>
          <div className="text-xs font-mono text-cyan-300">PRECISION: 99.6%</div>
        </div>
      </div>
    )
  }

  if (engineId === 'atmosphere') {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-amber-900 to-black overflow-hidden">
        {image ? (
          <img src={image} alt="Atmosphere" className="w-full h-full object-cover opacity-60" />
        ) : (
          <Placeholder tint="from-amber-950 to-black" />
        )}

        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={`layer-${i}`}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(251, 191, 36, ${0.15 - i * 0.02}), transparent 60%)`,
            }}
            animate={{
              scale: [1 + i * 0.1, 1.2 + i * 0.1, 1 + i * 0.1],
              opacity: [0.6, 0.8, 0.6],
            }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute w-1 h-1 bg-yellow-300 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              boxShadow: '0 0 10px rgba(251, 191, 36, 0.8)',
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}

        <svg className="absolute inset-0 w-full h-full opacity-30">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.line
              key={`ray-${i}`}
              x1="200"
              y1="200"
              x2={200 + Math.cos((i / 12) * Math.PI * 2) * 300}
              y2={200 + Math.sin((i / 12) * Math.PI * 2) * 300}
              stroke="rgba(251, 191, 36, 0.4)"
              strokeWidth="2"
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2, delay: i * 0.1, repeat: Infinity }}
            />
          ))}
        </svg>

        <div className="absolute bottom-4 left-4 space-y-1">
          <motion.div
            className="text-xs font-mono text-amber-300"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            GENERATING ATMOSPHERE...
          </motion.div>
          <div className="text-xs font-mono text-amber-200">LAYERS: MULTI</div>
          <div className="text-xs font-mono text-amber-200">LIGHTING: VOLUMETRIC</div>
        </div>
      </div>
    )
  }

  if (engineId === 'texture') {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-purple-900 to-black overflow-hidden">
        {image ? (
          <img src={image} alt="Texture Blend" className="w-full h-full object-cover opacity-50" />
        ) : (
          <Placeholder tint="from-purple-950 to-black" />
        )}

        <svg className="absolute inset-0 w-full h-full">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.circle
              key={`lens-${i}`}
              cx="200"
              cy="200"
              r={50 + i * 25}
              fill="none"
              stroke={`rgba(168, 85, 247, ${0.4 - i * 0.05})`}
              strokeWidth="2"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
              style={{ transformOrigin: '200px 200px' }}
            />
          ))}
        </svg>

        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />

        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={`node-${i}`}
            className="absolute w-2 h-2 bg-purple-300 rounded-full"
            style={{
              left: `${20 + (i % 4) * 20}%`,
              top: `${20 + Math.floor(i / 4) * 20}%`,
              boxShadow: '0 0 15px rgba(168, 85, 247, 0.8)',
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 2, delay: i * 0.15, repeat: Infinity }}
          />
        ))}

        <div className="absolute top-4 right-4 space-y-1 text-right">
          <motion.div
            className="text-xs font-mono text-purple-300"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            BLENDING TEXTURES...
          </motion.div>
          <div className="text-xs font-mono text-purple-200">PSM: ACTIVE</div>
          <div className="text-xs font-mono text-purple-200">QUALITY: ULTRA</div>
        </div>
      </div>
    )
  }

  if (engineId === 'final') {
    return (
      <div className="relative w-full h-full bg-black overflow-hidden">
        {image ? (
          <img src={image} alt="Final" className="w-full h-full object-cover" />
        ) : (
          <Placeholder tint="from-yellow-950 to-black" />
        )}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)',
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute bottom-4 right-4 text-right space-y-1">
          <div className="text-xs font-mono text-yellow-200">OUTPUT: 4K</div>
          <div className="text-xs font-mono text-yellow-200">ART DIRECTION: ON</div>
        </div>
      </div>
    )
  }

  return null
}
