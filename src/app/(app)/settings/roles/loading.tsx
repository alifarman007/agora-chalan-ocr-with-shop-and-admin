import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function RolesLoading() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton shape="text" className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="mb-4 h-16 w-full" />
      <TableSkeleton rows={12} cols={6} />
    </>
  )
}
