import Link from 'next/link'
import { cn } from '@/lib/cn'

const TONES = {
  neutral: 'text-muted-foreground bg-muted',
  brand: 'text-brand bg-brand/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning-foreground bg-warning/20',
  destructive: 'text-destructive bg-destructive/10',
} as const

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  href,
}: {
  label: string
  value: number | string
  hint?: string
  icon?: React.ReactNode
  tone?: keyof typeof TONES
  href?: string
}) {
  const body = (
    <div
      className={cn(
        'flex h-full items-start gap-4 rounded-xl border border-border bg-card p-5 transition-colors',
        href && 'hover:border-primary/40 hover:bg-accent/40',
      )}
    >
      {icon && (
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', TONES[tone])}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )

  if (!href) return body
  return (
    <Link
      href={href}
      className="rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  )
}
