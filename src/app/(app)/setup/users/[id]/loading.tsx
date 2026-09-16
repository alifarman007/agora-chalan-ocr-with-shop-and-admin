import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function LoadingUser() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton shape="text" className="w-full max-w-md" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton lines={5} showFooter />
        <CardSkeleton lines={3} showFooter />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton lines={5} showFooter />
        <CardSkeleton lines={5} showFooter />
      </div>
    </div>
  )
}
