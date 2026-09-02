import { Router } from 'express';
import { getDb } from '../db.js';
import { nanoid } from 'nanoid';

const router = Router();

// GET /api/businesses
router.get('/businesses', (_, res) => {
  const db = getDb();
  const businesses = db.prepare('SELECT * FROM businesses ORDER BY name').all();
  res.json({ businesses: businesses.map((b) => ({
    ...b,
    serviceAreas: b.service_areas,
  })) });
});

// GET /api/businesses/:id
router.get('/businesses/:id', (req, res) => {
  const db = getDb();
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Business not found' });
  res.json({ business: { ...b, serviceAreas: b.service_areas } });
});

// POST /api/businesses
router.post('/businesses', (req, res) => {
  const db = getDb();
  const { name, type, phone, address, serviceAreas, greeting, note } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO businesses (id, name, type, phone, address, service_areas, greeting, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, name, type, phone || '', address || '', serviceAreas || '', greeting || '', note || '', now, now,
  );
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  res.status(201).json({ business: { ...b, serviceAreas: b.service_areas } });
});

// PATCH /api/businesses/:id
router.patch('/businesses/:id', (req, res) => {
  const db = getDb();
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Business not found' });

  const fields = ['name', 'type', 'phone', 'address', 'serviceAreas', 'greeting', 'note'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      const col = f === 'serviceAreas' ? 'service_areas' : f;
      updates.push(`${col} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.json({ business: { ...b, serviceAreas: b.service_areas } });

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(req.params.id);

  db.prepare(`UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  res.json({ business: { ...updated, serviceAreas: updated.service_areas } });
});

// DELETE /api/businesses/:id
router.delete('/businesses/:id', (req, res) => {
  const db = getDb();
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Business not found' });
  db.prepare('DELETE FROM businesses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
