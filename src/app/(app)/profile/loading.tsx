import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function FormSkeleton({ fields }: { fields: number }) {
  return (
    <Card>
      <CardHeader bordered>
        <Skeleton className="h-5 w-40" />
        <Skeleton shape="text" className="mt-2 h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton shape="text" className="h-4 w-24" />
            <Skeleton className="h-9 w-full max-w-md" />
          </div>
        ))}
        <Skeleton className="h-9 w-36" />
      </CardContent>
    </Card>
  )
}

export default function ProfileLoading() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton shape="text" className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormSkeleton fields={4} />
        <FormSkeleton fields={3} />
      </div>
    </>
  )
}
