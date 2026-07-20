/*
 * XP grant hooks fired from existing routes (inquiries, reviews).
 * Kept thin: each function is fire-and-forget from the caller's
 * perspective and never throws — errors are swallowed and logged.
 * Badge auto-grant is also wired here.
 */
import { grantBadge, grantXp, touchStreak, ensureGameState } from '../routes/gamification.ts'

const safe = async <T>(p: Promise<T>): Promise<T | null> => {
  try { return await p } catch (e) { console.error('xp-hook', e); return null }
}

export const onMessageSentBySpecialist = async (
  db: D1Database, userId: string, inquiryCreatedAt: number,
): Promise<void> => {
  const minutes = (Date.now() / 1000 - inquiryCreatedAt) / 60
  const type = minutes <= 60 ? 'lead_responded_1h' : 'lead_responded_24h'
  await safe(grantXp(db, userId, type, { minutes: Math.round(minutes) }))
  await safe(touchStreak(db, userId))
}

export const onJobCompleted = async (
  db: D1Database, specialistUserId: string, clientUserId: string, inquiryId: string,
): Promise<void> => {
  await safe(grantXp(db, specialistUserId, 'job_completed', { inquiryId }))
  await safe(touchStreak(db, specialistUserId))

  const completedCount = await db.prepare(
    `SELECT COUNT(*) as n FROM inquiries WHERE specialist_user_id = ? AND work_status = 'done'`,
  ).bind(specialistUserId).first<{ n: number }>()
  const n = completedCount?.n ?? 0
  if (n === 1) await safe(grantBadge(db, specialistUserId, 'milestone_first_job'))
  if (n === 10) await safe(grantBadge(db, specialistUserId, 'milestone_10_jobs'))
  if (n === 50) await safe(grantBadge(db, specialistUserId, 'milestone_50_jobs'))
  if (n === 100) await safe(grantBadge(db, specialistUserId, 'milestone_100_jobs'))

  await upsertClientRecord(db, specialistUserId, clientUserId)
}

export const onReviewCreated = async (
  db: D1Database, rateeUserId: string, raterUserId: string, stars: number, hasPhoto: boolean,
): Promise<void> => {
  const type = hasPhoto ? 'review_with_photo' : 'review_with_text'
  await safe(grantXp(db, rateeUserId, type, { stars, raterUserId }))
  if (stars >= 5) await safe(grantXp(db, rateeUserId, 'review_5star_bonus', { raterUserId }))

  const fiveStarFirst = await db.prepare(
    `SELECT COUNT(*) as n FROM reviews WHERE ratee_user_id = ? AND stars >= 5 AND role = 'client'`,
  ).bind(rateeUserId).first<{ n: number }>()
  if ((fiveStarFirst?.n ?? 0) === 1) await safe(grantBadge(db, rateeUserId, 'milestone_first_5star'))
}

const upsertClientRecord = async (
  db: D1Database, specialistUserId: string, clientUserId: string,
): Promise<void> => {
  const existing = await db.prepare(
    `SELECT id, job_count FROM client_records WHERE specialist_user_id = ? AND client_user_id = ?`,
  ).bind(specialistUserId, clientUserId).first<{ id: string; job_count: number }>()
  const now = Math.floor(Date.now() / 1000)
  const clientRow = await db.prepare(
    `SELECT u.display_name, sp.barrio
     FROM users u
     LEFT JOIN specialist_profiles sp ON sp.user_id = u.id
     WHERE u.id = ?`,
  ).bind(clientUserId).first<{ display_name: string | null; barrio: string | null }>()
  const dn = clientRow?.display_name ?? null
  const barrio = clientRow?.barrio ?? null

  if (existing) {
    await db.prepare(
      `UPDATE client_records SET job_count = ?, last_job_at = ?, updated_at = ? WHERE id = ?`,
    ).bind(existing.job_count + 1, now, now, existing.id).run()
  } else {
    const id = crypto.randomUUID()
    await db.prepare(
      `INSERT INTO client_records (id, specialist_user_id, client_user_id, display_name, phone,
         barrio, notes, job_count, last_job_at, opt_out, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, '', 1, ?, 0, ?, ?)`,
    ).bind(id, specialistUserId, clientUserId, dn, barrio, now, now, now).run()
  }
}

export const onProfilePortfolioAdded = async (db: D1Database, userId: string): Promise<void> => {
  await safe(grantXp(db, userId, 'portfolio_added'))
  const photos = await db.prepare(
    `SELECT COALESCE(json_array_length(portfolio_json), 0) as n FROM specialist_profiles WHERE user_id = ?`,
  ).bind(userId).first<{ n: number }>()
  if ((photos?.n ?? 0) >= 10) await safe(grantBadge(db, userId, 'constructor'))
}

export const onProfileMultilingual = async (db: D1Database, userId: string): Promise<void> => {
  const row = await db.prepare(
    `SELECT bio_gn, headline_gn FROM specialist_profiles WHERE user_id = ?`,
  ).bind(userId).first<{ bio_gn: string | null; headline_gn: string | null }>()
  if (row?.bio_gn || row?.headline_gn) await safe(grantBadge(db, userId, 'multilingue'))
}

export const onProfileFullyVerified = async (db: D1Database, userId: string): Promise<void> => {
  const row = await db.prepare(
    `SELECT verified, cedula_verified FROM specialist_profiles WHERE user_id = ?`,
  ).bind(userId).first<{ verified: number; cedula_verified: number }>()
  if (row?.verified === 1 && row?.cedula_verified === 1) {
    await safe(grantBadge(db, userId, 'verificado_completo'))
  }
}

export const onProfileCompleteness100 = async (db: D1Database, userId: string): Promise<void> => {
  const state = await ensureGameState(db, userId)
  if (state.profile_complete_pct >= 100) {
    await safe(grantBadge(db, userId, 'perfil_maestro'))
  }
}
