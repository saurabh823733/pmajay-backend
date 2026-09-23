# PM-AJAY Sahayak — Backend (IVR + WhatsApp + REST)

## Deploy in 5 minutes (do this first)

```bash
cd pmajay-backend
git init
git add .
git commit -m "PM-AJAY Sahayak backend"
```
Create an empty repo on github.com (no README/license), then:
```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```
Go to **render.com** → New → Web Service → connect that GitHub repo.
Render auto-detects `render.yaml` in this project and pre-fills everything
(build command, start command, env var names) — you only need to paste in
the actual secret values (WhatsApp token, Exotel SID, etc.) in the
"Environment" tab, which Render prompts for since they're marked
`sync: false` in `render.yaml`. Click **Deploy** — you'll get a live HTTPS
URL like `https://pmajay-sahayak-backend.onrender.com` in a few minutes.
That URL is what goes into Exotel's and Meta's webhook settings below.


This is the real multi-channel backend behind the web prototype: one shared
NLU/recommendation engine, exposed to three entry points — a phone call
(IVR), a WhatsApp voice note, and a plain REST API (used by the web app).

## Architecture

```
Phone call (IVR) ──▶ Exotel/Knowlarity ──▶ /ivr/webhook   ─┐
WhatsApp voice note ──▶ Meta Cloud API ──▶ /whatsapp/webhook ─┼──▶ ASR ──▶ recommendationEngine.js ──▶ TTS ──▶ reply
Web app ─────────────────────────────────▶ /api/recommend ─┘                         │
                                                                                        ▼
                                                                          records.json / dashboard API
```

Every channel funnels into the same `src/recommendationEngine.js` — this is
the piece that matches beneficiary answers to NSQF-aligned trades. Adding a
fourth channel later (e.g. a kiosk app) only means writing a new thin
adapter, not re-implementing the logic.

## Setup

```bash
npm install
cp .env.example .env      # fill in provider credentials
npm start                 # runs on http://localhost:3000
```

For local testing before you own a domain, expose your machine with a
tunnel (e.g. `ngrok http 3000`) and use the generated HTTPS URL as the
webhook URL in Exotel/Meta's dashboards.

## Wiring up IVR (Exotel example)

1. Buy/port a number in the Exotel dashboard.
2. Create a **Voicebot Applet** flow, set its webhook to
   `https://<your-domain>/ivr/webhook`.
3. Exotel calls this endpoint on call start, on DTMF input, and after
   every recorded response — `src/ivr/ivrRoutes.js` handles all three.
4. Knowlarity/Ozonetel use a similar webhook contract but different field
   names (e.g. `CallUUID` instead of `CallSid`) — adjust
   `req.body` field reads in `ivrRoutes.js` if you switch providers.

## Wiring up WhatsApp (Meta Cloud API)

1. Create a Meta developer app → add the WhatsApp product → get a
   `phone_number_id` and a permanent access token.
2. Set the webhook to `https://<your-domain>/whatsapp/webhook`, and set
   `WHATSAPP_VERIFY_TOKEN` in `.env` to match what you enter in Meta's
   dashboard (used for the GET verification handshake).
3. Subscribe the webhook to the `messages` field.
4. Beneficiaries message your WhatsApp Business number directly; the bot
   replies with text + a synthesized voice note.

## Swapping in real ASR/TTS

`src/services/asrService.js` and `ttsService.js` are provider-agnostic —
set `ASR_PROVIDER` / `TTS_PROVIDER` in `.env` to `bhashini` or `google`
and fill in the matching keys. **Bhashini** (Digital India's own platform,
bhashini.gov.in) is the recommended default for this use case — it's built
specifically for Indian regional languages and dialects and is free/
subsidised for government use cases like PM-AJAY.

Left as `mock`, both services run without any paid account so you can
test the full conversation flow end-to-end (session state, question
sequencing, recommendation scoring) before wiring in real speech.

## API reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/ivr/webhook` | POST | Exotel/telephony webhook |
| `/whatsapp/webhook` | GET | Meta webhook verification handshake |
| `/whatsapp/webhook` | POST | Incoming WhatsApp messages |
| `/api/recommend` | POST | Run the engine directly — `{name_loc, education, family_occ, current_work, interest, mobility, emp_pref}` |
| `/api/records` | GET | All saved beneficiary profiles (powers the coordinator dashboard) |
| `/health` | GET | Uptime check |

## Production notes / what to harden before go-live

- **Session store**: currently an in-memory `Map` (`src/sessionStore.js`).
  Swap for Redis so sessions survive restarts and work across multiple
  server instances behind a load balancer.
- **Database**: `src/db/records.js` writes to a local JSON file for zero-
  setup demo purposes. Replace with Postgres/MongoDB before real
  beneficiary data is collected.
- **Webhook signature verification**: Meta and Exotel both support
  signing webhook payloads — verify signatures before trusting request
  bodies in production.
- **PII/privacy**: phone numbers and voice recordings are personal data
  under India's DPDP Act — encrypt at rest, mask numbers in logs/
  dashboard views, and set a data retention policy.
- **Scaling**: stateless webhook handlers behind a load balancer + shared
  Redis session store scale horizontally without code changes.
