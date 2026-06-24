import { requireAuth } from '@pya-company/auth'
import { ForbiddenError, NotFoundError, ValidationError, uuidV7 } from '@pya-company/shared'
import { Hono } from 'hono'

interface AppEnv {
  readonly Bindings: Env
}

interface QuoteItem {
  readonly name: string
  readonly qty: number
  readonly unitPrice: number
}

const validateItems = (raw: unknown): QuoteItem[] => {
  if (!Array.isArray(raw)) throw new ValidationError({ issues: [{ path: 'items', message: 'array required' }] })
  return raw.slice(0, 50).map((r: { name?: unknown; qty?: unknown; unitPrice?: unknown }, idx) => {
    const name = typeof r?.name === 'string' ? r.name.slice(0, 200) : ''
    const qty = Math.max(1, Math.min(9999, Math.round(Number(r?.qty || 1))))
    const unitPrice = Math.max(0, Math.round(Number(r?.unitPrice || 0)))
    if (!name) throw new ValidationError({ issues: [{ path: `items[${idx}].name`, message: 'required' }] })
    return { name, qty, unitPrice }
  })
}

const computeTotals = (items: QuoteItem[], ivaIncluded: boolean): { subtotal: number; iva: number; total: number } => {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
  const iva = ivaIncluded ? Math.round(subtotal * 0.1) : 0
  return { subtotal, iva, total: subtotal + iva }
}

export const quotesClientsRoutes = new Hono<AppEnv>()

  /* ----- Quote Templates ----- */
  .get('/quote-templates', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const result = await c.env.DB.prepare(
      'SELECT id, oficio, title, items_json, is_default, created_at FROM quote_templates WHERE user_id = ? ORDER BY oficio, title',
    ).bind(userId).all<{ id: string; oficio: string; title: string; items_json: string; is_default: number; created_at: number }>()
    return c.json({
      data: result.results.map((r) => ({
        id: r.id, oficio: r.oficio, title: r.title,
        items: JSON.parse(r.items_json), isDefault: r.is_default === 1, createdAt: r.created_at,
      })),
    })
  })

  .post('/quote-templates', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const body = await c.req.json().catch(() => ({})) as { oficio?: unknown; title?: unknown; items?: unknown }
    if (typeof body.oficio !== 'string' || typeof body.title !== 'string') {
      throw new ValidationError({ issues: [{ path: 'oficio|title', message: 'required' }] })
    }
    const items = validateItems(body.items)
    const id = uuidV7()
    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      'INSERT INTO quote_templates (id, user_id, oficio, title, items_json, is_default, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
    ).bind(id, userId, body.oficio.slice(0, 50), body.title.slice(0, 200), JSON.stringify(items), now).run()
    return c.json({ data: { id, oficio: body.oficio, title: body.title, items, createdAt: now } }, 201)
  })

  .delete('/quote-templates/:id', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const id = c.req.param('id')
    const row = await c.env.DB.prepare('SELECT user_id FROM quote_templates WHERE id = ?').bind(id).first<{ user_id: string }>()
    if (!row) throw new NotFoundError({ resource: 'quote_template' })
    if (row.user_id !== userId) throw new ForbiddenError({ required: 'not owner' })
    await c.env.DB.prepare('DELETE FROM quote_templates WHERE id = ?').bind(id).run()
    return c.json({ data: { ok: true } })
  })

  /* ----- Quotes ----- */
  .get('/quotes', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const result = await c.env.DB.prepare(
      `SELECT id, client_name, client_phone, items_json, subtotal_gs, iva_included, iva_gs, total_gs,
              pdf_key, sent_at, created_at
       FROM quotes WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    ).bind(userId).all<{
      id: string; client_name: string | null; client_phone: string | null;
      items_json: string; subtotal_gs: number; iva_included: number; iva_gs: number; total_gs: number;
      pdf_key: string | null; sent_at: number | null; created_at: number;
    }>()
    return c.json({
      data: result.results.map((r) => ({
        id: r.id, clientName: r.client_name, clientPhone: r.client_phone,
        items: JSON.parse(r.items_json),
        subtotal: r.subtotal_gs, iva: r.iva_gs, total: r.total_gs, ivaIncluded: r.iva_included === 1,
        pdfKey: r.pdf_key, sentAt: r.sent_at, createdAt: r.created_at,
      })),
    })
  })

  .post('/quotes', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const body = await c.req.json().catch(() => ({})) as {
      clientName?: unknown; clientPhone?: unknown; items?: unknown; ivaIncluded?: unknown
    }
    const items = validateItems(body.items)
    const ivaIncluded = body.ivaIncluded !== false
    const totals = computeTotals(items, ivaIncluded)
    const id = uuidV7()
    const now = Math.floor(Date.now() / 1000)
    await c.env.DB.prepare(
      `INSERT INTO quotes (id, user_id, client_name, client_phone, items_json, subtotal_gs,
         iva_included, iva_gs, total_gs, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, userId,
      typeof body.clientName === 'string' ? body.clientName.slice(0, 200) : null,
      typeof body.clientPhone === 'string' ? body.clientPhone.slice(0, 50) : null,
      JSON.stringify(items),
      totals.subtotal, ivaIncluded ? 1 : 0, totals.iva, totals.total, now,
    ).run()
    return c.json({ data: { id, items, ...totals, ivaIncluded, createdAt: now } }, 201)
  })

  .post('/quotes/:id/sent', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const id = c.req.param('id')
    const now = Math.floor(Date.now() / 1000)
    const row = await c.env.DB.prepare('SELECT user_id FROM quotes WHERE id = ?').bind(id).first<{ user_id: string }>()
    if (!row) throw new NotFoundError({ resource: 'quote' })
    if (row.user_id !== userId) throw new ForbiddenError({ required: 'not owner' })
    await c.env.DB.prepare('UPDATE quotes SET sent_at = ? WHERE id = ?').bind(now, id).run()
    return c.json({ data: { ok: true, sentAt: now } })
  })

  /* ----- Lite-CRM "Mis clientes" ----- */
  .get('/clients', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const result = await c.env.DB.prepare(
      `SELECT id, client_user_id, display_name, phone, barrio, notes, job_count,
              last_job_at, last_job_oficio, next_pitch_at, opt_out, created_at, updated_at
       FROM client_records WHERE specialist_user_id = ? AND opt_out = 0
       ORDER BY updated_at DESC LIMIT 200`,
    ).bind(userId).all<{
      id: string; client_user_id: string; display_name: string | null; phone: string | null;
      barrio: string | null; notes: string | null; job_count: number; last_job_at: number | null;
      last_job_oficio: string | null; next_pitch_at: number | null; opt_out: number;
      created_at: number; updated_at: number;
    }>()
    return c.json({
      data: result.results.map((r) => ({
        id: r.id, clientUserId: r.client_user_id, displayName: r.display_name,
        phone: r.phone, barrio: r.barrio, notes: r.notes ?? '',
        jobCount: r.job_count, lastJobAt: r.last_job_at, lastJobOficio: r.last_job_oficio,
        nextPitchAt: r.next_pitch_at, optOut: r.opt_out === 1,
        createdAt: r.created_at, updatedAt: r.updated_at,
      })),
    })
  })

  .patch('/clients/:id', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({})) as { notes?: unknown }
    if (typeof body.notes !== 'string') {
      throw new ValidationError({ issues: [{ path: 'notes', message: 'string required' }] })
    }
    const row = await c.env.DB.prepare(
      'SELECT specialist_user_id FROM client_records WHERE id = ?',
    ).bind(id).first<{ specialist_user_id: string }>()
    if (!row) throw new NotFoundError({ resource: 'client_record' })
    if (row.specialist_user_id !== userId) throw new ForbiddenError({ required: 'not owner' })
    await c.env.DB.prepare(
      'UPDATE client_records SET notes = ?, updated_at = ? WHERE id = ?',
    ).bind(body.notes.slice(0, 2000), Math.floor(Date.now() / 1000), id).run()
    return c.json({ data: { ok: true } })
  })

  /* ----- Analytics enhanced ----- */
  .get('/analytics-extended', requireAuth, async (c) => {
    const userId = c.var.session.userId
    const now = Math.floor(Date.now() / 1000)
    const days30Ago = now - 30 * 86400
    const days7Ago = now - 7 * 86400

    const counts = await c.env.DB.prepare(
      `SELECT event, COUNT(*) as n FROM analytics_events
       WHERE user_id = ? AND ts >= ?
       GROUP BY event`,
    ).bind(userId, days30Ago).all<{ event: string; n: number }>()

    const byDay = await c.env.DB.prepare(
      `SELECT (ts / 86400) as day, COUNT(*) as n FROM analytics_events
       WHERE user_id = ? AND ts >= ? AND event = 'profile_view'
       GROUP BY day ORDER BY day`,
    ).bind(userId, days7Ago).all<{ day: number; n: number }>()

    const inquiries30 = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM inquiries WHERE specialist_user_id = ? AND created_at >= ?`,
    ).bind(userId, days30Ago).first<{ n: number }>()

    const completed30 = await c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM inquiries WHERE specialist_user_id = ? AND work_status = 'done' AND closed_at >= ?`,
    ).bind(userId, days30Ago).first<{ n: number }>()

    const reviewAgg = await c.env.DB.prepare(
      `SELECT COALESCE(AVG(stars), 0) as avg, COUNT(*) as n FROM reviews
       WHERE ratee_user_id = ? AND role = 'client'`,
    ).bind(userId).first<{ avg: number; n: number }>()

    const eventMap = new Map(counts.results.map((r) => [r.event, r.n]))

    return c.json({
      data: {
        last30Days: {
          profileViews: eventMap.get('profile_view') ?? 0,
          phoneClicks: eventMap.get('phone_click') ?? 0,
          whatsappClicks: eventMap.get('whatsapp_click') ?? 0,
          inquiriesReceived: inquiries30?.n ?? 0,
          jobsCompleted: completed30?.n ?? 0,
        },
        lifetime: {
          reviewsCount: reviewAgg?.n ?? 0,
          ratingAvg: Math.round((reviewAgg?.avg ?? 0) * 10) / 10,
        },
        viewsByDay: byDay.results.map((r) => ({ day: r.day, n: r.n })),
      },
    })
  })
