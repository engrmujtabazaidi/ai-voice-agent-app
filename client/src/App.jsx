import React, { useState, useEffect } from 'react';
import {
  // Business API
  getBusinesses, createBusiness, updateBusiness, deleteBusiness,
  // Agent API
  getAgents, createAgent, updateAgent, deleteAgent, toggleAgent,
  // Appointment API
  getAppointments, createAppointment, updateAppointment, deleteAppointment,
  // Call API
  getCallLogs,
} from './api';

// ── Helpers ──────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtDateTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const fmtPhone = (p) => (p || '').replace(/^(\+?\d{1,3})?(\d{3})(\d{3})(\d{4})$/, (_, pfx, a, b, c) => `${pfx ? pfx + ' ' : '() '}${a} ${b}-${c}`.trim());
const statusClass = (s) => {
  const m = { completed: 'badge-success', missed: 'badge-danger', cancelled: 'badge-warning', scheduled: 'badge-info', active: 'badge-success', paused: 'badge-warning', offline: 'badge-danger' };
  return m[s] || 'badge-info';
};
const toast = (msg) => {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
};

// ── Modal ─────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Confirm ────────────────────────────────────────────────────────────
function Confirm({ open, onClose, onConfirm, title, message }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>Delete</button>
      </>
    }>
      <p className="text-muted">{message}</p>
    </Modal>
  );
}

// ── Sidebar nav ────────────────────────────────────────────────────────
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'businesses', label: 'Businesses', icon: '🏢' },
  { id: 'agents', label: 'Voice Agents', icon: '🤖' },
  { id: 'appointments', label: 'Appointments', icon: '📅' },
  { id: 'calls', label: 'Call Logs', icon: '📞' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: 16, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="8" fill="#6366f1"/>
              <path d="M10 12 L22 12 L22 20 L10 20 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
              <circle cx="16" cy="16" r="3" fill="#fff"/>
              <path d="M16 19 L16 24 M13 22 L19 22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 15 }}>VoiceAgent</span>
          </div>
          <p className="text-xs text-muted mt-2">AI Appointment Automation</p>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 6, fontWeight: 500, fontSize: 13,
                background: page === n.id ? '#e0e7ff' : 'transparent',
                color: page === n.id ? '#3730a3' : 'var(--text)',
                border: page === n.id ? '1px solid #c7d2fe' : '1px solid transparent',
                transition: 'all .15s',
              }}
            >
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>API</span>
              <span>localhost:3001</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Mode</span>
              <span className="badge badge-info">Simulation</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 28, overflowY: 'auto', maxWidth: 1200 }}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'businesses' && <Businesses />}
        {page === 'agents' && <Agents />}
        {page === 'appointments' && <Appointments />}
        {page === 'calls' && <CallLogs />}
      </main>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState({ totalBusinesses: 0, activeAgents: 0, totalAppointments: 0, todayAppointments: 0, missedCalls: 0, callsToday: 0 });

  useEffect(() => {
    Promise.all([
      getBusinesses().catch(() => ({ businesses: [] })),
      getAgents().catch(() => ({ agents: [] })),
      getAppointments({ limit: 999 }).catch(() => ({ appointments: [] })),
      getCallLogs({ limit: 999 }).catch(() => ({ calls: [] })),
    ]).then(([b, a, ap, c]) => {
      const today = new Date().toDateString();
      setStats({
        totalBusinesses: b.businesses?.length || 0,
        activeAgents: a.agents?.filter((x) => x.status === 'active').length || 0,
        totalAppointments: ap.appointments?.length || 0,
        todayAppointments: ap.appointments?.filter((x) => x.status !== 'cancelled' && new Date(x.date).toDateString() === today).length || 0,
        missedCalls: c.calls?.filter((x) => x.status === 'missed').length || 0,
        callsToday: c.calls?.filter((x) => new Date(x.timestamp).toDateString() === today).length || 0,
      });
    });
  }, []);

  const cards = [
    { label: 'Businesses', value: stats.totalBusinesses, color: '#6366f1', desc: 'Connected service businesses' },
    { label: 'Active Agents', value: stats.activeAgents, color: '#22c55e', desc: 'Voice agents online now' },
    { label: 'Appointments Today', value: stats.todayAppointments, color: '#f59e0b', desc: `of ${stats.totalAppointments} total` },
    { label: 'Missed Calls', value: stats.missedCalls, color: stats.missedCalls > 0 ? '#ef4444' : '#64748b', desc: `${stats.callsToday} calls today` },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Dashboard</h1>
      <p className="text-muted text-sm mb-6">Overview of your AI voice agent automation</p>

      <div className="grid grid-2 mb-6" style={{ marginBottom: 24 }}>
        {cards.map((c, i) => (
          <div key={i} className="card" style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: c.color, opacity: .08 }} />
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color, position: 'relative' }}>{c.value}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{c.label}</div>
            <div className="text-muted text-sm mt-2" style={{ position: 'relative' }}>{c.desc}</div>
          </div>
        ))}
      </div>

      {/* Recent calls preview */}
      <div className="card">
        <div className="flex-between mb-4">
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recent Call Activity</h3>
          <a href="#/calls" style={{ fontSize: 13 }}>View all →</a>
        </div>
        <div id="recentCalls" style={{ minHeight: 100 }}>
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            <p>No calls yet. When an agent takes an inbound call, it will appear here.</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-3 mt-6">
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>100%</div>
          <div className="text-muted text-sm">Appointment conversion (sim)</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#6366f1' }}>&lt;2s</div>
          <div className="text-muted text-sm">Avg call answer time</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>24/7</div>
          <div className="text-muted text-sm">Agent availability</div>
        </div>
      </div>
    </div>
  );
}

// ── Businesses ─────────────────────────────────────────────────────────
function Businesses() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'real_estate', phone: '', address: '', note: '', serviceAreas: '', greeting: '' });
  const [delId, setDelId] = useState(null);

  const load = () => getBusinesses().then((d) => setList(d.businesses || []));
  useEffect(() => { load(); }, []);

  const reset = () => { setForm({ name: '', type: 'real_estate', phone: '', address: '', note: '', serviceAreas: '', greeting: '' }); setEditing(null); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (b) => { setForm({ name: b.name, type: b.type, phone: b.phone, address: b.address || '', note: b.note || '', serviceAreas: b.serviceAreas || '', greeting: b.greeting || '' }); setEditing(b.id); setOpen(true); };

  const save = async () => {
    try {
      if (editing) {
        await updateBusiness(editing, form);
        toast('Business updated');
      } else {
        await createBusiness(form);
        toast('Business created');
      }
      setOpen(false);
      load();
    } catch (e) { toast(e.message); }
  };

  const remove = async () => {
    try {
      await deleteBusiness(delId);
      toast('Business deleted');
      setDelId(null);
      load();
    } catch (e) { toast(e.message); }
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Businesses</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Add Business</button>
      </div>
      <p className="text-muted text-sm mb-6">Real estate and service businesses that use your AI voice agents</p>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {list.map((b) => (
          <div key={b.id} className="card" style={{ padding: 18 }}>
            <div className="flex-between items-center mb-2">
              <div style={{ fontWeight: 600, fontSize: 15 }} className="truncate max-w-sm">{b.name}</div>
              <span className={`badge ${b.type === 'real_estate' ? 'badge-info' : 'badge-success'}`}>{b.type === 'real_estate' ? 'Real Estate' : 'Service'}</span>
            </div>
            {b.phone && <div className="text-muted text-sm mb-1">📞 {fmtPhone(b.phone)}</div>}
            {b.address && <div className="text-muted text-sm mb-1">📍 {b.address}</div>}
            {b.serviceAreas && <div className="text-muted text-sm mb-2">Areas: {b.serviceAreas}</div>}
            {b.greeting && <div className="text-xs text-muted mb-2 max-w-sm">Greeting: {b.greeting.slice(0, 60)}{b.greeting.length > 60 ? '…' : ''}</div>}
            {b.note && <div className="text-xs text-muted mb-2">{b.note}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDelId(b.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && (
        <div className="empty-state card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 10h18M3 7l9-4 9 4M3 10v11M21 10v11M6 21v-6h12v6"/></svg>
          <p>No businesses yet. Add your first business to get started.</p>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Business' : 'Add Business'} footer={<button className="btn btn-primary" onClick={save}>Save</button>}>
        <div className="form-group">
          <label className="form-label">Business Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Smith Realty Group" />
        </div>
        <div className="form-group">
          <label className="form-label">Business Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="real_estate">Real Estate</option>
            <option value="service">Service Business</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+15551234567" className="w-full" />
          <div className="form-hint">The number that receives inbound calls</div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City" />
        </div>
        <div className="form-group">
          <label className="form-label">Service Areas</label>
          <input value={form.serviceAreas} onChange={(e) => setForm({ ...form, serviceAreas: e.target.value })} placeholder="Downtown, Westside, North Hills" />
        </div>
        <div className="form-group">
          <label className="form-label">Greeting Script</label>
          <textarea rows={3} value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} placeholder="Hi, thanks for calling {business} — how can I help you today?" />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional internal notes" />
        </div>
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} title="Delete Business" message="This will delete the business and disconnect all associated agents. This cannot be undone." />
    </div>
  );
}

// ── Agents ─────────────────────────────────────────────────────────────
function Agents() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', businessId: '', phoneNumber: '', voice: 'alice', status: 'offline', systemPrompt: '', twilioSid: '', twilioAuthToken: '', scheduledDays: 'mon,tue,wed,thu,fri', scheduledStart: '9:00', scheduledEnd: '18:00', timezone: 'America/Chicago' });
  const [delId, setDelId] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => getAgents().then((d) => setList(d.agents || []));
  const loadBiz = () => getBusinesses().then((d) => setBiz(d.businesses || []));
  const [biz, setBiz] = useState([]);
  useEffect(() => { load(); loadBiz(); }, []);

  const reset = () => { setForm({ name: '', businessId: '', phoneNumber: '', voice: 'alice', status: 'offline', systemPrompt: '', twilioSid: '', twilioAuthToken: '', scheduledDays: 'mon,tue,wed,thu,fri', scheduledStart: '9:00', scheduledEnd: '18:00', timezone: 'America/Chicago' }); setEditing(null); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (a) => {
    setForm({
      name: a.name, businessId: a.businessId, phoneNumber: a.phoneNumber || '', voice: a.voice, status: a.status,
      systemPrompt: a.systemPrompt || '', twilioSid: a.twilioSid || '', twilioAuthToken: a.twilioAuthToken || '',
      scheduledDays: a.scheduledDays || 'mon,tue,wed,thu,fri', scheduledStart: a.scheduledStart || '9:00',
      scheduledEnd: a.scheduledEnd || '18:00', timezone: a.timezone || 'America/Chicago',
    });
    setEditing(a.id);
    setOpen(true);
  };

  const save = async () => {
    try {
      setLoading(true);
      if (editing) {
        await updateAgent(editing, form);
        toast('Agent updated');
      } else {
        await createAgent(form);
        toast('Agent created');
      }
      setOpen(false);
      load();
    } catch (e) { toast(e.message); } finally { setLoading(false); }
  };

  const toggle = async (id) => {
    try {
      await toggleAgent(id);
      toast('Agent status toggled');
      load();
    } catch (e) { toast(e.message); }
  };

  const remove = async () => {
    try {
      await deleteAgent(delId);
      toast('Agent deleted');
      setDelId(null);
      load();
    } catch (e) { toast(e.message); }
  };

  const bizName = (id) => biz.find((b) => b.id === id)?.name || '—';

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Voice Agents</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Add Agent</button>
      </div>
      <p className="text-muted text-sm mb-6">AI voice agents that handle inbound calls and book appointments autonomously</p>

      {/* Agent cards */}
      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {list.map((a) => {
          const biz = biz.find((b) => b.id === a.businessId);
          return (
            <div key={a.id} className="card" style={{ padding: 18 }}>
              <div className="flex-between items-center mb-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: a.status === 'active' ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    {a.status === 'active' ? '🟢' : '🔴'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }} className="truncate max-w-sm">{a.name}</div>
                    <div className="text-xs text-muted">{a.voice} voice · {biz?.name || 'No business'}</div>
                  </div>
                </div>
                <button className={`btn btn-sm ${a.status === 'active' ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggle(a.id)}>
                  {a.status === 'active' ? 'Pause' : 'Activate'}
                </button>
              </div>

              <div className="flex-between items-center mb-2 text-sm">
                <span className={`badge ${a.status === 'active' ? 'badge-success' : a.status === 'paused' ? 'badge-warning' : 'badge-danger'}`}>{a.status}</span>
                <span className="text-muted">{a.scheduledDays.split(',').length} days/wk · {a.scheduledStart}–{a.scheduledEnd}</span>
              </div>
              {a.phoneNumber && <div className="text-sm mb-1">📞 {fmtPhone(a.phoneNumber)}</div>}
              {a.twilioSid && <div className="text-xs text-muted mb-2">Twilio: {a.twilioSid.slice(0, 12)}…</div>}
              {a.systemPrompt && <div className="text-xs text-muted mb-2 max-w-sm">{a.systemPrompt.slice(0, 100)}{a.systemPrompt.length > 100 ? '…' : ''}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Configure</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDelId(a.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      {list.length === 0 && (
        <div className="empty-state card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 14a4 4 0 110-8 4 4 0 010 8z"/><path d="M8 12h8M12 8v8"/></svg>
          <p>No voice agents yet. Create one to start taking inbound calls automatically.</p>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Configure Agent' : 'New Voice Agent'} footer={<button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>}>
        <div className="form-group">
          <label className="form-label">Agent Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="RealtyBot Pro" />
        </div>
        <div className="form-group">
          <label className="form-label">Linked Business *</label>
          <select value={form.businessId} onChange={(e) => setForm({ ...form, businessId: e.target.value })}>
            <option value="">— Select a business —</option>
            {biz.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="form-hint">The business this agent represents</div>
        </div>
        <div className="form-group">
          <label className="form-label">Voice Style</label>
          <select value={form.voice} onChange={(e) => setForm({ ...form, voice: e.target.value })}>
            <option value="alice">Alice — Warm, professional (female)</option>
            <option value="james">James — Confident, authoritative (male)</option>
            <option value="sarah">Sarah — Friendly, conversational (female)</option>
            <option value="daniel">Daniel — Calm, reassuring (male)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Phone Number (Twilio)</label>
          <input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+15551234567" />
          <div className="form-hint">Twilio phone number that receives inbound calls</div>
        </div>
        <div className="form-group">
          <label className="form-label">Twilio Account SID</label>
          <input value={form.twilioSid} onChange={(e) => setForm({ ...form, twilioSid: e.target.value })} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          <div className="form-hint">Your Twilio Account SID (optional — simulation mode works without)</div>
        </div>
        <div className="form-group">
          <label className="form-label">Twilio Auth Token</label>
          <input value={form.twilioAuthToken} onChange={(e) => setForm({ ...form, twilioAuthToken: e.target.value })} placeholder="your_auth_token" type="password" />
        </div>
        <div className="form-group">
          <label className="form-label">System Prompt (AI personality)</label>
          <textarea rows={4} value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} placeholder="You are a professional real estate agent assistant. Be warm, helpful, and concise. Always confirm appointments clearly." />
          <div className="form-hint">Instructions that shape how the AI agent talks and behaves</div>
        </div>
        <div className="form-group">
          <label className="form-label">Schedule (days)</label>
          <input value={form.scheduledDays} onChange={(e) => setForm({ ...form, scheduledDays: e.target.value })} placeholder="mon,tue,wed,thu,fri" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Start time</label>
            <input type="time" value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">End time</label>
            <input type="time" value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Timezone</label>
          <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            <option value="America/Chicago">America/Chicago (Central)</option>
            <option value="America/New_York">America/New_York (Eastern)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
            <option value="America/Denver">America/Denver (Mountain)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} title="Delete Agent" message="This will permanently delete the voice agent and its call history. This cannot be undone." />
    </div>
  );
}

// ── Appointments ───────────────────────────────────────────────────────
function Appointments() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ businessId: '', type: 'showing', customerName: '', customerPhone: '', date: '', time: '', duration: '30', notes: '', address: '', status: 'scheduled' });
  const [delId, setDelId] = useState(null);

  const load = (p = {}) => getAppointments(p).then((d) => setList(d.appointments || []));
  const loadBiz = () => getBusinesses().then((d) => setBiz(d.businesses || []));
  const [biz, setBiz] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadBiz(); }, []);
  useEffect(() => { load({ status: filter === 'all' ? undefined : filter }); }, [filter]);

  const reset = () => { setForm({ businessId: '', type: 'showing', customerName: '', customerPhone: '', date: '', time: '', duration: '30', notes: '', address: '', status: 'scheduled' }); setEditing(null); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (a) => {
    setForm({
      businessId: a.businessId, type: a.type, customerName: a.customerName, customerPhone: a.customerPhone,
      date: a.date ? a.date.split('T')[0] : '', time: a.time ? a.time.split('T')[1]?.slice(0, 5) : '',
      duration: String(a.duration || 30), notes: a.notes || '', address: a.address || '', status: a.status,
    });
    setEditing(a.id);
    setOpen(true);
  };

  const save = async () => {
    try {
      const fd = new Date(form.date + 'T' + form.time);
      if (isNaN(fd)) throw new Error('Invalid date/time');
      if (editing) {
        await updateAppointment(editing, { ...form, date: fd.toISOString(), time: fd.toISOString() });
        toast('Appointment updated');
      } else {
        await createAppointment({ ...form, date: fd.toISOString(), time: fd.toISOString() });
        toast('Appointment created');
      }
      setOpen(false);
      load({ status: filter === 'all' ? undefined : filter });
    } catch (e) { toast(e.message); }
  };

  const remove = async () => {
    try {
      await deleteAppointment(delId);
      toast('Appointment deleted');
      setDelId(null);
      load({ status: filter === 'all' ? undefined : filter });
    } catch (e) { toast(e.message); }
  };

  const bizName = (id) => biz.find((b) => b.id === id)?.name || '—';
  const typeLabel = (t) => ({ showing: 'Home Showing', consultation: 'Consultation', followup: 'Follow-up', other: 'Other' }[t] || t);
  const daysUntil = (d) => {
    if (!d) return '';
    const diff = Math.ceil((new Date(d) - new Date()) / 86400000);
    if (diff < 0) return 'Past';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff}d away`;
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Appointments</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Book Appointment</button>
      </div>
      <p className="text-muted text-sm mb-4">Appointments booked by AI agents and your team</p>

      <div className="flex-between mb-4" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'scheduled', 'completed', 'missed', 'cancelled'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              background: filter === f ? '#6366f1' : 'transparent', color: filter === f ? '#fff' : 'var(--muted)',
              border: `1px solid ${filter === f ? '#6366f1' : 'var(--border)'}`,
            }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">{list.length} appointments</span>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Type</th>
              <th>Customer</th>
              <th>Business</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div>{fmtDate(a.date)}</div>
                  <div className="text-xs text-muted">{a.time ? new Date(a.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''} · {a.duration}min</div>
                  {a.address && <div className="text-xs text-muted truncate" style={{ maxWidth: 160 }}>{a.address}</div>}
                </td>
                <td>{typeLabel(a.type)}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{a.customerName || '—'}</div>
                  {a.customerPhone && <div className="text-xs text-muted">{fmtPhone(a.customerPhone)}</div>}
                </td>
                <td className="truncate max-w-sm">{bizName(a.businessId)}</td>
                <td><span className={`badge ${statusClass(a.status)}`}>{a.status}</span></td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDelId(a.id)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <div className="empty-state" style={{ padding: 30 }}>
            <p>No appointments found.</p>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Appointment' : 'Book Appointment'} footer={<button className="btn btn-primary" onClick={save}>Save</button>}>
        <div className="form-group">
          <label className="form-label">Business</label>
          <select value={form.businessId} onChange={(e) => setForm({ ...form, businessId: e.target.value })}>
            <option value="">— Select —</option>
            {biz.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Appointment Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="showing">Home Showing</option>
            <option value="consultation">Consultation</option>
            <option value="followup">Follow-up</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Customer Name *</label>
          <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Jane Smith" />
        </div>
        <div className="form-group">
          <label className="form-label">Customer Phone *</label>
          <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="+15551234567" />
        </div>
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} min={new Date().toISOString().split('T')[0]} />
        </div>
        <div className="form-group">
          <label className="form-label">Time *</label>
          <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Duration (min)</label>
            <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} min={15} max={180} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Property Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="456 Oak Ave, City" />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any special instructions" />
        </div>
      </Modal>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={remove} title="Delete Appointment" message="Delete this appointment? This cannot be undone." />
    </div>
  );
}

// ── Call Logs ──────────────────────────────────────────────────────────
function CallLogs() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const load = (p = {}) => getCallLogs({ ...p, limit: perPage, offset: (page - 1) * perPage }).then((d) => { setList(d.calls || []); setTotal(d.total || 0); });
  const [total, setTotal] = useState(0);

  useEffect(() => { load({ status: filter === 'all' ? undefined : filter }); }, [filter, page]);

  const statusClass = (s) => {
    const m = { completed: 'badge-success', missed: 'badge-danger', busy: 'badge-warning', no_answer: 'badge-warning', cancelled: 'badge-warning', scheduled: 'badge-info' };
    return m[s] || 'badge-info';
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Call Logs</h1>
        <span className="text-sm text-muted">{total} total calls</span>
      </div>
      <p className="text-muted text-sm mb-4">Inbound and outbound call history from your AI voice agents</p>

      <div className="flex-between mb-4" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'completed', 'missed', 'busy', 'no_answer', 'cancelled'].map((f) => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
              background: filter === f ? '#6366f1' : 'transparent', color: filter === f ? '#fff' : 'var(--muted)',
              border: `1px solid ${filter === f ? '#6366f1' : 'var(--border)'}`,
            }}>
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Agent</th>
              <th>Caller</th>
              <th>Business</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtDateTime(c.timestamp)}</td>
                <td>{c.agentName || '—'}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.callerNumber ? fmtPhone(c.callerNumber) : '—'}</div>
                  {c.callerName && <div className="text-xs text-muted">{c.callerName}</div>}
                </td>
                <td className="truncate max-w-sm">{c.businessName || '—'}</td>
                <td>{c.duration ? `${Math.round(c.duration / 60)}m ${c.duration % 60}s` : '—'}</td>
                <td><span className={`badge ${statusClass(c.status)}`}>{c.status?.replace('_', ' ')}</span></td>
                <td className="text-xs text-muted max-w-sm truncate">{c.outcome || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <div className="empty-state" style={{ padding: 30 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            <p>No calls recorded yet. Calls appear here when an agent handles an inbound call.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > perPage && (
        <div className="flex-between mt-4">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button>
          <span className="text-sm text-muted">Page {page} of {Math.ceil(total / perPage)}</span>
          <button className="btn btn-ghost btn-sm" disabled={page * perPage >= total} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
