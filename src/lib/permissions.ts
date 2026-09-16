/**
 * The permission VOCABULARY. Fixed in code on purpose.
 *
 * The UI can never show a permission the server does not enforce, and adding a
 * permission without mapping it is a compile error. Only the role -> permission
 * MAPPING lives in the database, editable from Master Control.
 */

export const PERMISSIONS = [
  'dashboard.view',
  'document.upload',
  'document.view',
  'document.edit',
  'document.submit',
  'document.approve',
  'document.retry_ocr',
  'document.delete_draft',
  'document.download',
  'document.history.view',
  'shop.view_all',
  'shop.manage',
  'membership.manage',
  'user.manage',
  'role.manage',
  'settings.manage',
  'audit.view',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const ROLE_CODES = ['super_admin', 'admin', 'approver', 'shop_user', 'viewer'] as const
export type RoleCode = (typeof ROLE_CODES)[number]

export const ROLE_META: Record<RoleCode, { name: string; description: string; rank: number }> = {
  super_admin: {
    name: 'Super Admin',
    description: 'Runs the system. The only role that can change Master Control and the permission grid.',
    rank: 100,
  },
  admin: {
    name: 'Admin',
    description: 'Runs day-to-day work across every shop, but cannot change the rules of the system.',
    rank: 80,
  },
  approver: {
    name: 'Approver',
    description: 'Reviews and approves documents for the shops they are assigned to.',
    rank: 60,
  },
  shop_user: {
    name: 'Shop User',
    description: 'Uploads documents, corrects the extracted data and submits it for approval.',
    rank: 40,
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to the shops they are assigned to.',
    rank: 20,
  },
}

/** Seeded into role_permission by the first migration. Editable afterwards. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  // super_admin is granted everything in code and its rows are ignored at runtime,
  // so the grid can never lock the owner out. Listed here for the seed only.
  super_admin: [...PERMISSIONS],
  admin: [
    'dashboard.view',
    'document.upload',
    'document.view',
    'document.edit',
    'document.submit',
    'document.approve',
    'document.retry_ocr',
    'document.delete_draft',
    'document.download',
    'document.history.view',
    'shop.view_all',
    'shop.manage',
    'membership.manage',
    'user.manage',
    'audit.view',
  ],
  approver: [
    'dashboard.view',
    'document.view',
    'document.approve',
    'document.download',
    'document.history.view',
    'audit.view',
  ],
  shop_user: [
    'dashboard.view',
    'document.upload',
    'document.view',
    'document.edit',
    'document.submit',
    'document.retry_ocr',
    'document.delete_draft',
    'document.download',
    'document.history.view',
  ],
  viewer: ['dashboard.view', 'document.view', 'document.download'],
}

/** Grouping, only for laying out the checkbox grid. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: 'Documents',
    permissions: [
      'document.upload',
      'document.view',
      'document.edit',
      'document.submit',
      'document.approve',
      'document.retry_ocr',
      'document.delete_draft',
      'document.download',
      'document.history.view',
    ],
  },
  { label: 'Dashboard', permissions: ['dashboard.view'] },
  {
    label: 'Setup',
    permissions: ['shop.view_all', 'shop.manage', 'membership.manage', 'user.manage'],
  },
  { label: 'System', permissions: ['role.manage', 'settings.manage', 'audit.view'] },
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'See the dashboard',
  'document.upload': 'Upload documents',
  'document.view': 'See documents',
  'document.edit': 'Edit extracted data',
  'document.submit': 'Submit for approval',
  'document.approve': 'Approve or reject',
  'document.retry_ocr': 'Retry a failed OCR',
  'document.delete_draft': 'Delete an unsubmitted document',
  'document.download': 'Download the original file',
  'document.history.view': 'See document history',
  'shop.view_all': 'See every shop',
  'shop.manage': 'Create and edit shops',
  'membership.manage': 'Assign users and approvers to shops',
  'user.manage': 'Create and edit users',
  'role.manage': 'Edit the permission grid',
  'settings.manage': 'Change Master Control',
  'audit.view': 'See the audit log',
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value)
}
