/**
 * Master Control settings and the document-type registry.
 *
 * Settings are key/value with a jsonb value, validated by a Zod schema in code
 * (src/lib/settings.ts). Adding a setting is therefore a code change with NO migration.
 *
 * document_type is what makes "more document types later" possible: add a row plus a
 * code-side extractor module. The `document` table never changes, because the payload
 * lives in jsonb.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from './auth'

export const appSettings = pgTable('app_setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedByUserId: text('updated_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const documentTypes = pgTable('document_type', {
  /** Matches DeliveryChalanDocument.document_type, e.g. 'delivery_chalan'. */
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  /** true  -> run the second Gemini call and store ai_result
   *  false -> raw OCR text only */
  hasStructuredExtraction: boolean('has_structured_extraction').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Everything that is NOT a document: shops, users, memberships, settings, the grid. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_created_idx').on(t.createdAt),
    index('audit_actor_idx').on(t.actorUserId, t.createdAt),
  ],
)

export type AppSetting = typeof appSettings.$inferSelect
export type DocumentType = typeof documentTypes.$inferSelect
export type AuditLogRow = typeof auditLog.$inferSelect
