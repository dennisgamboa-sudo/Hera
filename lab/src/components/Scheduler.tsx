import { motion } from 'motion/react'
import { Clock, Calendar, CheckCircle2 } from 'lucide-react'

interface Task {
  id: string
  title: string
  type: 'carousel' | 'reel' | 'post'
  status: 'pending' | 'in_progress' | 'completed'
  time: string
}

const tasks: Task[] = [
  { id: '1', title: 'Subir activos al moodboard', type: 'post', status: 'completed', time: '09:00 AM' },
  { id: '2', title: 'Ordenar feed y definir estados', type: 'carousel', status: 'in_progress', time: '11:30 AM' },
  { id: '3', title: 'Captions + export config del feed', type: 'reel', status: 'pending', time: '02:00 PM' },
]

export function Scheduler() {
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold tracking-widest text-xs uppercase flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" /> Planificación Diaria
        </h3>
        <span className="text-[10px] font-mono text-gray-500">{today}</span>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => (
          <div key={task.id} className="group relative flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
            <div className={`mt-1 p-1 rounded-full ${
              task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {task.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white">{task.title}</h4>
                <span className="text-[10px] font-mono text-gray-500">{task.time}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] uppercase tracking-tighter text-gray-400 border border-white/10 px-1.5 py-0.5 rounded">
                  {task.type}
                </span>
                {task.status === 'in_progress' && (
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-[9px] text-blue-400 uppercase font-bold"
                  >
                    Procesando...
                  </motion.span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-6 py-3 border border-dashed border-white/20 rounded-xl text-[10px] font-bold tracking-widest uppercase hover:bg-white/5 hover:border-white/40 transition-all cursor-pointer">
        Programar Nueva Tarea
      </button>
    </div>
  )
}
