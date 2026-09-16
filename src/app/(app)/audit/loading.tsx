import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function AuditLoading() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton shape="text" className="h-4 w-96 max-w-full" />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-9 w-full sm:w-52" />
        <Skeleton className="h-9 w-full sm:w-40" />
        <Skeleton className="h-9 w-full sm:w-40" />
      </div>

      <TableSkeleton rows={10} cols={6} />
    </>
  )
}
