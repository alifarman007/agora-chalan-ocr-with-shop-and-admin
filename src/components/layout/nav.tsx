'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  CloudUpload,
  FileText,
  Menu,
  ScanText,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Permission } from '@/lib/permissions'

export type NavItem = {
  href: string
  label: string
  icon: keyof typeof ICONS
  permission?: Permission
  exact?: boolean
}

const ICONS = {
  dashboard: ChartColumn,
  documents: FileText,
  upload: CloudUpload,
  approvals: ClipboardCheck,
  approved: CircleCheck,
  shops: Store,
  users: Users,
  approvers: ShieldCheck,
  settings: Settings,
  audit: ScrollText,
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Work',
    items: [
      { href: '/', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view', exact: true },
      { href: '/documents', label: 'Documents', icon: 'documents', permission: 'document.view' },
      { href: '/documents/new', label: 'Upload', icon: 'upload', permission: 'document.upload' },
      { href: '/approvals', label: 'Approvals', icon: 'approvals', permission: 'document.view' },
      { href: '/approved', label: 'Approved', icon: 'approved', permission: 'document.view' },
    ],
  },
  {
    label: 'Setup',
    items: [
      { href: '/setup/shops', label: 'Shops', icon: 'shops', permission: 'shop.manage' },
      { href: '/setup/users', label: 'Users', icon: 'users', permission: 'user.manage' },
      {
        href: '/setup/approvers',
        label: 'Approvers',
        icon: 'approvers',
        permission: 'membership.manage',
      },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Master Control', icon: 'settings', permission: 'settings.manage', exact: true },
      { href: '/settings/roles', label: 'Roles', icon: 'approvers', permission: 'role.manage' },
      { href: '/audit', label: 'Audit log', icon: 'audit', permission: 'audit.view' },
    ],
  },
]

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href
  if (item.href === '/documents') {
    return pathname === '/documents' || (pathname.startsWith('/documents/') && pathname !== '/documents/new')
  }
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

function NavLinks({
  permissions,
  onNavigate,
}: {
  permissions: string[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const held = new Set(permissions)

  return (
    <nav className="flex flex-col gap-6 p-3">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.permission || held.has(i.permission))
        // A group the user has no access to is not rendered at all.
        if (items.length === 0) return null
        return (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = ICONS[item.icon]
                const active = isActive(pathname, item)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

export function Brand({ companyName }: { companyName: string }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 px-4 py-4 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground">
        <ScanText className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold tracking-tight">{companyName}</span>
        <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Chalan Dashboard
        </span>
      </span>
    </Link>
  )
}

export function Sidebar({
  permissions,
  companyName,
}: {
  permissions: string[]
  companyName: string
}) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar lg:block">
      <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto">
        <Brand companyName={companyName} />
        <NavLinks permissions={permissions} />
      </div>
    </aside>
  )
}

export function MobileNav({
  permissions,
  companyName,
}: {
  permissions: string[]
  companyName: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto border-r border-border bg-sidebar shadow-xl">
            <div className="flex items-center justify-between pr-2">
              <Brand companyName={companyName} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <NavLinks permissions={permissions} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
