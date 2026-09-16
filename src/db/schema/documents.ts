/**
 * The core table, plus its append-only history.
 *
 * One `document` row per uploaded file, for its whole life. Edits happen in place,
 * guarded by the `revision` counter. Every submit snapshots the submitted payload into
 * `document_event.details`, so the full approval history is reconstructible without a
 * separate versions table.
 *
 * `aiResult` is the agent's output stored EXACTLY as produced and never modified.
 * `editedResult` is the user's working copy.
 */
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './auth'
import { shops } from './shops'
import { documentTypes } from './config'

export const DOCUMENT_STATUSES = [
  'uploaded',
  'processing',
  'failed',
  'draft',
  'pending_approval',
  'approved',
  'rejected',
] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const DOCUMENT_EVENT_TYPES = [
  'uploaded',
  'ocr_started',
  'ocr_succeeded',
  'ocr_failed',
  'draft_saved',
  'submitted',
  'resubmitted',
  'approved',
  'rejected',
  'deleted',
] as const
export type DocumentEventType = (typeof DOCUMENT_EVENT_TYPES)[number]

export const documents = pgTable(
  'document',
  {
    /** Generated server-side BEFORE upload so the storage key can embed it. */
    id: uuid('id').primaryKey().defaultRandom(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    documentTypeCode: text('document_type_code')
      .notNull()
      .references(() => documentTypes.code, { onDelete: 'restrict' }),
    status: text('status').notNull().default('uploaded'),

    // ── the file ───────────────────────────────────────────────────────────
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    /** Hex. Computed in the browser, re-verified server-side from the real bytes. */
    sha256: text('sha256').notNull(),
    storageKey: text('storage_key').notNull(),
    thumbnailKey: text('thumbnail_key'),

    // ── OCR output ─────────────────────────────────────────────────────────
    /** Gemini call 1. Written as a checkpoint BEFORE call 2, so a structuring
     *  failure never has to pay for the OCR call again. */
    rawOcrText: text('raw_ocr_text'),
    /** Gemini call 2, stored exactly as returned. Never modified after write. */
    aiResult: jsonb('ai_result'),
    /** The user's editable copy. Starts as a copy of aiResult. */
    editedResult: jsonb('edited_result'),

    correctionsMade: integer('corrections_made'),
    correctionCount: integer('correction_count'),
    aiConfidence: numeric('ai_confidence', { precision: 5, scale: 4 }),

    processingModel: text('processing_model'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    thinkingTokens: integer('thinking_tokens'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),

    ocrAttempts: integer('ocr_attempts').notNull().default(0),
    ocrStartedAt: timestamp('ocr_started_at', { withTimezone: true }),
    ocrFinishedAt: timestamp('ocr_finished_at', { withTimezone: true }),
    processingError: text('processing_error'),

    // ── who did what ───────────────────────────────────────────────────────
    uploadedByUserId: text('uploaded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** The LAST submitter. This is what the self-approval rule binds to. */
    submittedByUserId: text('submitted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submissionCount: integer('submission_count').notNull().default(0),

    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),

    /** Optimistic lock. Bumped by every write. */
    revision: integer('revision').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('document_storage_key_uq').on(t.storageKey),
    // the same file cannot start a second approval thread in the same shop
    uniqueIndex('document_shop_sha_uq').on(t.shopId, t.sha256),
    index('document_shop_status_created_idx').on(t.shopId, t.status, t.createdAt),
    index('document_status_created_idx').on(t.status, t.createdAt),
    index('document_submitted_by_idx').on(t.submittedByUserId),
    index('document_type_idx').on(t.documentTypeCode),
    // drives the stale-job reaper
    index('document_processing_started_idx')
      .on(t.ocrStartedAt)
      .where(sql`status = 'processing'`),
  ],
)

export const documentEvents = pgTable(
  'document_event',
  {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    /** null = the system (OCR worker, reaper). */
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    note: text('note'),
    /** Per-event payload. `submitted` carries a FULL snapshot of editedResult. */
    details: jsonb('details'),
    /** Client-generated, for idempotent replays of a double-clicked action. */
    requestId: uuid('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('document_event_doc_created_idx').on(t.documentId, t.createdAt),
    index('document_event_type_created_idx').on(t.eventType, t.createdAt),
    uniqueIndex('document_event_request_uq')
      .on(t.documentId, t.requestId)
      .where(sql`request_id is not null`),
  ],
)

export type DocumentRow = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentEvent = typeof documentEvents.$inferSelect
