import { sendEmail } from '@pya-company/email'
import { requireAuth } from '@pya-company/auth'
import { ForbiddenError, NotFoundError, ValidationError, uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'
import * as v from 'valibot'
import {
  InquiryCreateSchema,
  MessageCreateSchema,
  ReviewCreateSchema,
  WorkStatusActionSchema,
} from '../schemas.ts'

interface AppEnv {
  readonly Bindings: Env
}

interface InquiryRow {
  readonly id: string
  readonly subject_type: string
  readonly subject_id: string
  readonly client_user_id: string
  readonly specialist_user_id: string
  readonly last_message_at: number
  readonly created_at: number
  readonly work_status: string
  readonly client_confirmed: number
  readonly specialist_confirmed: number
  readonly closed_at: number | null
}

interface MessageRow {
  readonly id: string
  readonly inquiry_id: string
  readonly sender_user_id: string
  readonly body: string
  readonly created_at: number
}

const toInquiryDto = (r: InquiryRow) => ({
  id: r.id,
  subjectType: r.subject_type,
  subjectId: r.subject_id,
  clientUserId: r.client_user_id,
  specialistUserId: r.specialist_user_id,
  lastMessageAt: r.last_message_at,
  createdAt: r.created_at,
  workStatus: r.work_status,
  clientConfirmed: r.client_confirmed === 1,
  specialistConfirmed: r.specialist_confirmed === 1,
  closedAt: r.closed_at,
})

const toMessageDto = (r: MessageRow) => ({
  id: r.id,
  inquiryId: r.inquiry_id,
  senderUserId: r.sender_user_id,
  body: r.body,
  createdAt: r.created_at,
})

const resolveSpecialistUserId = async (
  env: Env,
  subjectType: 'listing' | 'request',
  subjectId: string,
  meUserId: string,
): Promise<{ specialistUserId: string; clientUserId: string }> => {
  if (subjectType === 'listing') {
    const row = await env.DB.prepare(
      'SELECT s.user_id AS user_id FROM listings l JOIN specialist_profiles s ON s.id = l.specialist_id WHERE l.id = ?',
    )
      .bind(subjectId)
      .first<{ user_id: string }>()
    if (!row) throw new NotFoundError({ resource: 'listing' })
    if (row.user_id === meUserId)
      throw new ValidationError({ issues: [{ path: '', message: 'cannot open inquiry on own listing' }] })
    return { specialistUserId: row.user_id, clientUserId: meUserId }
  }
  const row = await env.DB.prepare('SELECT client_id FROM requests WHERE id = ?').bind(subjectId).first<{ client_id: string }>()
  if (!row) throw new NotFoundError({ resource: 'request' })
  if (row.client_id === meUserId)
    throw new ValidationError({ issues: [{ path: '', message: 'cannot open inquiry on own request' }] })
  return { specialistUserId: meUserId, clientUserId: row.client_id }
}

// Throttled notification email. Skips if recipient opted out or we already sent
// the same kind to that recipient in the past hour.
const tryNotify = async (
  env: Env,
  recipientUserId: string,
  kind: 'inquiry_new' | 'message_new',
  subject: string,
  text: string,
): Promise<void> => {
  const user = await env.DB.prepare(
    'SELECT email, email_notifications FROM users WHERE id = ?',
  )
    .bind(recipientUserId)
    .first<{ email: string; email_notifications: number }>()
  if (!user || user.email_notifications !== 1) return
  const now = Math.floor(Date.now() / 1000)
  const throttle = await env.DB.prepare(
    'SELECT last_sent FROM email_throttle WHERE recipient = ? AND kind = ?',
  )
    .bind(user.email, kind)
    .first<{ last_sent: number }>()
  if (throttle && now - throttle.last_sent < 3600) return
  await env.DB.prepare(
    'INSERT OR REPLACE INTO email_throttle (recipient, kind, last_sent) VALUES (?, ?, ?)',
  )
    .bind(user.email, kind, now)
    .run()
  await sendEmail({
    env,
    to: user.email,
    subject,
    text,
    brandName: 'PyaServ',
    fromLocal: 'noreply',
  })
}

// Apply a work-pipeline transition. Returns updated row.
const applyWorkAction = async (
  env: Env,
  inquiry: InquiryRow,
  action: 'start' | 'confirm_done' | 'cancel',
  meUserId: string,
): Promise<InquiryRow> => {
  const isClient = inquiry.client_user_id === meUserId
  const isSpecialist = inquiry.specialist_user_id === meUserId
  const now = Math.floor(Date.now() / 1000)

  if (action === 'start') {
    if (inquiry.work_status !== 'negotiating')
      throw new ValidationError({ issues: [{ path: 'action', message: 'can only start from negotiating' }] })
    await env.DB.prepare('UPDATE inquiries SET work_status = ? WHERE id = ?')
      .bind('in_progress', inquiry.id)
      .run()
  } else if (action === 'confirm_done') {
    if (inquiry.work_status !== 'in_progress')
      throw new ValidationError({ issues: [{ path: 'action', message: 'can only confirm from in_progress' }] })
    const clientFlag = isClient ? 1 : inquiry.client_confirmed
    const specFlag = isSpecialist ? 1 : inquiry.specialist_confirmed
    const newStatus = clientFlag === 1 && specFlag === 1 ? 'done' : 'in_progress'
    const closedAt = newStatus === 'done' ? now : null
    await env.DB.prepare(
      'UPDATE inquiries SET work_status = ?, client_confirmed = ?, specialist_confirmed = ?, closed_at = ? WHERE id = ?',
    )
      .bind(newStatus, clientFlag, specFlag, closedAt, inquiry.id)
      .run()
  } else if (action === 'cancel') {
    if (inquiry.work_status === 'done' || inquiry.work_status === 'cancelled')
      throw new ValidationError({ issues: [{ path: 'action', message: 'inquiry already closed' }] })
    await env.DB.prepare('UPDATE inquiries SET work_status = ?, closed_at = ? WHERE id = ?')
      .bind('cancelled', now, inquiry.id)
      .run()
  }
  const fresh = await env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(inquiry.id).first<InquiryRow>()
  return fresh as InquiryRow
}

export const inquiriesRoutes = new Hono<AppEnv>()
  .get('/', requireAuth, async (c) => {
    const me = c.var.session.userId
    const result = await c.env.DB.prepare(
      `SELECT * FROM inquiries
       WHERE client_user_id = ? OR specialist_user_id = ?
       ORDER BY last_message_at DESC LIMIT 100`,
    )
      .bind(me, me)
      .all<InquiryRow>()
    return c.json({ data: result.results.map(toInquiryDto) })
  })
  .get('/:id', requireAuth, async (c) => {
    const id = c.req.param('id')
    const inquiry = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first<InquiryRow>()
    if (!inquiry) throw new NotFoundError({ resource: 'inquiry' })
    const me = c.var.session.userId
    if (inquiry.client_user_id !== me && inquiry.specialist_user_id !== me)
      throw new ForbiddenError({ required: 'not a participant' })
    const messages = await c.env.DB.prepare(
      'SELECT * FROM messages WHERE inquiry_id = ? ORDER BY created_at ASC LIMIT 500',
    )
      .bind(id)
      .all<MessageRow>()
    // Reviews scoped to this inquiry (for "did I already rate?" checks)
    const reviewRows = await c.env.DB.prepare('SELECT * FROM reviews WHERE inquiry_id = ?')
      .bind(id)
      .all<{ id: string; rater_user_id: string; ratee_user_id: string; role: string; stars: number; body: string; created_at: number }>()
    return c.json({
      data: {
        inquiry: toInquiryDto(inquiry),
        messages: messages.results.map(toMessageDto),
        reviews: reviewRows.results.map((r) => ({
          id: r.id,
          raterUserId: r.rater_user_id,
          rateeUserId: r.ratee_user_id,
          role: r.role,
          stars: r.stars,
          body: r.body,
          createdAt: r.created_at,
        })),
      },
    })
  })
  .post('/', requireAuth, async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(InquiryCreateSchema, body)
    if (!parsed.success)
      throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join('.') ?? '', message: i.message })) })
    const me = c.var.session.userId
    const { specialistUserId, clientUserId } = await resolveSpecialistUserId(
      c.env,
      parsed.output.subjectType,
      parsed.output.subjectId,
      me,
    )
    const now = Math.floor(Date.now() / 1000)

    const existing = await c.env.DB.prepare(
      `SELECT * FROM inquiries
       WHERE subject_type = ? AND subject_id = ? AND client_user_id = ? AND specialist_user_id = ?`,
    )
      .bind(parsed.output.subjectType, parsed.output.subjectId, clientUserId, specialistUserId)
      .first<InquiryRow>()

    const inquiryId = existing ? existing.id : uuidV7()
    if (!existing) {
      await c.env.DB.prepare(
        `INSERT INTO inquiries (id, subject_type, subject_id, client_user_id, specialist_user_id, last_message_at, created_at, work_status, client_confirmed, specialist_confirmed)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'negotiating', 0, 0)`,
      )
        .bind(inquiryId, parsed.output.subjectType, parsed.output.subjectId, clientUserId, specialistUserId, now, now)
        .run()
    }

    const messageId = uuidV7()
    await c.env.DB.prepare(
      'INSERT INTO messages (id, inquiry_id, sender_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(messageId, inquiryId, me, parsed.output.body, now)
      .run()
    await c.env.DB.prepare('UPDATE inquiries SET last_message_at = ? WHERE id = ?').bind(now, inquiryId).run()

    // Fire-and-forget notification to the counterparty.
    const recipient = me === clientUserId ? specialistUserId : clientUserId
    c.executionCtx.waitUntil(
      tryNotify(
        c.env,
        recipient,
        existing ? 'message_new' : 'inquiry_new',
        existing ? 'Nuevo mensaje en PyaServ' : 'Tenés una consulta en PyaServ',
        `Recibiste un mensaje en PyaServ:\n\n"${parsed.output.body.slice(0, 240)}"\n\nIngresá a https://pyaserv.com/me/ para responder.`,
      ),
    )

    const inquiry = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(inquiryId).first<InquiryRow>()
    return c.json({ data: toInquiryDto(inquiry as InquiryRow) }, 201)
  })
  .post('/:id/messages', requireAuth, async (c) => {
    const id = c.req.param('id')
    const inquiry = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first<InquiryRow>()
    if (!inquiry) throw new NotFoundError({ resource: 'inquiry' })
    const me = c.var.session.userId
    if (inquiry.client_user_id !== me && inquiry.specialist_user_id !== me)
      throw new ForbiddenError({ required: 'not a participant' })

    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(MessageCreateSchema, body)
    if (!parsed.success)
      throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join('.') ?? '', message: i.message })) })

    const now = Math.floor(Date.now() / 1000)
    const msgId = uuidV7()
    await c.env.DB.prepare(
      'INSERT INTO messages (id, inquiry_id, sender_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(msgId, id, me, parsed.output.body, now)
      .run()
    await c.env.DB.prepare('UPDATE inquiries SET last_message_at = ? WHERE id = ?').bind(now, id).run()
    const recipient = me === inquiry.client_user_id ? inquiry.specialist_user_id : inquiry.client_user_id
    c.executionCtx.waitUntil(
      tryNotify(
        c.env,
        recipient,
        'message_new',
        'Nuevo mensaje en PyaServ',
        `Recibiste un mensaje en PyaServ:\n\n"${parsed.output.body.slice(0, 240)}"\n\nIngresá a https://pyaserv.com/me/ para responder.`,
      ),
    )
    const msg = await c.env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(msgId).first<MessageRow>()
    return c.json({ data: toMessageDto(msg as MessageRow) }, 201)
  })
  .patch('/:id/status', requireAuth, async (c) => {
    const id = c.req.param('id')
    const inquiry = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first<InquiryRow>()
    if (!inquiry) throw new NotFoundError({ resource: 'inquiry' })
    const me = c.var.session.userId
    if (inquiry.client_user_id !== me && inquiry.specialist_user_id !== me)
      throw new ForbiddenError({ required: 'not a participant' })
    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(WorkStatusActionSchema, body)
    if (!parsed.success)
      throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join('.') ?? '', message: i.message })) })
    const updated = await applyWorkAction(c.env, inquiry, parsed.output.action, me)
    return c.json({ data: toInquiryDto(updated) })
  })
  .post('/:id/reviews', requireAuth, async (c) => {
    const id = c.req.param('id')
    const inquiry = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first<InquiryRow>()
    if (!inquiry) throw new NotFoundError({ resource: 'inquiry' })
    const me = c.var.session.userId
    const isClient = inquiry.client_user_id === me
    const isSpecialist = inquiry.specialist_user_id === me
    if (!isClient && !isSpecialist) throw new ForbiddenError({ required: 'not a participant' })
    if (inquiry.work_status !== 'done')
      throw new ValidationError({ issues: [{ path: 'inquiry', message: 'can only review after done' }] })
    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(ReviewCreateSchema, body)
    if (!parsed.success)
      throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join('.') ?? '', message: i.message })) })
    const role = isClient ? 'client' : 'specialist'
    const rateeUserId = isClient ? inquiry.specialist_user_id : inquiry.client_user_id
    const existing = await c.env.DB.prepare('SELECT id FROM reviews WHERE inquiry_id = ? AND role = ?')
      .bind(id, role)
      .first<{ id: string }>()
    if (existing) throw new ValidationError({ issues: [{ path: 'review', message: 'already rated' }] })
    const reviewId = uuidV7()
    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      'INSERT INTO reviews (id, inquiry_id, rater_user_id, ratee_user_id, role, stars, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(reviewId, id, me, rateeUserId, role, parsed.output.stars, parsed.output.body ?? '', now)
      .run()
    return c.json({ data: { id: reviewId, stars: parsed.output.stars, body: parsed.output.body ?? '' } }, 201)
  })
