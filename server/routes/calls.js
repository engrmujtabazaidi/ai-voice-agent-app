import { Router } from 'express';
import { getDb } from '../db.js';
import { nanoid } from 'nanoid';

const router = Router();

// GET /api/calls
router.get('/calls', (req, res) => {
  const db = getDb();
  const { status, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT c.*, a.name as agent_name, b.name as business_name FROM calls c LEFT JOIN agents a ON c.agent_id = a.id LEFT JOIN businesses b ON c.business_id = b.id';
  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('c.status = ?');
    params.push(status);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const calls = db.prepare(query).all(...params);
  const countQuery = 'SELECT COUNT(*) as n FROM calls c' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '');
  const total = db.prepare(countQuery).get(...params.slice(0, -2));

  res.json({ calls, total: total.n });
});

// GET /api/calls/:id
router.get('/calls/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare('SELECT c.*, a.name as agent_name, b.name as business_name FROM calls c LEFT JOIN agents a ON c.agent_id = a.id LEFT JOIN businesses b ON c.business_id = b.id WHERE c.id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Call not found' });
  res.json({ call: c });
});

export default router;
