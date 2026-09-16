# CLAUDE.md — Agora Dashboard

Read this first, every session. Then read `plan.md` before starting any task.

## Summary

A dashboard for **Agora**, a company with many shop branches in Bangladesh. Shop staff upload
delivery chalans and receipts, an approved Gemini OCR agent extracts the data, staff check and
correct it, and an approver approves or rejects it. Adds shops, users, roles, approvals, file storage
and reports around that agent.

**Stack:** Next.js 16 (App Router) · TypeScript 5.9 · React 19 · Tailwind v4 + shadcn/ui · Drizzle ORM ·
PostgreSQL on Supabase · Better Auth · Supabase Storage · Google Gemini · deployed on Vercel.

**Status:** planning done, nothing built. Phase 0 is next. See `plan.md` section 17.

## Structure (planned)

```
src/
  app/
    (auth)/login, forgot-password, reset-password
    (app)/                      dashboard, documents, approvals, approved, setup, settings, audit
    api/auth/[...all]           Better Auth
    api/documents/[id]/ocr      starts OCR, returns 202, works in after()
    api/documents/[id]/status   polled while processing
    api/files/[id]/original     302 to a signed URL
    api/cron/sweep              daily reaper + keep-alive
  components/   ui/ (shadcn), layout/, documents/, chalan-editor/ (ported), dashboard/
  db/           schema/, index.ts, queries/          ← the ONLY place that touches the database
  lib/          auth/, permissions.ts, settings.ts, storage/ (StorageService), format.ts
  server/       actions/, ocr/ (ported services — server-only)
  types/        delivery-chalan.ts (ported, unchanged)
drizzle/        migration files — the only way the schema ever changes
test-data/private/   real chalans, git-ignored, never committed
```

## Commands

To be added in Phase 0.

## OCR source — do not break this

- GitHub: https://github.com/alifarman007/agoraOCR
- Local: `C:\Python_Projects\agoraOCR` (Git Bash: `/c/Python_Projects/agoraOCR`)
- **Approved commit: `b54ac32046e14fa791457a391f4d67ccc69aa2ce`** ("four api", 2026-08-11)
- **Never modify that folder.** No pull, no checkout, no edits. Never open its `.env.local`.
- The client approved this agent. **Do not change its prompts, model settings, JSON structure or
  extraction logic without asking Alif.** Every planned change is listed in `plan.md` section 3.4.
- Two prompt hashes are asserted by a unit test. If that test fails, the approved logic has drifted:
  OCR prompt `a56c92ab33ec…`, chalan prompt `4558824e5052…` (full values in `plan.md` section 3.5).
- Model: `gemini-3.6-flash`, temperature 0.1, both calls. Call 2 sees only the text from call 1,
  never the image. That is on purpose.

## Rules

### Database
- **All database access goes through Drizzle, in `src/db`.** Never `supabase-js` for data, never the
  Supabase Data API.
- **Schema changes only through migration files in `drizzle/`.** Never change the schema with the
  Supabase MCP or the dashboard. Use the MCP only to inspect tables, advisors and logs.
- **Ask Alif before any destructive SQL** — drop, truncate, delete without a where clause, or a
  migration that loses a column.
- Standard Postgres only: `gen_random_uuid()`, `timestamptz`, `jsonb`, `text` + `CHECK`, `numeric`.
  No Supabase-only extension.
- Connection comes from env vars only. `DATABASE_URL` is the transaction pooler (port 6543) and needs
  `{ prepare: false }`. `DATABASE_URL_MIGRATE` is the session pooler (port 5432), for drizzle-kit.

### Staying portable
- Auth lives in our own tables via Better Auth. Never Supabase Auth. Never a `schemaName: "auth"`.
- No RLS policy based on `auth.uid()`. No Edge Functions. No Realtime. Our server checks access.
- Files go through the `StorageService` interface. Supabase now, S3/MinIO/local later.
- Switching databases must mean: change env vars, run migrations, move files. **No code changes.**

### Security — this repo is PUBLIC right now
- **No secrets in git.** No API key, password, connection string or token in any committed file.
  Local secrets go in `.env.local`, which git ignores.
- **No cloud IDs in git.** Committed files may name the Supabase project, the Vercel project and
  their regions. Never a project ref, project ID, team ID, Supabase URL or deployment URL. Look them
  up by name with the MCP tools.
- **No client documents in git.** Real chalans go in `test-data/private/`. Only a manifest of hashes
  is committed.
- The Gemini key is server-only. **Never** give it a `NEXT_PUBLIC_` prefix.
- **Check permissions on the server for every action.** Hiding a button is not a check. Server
  Actions bypass `proxy.ts` matchers, so re-check inside each one.
- Shop scope is a required parameter on every document query, so it cannot be forgotten.
- Record who did what, when, and the note, for every approval.
- A user cannot approve a document they submitted (default on, switchable in Master Control).

### UI
- Match the approved OCR app: slate surfaces, `blue-600` brand, `indigo-600` primary, Inter +
  **Hind Siliguri** for Bangla. Bangla fields carry the `.bangla-text` class.
- Store times as `timestamptz` in UTC, display in **Asia/Dhaka** through one helper. Money in **BDT (৳)**.
- Dark mode, responsive from 360 px, loading skeletons, real empty states, clear status badges.
- The Tailwind v3 → v4 migration changes how some existing class names render. Work through the
  check list in `plan.md` section 10 and compare against screenshots of the old app.

## Workflow

- **Read `plan.md` before each task. Work one phase at a time.**
- **Tick the checkboxes in `plan.md` section 17** as tasks land.
- **Run typecheck, lint and tests before saying "done".** Report failures honestly.
- Small, clear commits. Ask when unsure rather than guessing.
- Twelve questions in `plan.md` section 2 are still open. Anything built on an assumption should say
  so. Phase 0 depends on none of them.

## Links

- GitHub: https://github.com/alifarman007/agora-chalan-ocr-with-shop-and-admin (public for now)
- Supabase org: **alifarman** (Free plan) · project **agora-dashboard** *(proposed, not created)* ·
  region **ap-south-1, Mumbai** *(proposed)*
- Vercel: personal team (Hobby plan) · project **agora-chalan-ocr-with-shop-and-admin** (exists,
  linked to the repo, no deployments) · function region **bom1, Mumbai** *(to set)*
- No refs, IDs, URLs or secrets here while the repo is public.

⚠️ The Vercel project is already linked to this repo, so **a push to `main` will try to deploy**.
Commit `vercel.json` with `git.deploymentEnabled: false` in the first commit.

## Language

**Explain things to me in simple English.** Short sentences. Say what something does before saying
how. If something is unclear or looks wrong, ask — do not guess.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
