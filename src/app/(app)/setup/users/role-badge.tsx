import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { ROLE_META, type RoleCode } from '@/lib/permissions'

const VARIANTS: Record<RoleCode, BadgeVariant> = {
  super_admin: 'destructive',
  admin: 'default',
  approver: 'info',
  shop_user: 'secondary',
  viewer: 'outline',
}

export function RoleBadge({ roleCode }: { roleCode: RoleCode }) {
  return (
    <Badge variant={VARIANTS[roleCode]} outlined>
      {ROLE_META[roleCode].name}
    </Badge>
  )
}
