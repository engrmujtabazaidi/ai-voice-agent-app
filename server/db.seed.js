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
    'Hi, thanks for calling Smith Realty Group! My name is Sarah, and I\'m here to help you find your perfect home or answer any real estate questions. How can I assist you today?',
    'Top-producing real estate brokerage in Chicago since 2010. Specializes in luxury listings and first-time homebuyers.',
    now, now,
  );

  const agentId = nanoid();
  db.prepare(`INSERT INTO agents (id, name, business_id, phone_number, voice, status, system_prompt, twilio_sid, twilio_auth_token, scheduled_days, scheduled_start, scheduled_end, timezone, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    agentId, 'RealtyAgent AI', bizId, '+15551234567', 'sarah', 'active',
    'You are Sarah, a professional real estate agent assistant for Smith Realty Group. Your personality: warm, friendly, knowledgeable, and concise. You speak naturally like a real person — not robotic. Rules: (1) Always greet callers warmly and state your name. (2) Listen carefully and answer questions about homes, neighborhoods, pricing, and the buying/selling process. (3) When someone wants to schedule a showing or consultation, confirm the date, time, address, and their name clearly before booking. (4) Repeat back all appointment details to confirm. (5) If you don\'t know an answer, offer to have a human agent follow up. (6) Keep responses under 30 seconds of speech. (7) End calls politely. (8) Never make up property details — use only what the business provides.',
    '', '', 'mon,tue,wed,thu,fri,sat', '00:00', '23:59', 'America/Chicago',
    now, now,
  );

  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);

  const appts = [
    { customerName: 'John Martinez', phone: '+15559876543', type: 'showing', date: tomorrow.toISOString(), time: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 0).toISOString(), address: '456 Oak Avenue, Chicago, IL 60614', duration: 45, notes: '3BR/2BA, interested in kitchen remodel' },
    { customerName: 'Emily Chen', phone: '+15558765432', type: 'consultation', date: nextWeek.toISOString(), time: new Date(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate(), 10, 0).toISOString(), duration: 60, notes: 'First-time buyer consultation' },
    { customerName: 'Robert Wilson', phone: '+15557654321', type: 'showing', date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2).toISOString(), time: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 15, 30).toISOString(), address: '789 Pine Street, Chicago, IL 60611', duration: 30, notes: 'Luxury condo, agent to bring floor plans' },
  ];

  for (const a of appts) {
    db.prepare(`INSERT INTO appointments (id, business_id, type, customer_name, customer_phone, date, time, duration, address, notes, status, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      nanoid(), bizId, a.type, a.customerName, a.phone, a.date, a.time, a.duration, a.address || '', a.notes || '', 'scheduled', 'ai', now, now,
    );
  }

  console.log('Demo data seeded:', { businesses: 1, agents: 1, appointments: appts.length });
}
