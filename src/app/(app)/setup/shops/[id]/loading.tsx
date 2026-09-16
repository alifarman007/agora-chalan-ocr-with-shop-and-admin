import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function LoadingShop() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton shape="text" className="w-full max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton lines={5} showFooter />
        <CardSkeleton lines={5} />
      </div>
      <CardSkeleton lines={3} />
    </div>
  )
}
