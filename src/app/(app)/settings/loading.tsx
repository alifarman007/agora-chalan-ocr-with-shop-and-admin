import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton shape="text" className="h-4 w-80 max-w-full" />
      </div>

      <div className="mb-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0" />
        ))}
      </div>

      <Card>
        <CardHeader bordered>
          <Skeleton className="h-5 w-32" />
          <Skeleton shape="text" className="mt-2 h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton shape="text" className="h-4 w-40" />
              <Skeleton className="h-9 w-full max-w-md" />
              <Skeleton shape="text" className="h-3 w-56 max-w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
