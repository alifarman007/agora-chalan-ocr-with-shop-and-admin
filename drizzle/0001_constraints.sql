-- Hand-written. Keeps bad values out of the database itself, not just out of the app.
-- text + CHECK rather than Postgres ENUM types: adding a value later is a plain
-- migration instead of an ALTER TYPE, which keeps us portable.

ALTER TABLE "role" ADD CONSTRAINT "role_code_check"
  CHECK (code IN ('super_admin','admin','approver','shop_user','viewer'));
--> statement-breakpoint
ALTER TABLE "shop_membership" ADD CONSTRAINT "shop_membership_kind_check"
  CHECK (kind IN ('member','approver'));
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_status_check"
  CHECK (status IN ('uploaded','processing','failed','draft','pending_approval','approved','rejected'));
--> statement-breakpoint
ALTER TABLE "document_event" ADD CONSTRAINT "document_event_type_check"
  CHECK (event_type IN ('uploaded','ocr_started','ocr_succeeded','ocr_failed','draft_saved','submitted','resubmitted','approved','rejected','deleted'));
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_size_positive_check"
  CHECK (file_size_bytes > 0);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_revision_check"
  CHECK (revision >= 0 AND submission_count >= 0 AND ocr_attempts >= 0);
