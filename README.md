# WorkReferences Free Reference Risk Assessment

A 6-question, about 5-minute assessment that shows job seekers what an employer is likely to verify before a background check. It scores six areas (employment dates, job titles, employment arrangement, references, departures and gaps, and consistency across records), shows a preparation plan, and links to a free consultation booked through vCita.

- **Stack:** Express + Vite/React + Tailwind + shadcn/ui, with a SQLite database (`better-sqlite3`)
- **Production address:** https://assessment.workreferences.com, hosted on Render

## Pages

| Path | What it is |
|---|---|
| `/#/` | The assessment: question 1 on the opening screen, 6 questions, then contact details. `/#/?start=1` hides the welcome headline |
| `/#/free-assessment/:id/results` | Results page: preparation plan, score, research chart, booking and optional resume upload |
| `/#/admin` | Consultant view: submissions, resume downloads, funnel, research chart, delete controls. Needs `ADMIN_PASSCODE` |
| `/#/embed/research` | Research chart for embedding on workreferences.com/insights/research |
| `/api/health` | Health check, returns `{"ok":true}` |

## Run it locally

Requires Node 20 to 22.

```bash
npm ci
cp .env.example .env    # or create .env by hand (see below)
npm run dev             # http://localhost:5000
```

Production build:

```bash
npm run build
npm start               # serves dist/ on PORT (default 5000)
```

`npm run check` runs the TypeScript checks.

## Environment variables

| Key | Required | Purpose |
|---|---|---|
| `ADMIN_PASSCODE` | Yes | Unlocks `/#/admin`. Use a long, unique value and keep it secret |
| `BOOKING_URL` | Yes | vCita booking page. The app pre-fills first name, last name, email and phone |
| `DATA_DIR` | On Render | Folder for `data.db` and `uploads/`. Defaults to the project folder. On Render it's `/var/data` (the persistent disk) |
| `RESEARCH_MIN_RESPONSES` | No | Research chart stays hidden until this many assessments are complete. Default `25` |
| `RESEARCH_SAMPLE` | No | `1` shows labeled sample research data. **Preview/testing only. Never set it in production** |
| `SMTP_HOST` | For alerts | Mail server. `smtp.gmail.com` for Google Workspace |
| `SMTP_PORT` | For alerts | `465` (secure connection) |
| `SMTP_USER` | For alerts | The mailbox that sends the alerts, e.g. `w.schmidt@workreferences.com` |
| `SMTP_PASS` | For alerts | A Google **app password** for that mailbox (not the normal password). Secret |
| `NOTIFY_EMAIL_TO` | For alerts | Who receives the alerts. Separate several addresses with commas |
| `NOTIFY_EMAIL_FROM` | No | Sender shown in the inbox. Default `WorkReferences Assessment <SMTP_USER>` |
| `APP_URL` | No | Used for links in the alerts. Default `https://assessment.workreferences.com` |
| `PORT` | No | Set automatically by Render |

Alerts are off until `SMTP_USER`, `SMTP_PASS` and `NOTIFY_EMAIL_TO` are all set. If sending fails, the client's submission still goes through and the reason is written to the server log.

Never commit `.env`, `data.db` or `uploads/`. They're already in `.gitignore`.

## Deploying to Render

The app runs as one Render web service with a 1 GB persistent disk. `render.yaml` (a Render Blueprint) sets up the service, disk, environment variables and custom domain. Full details, with explanations, are in [RENDER_DEPLOY.md](RENDER_DEPLOY.md).

### Cost

The Hobby workspace plan ($0) is enough, but the service needs the paid $7/month instance. Free instances lose all files on every restart and can't use a persistent disk, so submissions and resumes would be lost. Add $0.25/month for the 1 GB disk, for about $7.25/month in total. Check current prices at https://render.com/pricing.

### 1. Push the code to a private GitHub repository

1. Create a **private** repository, for example `workreferences-assessment`.
2. Push this folder, or upload the contents of `workreferences-assessment-source.zip`.
3. Use the `main` branch. Render deploys automatically on every push to `main`.

### 2. Create the service from the Blueprint

1. In the Render dashboard, click **New > Blueprint** and connect the repository.
2. Render reads `render.yaml` and shows one web service, `workreferences-assessment`, with the disk `assessment-data` (1 GB at `/var/data`).
3. When asked for `ADMIN_PASSCODE`, enter a new, long passcode. Don't reuse the preview passcode.
   When asked for `SMTP_PASS`, enter the Google app password (see "Email alerts" below), or leave it blank to add later.
4. Click **Apply**. The first build takes 3 to 5 minutes.

Settings that `render.yaml` applies:

| Setting | Value |
|---|---|
| Runtime / region | Node, Virginia (US East) |
| Instance | `starter` (512 MB RAM, $7/month) |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Disk | `assessment-data`, 1 GB, mounted at `/var/data` |
| Environment | `NODE_VERSION=20`, `DATA_DIR=/var/data`, `BOOKING_URL`, `RESEARCH_MIN_RESPONSES=25`, email alert settings, plus `ADMIN_PASSCODE` and `SMTP_PASS` (both entered in the dashboard) |
| Custom domain | `assessment.workreferences.com` |
| onrender.com address | On until the custom domain is verified |

Don't add `RESEARCH_SAMPLE`, `PORT` or `NODE_ENV` in Render. Setting `NODE_ENV` for the whole service would skip the build tools.

### 3. Connect assessment.workreferences.com

1. In the service, open **Settings > Custom Domains**. `assessment.workreferences.com` is already listed. Copy the target address Render shows, which looks like `workreferences-assessment.onrender.com`.
2. At the DNS host for workreferences.com, add:

   | Type | Name | Target |
   |---|---|---|
   | CNAME | `assessment` | the address from step 1 |

   Delete any existing `A`, `AAAA` or `CNAME` record named `assessment` first. On Cloudflare, set the record to **DNS only** until it's verified. Leave the root and `www` records alone.
3. Click **Verify** in Render. If it fails, wait 10 to 30 minutes and try again. Render then issues the SSL certificate and redirects HTTP to HTTPS automatically.
4. Optional, once it's verified: set `renderSubdomainPolicy: disabled` in `render.yaml` and push, so the app only answers on the custom domain. Don't do this before it's verified.

### Email alerts

When a client completes the assessment, the app emails `NOTIFY_EMAIL_TO` with their contact details, score, result, top areas to prepare and all six answers. Employers, job titles and dates are not collected. Replying to the alert writes to the client directly. A second, shorter alert is sent when they upload a resume. The file itself isn't attached; download it from `/#/admin`.

To create the Google app password for `w.schmidt@workreferences.com`:

1. Sign in to https://myaccount.google.com with that account.
2. Open **Security**. Under "How you sign in to Google", turn on **2-Step Verification** if it isn't on already. App passwords need it.
3. Go to https://myaccount.google.com/apppasswords (or search "App passwords" at the top of the account page).
4. Name it `WorkReferences Assessment` and click **Create**. Google shows a 16-character password once. Copy it.
5. In Render, open the service, then **Environment**. Make sure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL_TO` and `APP_URL` are all listed (add any that are missing), set `SMTP_PASS` to the app password, and click **Save, rebuild, and deploy**.

If "App passwords" doesn't appear, the Google Workspace admin console may be blocking it. Check **Security > Authentication > 2-Step Verification** there and allow users to turn it on.

Render's paid instances can send email. Free instances can't use mail ports 25, 465 or 587.

### 4. Link it from workreferences.com

- Point every "Start My Free Assessment" button to `https://assessment.workreferences.com/#/?start=1&src=website`. This opens straight on question 1 and labels the visit as coming from your website in the admin funnel.
- To show the research chart on https://workreferences.com/insights/research, paste this into an HTML/embed block:

```html
<iframe id="wr-research" src="https://assessment.workreferences.com/#/embed/research?area=references"
  style="width:100%;border:0;min-height:560px" title="WorkReferences research" loading="lazy"></iframe>
<script>
window.addEventListener("message",function(e){if(e.data&&e.data.type==="wr-research-height"){document.getElementById("wr-research").style.height=e.data.height+"px";}});
</script>
```

### 5. Launch checklist

- [ ] `https://assessment.workreferences.com/api/health` shows `{"ok":true}`, with a padlock in the browser
- [ ] Every "Start My Free Assessment" button on workreferences.com opens `https://assessment.workreferences.com/#/?start=1&src=website`
- [ ] Complete one assessment. The results page loads, and the booking button opens vCita with your details filled in
- [ ] An alert email for that test arrives at w.schmidt@workreferences.com (check Spam the first time and mark it "Not spam")
- [ ] Upload a test resume, then download it from `/#/admin` using the new passcode. A "Resume uploaded" alert arrives
- [ ] Redeploy once (**Manual Deploy > Deploy latest commit**) and confirm the test submission is still in `/#/admin`. This proves the disk works
- [ ] Delete the test submission from `/#/admin`

### Operating notes

- **Deploys cause brief downtime.** A service with a disk restarts on each deploy, so it's unavailable for roughly 30 to 60 seconds. Deploy outside busy hours.
- **Backups.** Render takes daily disk snapshots, which you can restore from the service's **Disk** page.
- **One instance.** A disk attaches to a single instance, which is plenty for this traffic. If volume grows a lot, move the data to Postgres or Supabase.
- **Old coaching flow.** `/#/coaching` (the retired 5-session tool) generates its PDF with Python's ReportLab, which isn't available on Render. Nothing links to it.

## Privacy

- Contact details are collected only at the final step. Answers saved for resuming stay on the visitor's own device, with no contact details, and are cleared on completion.
- Research data is anonymous: month, job-search status, result category and answer choices only.
- Funnel tracking uses a random visitor id that changes daily (kept in the browser), with no names, contact details or links to submissions. Automated browsers and any browser that has logged in to `/#/admin` are not counted. "Started" means the visitor answered question 1. Traffic source is stored only as a broad category (workreferences.com, search, social, email, direct, other). Counts start on Oct 7, 2026, when the counting method changed.
- Admin requests authenticate with the `x-admin-key` header only, with a 15-minute lockout after 10 failed attempts.
