import type { Metadata } from 'next'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { documentTypes, shops } from '@/db/schema'
import { requirePermission } from '@/lib/auth/session'
import { getSettings } from '@/server/settings'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { UploadForm } from './upload-form'

export const metadata: Metadata = { title: 'Upload a document' }

export default async function NewDocumentPage() {
  const actor = await requirePermission('document.upload')

  // Only shops this person may actually upload into, and only active ones.
  const scope = actor.uploadScope
  const availableShops =
    scope === 'all'
      ? await db.select().from(shops).where(eq(shops.isActive, true)).orderBy(shops.name)
      : scope.length === 0
        ? []
        : await db
            .select()
            .from(shops)
            .where(and(eq(shops.isActive, true), inArray(shops.id, scope)))
            .orderBy(shops.name)

  const types = await db
    .select()
    .from(documentTypes)
    .where(eq(documentTypes.isActive, true))
    .orderBy(documentTypes.sortOrder)

  const settings = await getSettings()

  if (availableShops.length === 0) {
    return (
      <>
        <PageHeader title="Upload a document" />
        <EmptyState
          title="No shop to upload into"
          description="Your account is not linked to an active shop yet. Ask an administrator to add you to one."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Upload a document"
        description="Pick the shop and the kind of document, then choose the file. The reader starts as soon as the upload finishes."
      />
      <UploadForm
        shops={availableShops.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
        types={types.map((t) => ({
          code: t.code,
          name: t.name,
          structured: t.hasStructuredExtraction,
        }))}
        allowedMimeTypes={settings['upload.allowed_mime_types']}
        maxFileBytes={settings['upload.max_file_bytes']}
      />
    </>
  )
}
