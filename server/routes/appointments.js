import { Router } from 'express';
import { getDb } from '../db.js';
import { nanoid } from 'nanoid';

const router = Router();

// GET /api/appointments
router.get('/appointments', (req, res) => {
  const db = getDb();
  const { status, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM appointments';
  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY date DESC, time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const appointments = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as n FROM appointments' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '')).get(...params.slice(0, -2));

  res.json({ appointments: appointments.map((a) => ({
    ...a,
    duration: Number(a.duration),
  })), total: total.n });
});

// GET /api/appointments/:id
router.get('/appointments/:id', (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ appointment: a });
});

// POST /api/appointments
router.post('/appointments', (req, res) => {
  const db = getDb();
  const { businessId, type, customerName, customerPhone, date, time, duration, address, notes, source } = req.body;
  if (!businessId || !customerName || !customerPhone || !date || !time) {
    return res.status(400).json({ error: 'Business, customer name, phone, date, and time are required' });
  }

  const biz = db.prepare('SELECT id FROM businesses WHERE id = ?').get(businessId);
  if (!biz) return res.status(400).json({ error: 'Business not found' });

  const id = nanoid();
  const now = new Date().toISOString();
  const status = 'scheduled';
  db.prepare(`INSERT INTO appointments (id, business_id, type, customer_name, customer_phone, date, time, duration, address, notes, status, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, businessId, type || 'showing', customerName, customerPhone, date, time, duration || 30,
    address || '', notes || '', status, source || 'manual', now, now,
  );

  // Log action
  db.prepare(`INSERT INTO appointment_actions (id, appointment_id, action, data, agent_id, created_at) VALUES (?,?,?,?,?,?)`).run(
    nanoid(), id, 'created', JSON.stringify({ ...req.body, status }), null, now,
  );

  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  res.status(201).json({ appointment: a });
});

// PATCH /api/appointments/:id
router.patch('/appointments/:id', (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Appointment not found' });

  const fields = ['businessId', 'type', 'customerName', 'customerPhone', 'date', 'time', 'duration', 'address', 'notes', 'status'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      const col = f === 'businessId' ? 'business_id' : f === 'customerName' ? 'customer_name' : f === 'customerPhone' ? 'customer_phone' : f;
      updates.push(`${col} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.json({ appointment: a });

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(req.params.id);

  db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // Log status change
  if (req.body.status) {
    db.prepare(`INSERT INTO appointment_actions (id, appointment_id, action, data, agent_id, created_at) VALUES (?,?,?,?,?,?)`).run(
      nanoid(), req.params.id, 'status_changed', JSON.stringify({ old: a.status, new: req.body.status }), null, new Date().toISOString(),
    );
  }

  const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  res.json({ appointment: updated });
});

// DELETE /api/appointments/:id
router.delete('/appointments/:id', (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Appointment not found' });
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
