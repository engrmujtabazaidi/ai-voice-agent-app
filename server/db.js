import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'voice-agent.db');

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export async function initDb() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'real_estate' CHECK(type IN ('real_estate','service')),
      phone TEXT,
      address TEXT,
      service_areas TEXT,
      greeting TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      phone_number TEXT,
      voice TEXT NOT NULL DEFAULT 'alice',
      status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('active','paused','offline')),
      system_prompt TEXT,
      twilio_sid TEXT,
      twilio_auth_token TEXT,
      scheduled_days TEXT NOT NULL DEFAULT 'mon,tue,wed,thu,fri',
      scheduled_start TEXT NOT NULL DEFAULT '9:00',
      scheduled_end TEXT NOT NULL DEFAULT '18:00',
      timezone TEXT NOT NULL DEFAULT 'America/Chicago',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'showing' CHECK(type IN ('showing','consultation','followup','other')),
      customer_name TEXT,
      customer_phone TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 30,
      address TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','missed','cancelled')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','ai','phone')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
      caller_number TEXT,
      caller_name TEXT,
      twilio_call_sid TEXT,
      direction TEXT NOT NULL DEFAULT 'inbound' CHECK(direction IN ('inbound','outbound')),
      status TEXT NOT NULL DEFAULT 'no_answer' CHECK(status IN ('in_progress','completed','missed','busy','no_answer','cancelled')),
      duration INTEGER,
      outcome TEXT,
      recording_url TEXT,
      transcription TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS appointment_actions (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      data TEXT,
      agent_id TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_calls_agent ON calls(agent_id);
    CREATE INDEX IF NOT EXISTS idx_calls_business ON calls(business_id);
    CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at);
  `);

  console.log('Database initialized at', DB_PATH);
}

export async function seedDemo() {
  const db = getDb();
  const now = new Date().toISOString();

  const count = db.prepare('SELECT COUNT(*) as n FROM businesses').get();
  if (count.n > 0) return;

  console.log('Seeding demo data...');

  const bizId = nanoid();
  db.prepare(`INSERT INTO businesses (id, name, type, phone, address, service_areas, greeting, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    bizId, 'Smith Realty Group', 'real_estate', '+15551234567',
    '123 Main Street, Suite 400, Chicago, IL 60601',
    'Downtown Chicago, West Loop, Lincoln Park, Gold Coast',
    'Hi, thanks for calling Smith Realty Group! My name is Sarah, and I am here to help you find your perfect home or answer any real estate questions. How can I assist you today?',
    'Top-producing real estate brokerage in Chicago since 2010. Specializes in luxury listings and first-time homebuyers.',
    now, now,
  );

  const agentId = nanoid();
  db.prepare(`INSERT INTO agents (id, name, business_id, phone_number, voice, status, system_prompt, twilio_sid, twilio_auth_token, scheduled_days, scheduled_start, scheduled_end, timezone, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    agentId, 'RealtyAgent AI', bizId, '+15551234567', 'sarah', 'active',
    'You are Sarah, a professional real estate agent assistant for Smith Realty Group. Your personality: warm, friendly, knowledgeable, and concise. You speak naturally like a real person — not robotic. Rules: (1) Always greet callers warmly and state your name. (2) Listen carefully and answer questions about homes, neighborhoods, pricing, and the buying/selling process. (3) When someone wants to schedule a showing or consultation, confirm the date, time, address, and their name clearly before booking. (4) Repeat back all appointment details to confirm. (5) If you do not know an answer, offer to have a human agent follow up. (6) Keep responses under 30 seconds of speech. (7) End calls politely. (8) Never make up property details — use only what the business provides.',
    '', '', 'mon,tue,wed,thu,fri', '09:00', '18:00', 'America/Chicago',
    now, now,
  );

  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);

  const appts = [
    { customerName: 'John Martinez', phone: '+15556543210', type: 'showing', date: tomorrow.toISOString(), time: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 0).toISOString(), address: '456 Oak Avenue, Chicago, IL 60614', duration: 45, notes: '3BR/2BA, interested in kitchen remodel' },
    { customerName: 'Emily Chen', phone: '+15555432109', type: 'consultation', date: nextWeek.toISOString(), time: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 10, 0).toISOString(), duration: 60, notes: 'First-time buyer consultation' },
    { customerName: 'Robert Wilson', phone: '+15554321098', type: 'showing', date: dayAfter.toISOString(), time: new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate(), 15, 30).toISOString(), address: '789 Pine Street, Chicago, IL 60611', duration: 30, notes: 'Luxury condo, agent to bring floor plans' },
  ];

  for (const a of appts) {
    db.prepare(`INSERT INTO appointments (id, business_id, type, customer_name, customer_phone, date, time, duration, address, notes, status, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      nanoid(), bizId, a.type, a.customerName, a.phone, a.date, a.time, a.duration, a.address || '', a.notes || '', 'scheduled', 'ai', now, now,
    );
  }

  console.log('Demo data seeded:', { businesses: 1, agents: 1, appointments: appts.length });
}