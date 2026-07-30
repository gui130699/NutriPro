import type { LucideIcon } from 'lucide-react'
import { br, remaining } from '../lib/nutrition'

type Props = { label: string; value: number; goal: number; unit: string; color?: string; icon?: LucideIcon; compact?: boolean }
export function MetricCard({ label, value, goal, unit, color = '#64b996', icon: Icon, compact = false }: Props) {
  const pct = goal ? Math.round(value / goal * 100) : 0
  const over = value > goal
  return <article className={`metric-card ${compact ? 'metric-card-compact' : ''}`} style={{ '--metric-color': over ? '#ef6d65' : color } as React.CSSProperties}>
    <div className="metric-head"><span className="metric-icon">{Icon && <Icon size={17} strokeWidth={2.4}/>}</span><span className="metric-percent">{pct}%</span></div>
    <div className="metric-name">{label}</div>
    <div className="metric-value">{br(value)} <small>{unit}</small></div>
    <div className="metric-caption">{over ? `${br(value - goal)} acima da meta` : `${br(remaining(goal, value))} para a meta`}</div>
    <div className="metric-track"><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
  </article>
}
