import { requireAuth } from '@pya-company/auth'
import { ForbiddenError, NotFoundError, ValidationError, uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'
import * as v from 'valibot'
import { InquiryCreateSchema, MessageCreateSchema } from '../schemas.ts'

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
})

const toMessageDto = (r: MessageRow) => ({
  id: r.id,
  inquiryId: r.inquiry_id,
  senderUserId: r.sender_user_id,
  body: r.body,
  createdAt: r.created_at,
})

// Resolve the counter-party (specialist user) for the given subject.
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
      throw new ValidationError({ issues: [{ path: "", message: "cannot open inquiry on own listing" }] })
    return { specialistUserId: row.user_id, clientUserId: meUserId }
  }
  // request: the message author is the specialist responding
  const row = await env.DB.prepare('SELECT client_id FROM requests WHERE id = ?')
    .bind(subjectId)
    .first<{ client_id: string }>()
  if (!row) throw new NotFoundError({ resource: 'request' })
  if (row.client_id === meUserId)
    throw new ValidationError({ issues: [{ path: "", message: "cannot open inquiry on own request" }] })
  return { specialistUserId: meUserId, clientUserId: row.client_id }
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
      throw new ForbiddenError({ required: "not a participant" })
    const messages = await c.env.DB.prepare(
      'SELECT * FROM messages WHERE inquiry_id = ? ORDER BY created_at ASC LIMIT 500',
    )
      .bind(id)
      .all<MessageRow>()
    return c.json({
      data: {
        inquiry: toInquiryDto(inquiry),
        messages: messages.results.map(toMessageDto),
      },
    })
  })
  .post('/', requireAuth, async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(InquiryCreateSchema, body)
    if (!parsed.success) throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join(".") ?? "", message: i.message })) })
    const me = c.var.session.userId
    const { specialistUserId, clientUserId } = await resolveSpecialistUserId(
      c.env,
      parsed.output.subjectType,
      parsed.output.subjectId,
      me,
    )
    const now = Math.floor(Date.now() / 1000)

    // upsert: one thread per (subject, pair)
    const existing = await c.env.DB.prepare(
      `SELECT * FROM inquiries
       WHERE subject_type = ? AND subject_id = ? AND client_user_id = ? AND specialist_user_id = ?`,
    )
      .bind(parsed.output.subjectType, parsed.output.subjectId, clientUserId, specialistUserId)
      .first<InquiryRow>()

    const inquiryId = existing ? existing.id : uuidV7()
    if (!existing) {
      await c.env.DB.prepare(
        `INSERT INTO inquiries (id, subject_type, subject_id, client_user_id, specialist_user_id, last_message_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
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

    const inquiry = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(inquiryId).first<InquiryRow>()
    return c.json({ data: toInquiryDto(inquiry as InquiryRow) }, 201)
  })
  .post('/:id/messages', requireAuth, async (c) => {
    const id = c.req.param('id')
    const inquiry = await c.env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first<InquiryRow>()
    if (!inquiry) throw new NotFoundError({ resource: 'inquiry' })
    const me = c.var.session.userId
    if (inquiry.client_user_id !== me && inquiry.specialist_user_id !== me)
      throw new ForbiddenError({ required: "not a participant" })

    const body = await c.req.json().catch(() => ({}))
    const parsed = v.safeParse(MessageCreateSchema, body)
    if (!parsed.success) throw new ValidationError({ issues: parsed.issues.map((i) => ({ path: i.path?.map((p) => p.key).join(".") ?? "", message: i.message })) })

    const now = Math.floor(Date.now() / 1000)
    const msgId = uuidV7()
    await c.env.DB.prepare(
      'INSERT INTO messages (id, inquiry_id, sender_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(msgId, id, me, parsed.output.body, now)
      .run()
    await c.env.DB.prepare('UPDATE inquiries SET last_message_at = ? WHERE id = ?').bind(now, id).run()
    const msg = await c.env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(msgId).first<MessageRow>()
    return c.json({ data: toMessageDto(msg as MessageRow) }, 201)
  })
