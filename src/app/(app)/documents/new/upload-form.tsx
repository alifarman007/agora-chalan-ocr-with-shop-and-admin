'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { CircleAlert, CloudUpload, FileText, LoaderCircle, X } from 'lucide-react'
import { Button, Label, Select, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import { createUploadUrl, registerUpload, attachThumbnail } from '@/server/actions/documents'

type Shop = { id: string; name: string; code: string }
type DocType = { code: string; name: string; structured: boolean }

type Stage = 'idle' | 'hashing' | 'uploading' | 'registering' | 'starting' | 'done'

const STAGE_TEXT: Record<Stage, string> = {
  idle: '',
  hashing: 'Checking the file…',
  uploading: 'Uploading…',
  registering: 'Saving…',
  starting: 'Starting the reader…',
  done: 'Done',
}

/** SHA-256 in the browser, so the server can prove the bytes arrived intact. */
async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Renders page 1 of a PDF to a small PNG.
 * Done in the browser because pdf.js is already here for the preview — doing it on
 * the server would add about 70 MB of native binaries to every function.
 */
async function pdfThumbnail(file: File): Promise<string | null> {
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(480 / base.width, 640 / base.height, 2)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) return null
    await page.render({ canvas, canvasContext: context, viewport }).promise
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('PDF thumbnail failed', error)
    return null
  }
}

export function UploadForm({
  shops,
  types,
  allowedMimeTypes,
  maxFileBytes,
}: {
  shops: Shop[]
  types: DocType[]
  allowedMimeTypes: string[]
  maxFileBytes: number
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [shopId, setShopId] = useState(shops[0]?.id ?? '')
  const [typeCode, setTypeCode] = useState(types[0]?.code ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const busy = stage !== 'idle' && stage !== 'done'
  const selectedType = types.find((t) => t.code === typeCode)

  function pickFile(next: File | null) {
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (!next) {
      setFile(null)
      setPreviewUrl(null)
      return
    }
    if (!allowedMimeTypes.includes(next.type)) {
      setError('That file type is not allowed. You can upload ' + allowedMimeTypes.join(', ') + '.')
      setFile(null)
      setPreviewUrl(null)
      return
    }
    if (next.size > maxFileBytes) {
      setError('That file is ' + formatBytes(next.size) + '. The limit is ' + formatBytes(maxFileBytes) + '.')
      setFile(null)
      setPreviewUrl(null)
      return
    }
    setFile(next)
    setPreviewUrl(URL.createObjectURL(next))
  }

  /** PUT straight to storage with progress. File bytes never touch our server. */
  function putToStorage(url: string, method: string, headers: Record<string, string>, body: File) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(method, url)
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error('Upload failed (' + xhr.status + ')'))
      xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'))
      xhr.send(body)
    })
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!file || !shopId || !typeCode) return
    setError(null)
    setProgress(0)

    try {
      setStage('hashing')
      const hash = await sha256(file)

      setStage('uploading')
      const signed = await createUploadUrl({
        shopId,
        documentTypeCode: typeCode,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      if (!signed.ok) {
        setError(signed.error)
        setStage('idle')
        return
      }

      await putToStorage(signed.uploadUrl, signed.method, signed.headers, file)

      setStage('registering')
      const registered = await registerUpload({
        documentId: signed.documentId,
        shopId,
        documentTypeCode: typeCode,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        sha256: hash,
      })
      if (!registered.ok) {
        setError(registered.error)
        setStage('idle')
        return
      }

      if (registered.duplicate) {
        toast.info('That file was already uploaded to this shop. Opening the original.')
        router.push('/documents/' + registered.documentId)
        return
      }

      // A PDF thumbnail is best effort and must never block the upload.
      if (file.type === 'application/pdf') {
        const dataUrl = await pdfThumbnail(file)
        if (dataUrl) await attachThumbnail(registered.documentId, dataUrl).catch(() => {})
      }

      setStage('starting')
      await fetch('/api/documents/' + registered.documentId + '/ocr', { method: 'POST' })

      setStage('done')
      router.push('/documents/' + registered.documentId)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('idle')
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!busy) pickFile(e.dataTransfer.files?.[0] ?? null)
          }}
          className={cn(
            'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border bg-card',
            busy && 'opacity-60',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={allowedMimeTypes.join(',')}
            disabled={busy}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {!file ? (
            <>
              <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <CloudUpload className="size-8" />
              </span>
              <p className="text-lg font-semibold">Drop a chalan here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                JPG, PNG, WEBP or PDF, up to {formatBytes(maxFileBytes)}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => inputRef.current?.click()}
              >
                Choose a file
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative mb-4 h-64 w-48 overflow-hidden rounded-lg border border-border bg-muted">
                {file.type === 'application/pdf' ? (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <FileText className="size-12" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl ?? ''} alt="" className="size-full object-contain" />
                )}
              </div>
              <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              {!busy && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => pickFile(null)}
                >
                  <X className="size-4" />
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>

        {busy && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              {STAGE_TEXT[stage]}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: (stage === 'uploading' ? progress : 100) + '%' }}
              />
            </div>
          </div>
        )}
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop">Shop</Label>
          <Select
            id="shop"
            value={shopId}
            disabled={busy || shops.length === 1}
            onChange={(e) => setShopId(e.target.value)}
            options={shops.map((s) => ({ value: s.id, label: s.name + ' (' + s.code + ')' }))}
          />
          {shops.length === 1 && (
            <p className="text-xs text-muted-foreground">You upload for this shop.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Kind of document</Label>
          <Select
            id="type"
            value={typeCode}
            disabled={busy}
            onChange={(e) => setTypeCode(e.target.value)}
            options={types.map((t) => ({ value: t.code, label: t.name }))}
          />
          <p className="text-xs text-muted-foreground">
            {selectedType?.structured
              ? 'The reader will pull out the chalan fields so you can check them.'
              : 'The reader will give you the text only. There is no form to check.'}
          </p>
        </div>

        <Button type="submit" disabled={!file || busy} className="mt-2 w-full">
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {busy ? STAGE_TEXT[stage] : 'Upload and read'}
        </Button>

        <p className="text-xs text-muted-foreground">
          The file goes straight to storage from your browser. Reading usually takes under a minute.
        </p>
      </aside>
    </form>
  )
}
