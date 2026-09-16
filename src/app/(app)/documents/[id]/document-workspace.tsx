'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CircleAlert,
  CircleCheck,
  Download,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react'
import { Button, Card, CardContent, Textarea, toast } from '@/components/ui'
import { ChalanEditor } from '@/components/chalan-editor'
import { formatDhaka, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  approveDocument,
  rejectDocument,
  saveDraft,
  submitChalan,
} from '@/server/actions/documents'
import type { DeliveryChalanDocument } from '@/types/delivery-chalan'
import type { DocumentStatus } from '@/db/schema'
import { HistoryTimeline, type HistoryEntry } from './history-timeline'

/** Matches the approved app's wording exactly. */
const STEP_TEXT: Record<string, string> = {
  ocr: 'Step 1/2: Extracting Text...',
  structuring: 'Step 2/2: Structuring Data...',
}

const FAILURE_TEXT: Record<string, string> = {
  not_configured: 'The reader is not set up yet. Ask an administrator.',
  file_missing: 'The file could not be found in storage.',
  file_too_large: 'That file is too large for the reader.',
  checksum_mismatch: 'The stored file does not match what was uploaded.',
  unsupported_type: 'That file type cannot be read.',
  timed_out: 'Reading took too long and was stopped.',
  bad_json: 'The reader returned something we could not understand.',
  model_error: 'The reader could not read this document.',
}

export function DocumentWorkspace(props: {
  documentId: string
  status: DocumentStatus
  revision: number
  mimeType: string
  originalUrl: string
  originalFilename: string
  rawOcrText: string | null
  editedResult: DeliveryChalanDocument | null
  structured: boolean
  processingError: string | null
  reviewNote: string | null
  reviewedAt: string | null
  submissionCount: number
  canEdit: boolean
  canSubmit: boolean
  canDecide: boolean
  canRetry: boolean
  canDownload: boolean
  blockedBySelfRule: boolean
  requireRejectNote: boolean
  history: HistoryEntry[]
}) {
  const router = useRouter()
  const [status, setStatus] = useState(props.status)
  const [step, setStep] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const draftRef = useRef<{ doc: DeliveryChalanDocument | null; count: number }>({
    doc: props.editedResult,
    count: 0,
  })
  const revisionRef = useRef(props.revision)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Poll while the reader is working. The server tells us which of the two steps
  // it is on, so the approved "Step 1/2 / Step 2/2" wording is preserved.
  useEffect(() => {
    if (status !== 'processing' && status !== 'uploaded') return
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch('/api/documents/' + props.documentId + '/status', {
          cache: 'no-store',
        })
        if (!res.ok || !alive) return
        const data = (await res.json()) as {
          status: DocumentStatus
          step: string | null
          revision: number
        }
        if (!alive) return
        setStep(data.step)
        if (data.status !== status) {
          setStatus(data.status)
          revisionRef.current = data.revision
          // Reload so the editor gets the freshly extracted data.
          if (data.status !== 'processing') router.refresh()
        }
      } catch {
        /* a dropped poll is harmless; the next one will catch up */
      }
    }
    void tick()
    const id = setInterval(tick, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [status, props.documentId, router])

  const persistDraft = useCallback(async () => {
    const { doc } = draftRef.current
    if (!doc || !props.canEdit) return
    const result = await saveDraft({
      documentId: props.documentId,
      expectedRevision: revisionRef.current,
      editedResult: doc,
    })
    if (result.ok) {
      revisionRef.current = result.revision
    } else if (result.code === 'STALE') {
      toast.error('Someone else changed this document. Reloading.')
      router.refresh()
    }
  }, [props.canEdit, props.documentId, router])

  const onEditorChange = useCallback(
    (next: DeliveryChalanDocument, correctionCount: number) => {
      draftRef.current = { doc: next, count: correctionCount }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => void persistDraft(), 1500)
    },
    [persistDraft],
  )

  async function onSubmit() {
    setBusy(true)
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const result = await submitChalan({
        documentId: props.documentId,
        expectedRevision: revisionRef.current,
        document: draftRef.current.doc,
        corrections_made: draftRef.current.count > 0,
        correction_count: draftRef.current.count,
        requestId: crypto.randomUUID(),
      })
      if (result.ok) {
        toast.success('Sent for approval.')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  async function onDecide(decision: 'approve' | 'reject') {
    if (decision === 'reject' && props.requireRejectNote && !note.trim()) {
      toast.error('Please write a note explaining the rejection.')
      return
    }
    setBusy(true)
    try {
      const fn = decision === 'approve' ? approveDocument : rejectDocument
      const result = await fn({
        documentId: props.documentId,
        note: note.trim() || undefined,
        requestId: crypto.randomUUID(),
      })
      if (result.ok) {
        toast.success(decision === 'approve' ? 'Approved.' : 'Rejected.')
        setNote('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  async function onRetry() {
    setBusy(true)
    try {
      const res = await fetch('/api/documents/' + props.documentId + '/ocr', { method: 'POST' })
      if (res.ok) {
        setStatus('processing')
        toast.info('Reading again…')
      } else {
        const body = await res.json().catch(() => ({ error: 'Could not start the reader.' }))
        toast.error(body.error ?? 'Could not start the reader.')
      }
    } finally {
      setBusy(false)
    }
  }

  // ── still reading ─────────────────────────────────────────────────────────
  if (status === 'processing' || status === 'uploaded') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <LoaderCircle className="size-10 animate-spin text-primary" />
          <div>
            <p className="text-lg font-semibold">
              {step ? STEP_TEXT[step] : 'Getting ready…'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              This usually takes a few seconds. You can leave this page and come back.
            </p>
          </div>
          <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{ width: step === 'structuring' ? '85%' : '40%' }}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── it failed ─────────────────────────────────────────────────────────────
  if (status === 'failed') {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="size-7" />
            </span>
            <div>
              <p className="text-lg font-semibold">Could not read this document</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {FAILURE_TEXT[props.processingError ?? ''] ??
                  'Something went wrong while reading it.'}
              </p>
            </div>
            <div className="flex gap-2">
              {props.canRetry && (
                <Button onClick={onRetry} disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  Try again
                </Button>
              )}
              {props.canDownload && (
                <Button
                  variant="outline"
                  onClick={() => window.open(props.originalUrl, '_blank')}
                >
                  <Download className="size-4" />
                  Open the file
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <HistoryTimeline entries={props.history} />
      </div>
    )
  }

  const readOnly = !props.canEdit
  const statusBanner =
    status === 'rejected' && props.reviewNote ? (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">
            Sent back {props.reviewedAt ? timeAgo(props.reviewedAt) : ''}
          </p>
          <p className="mt-0.5 text-destructive/90 bangla-text">{props.reviewNote}</p>
        </div>
      </div>
    ) : status === 'approved' ? (
      <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <div>
          <p className="font-medium text-success">
            Approved {props.reviewedAt ? formatDhaka(props.reviewedAt, 'short') : ''}
          </p>
          {props.reviewNote && (
            <p className="mt-0.5 text-success/90 bangla-text">{props.reviewNote}</p>
          )}
        </div>
      </div>
    ) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Approver panel sits above the editor so a reviewer sees it first. */}
      {props.canDecide && (
        <Card
          className={cn(
            'border-2',
            props.blockedBySelfRule ? 'border-warning/40' : 'border-primary/30',
          )}
        >
          <CardContent className="pt-6">
            {props.blockedBySelfRule ? (
              <div className="flex items-start gap-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                <p>
                  <span className="font-medium">You submitted this document.</span> Another approver
                  or an admin has to review it.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-semibold">Your decision</h2>
                <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
                  Check the fields against the image, then approve or send it back.
                </p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    props.requireRejectNote
                      ? 'A note is required when sending back. What should be fixed?'
                      : 'Add a note (optional)'
                  }
                  rows={2}
                  className="bangla-text"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => onDecide('approve')} disabled={busy} variant="success">
                    {busy ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <CircleCheck className="size-4" />
                    )}
                    Approve
                  </Button>
                  <Button
                    onClick={() => onDecide('reject')}
                    disabled={busy}
                    variant="destructive"
                  >
                    Send back
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {props.structured && props.editedResult ? (
        <ChalanEditor
          document={props.editedResult}
          imageUrl={props.originalUrl}
          mimeType={props.mimeType}
          readOnly={readOnly}
          onChange={onEditorChange}
          onSubmit={props.canSubmit ? onSubmit : undefined}
          onSaveDraft={props.canEdit ? persistDraft : undefined}
          submitting={busy}
          statusSlot={statusBanner}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            {statusBanner}
            <h2 className="mb-2 mt-2 text-sm font-semibold">Text from the document</h2>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 font-mono text-xs bangla-text">
              {props.rawOcrText || 'No text was found.'}
            </pre>
            {props.canSubmit && (
              <Button onClick={onSubmit} disabled={busy} className="mt-4">
                {busy && <LoaderCircle className="size-4 animate-spin" />}
                Submit for approval
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <HistoryTimeline entries={props.history} />
    </div>
  )
}
