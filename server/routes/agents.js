import { Router } from 'express';
import { getDb } from '../db.js';
import { nanoid } from 'nanoid';

const router = Router();

// GET /api/agents
router.get('/agents', (_, res) => {
  const db = getDb();
  const agents = db.prepare('SELECT * FROM agents ORDER BY name').all();
  res.json({ agents });
});

// GET /api/agents/:id
router.get('/agents/:id', (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Agent not found' });
  res.json({ agent: a });
});

// POST /api/agents
router.post('/agents', (req, res) => {
  const db = getDb();
  const { name, businessId, phoneNumber, voice, status, systemPrompt, twilioSid, twilioAuthToken, scheduledDays, scheduledStart, scheduledEnd, timezone } = req.body;
  if (!name || !businessId) return res.status(400).json({ error: 'Name and business ID are required' });

  // Validate business exists
  const biz = db.prepare('SELECT id FROM businesses WHERE id = ?').get(businessId);
  if (!biz) return res.status(400).json({ error: 'Business not found' });

  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO agents (id, name, business_id, phone_number, voice, status, system_prompt, twilio_sid, twilio_auth_token, scheduled_days, scheduled_start, scheduled_end, timezone, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, name, businessId, phoneNumber || '', voice || 'alice', status || 'offline', systemPrompt || '',
    twilioSid || '', twilioAuthToken || '', scheduledDays || 'mon,tue,wed,thu,fri', scheduledStart || '9:00',
    scheduledEnd || '18:00', timezone || 'America/Chicago', now, now,
  );
  const a = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  res.status(201).json({ agent: a });
});

// PATCH /api/agents/:id
router.patch('/agents/:id', (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Agent not found' });

  const fields = ['name', 'businessId', 'phoneNumber', 'voice', 'status', 'systemPrompt', 'twilioSid', 'twilioAuthToken', 'scheduledDays', 'scheduledStart', 'scheduledEnd', 'timezone'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      const col = f === 'businessId' ? 'business_id' : f === 'phoneNumber' ? 'phone_number' : f === 'systemPrompt' ? 'system_prompt' : f === 'twilioSid' ? 'twilio_sid' : f === 'twilioAuthToken' ? 'twilio_auth_token' : f === 'scheduledDays' ? 'scheduled_days' : f === 'scheduledStart' ? 'scheduled_start' : f === 'scheduledEnd' ? 'scheduled_end' : f === 'timezone' ? 'timezone' : f;
      updates.push(`${col} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.json({ agent: a });

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(req.params.id);

  db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  res.json({ agent: updated });
});

// POST /api/agents/:id/toggle
router.post('/agents/:id/toggle', (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Agent not found' });

  const newStatus = a.status === 'active' ? 'paused' : a.status === 'paused' ? 'offline' : 'active';
  db.prepare('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, new Date().toISOString(), req.params.id);
  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  res.json({ agent: updated });
});

// DELETE /api/agents/:id
router.delete('/agents/:id', (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Agent not found' });
  db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
