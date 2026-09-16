import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AuthError } from '@/lib/auth/session'
import { getDocumentDetail } from '@/server/actions/documents'
import { documentHistory } from '@/server/queries/documents'
import { getSettings } from '@/server/settings'
import { formatDhaka } from '@/lib/format'
import { StatusBadge } from '@/components/ui'
import { DocumentWorkspace } from './document-workspace'
import type { DocumentStatus } from '@/db/schema'

export const metadata: Metadata = { title: 'Document' }

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let detail
  try {
    detail = await getDocumentDetail(id)
  } catch (error) {
    if (error instanceof AuthError && error.code === 'NOT_FOUND') notFound()
    throw error
  }

  const { actor, document: doc, shop, type, originalUrl, editedResult } = detail
  const [history, settings] = await Promise.all([documentHistory(id), getSettings()])

  const canEdit =
    actor.permissions.has('document.edit') && ['draft', 'rejected'].includes(doc.status)
  const canSubmit =
    actor.permissions.has('document.submit') && ['draft', 'rejected'].includes(doc.status)
  const canDecide =
    actor.permissions.has('document.approve') &&
    doc.status === 'pending_approval' &&
    (actor.approveScope === 'all' || actor.approveScope.includes(doc.shopId))
  const isOwnSubmission = doc.submittedByUserId === actor.id
  const blockedBySelfRule = settings['approval.disallow_self_approval'] && isOwnSubmission

  return (
    <>
      <div className="mb-4">
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All documents
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight bangla-text">
              {(editedResult?.chalan_number as string) || doc.originalFilename}
            </h1>
            <StatusBadge status={doc.status as DocumentStatus} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {shop?.name} · {type?.name} · uploaded {formatDhaka(doc.createdAt, 'short')}
          </p>
        </div>
      </div>

      <DocumentWorkspace
        documentId={doc.id}
        status={doc.status as DocumentStatus}
        revision={doc.revision}
        mimeType={doc.mimeType}
        originalUrl={originalUrl}
        originalFilename={doc.originalFilename}
        rawOcrText={doc.rawOcrText}
        editedResult={editedResult}
        structured={Boolean(type?.hasStructuredExtraction)}
        processingError={doc.processingError}
        reviewNote={doc.reviewNote}
        reviewedAt={doc.reviewedAt ? doc.reviewedAt.toISOString() : null}
        submissionCount={doc.submissionCount}
        canEdit={canEdit}
        canSubmit={canSubmit}
        canDecide={canDecide}
        canRetry={actor.permissions.has('document.retry_ocr')}
        canDownload={actor.permissions.has('document.download')}
        blockedBySelfRule={blockedBySelfRule}
        requireRejectNote={settings['approval.require_note_on_reject']}
        history={history.map((h) => ({
          id: String(h.id),
          eventType: h.eventType,
          note: h.note,
          actorName: h.actorName,
          createdAt: h.createdAt.toISOString(),
          details: h.details as Record<string, unknown> | null,
        }))}
      />
    </>
  )
}
