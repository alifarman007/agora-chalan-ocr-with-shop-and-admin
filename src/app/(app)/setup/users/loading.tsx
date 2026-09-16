import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function LoadingUsers() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton shape="text" className="w-full max-w-2xl" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-48" />
      </div>
      <TableSkeleton rows={8} cols={6} bordered />
    </div>
  )
}
