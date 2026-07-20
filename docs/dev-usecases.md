# Dev stand — specialist use-cases & coverage

The **dev.pyaserv.com** stand runs an **isolated backend** so demo/test data never
touches production:

| Piece | Value |
|-------|-------|
| Site (Cloudflare Pages) | `pyaserv-dev` → https://dev.pyaserv.com (built with `PUBLIC_DEMO=1`, `PUBLIC_API_URL=<dev worker>`, `PUBLIC_DEV_BYPASS=<key>`) |
| API (Worker) | `pyaserv-api-dev` → https://pyaserv-api-dev.igor-ganov.workers.dev (config `apps/api/wrangler.dev.jsonc`, feature-branch code) |
| DB (D1) | `pyaserv-dev` (`ee154550-…`) — all 12 migrations applied |
| KV | `SESSIONS`/`OAUTH_STATE`/`MEDIA_KV` (dev namespaces) |
| Login | no email provider on dev → `/dev-entrar` uses the dev-bypass key; one click signs in as `igor_ganov@yahoo.com` |

The seeded account (`igor_ganov@yahoo.com`, specialist **Igor Ganov**, electricista, Villa Morra)
was populated by `scripts/seed-dev.ts`, which drives the **real API** for every wired
journey (so the seed doubles as an integration walk-through) and fills unwired gaps with SQL.

## Use-case inventory

Legend — **Covered by:** `seed` = exercised by `scripts/seed-dev.ts`; `test` =
asserted in `apps/api/test/specialist-journey.test.ts`; `sql` = seeded directly
because no endpoint wires it (see the domain map notes).

| # | Use case | Endpoint(s) | Covered by |
|---|----------|-------------|------------|
| 1 | Sign in (dev-bypass, no email) | `POST /api/dev/login` | seed, test |
| 2 | Create specialist profile | `POST /v1/specialists` | seed, test |
| 3 | Edit basic profile (phone/whatsapp/barrio/geo) | `PATCH /v1/specialists/:id` | test |
| 4 | Extended profile — services list | `PATCH /v1/me/profile-extended` (`services`) | seed, test |
| 5 | Portfolio gallery (≥10 → *constructor*) | `PATCH /v1/me/profile-extended` (`portfolio`) | seed, test |
| 6 | Weekly schedule / availability | `PATCH /v1/me/profile-extended` (`schedule`) | seed, test |
| 7 | Lead filters | `PATCH /v1/me/profile-extended` (`leadFilters`) | seed |
| 8 | Service areas (from the 40-area catalog) | `PATCH …` (`areas`) + `GET /v1/me/service-areas` | seed, test |
| 9 | Multilingual profile (ES + Guaraní) | `PATCH …` (`bioGn`/`headlineGn`) | seed |
| 10 | Verification (cédula + RUC + verified badge) | `PATCH …` (`cedulaVerified`,`rucNumber`) / `sql` verified | seed, sql |
| 11 | Public shareable profile (slug) | slug auto on first PATCH; `GET /v1/p/:slug` | seed |
| 12 | Publish service listings | `POST /v1/listings` (+ `PATCH`/`DELETE`) | seed, test |
| 13 | Appear in search (ranked by verified) | `GET /v1/specialists`, `GET /v1/listings` | test |
| 14 | Receive an inquiry & reply | client `POST /v1/inquiries` → `POST …/messages` | seed, test |
| 15 | Work pipeline start → done (both confirm) | `PATCH /v1/inquiries/:id/status` | seed, test |
| 16 | Receive a rating/review (public) | client `POST /v1/inquiries/:id/reviews` | seed, test |
| 17 | Leave a review (specialist → client) | `POST /v1/inquiries/:id/reviews` (role specialist) | seed |
| 18 | Gamification HUD (XP / tier / streak) | `GET /v1/me/game-state`, `/xp-events` | seed, test |
| 19 | Badges (earn / hide-show) | `GET /v1/me/badges`, `PATCH /v1/me/badges/:code` | seed(+sql), test |
| 20 | Quests (daily/weekly, claim) | `GET /v1/me/quests`, `POST …/claim` | seed |
| 21 | Onboarding tours | `GET/POST /v1/me/tours` | sql |
| 22 | Quote builder + templates | `POST /v1/me/quote-templates`, `POST /v1/me/quotes` | seed, test |
| 23 | Lite-CRM "Mis clientes" (auto on job done) | `GET /v1/me/clients`, `PATCH …` | seed, test |
| 24 | Stats / analytics dashboard | `GET /v1/analytics/me`, `/v1/me/analytics-extended` | seed(+sql), test |
| 25 | Notification preferences | `GET/PATCH /v1/me/notifications` | test |
| 26 | Client requests board (answer a job post) | `POST /v1/requests` → `POST /v1/inquiries` | — (pending) |

## Seeded totals (verified live)

- **920 XP**, tier **maestro**, streak 14 (best 27), profile 100 %
- **10 badges**: tier ×3, milestone (first job / 10 jobs / first 5★), *perfil_maestro*, *multilingue*, *constructor*, *verificado_completo*
- **16 conversations** (12 completed jobs with review, 1 in progress, 2 negotiating, 1 cancelled)
- **12 client reviews** on the profile · **6 clients** in the CRM
- **5 listings**, **6 services**, **12 portfolio photos**, weekly schedule, 6 areas, ES+GN
- **Analytics (30 d)**: 210 profile views · 10 phone clicks · 15 WhatsApp clicks · funnel 16 → 12
- **3 quotes** + **2 quote templates**

## Re-seed / re-run

```sh
# 1. (once) create resources + apply migrations + set SESSION_PEPPER & DEV_AUTH_BYPASS_KEY
#    on pyaserv-api-dev, then: bunx wrangler deploy --config apps/api/wrangler.dev.jsonc
# 2. seed the account (drives the real API):
bun scripts/seed-dev.ts                       # needs the dev-bypass key
# 3. apply the SQL extras it emits:
bunx wrangler d1 execute pyaserv-dev --remote --config apps/api/wrangler.dev.jsonc --file <scratch>/seed-extras.sql
# 4. run the use-case tests:
PYASERV_DEV_BYPASS_KEY=<key> bun test apps/api/test/specialist-journey.test.ts
```

> Note: the dev build's CSP must allow the dev worker + picsum. `public/_headers`
> is patched post-build for the dev deploy (`connect-src` += the worker,
> `img-src` += picsum.photos). Production `_headers` is untouched.
