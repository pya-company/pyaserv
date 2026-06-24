import { requireAuth } from '@pya-company/auth'
import { ValidationError, uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'

interface AppEnv {
  readonly Bindings: Env
}

/* ------------------------------------------------------------------------- */
/* Domain constants — XP table + tier thresholds + quest pool                */
/* ------------------------------------------------------------------------- */

export const XP_VALUES = {
  daily_login: 1,
  lead_responded_1h: 5,
  lead_responded_24h: 2,
  job_completed: 25,
  review_with_text: 30,
  review_with_photo: 50,
  review_5star_bonus: 20,
  portfolio_added: 5,
  share_completed_job: 15,
  weekly_quest: 50,
  daily_quest: 10,
  referral_signup: 100,
  referral_client: 50,
} as const

export const TIER_THRESHOLDS: ReadonlyArray<{ tier: string; xp: number }> = [
  { tier: 'aprendiz', xp: 0 },
  { tier: 'oficial', xp: 100 },
  { tier: 'maestro', xp: 500 },
  { tier: 'maestro_mayor', xp: 2000 },
  { tier: 'patron', xp: 5000 },
]

export const tierFor = (xp: number): string => {
  let cur = 'aprendiz'
  for (const t of TIER_THRESHOLDS) if (xp >= t.xp) cur = t.tier
  return cur
}

interface QuestTemplate {
  readonly code: string
  readonly type: 'daily' | 'weekly'
  readonly goal: number
  readonly title: string
  readonly rewardXp: number
  readonly rewardBoostH: number
}

const QUEST_POOL_DAILY: ReadonlyArray<QuestTemplate> = [
  { code: 'respond_1_lead', type: 'daily', goal: 1, title: 'Respondé 1 lead', rewardXp: 10, rewardBoostH: 1 },
  { code: 'add_portfolio_photo', type: 'daily', goal: 1, title: 'Agregá 1 foto al portfolio', rewardXp: 10, rewardBoostH: 1 },
  { code: 'update_service_price', type: 'daily', goal: 1, title: 'Actualizá el precio de 1 servicio', rewardXp: 10, rewardBoostH: 1 },
  { code: 'share_profile', type: 'daily', goal: 1, title: 'Compartí tu perfil en WhatsApp', rewardXp: 10, rewardBoostH: 1 },
]
const QUEST_POOL_WEEKLY: ReadonlyArray<QuestTemplate> = [
  { code: 'get_3_reviews', type: 'weekly', goal: 3, title: 'Conseguí 3 reseñas esta semana', rewardXp: 50, rewardBoostH: 24 },
  { code: 'respond_5_under_1h', type: 'weekly', goal: 5, title: 'Respondé en <1h a 5 leads', rewardXp: 50, rewardBoostH: 24 },
  { code: 'complete_2_jobs', type: 'weekly', goal: 2, title: 'Completá 2 trabajos', rewardXp: 50, rewardBoostH: 24 },
]

/* ------------------------------------------------------------------------- */
/* Helper: ensure user_game_state row exists                                 */
/* ------------------------------------------------------------------------- */

interface GameStateRow {
  readonly user_id: string
  readonly xp: number
  readonly tier: string
  readonly profile_complete_pct: number
  readonly streak_current: number
  readonly streak_best: number
  readonly streak_last_active_date: string | null
  readonly streak_freezes_used_month: number
  readonly streak_paused_until: string | null
  readonly updated_at: number
}

export const ensureGameState = async (db: D1Database, userId: string): Promise<GameStateRow> => {
  const existing = await db.prepare('SELECT * FROM user_game_state WHERE user_id = ?')
    .bind(userId).first<GameStateRow>()
  if (existing) return existing
  const now = Math.floor(Date.now() / 1000)
  await db.prepare(
    `INSERT INTO user_game_state (user_id, xp, tier, profile_complete_pct, streak_current,
       streak_best, streak_freezes_used_month, updated_at)
     VALUES (?, 0, 'aprendiz', 20, 0, 0, 0, ?)`,
  ).bind(userId, now).run()
  return {
    user_id: userId, xp: 0, tier: 'aprendiz', profile_complete_pct: 20,
    streak_current: 0, streak_best: 0, streak_last_active_date: null,
    streak_freezes_used_month: 0, streak_paused_until: null, updated_at: now,
  }
}

/* ------------------------------------------------------------------------- */
/* XP grant — pure logic kept in api/src/lib for re-use from other routes    */
/* ------------------------------------------------------------------------- */

export interface XpGrantResult {
  readonly granted: number
  readonly newTotal: number
  readonly oldTier: string
  readonly newTier: string
  readonly tierChanged: boolean
}

export const grantXp = async (
  db: D1Database,
  userId: string,
  type: keyof typeof XP_VALUES,
  ctx: Record<string, unknown> = {},
): Promise<XpGrantResult> => {
  const state = await ensureGameState(db, userId)
  const xp = XP_VALUES[type]
  const newTotal = state.xp + xp
  const newTier = tierFor(newTotal)
  const now = Math.floor(Date.now() / 1000)
  const eventId = uuidV7()
  await db.batch([
    db.prepare(
      'INSERT INTO xp_events (id, user_id, type, xp, ctx_json, at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(eventId, userId, type, xp, JSON.stringify(ctx), now),
    db.prepare(
      'UPDATE user_game_state SET xp = ?, tier = ?, updated_at = ? WHERE user_id = ?',
    ).bind(newTotal, newTier, now, userId),
  ])
  return { granted: xp, newTotal, oldTier: state.tier, newTier, tierChanged: state.tier !== newTier }
}

/* ------------------------------------------------------------------------- */
/* Streak update — call when user performs any "active" action               */
/* ------------------------------------------------------------------------- */

const todayPyIso = (): string => {
  const d = new Date()
  // Asunción is UTC-3 year-round (no DST since 2022).
  d.setUTCHours(d.getUTCHours() - 3)
  return d.toISOString().slice(0, 10)
}

const dateDiffDays = (a: string, b: string): number => {
  const ta = Date.parse(`${a}T00:00:00Z`)
  const tb = Date.parse(`${b}T00:00:00Z`)
  return Math.round((tb - ta) / 86_400_000)
}

export const touchStreak = async (db: D1Database, userId: string): Promise<{
  current: number; best: number; lastActive: string
}> => {
  const state = await ensureGameState(db, userId)
  const today = todayPyIso()
  const last = state.streak_last_active_date
  let current = state.streak_current
  let best = state.streak_best
  if (!last) {
    current = 1
  } else if (last === today) {
    // already counted today
  } else {
    const diff = dateDiffDays(last, today)
    if (diff === 1) current += 1
    else current = 1 // broken streak (auto-freeze logic could rescue this in nightly cron)
  }
  if (current > best) best = current
  const now = Math.floor(Date.now() / 1000)
  await db.prepare(
    `UPDATE user_game_state
     SET streak_current = ?, streak_best = ?, streak_last_active_date = ?, updated_at = ?
     WHERE user_id = ?`,
  ).bind(current, best, today, now, userId).run()
  return { current, best, lastActive: today }
}

/* ------------------------------------------------------------------------- */
/* Badge grant                                                                */
/* ------------------------------------------------------------------------- */

export const grantBadge = async (
  db: D1Database, userId: string, code: string, meta: Record<string, unknown> = {},
): Promise<{ granted: boolean }> => {
  const exists = await db.prepare('SELECT 1 FROM user_badges WHERE user_id = ? AND code = ?')
    .bind(userId, code).first<{ '1': number }>()
  if (exists) return { granted: false }
  const catalog = await db.prepare('SELECT 1 FROM badges_catalog WHERE code = ?')
    .bind(code).first<{ '1': number }>()
  if (!catalog) return { granted: false }
  await db.prepare(
    'INSERT INTO user_badges (user_id, code, earned_at, meta_json, hidden) VALUES (?, ?, ?, ?, 0)',
  ).bind(userId, code, Math.floor(Date.now() / 1000), JSON.stringify(meta)).run()
  return { granted: true }
}

/* ------------------------------------------------------------------------- */
/* Quest seeding & queries                                                    */
/* ------------------------------------------------------------------------- */

const pickN = <T>(pool: ReadonlyArray<T>, n: number, seed: number): T[] => {
  const arr = [...pool]
  // deterministic shuffle by seed
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280
    const j = Math.floor((seed / 233280) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

const endOfTodayPyEpoch = (): number => {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() - 3)
  d.setUTCHours(23, 59, 59, 999)
  d.setUTCHours(d.getUTCHours() + 3)
  return Math.floor(d.getTime() / 1000)
}

const endOfWeekPyEpoch = (): number => {
  const d = new Date()
  d.setUTCHours(d.getUTCHours() - 3)
  const dayOfWeek = (d.getUTCDay() + 6) % 7 // Mon=0, Sun=6
  d.setUTCDate(d.getUTCDate() + (6 - dayOfWeek))
  d.setUTCHours(23, 59, 59, 999)
  d.setUTCHours(d.getUTCHours() + 3)
  return Math.floor(d.getTime() / 1000)
}

export const seedQuestsIfNeeded = async (db: D1Database, userId: string): Promise<void> => {
  const now = Math.floor(Date.now() / 1000)
  const activeDaily = await db.prepare(
    `SELECT COUNT(*) as n FROM quests WHERE user_id = ? AND type = 'daily' AND status = 'active' AND expires_at > ?`,
  ).bind(userId, now).first<{ n: number }>()
  if (!activeDaily || activeDaily.n < 3) {
    const need = 3 - (activeDaily?.n ?? 0)
    const seed = Math.floor(now / 86400) + userId.charCodeAt(0)
    const picks = pickN(QUEST_POOL_DAILY, need, seed)
    for (const p of picks) {
      await db.prepare(
        `INSERT INTO quests (id, user_id, type, template_code, goal_json, status, reward_xp,
           reward_boost_h, started_at, expires_at)
         VALUES (?, ?, 'daily', ?, ?, 'active', ?, ?, ?, ?)`,
      ).bind(
        uuidV7(), userId, p.code, JSON.stringify({ count: p.goal }),
        p.rewardXp, p.rewardBoostH, now, endOfTodayPyEpoch(),
      ).run()
    }
  }
  const activeWeekly = await db.prepare(
    `SELECT COUNT(*) as n FROM quests WHERE user_id = ? AND type = 'weekly' AND status = 'active' AND expires_at > ?`,
  ).bind(userId, now).first<{ n: number }>()
  if (!activeWeekly || activeWeekly.n < 2) {
    const need = 2 - (activeWeekly?.n ?? 0)
    const seed = Math.floor(now / (86400 * 7)) + userId.charCodeAt(0)
    const picks = pickN(QUEST_POOL_WEEKLY, need, seed)
    for (const p of picks) {
      await db.prepare(
        `INSERT INTO quests (id, user_id, type, template_code, goal_json, status, reward_xp,
           reward_boost_h, started_at, expires_at)
         VALUES (?, ?, 'weekly', ?, ?, 'active', ?, ?, ?, ?)`,
      ).bind(
        uuidV7(), userId, p.code, JSON.stringify({ count: p.goal }),
        p.rewardXp, p.rewardBoostH, now, endOfWeekPyEpoch(),
      ).run()
    }
  }
}

/* ------------------------------------------------------------------------- */
/* Routes                                                                     */
/* ------------------------------------------------------------------------- */

export const gamificationRoutes = new Hono<AppEnv>()
  .get('/game-state', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const state = await ensureGameState(c.env.DB, userId)
    const next = TIER_THRESHOLDS.find((t) => t.xp > state.xp)
    return c.json({
      data: {
        xp: state.xp,
        tier: state.tier,
        nextTier: next ? { tier: next.tier, xp: next.xp, remaining: next.xp - state.xp } : null,
        profileCompletePct: state.profile_complete_pct,
        streak: {
          current: state.streak_current,
          best: state.streak_best,
          lastActiveDate: state.streak_last_active_date,
          freezesUsedThisMonth: state.streak_freezes_used_month,
          pausedUntil: state.streak_paused_until,
        },
      },
    })
  })

  .get('/xp-events', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const result = await c.env.DB.prepare(
      'SELECT id, type, xp, ctx_json, at FROM xp_events WHERE user_id = ? ORDER BY at DESC LIMIT 50',
    ).bind(userId).all<{ id: string; type: string; xp: number; ctx_json: string | null; at: number }>()
    return c.json({
      data: result.results.map((r) => ({
        id: r.id, type: r.type, xp: r.xp,
        ctx: r.ctx_json ? JSON.parse(r.ctx_json) : null, at: r.at,
      })),
    })
  })

  .get('/badges', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const earned = await c.env.DB.prepare(
      `SELECT b.code, b.name_es, b.name_en, b.name_gn, b.description_es, b.description_en, b.description_gn,
              b.category, b.rarity, b.icon_slug, ub.earned_at, ub.hidden
       FROM user_badges ub
       JOIN badges_catalog b ON b.code = ub.code
       WHERE ub.user_id = ?
       ORDER BY ub.earned_at DESC`,
    ).bind(userId).all<{
      code: string; name_es: string; name_en: string; name_gn: string | null;
      description_es: string; description_en: string; description_gn: string | null;
      category: string; rarity: string; icon_slug: string; earned_at: number; hidden: number;
    }>()
    const all = await c.env.DB.prepare(
      'SELECT code, name_es, name_en, name_gn, description_es, description_en, description_gn, category, rarity, icon_slug FROM badges_catalog',
    ).all<{
      code: string; name_es: string; name_en: string; name_gn: string | null;
      description_es: string; description_en: string; description_gn: string | null;
      category: string; rarity: string; icon_slug: string;
    }>()
    const earnedCodes = new Set(earned.results.map((e) => e.code))
    const earnedMap = new Map(earned.results.map((e) => [e.code, e]))
    return c.json({
      data: all.results.map((b) => {
        const e = earnedMap.get(b.code)
        return {
          code: b.code,
          name: { es: b.name_es, en: b.name_en, gn: b.name_gn },
          description: { es: b.description_es, en: b.description_en, gn: b.description_gn },
          category: b.category,
          rarity: b.rarity,
          iconSlug: b.icon_slug,
          earned: earnedCodes.has(b.code),
          earnedAt: e?.earned_at ?? null,
          hidden: e?.hidden === 1,
        }
      }),
    })
  })

  .patch('/badges/:code', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const code = c.req.param('code')
    const body = await c.req.json().catch(() => ({})) as { hidden?: unknown }
    if (typeof body.hidden !== 'boolean') {
      throw new ValidationError({ issues: [{ path: 'hidden', message: 'boolean required' }] })
    }
    await c.env.DB.prepare(
      'UPDATE user_badges SET hidden = ? WHERE user_id = ? AND code = ?',
    ).bind(body.hidden ? 1 : 0, userId, code).run()
    return c.json({ data: { ok: true } })
  })

  .get('/quests', requireAuth, async (c) => {
    const userId = c.var.session.userId
    await seedQuestsIfNeeded(c.env.DB, userId)
    const now = Math.floor(Date.now() / 1000)
    const result = await c.env.DB.prepare(
      `SELECT id, type, template_code, goal_json, progress_json, status, reward_xp, reward_boost_h,
              started_at, expires_at, completed_at
       FROM quests
       WHERE user_id = ? AND (status = 'active' OR completed_at > ?)
       ORDER BY type, expires_at`,
    ).bind(userId, now - 86400).all<{
      id: string; type: string; template_code: string; goal_json: string; progress_json: string;
      status: string; reward_xp: number; reward_boost_h: number;
      started_at: number; expires_at: number; completed_at: number | null;
    }>()
    const templateTitle = (code: string): string => {
      const all = [...QUEST_POOL_DAILY, ...QUEST_POOL_WEEKLY]
      return all.find((t) => t.code === code)?.title ?? code
    }
    return c.json({
      data: result.results.map((q) => ({
        id: q.id, type: q.type, templateCode: q.template_code,
        title: templateTitle(q.template_code),
        goal: JSON.parse(q.goal_json), progress: JSON.parse(q.progress_json),
        status: q.status, rewardXp: q.reward_xp, rewardBoostH: q.reward_boost_h,
        startedAt: q.started_at, expiresAt: q.expires_at, completedAt: q.completed_at,
      })),
    })
  })

  .post('/quests/:id/claim', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const id = c.req.param('id')
    const q = await c.env.DB.prepare(
      'SELECT id, status, reward_xp, template_code FROM quests WHERE id = ? AND user_id = ?',
    ).bind(id, userId).first<{ id: string; status: string; reward_xp: number; template_code: string }>()
    if (!q || q.status !== 'done') {
      throw new ValidationError({ issues: [{ path: 'id', message: 'quest not ready to claim' }] })
    }
    const grant = await grantXp(c.env.DB, userId, q.reward_xp >= 50 ? 'weekly_quest' : 'daily_quest', { questId: id })
    await c.env.DB.prepare(
      'UPDATE quests SET status = ? WHERE id = ?',
    ).bind('active', id).run() // mark to prevent double claim
    return c.json({ data: { xpGranted: grant.granted, newTotal: grant.newTotal, tierChanged: grant.tierChanged, newTier: grant.newTier } })
  })
