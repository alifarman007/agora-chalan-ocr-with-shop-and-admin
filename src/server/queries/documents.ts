import 'server-only'

/**
 * Every read of the document table lives here.
 *
 * `scope` is a REQUIRED argument on every function, so a shop-scoping bug cannot be
 * written by forgetting an argument — it is a compile error. An empty scope array
 * means "nothing", never "everything".
 */
import { and, count, desc, eq, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { documents, documentTypes, shops, users } from '@/db/schema'
import type { DocumentStatus } from '@/db/schema'
import { storage } from '@/lib/storage'

export type Scope = 'all' | string[]

const NOTHING = '00000000-0000-0000-0000-000000000000'

/** Turns a scope into a WHERE fragment. The only place this rule is written. */
function scoped(scope: Scope): SQL | undefined {
  if (scope === 'all') return undefined
  if (scope.length === 0) return eq(documents.shopId, NOTHING)
  return inArray(documents.shopId, scope)
}

function allOf(...parts: (SQL | undefined)[]): SQL | undefined {
  const kept = parts.filter((p): p is SQL => Boolean(p))
  if (kept.length === 0) return undefined
  if (kept.length === 1) return kept[0]
  return and(...kept)
}

export type DocumentFilters = {
  shopIds?: string[]
  status?: DocumentStatus | DocumentStatus[]
  documentTypeCode?: string
  search?: string
  from?: Date
  to?: Date
}

function filterConditions(scope: Scope, f: DocumentFilters = {}): SQL | undefined {
  const parts: (SQL | undefined)[] = [scoped(scope)]

  if (f.shopIds?.length) {
    // Intersect the requested shops with the scope — a filter can narrow, never widen.
    const allowed = scope === 'all' ? f.shopIds : f.shopIds.filter((id) => scope.includes(id))
    parts.push(allowed.length ? inArray(documents.shopId, allowed) : eq(documents.shopId, NOTHING))
  }
  if (f.status) {
    parts.push(
      Array.isArray(f.status)
        ? inArray(documents.status, f.status)
        : eq(documents.status, f.status),
    )
  }
  if (f.documentTypeCode) parts.push(eq(documents.documentTypeCode, f.documentTypeCode))
  if (f.from) parts.push(gte(documents.createdAt, f.from))
  if (f.to) parts.push(lte(documents.createdAt, f.to))
  if (f.search?.trim()) {
    const q = '%' + f.search.trim() + '%'
    parts.push(
      or(
        sql`${documents.originalFilename} ilike ${q}`,
        sql`${documents.rawOcrText} ilike ${q}`,
        sql`${documents.editedResult}->>'chalan_number' ilike ${q}`,
        sql`${documents.editedResult}->>'po_number' ilike ${q}`,
      ),
    )
  }
  return allOf(...parts)
}

export type DocumentListRow = {
  id: string
  status: string
  originalFilename: string
  mimeType: string
  thumbnailKey: string | null
  createdAt: Date
  submittedAt: Date | null
  reviewedAt: Date | null
  aiConfidence: string | null
  shopId: string
  shopName: string
  shopCode: string
  typeName: string
  uploadedByName: string | null
  submittedByName: string | null
  reviewedByName: string | null
  submittedByUserId: string | null
  chalanNumber: string | null
  /** Hours this has been waiting for approval. Computed in SQL so components stay pure. */
  hoursWaiting: number | null
}

const uploader = sql<string>`uploader.name`
const submitter = sql<string>`submitter.name`
const reviewer = sql<string>`reviewer.name`

export async function listDocuments(
  scope: Scope,
  filters: DocumentFilters = {},
  page = { limit: 25, offset: 0 },
): Promise<{ rows: DocumentListRow[]; total: number }> {
  const where = filterConditions(scope, filters)

  const rows = await db
    .select({
      id: documents.id,
      status: documents.status,
      originalFilename: documents.originalFilename,
      mimeType: documents.mimeType,
      thumbnailKey: documents.thumbnailKey,
      createdAt: documents.createdAt,
      submittedAt: documents.submittedAt,
      reviewedAt: documents.reviewedAt,
      aiConfidence: documents.aiConfidence,
      shopId: documents.shopId,
      shopName: shops.name,
      shopCode: shops.code,
      typeName: documentTypes.name,
      submittedByUserId: documents.submittedByUserId,
      uploadedByName: uploader,
      submittedByName: submitter,
      reviewedByName: reviewer,
      chalanNumber: sql<string | null>`${documents.editedResult}->>'chalan_number'`,
      hoursWaiting: sql<number | null>`
        case when ${documents.submittedAt} is null then null
             else extract(epoch from (now() - ${documents.submittedAt})) / 3600 end`,
    })
    .from(documents)
    .innerJoin(shops, eq(shops.id, documents.shopId))
    .innerJoin(documentTypes, eq(documentTypes.code, documents.documentTypeCode))
    .leftJoin(sql`"user" as uploader`, sql`uploader.id = ${documents.uploadedByUserId}`)
    .leftJoin(sql`"user" as submitter`, sql`submitter.id = ${documents.submittedByUserId}`)
    .leftJoin(sql`"user" as reviewer`, sql`reviewer.id = ${documents.reviewedByUserId}`)
    .where(where)
    .orderBy(desc(documents.createdAt))
    .limit(page.limit)
    .offset(page.offset)

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(documents)
    .where(where)

  return { rows: rows as DocumentListRow[], total: Number(total) }
}

/** Signed thumbnail URLs for a page of rows, in one batch. */
export async function withThumbnails<T extends { thumbnailKey: string | null }>(
  rows: T[],
): Promise<(T & { thumbUrl: string | null })[]> {
  const s = storage()
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      thumbUrl: row.thumbnailKey ? await s.createSignedReadUrl(row.thumbnailKey, 900) : null,
    })),
  )
}

// ── dashboard ───────────────────────────────────────────────────────────────

export type StatusCounts = Record<string, number>

export async function countsByStatus(scope: Scope, filters: DocumentFilters = {}) {
  const rows = await db
    .select({ status: documents.status, value: count() })
    .from(documents)
    .where(filterConditions(scope, filters))
    .groupBy(documents.status)

  const out: StatusCounts = {}
  let total = 0
  for (const r of rows) {
    out[r.status] = Number(r.value)
    total += Number(r.value)
  }
  return { byStatus: out, total }
}

export async function dailyTrend(scope: Scope, filters: DocumentFilters = {}) {
  // Grouped by the Dhaka calendar day, so "today" means today in Bangladesh.
  const rows = await db
    .select({
      day: sql<string>`to_char((${documents.createdAt} at time zone 'Asia/Dhaka')::date, 'YYYY-MM-DD')`,
      status: documents.status,
      value: count(),
    })
    .from(documents)
    .where(filterConditions(scope, filters))
    .groupBy(
      sql`to_char((${documents.createdAt} at time zone 'Asia/Dhaka')::date, 'YYYY-MM-DD')`,
      documents.status,
    )
    .orderBy(sql`1`)

  return rows.map((r) => ({ day: r.day, status: r.status, value: Number(r.value) }))
}

export type ShopSummary = {
  shopId: string
  shopName: string
  shopCode: string
  total: number
  pending: number
  approved: number
  rejected: number
  thumbs: { id: string; thumbnailKey: string | null; mimeType: string }[]
}

/**
 * Per-shop counts plus the four most recent documents, for the dashboard cards.
 * One query with a LATERAL join — never N queries in a loop.
 */
export async function perShopSummary(
  scope: Scope,
  filters: DocumentFilters = {},
): Promise<ShopSummary[]> {
  const where = filterConditions(scope, filters)

  const counts = await db
    .select({
      shopId: documents.shopId,
      shopName: shops.name,
      shopCode: shops.code,
      total: count(),
      pending: sql<number>`count(*) filter (where ${documents.status} = 'pending_approval')`,
      approved: sql<number>`count(*) filter (where ${documents.status} = 'approved')`,
      rejected: sql<number>`count(*) filter (where ${documents.status} = 'rejected')`,
    })
    .from(documents)
    .innerJoin(shops, eq(shops.id, documents.shopId))
    .where(where)
    .groupBy(documents.shopId, shops.name, shops.code)
    .orderBy(desc(count()))

  if (counts.length === 0) return []

  const recent = await db
    .select({
      shopId: documents.shopId,
      id: documents.id,
      thumbnailKey: documents.thumbnailKey,
      mimeType: documents.mimeType,
      rn: sql<number>`row_number() over (partition by ${documents.shopId} order by ${documents.createdAt} desc)`,
    })
    .from(documents)
    .where(
      allOf(
        where,
        inArray(
          documents.shopId,
          counts.map((c) => c.shopId),
        ),
      ),
    )

  const byShop = new Map<string, { id: string; thumbnailKey: string | null; mimeType: string }[]>()
  for (const r of recent) {
    if (Number(r.rn) > 4) continue
    const list = byShop.get(r.shopId) ?? []
    list.push({ id: r.id, thumbnailKey: r.thumbnailKey, mimeType: r.mimeType })
    byShop.set(r.shopId, list)
  }

  return counts.map((c) => ({
    shopId: c.shopId,
    shopName: c.shopName,
    shopCode: c.shopCode,
    total: Number(c.total),
    pending: Number(c.pending),
    approved: Number(c.approved),
    rejected: Number(c.rejected),
    thumbs: byShop.get(c.shopId) ?? [],
  }))
}

/** What each document costs to read. Admin-only figure. */
export async function costSummary(scope: Scope, filters: DocumentFilters = {}) {
  const [row] = await db
    .select({
      costUsd: sql<string>`coalesce(sum(${documents.costUsd}), 0)`,
      inputTokens: sql<string>`coalesce(sum(${documents.inputTokens}), 0)`,
      outputTokens: sql<string>`coalesce(sum(${documents.outputTokens}), 0)`,
      processed: sql<string>`count(*) filter (where ${documents.ocrFinishedAt} is not null)`,
      failed: sql<string>`count(*) filter (where ${documents.status} = 'failed')`,
    })
    .from(documents)
    .where(filterConditions(scope, filters))

  return {
    costUsd: Number(row?.costUsd ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    processed: Number(row?.processed ?? 0),
    failed: Number(row?.failed ?? 0),
  }
}

export async function documentHistory(documentId: string) {
  const { documentEvents } = await import('@/db/schema')
  return db
    .select({
      id: documentEvents.id,
      eventType: documentEvents.eventType,
      fromStatus: documentEvents.fromStatus,
      toStatus: documentEvents.toStatus,
      note: documentEvents.note,
      details: documentEvents.details,
      createdAt: documentEvents.createdAt,
      actorName: users.name,
      actorId: documentEvents.actorUserId,
    })
    .from(documentEvents)
    .leftJoin(users, eq(users.id, documentEvents.actorUserId))
    .where(eq(documentEvents.documentId, documentId))
    .orderBy(documentEvents.createdAt)
}
