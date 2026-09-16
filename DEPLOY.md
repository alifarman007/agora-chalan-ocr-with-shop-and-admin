# Deploying to Vercel

Follow these in order. Steps 1 to 4 are one-time Supabase setup. Steps 5 to 7 put the app live.

> **Values with angle brackets** are secrets or cloud IDs. Never write them into a file in this
> repo — the repo is public. They go only in `.env.local` on your machine and in Vercel's
> Environment Variables screen.

---

## 1. Get the database password

Supabase generated a password when the project was created and it cannot be read back. Reset it:

1. Open the **agora-dashboard** project in the Supabase dashboard.
2. Go to **Settings → Database → Reset database password**.
3. Copy the new password into a password manager. You will need it twice below.

## 2. Copy the two connection strings

Click **Connect** at the top of the project, then:

- **Transaction pooler**, port **6543** → this becomes `DATABASE_URL`.
  The app runs on this. It is the one that works from a serverless function.
- **Session pooler**, port **5432** → this becomes `DATABASE_URL_MIGRATE`.
  Migrations and `pg_dump` use this. Transaction pooling cannot run migrations.

Both look like `postgres://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:PORT/postgres`.
Replace `[YOUR-PASSWORD]` with the password from step 1.

## 3. Close the Data API

We reach the database only through Drizzle, so the auto-generated REST API should answer nothing.

**Integrations → Data API → turn "Enable Data API" off.**

With it off, no REST endpoint responds at all, whatever the grants say. This is the decisive
control, and it needs no RLS policies — which we are not allowed to use anyway.

## 4. Create the storage bucket

**Storage → New bucket**

| Setting | Value |
|---|---|
| Name | `agora-documents` |
| Public | **off** — must stay private |
| File size limit | `20 MB` |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |

Then **Storage → Configuration → S3 access keys** is where you would later generate keys to copy
everything out. You do not need them now.

For the app itself you need a **secret key**: **Settings → API Keys → Secret keys → create one**.
It starts with `sb_secret_`. It is server-only and must never reach the browser.

---

## 5. Set up the database

Put the two connection strings into your local `.env.local`, then run these once:

```bash
npm run db:migrate    # creates the 13 tables
npm run db:seed       # roles, permission grid, document types, Master Control defaults
npm run create-admin -- --email admin@agora.com.bd --name "Agora Admin" --password "<a strong password>"
```

Check it worked: `npm run db:studio` should show 13 tables and 5 roles.

## 6. Add the environment variables in Vercel

Project **agora-chalan-ocr-with-shop-and-admin** → **Settings → Environment Variables**.
Add each one to **Production** and **Preview**. Tick **Sensitive** on everything marked 🔴.

| Name | Value | Sensitive |
|---|---|:--:|
| `DATABASE_URL` | transaction pooler string, port 6543 | 🔴 |
| `DATABASE_URL_MIGRATE` | session pooler string, port 5432 | 🔴 |
| `BETTER_AUTH_SECRET` | run `npx auth secret`, or any 32+ random characters | 🔴 |
| `BETTER_AUTH_URL` | `https://<your-vercel-domain>` | |
| `NEXT_PUBLIC_APP_URL` | the same URL | |
| `GEMINI_API_KEY_1` | a **new** Gemini key from https://aistudio.google.com | 🔴 |
| `STORAGE_PROVIDER` | `supabase` | |
| `STORAGE_BUCKET` | `agora-documents` | |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | 🔴 |
| `SUPABASE_SECRET_KEY` | the `sb_secret_…` key from step 4 | 🔴 |
| `CRON_SECRET` | any 24+ random characters | 🔴 |

`GEMINI_API_KEY_2` to `_4` are optional. The approved agent rotates through them if one fails.

> **Use a new Gemini key.** The four from the old app were built into browser bundles, so anyone
> who opened the deployed app could read them. Treat all four as public.

> **Use a paid Gemini project.** The free tier's terms allow Google to use your prompts to improve
> their products, which is wrong for a client's financial records, and its measured limits are far
> too low for several shops.

## 7. Check the project settings, then deploy

Still in Vercel **Settings**:

- **General → Framework Preset** → `Next.js`
- **Functions → Function Region** → **Mumbai (bom1)**, so it sits next to the database
- **Build and Deployment → Node.js Version** → `24.x`

Then turn deployments on. In `vercel.json`, change:

```json
"git": { "deploymentEnabled": false }
```

to `true`, commit, and push. Vercel builds on the push.

**The first deployment of a new project is always a production deployment.**

---

## After it is live

1. Open the URL, sign in as the admin you made in step 5, and change the password.
2. **Master Control** → set the company name, and check the upload limits.
3. **Shops** → add your real branches.
4. **Users** → add staff and approvers, then assign them to shops.
5. Upload one real chalan and check the extracted fields against the image.

---

## Two things to know about the Hobby plan

You have chosen to launch on Hobby. That works, and everything in this app fits inside it. Two
limits are worth knowing before they surprise you:

1. **Vercel's fair-use terms restrict Hobby to non-commercial personal use.** Paid client work is
   outside that. Vercel can pause an account for it. Pro is $20 a month and removes the risk.
2. **Runtime logs are kept for one hour**, so a failure overnight leaves no trace in Vercel. This
   app writes OCR errors, tokens and timings into the database instead, so the audit log and the
   document history still tell you what happened.

Also on Hobby: cron jobs run **once a day** at most. The daily sweep in `vercel.json` fits, and
stuck OCR jobs are caught by the status poll anyway rather than waiting for cron.

## If a deployment fails

- **"FUNCTION_INVOCATION_TIMEOUT"** — OCR took over 300 seconds. Retry the document.
- **"prepared statement already exists"** — `DATABASE_URL` is pointing at the wrong port.
  It must be the **transaction pooler on 6543**.
- **Sign-in works locally but not live** — `BETTER_AUTH_URL` does not match the real domain.
- **Uploads fail** — the bucket name does not match `STORAGE_BUCKET`, or the secret key is wrong.
- **Database looks empty** — migrations were run against your local database, not Supabase.
  Point `DATABASE_URL_MIGRATE` at Supabase and run `npm run db:migrate` again.
