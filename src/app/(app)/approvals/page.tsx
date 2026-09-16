import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth/session'
import { listDocuments } from '@/server/queries/documents'
import { PageHeader } from '@/components/layout/page-header'
import { DocumentTable } from '@/components/documents/document-table'

export const metadata: Metadata = { title: 'Approvals' }

export default async function ApprovalsPage() {
  const actor = await requirePermission('document.view')

  // Oldest first: the thing that has waited longest needs attention first.
  const { rows, total } = await listDocuments(
    actor.readScope,
    { status: 'pending_approval' },
    { limit: 100, offset: 0 },
  )
  const ordered = [...rows].sort(
    (a, b) => new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime(),
  )

  const canApprove = actor.permissions.has('document.approve')

  return (
    <>
      <PageHeader
        title="Waiting for approval"
        description={
          canApprove
            ? 'Open a document to check it and make your decision. Oldest first.'
            : 'These documents are waiting for an approver. You can look but not decide.'
        }
      />
      <DocumentTable
        rows={ordered}
        variant="pending"
        currentUserId={actor.id}
        emptyTitle="Nothing waiting"
        emptyDescription="Every submitted document has been reviewed. Good work."
      />
      {total > 100 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing the 100 oldest of {total}.
        </p>
      )}
    </>
  )
}
