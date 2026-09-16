import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function LoadingApprovers() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton shape="text" className="w-full max-w-2xl" />
      </div>
      <TableSkeleton rows={6} cols={6} bordered />
    </div>
  )
}
