# Going Live on Render: WorkReferences Free Reference Risk Assessment

The app runs as one Render web service. It stores the database and uploaded resumes on a Render persistent disk. The `render.yaml` file in this folder sets everything up automatically.

## What you need

- A Render account: https://dashboard.render.com
- A GitHub account with a **private** repository holding this project. Render deploys from GitHub, GitLab or Bitbucket.
- About 15 minutes

## Cost

| Item | Plan | Price |
|---|---|---|
| Web service | Starter (512 MB RAM, 0.5 CPU) | about $7/month |
| Persistent disk | 1 GB | about $0.25/month |

The free plan won't work because it has no persistent disk: every restart would erase submissions and resumes. Check current prices at https://render.com/pricing.

## Step 1. Put the code on GitHub

1. Create a new **private** repository, for example `workreferences-assessment`.
2. Upload the contents of `workreferences-assessment-source.zip`, or push this folder with Git.
3. Never upload `.env`, `data.db` or `uploads/`. They are excluded already.

## Step 2. Create the service from the Blueprint

1. In Render, click **New > Blueprint**.
2. Connect GitHub and pick the repository.
3. Render reads `render.yaml` and shows one web service, `workreferences-assessment`, with a 1 GB disk at `/var/data`.
4. When it asks for **ADMIN_PASSCODE**, enter a new, long passcode. Don't reuse the preview passcode.
5. Click **Apply**. The first build takes 3 to 5 minutes.

## Environment variables

| Key | Value | Why |
|---|---|---|
| `NODE_VERSION` | `20` | Node version used to build and run |
| `DATA_DIR` | `/var/data` | Keeps the database and resumes on the persistent disk |
| `ADMIN_PASSCODE` | your new passcode, kept secret | Unlocks the consultant view at `/#/admin` |
| `BOOKING_URL` | `https://live.vcita.com/site/27x9gds0opl46jcy/online-scheduling?service=48a5dda49xy1aaj3` | vCita booking page. Name, email and phone are pre-filled automatically |
| `RESEARCH_MIN_RESPONSES` | `25` | Research chart stays hidden until this many assessments are complete |
| `SMTP_HOST` | `smtp.gmail.com` | Google Workspace mail server for the alerts |
| `SMTP_PORT` | `465` | Secure mail connection |
| `SMTP_USER` | `w.schmidt@workreferences.com` | Mailbox that sends the alerts |
| `SMTP_PASS` | your Google app password, kept secret | Lets the app send from that mailbox. Entered in the Render dashboard |
| `NOTIFY_EMAIL_TO` | `w.schmidt@workreferences.com` | Who receives the alerts (separate several with commas) |
| `APP_URL` | `https://assessment.workreferences.com` | Used for the links inside the alerts |

**Do not add:**

- `RESEARCH_SAMPLE`: it shows fake research numbers and is for the preview only.
- `RESUME_UPLOAD_URL`: it's no longer used.
- `PORT`: Render sets it for you.
- `NODE_ENV`: the start command sets it. Setting it for the whole service would skip the build tools.

## Service settings (already in render.yaml)

| Setting | Value |
|---|---|
| Runtime | Node |
| Region | Virginia (US East) |
| Branch | `main`, auto-deploy on push |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Custom domain | `assessment.workreferences.com` |
| onrender.com address | On (can be turned off after the domain is verified) |
| Disk | `assessment-data`, 1 GB, mounted at `/var/data` |

## Step 3. Connect assessment.workreferences.com

`render.yaml` already adds `assessment.workreferences.com` to the service, so you don't need to type it in Render. You only need to add one DNS record and verify it.

1. In Render, open the service and go to **Settings > Custom Domains**. You'll see `assessment.workreferences.com` listed as unverified, along with the exact address to point it to. It will look like `workreferences-assessment.onrender.com`, but Render may add extra characters if that name is taken, so copy it from this screen.
2. Sign in wherever the DNS for workreferences.com is managed: your domain registrar, or a service like Cloudflare if you use one. Add this record:

   | Type | Name / Host | Value / Target | TTL |
   |---|---|---|---|
   | CNAME | `assessment` | the address from step 1 | Auto or 3600 |

   - Enter only `assessment` as the name. Most DNS hosts add `.workreferences.com` for you.
   - If there's already an `A`, `AAAA` or `CNAME` record named `assessment`, delete it first. Render specifically says to remove `AAAA` records.
   - If you use Cloudflare, set the record to **DNS only** (grey cloud) until Render shows it as verified.
   - Don't change the records for `workreferences.com` or `www`. Your main site stays where it is.
3. Back in Render, click **Verify** next to the domain. If it fails, wait 10 to 30 minutes for DNS to update and try again.
4. Once it's verified, Render issues the SSL certificate automatically and sends all `http://` traffic to `https://`.
5. Open `https://assessment.workreferences.com/api/health`. It should show `{"ok":true}`.
6. On workreferences.com, point every "Start My Free Assessment" button to `https://assessment.workreferences.com`.

**Optional, after it's verified:** in `render.yaml`, change `renderSubdomainPolicy: enabled` to `disabled` and push. The app will then only work at assessment.workreferences.com, and the onrender.com address will return "not found". Don't do this before the domain is verified, or the app will be unreachable.

## Step 3b. Turn on email alerts

Every completed assessment emails you the client's contact details, score, result, top areas to prepare and all six answers. Reply to the alert to write to the client directly. A second alert arrives when they upload a resume (download the file from `/#/admin`; it isn't attached).

Google needs a special **app password** for this, not your normal password:

1. Sign in to https://myaccount.google.com as `w.schmidt@workreferences.com`.
2. Click **Security**. Under "How you sign in to Google", make sure **2-Step Verification** is on. Turn it on if not; app passwords need it.
3. Go to https://myaccount.google.com/apppasswords (or type "App passwords" in the search box at the top).
4. Type the name `WorkReferences Assessment` and click **Create**.
5. Google shows a 16-character password in a yellow box, only once. Copy it.
6. In Render, open **workreferences-assessment**, then **Environment**. Check that all six email settings are listed: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL_TO` and `APP_URL`, with the values in the table above. Add any that are missing with **Add Environment Variable**. Paste the app password as the value of `SMTP_PASS`, then click **Save, rebuild, and deploy**.
7. Complete a test assessment. The alert should arrive within a minute. The first one may land in Spam; mark it "Not spam".

If you don't see "App passwords": the Google Workspace admin console may be blocking it. In https://admin.google.com go to **Security > Authentication > 2-Step Verification** and check **Allow users to turn on 2-Step Verification**.

If no alert arrives, open the service's **Logs** in Render and look for a line starting with `email alert failed`. It gives the reason without showing any client details. The client's submission is always saved either way.

## Step 4. Add the research chart to workreferences.com/insights/research

Paste this into an HTML or embed block on the Readdy page:

```html
<iframe id="wr-research" src="https://assessment.workreferences.com/#/embed/research?area=references"
  style="width:100%;border:0;min-height:560px" title="WorkReferences research" loading="lazy"></iframe>
<script>
window.addEventListener("message",function(e){if(e.data&&e.data.type==="wr-research-height"){document.getElementById("wr-research").style.height=e.data.height+"px";}});
</script>
```

If Readdy doesn't allow scripts, use the `<iframe>` line alone. It works, just without automatic resizing.

## Step 5. Launch checklist

- [ ] `https://assessment.workreferences.com/api/health` shows `{"ok":true}`, with a padlock in the browser
- [ ] On workreferences.com, every "Start My Free Assessment" button opens `https://assessment.workreferences.com`
- [ ] Complete one real assessment. The results page loads, and the booking button opens vCita with your details filled in.
- [ ] The alert email for that test arrives at w.schmidt@workreferences.com.
- [ ] Upload a test resume, then open `/#/admin` with the new passcode and download it. A "Resume uploaded" alert arrives.
- [ ] Redeploy once (**Manual Deploy > Deploy latest commit**) and confirm the test submission is still in `/#/admin`. This proves the disk is working.
- [ ] Delete your test submission afterwards, or leave it: research data only counts after 25 assessments.
- [ ] In vCita: make the 3 extra booking questions optional, and fix the Terms of Service link (currently `workreferences.co/terms-of-service/`).
- [ ] Cancel the "Test Resume-Sync" test appointment (Fri Oct 2, 10:30 AM ET) and delete that test client.

## Good to know

- **Brief downtime on deploys.** Services with a disk restart during each deploy, so the site is unavailable for roughly 30 to 60 seconds. Deploy outside busy hours.
- **Backups.** Render takes automatic daily snapshots of the disk. You can restore one from the service's **Disk** page.
- **One instance only.** A disk can attach to one instance, so the app can't scale to multiple instances. That's plenty for this traffic. If volume grows a lot, the next step is moving data to Postgres or Supabase.
- **Old coaching flow.** The earlier 5-session coaching tool is still reachable at `/#/coaching`. Its PDF report needs Python's ReportLab, which isn't installed on Render. Nothing links to it from the assessment, so it can be ignored or removed later.
