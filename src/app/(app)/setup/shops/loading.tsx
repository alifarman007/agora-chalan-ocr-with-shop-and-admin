import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function LoadingShops() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton shape="text" className="w-full max-w-2xl" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-9 w-28" />
      </div>
      <TableSkeleton rows={6} cols={6} bordered />
    </div>
  )
}
