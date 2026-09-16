'use client'

/**
 * Loads the chart in the browser only.
 *
 * Recharts measures its container to decide how big to draw, and there is nothing to
 * measure on the server — a server-rendered chart is an empty box until it hydrates.
 * Rendering it server-side also turned out to be very slow, so we skip it entirely and
 * show a skeleton of the same height, which keeps the layout from jumping.
 */
import dynamic from 'next/dynamic'

const TrendChart = dynamic(() => import('./trend-chart').then((m) => m.TrendChart), {
  ssr: false,
  loading: () => (
    <div
      className="h-64 w-full animate-pulse rounded-lg bg-muted/50"
      role="status"
      aria-label="Loading the chart"
    />
  ),
})

export type TrendPoint = { day: string; status: string; value: number }

export function TrendChartLoader({
  data,
  from,
  to,
}: {
  data: TrendPoint[]
  from: string
  to: string
}) {
  return <TrendChart data={data} from={from} to={to} />
}
