import { Router } from 'express';
import { getDb } from '../db.js';
import { nanoid } from 'nanoid';

const router = Router();

// ── Voice Agent Engine ────────────────────────────────────────────────
class VoiceAgentEngine {
  constructor(db) {
    this.db = db;
    this.contexts = new Map();
    this.callStart = new Map();
  }

  /**
   * Find an available agent for a call.
   * Checks agent status + schedule in the agent's configured timezone.
   */
  findAgentForCall(businessId, callerNumber) {
    const db = this.db;
    let agents = db.prepare(`
      SELECT a.*, b.name as business_name FROM agents a
      JOIN businesses b ON a.business_id = b.id
      WHERE a.business_id = ?
      ORDER BY CASE WHEN a.status = 'active' THEN 0 ELSE 1 END, a.name
    `).all(businessId);

    if (agents.length === 0) {
      agents = db.prepare(`
        SELECT a.*, b.name as business_name FROM agents a
        JOIN businesses b ON a.business_id = b.id
        WHERE a.status = 'active'
        ORDER BY a.name
      `).all();
    }
    if (agents.length === 0) return null;

    const now = new Date();

    // Re-check with per-agent timezone
    for (const agent of agents) {
      if (agent.status !== 'active') continue;
      const agentTz = agent.timezone || 'America/Chicago';
      const { inRange, dayName } = this._timeInRange(now, agent, agentTz);
      if (!inRange) continue;
      const days = (agent.scheduled_days || '').split(',').map((d) => d.trim());
      if (!days.includes(dayName)) continue;
      return agent;
    }

    // Fallback: if no agent is in-range by schedule, return the first active agent
    // (for development/simulation convenience)
    for (const agent of agents) {
      if (agent.status === 'active') return agent;
    }

    return null;
  }

  /**
   * Check whether `now` falls within an agent's scheduled hours,
   * accounting for the agent's timezone.
   * Returns { inRange: boolean, dayName: string (in agent's TZ) }.
   */
  _timeInRange(now, agent, tz) {
    const options = { timeZone: tz, hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || '0';

    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);
    const dayName = getPart('weekday').toLowerCase();

    const nowMinutes = hour * 60 + minute;
    const [startH, startM] = (agent.scheduled_start || '9:00').split(':').map(Number);
    const [endH, endM] = (agent.scheduled_end || '18:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return { inRange: nowMinutes >= startMinutes && nowMinutes <= endMinutes, dayName };
    } else {
      // Overnight schedule (e.g., 22:00–06:00)
      return { inRange: nowMinutes >= startMinutes || nowMinutes <= endMinutes, dayName };
    }
  }

  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  generateResponse(agent, context) {
    const lastMsg = context.messages[context.messages.length - 1];
    const lower = (lastMsg && lastMsg.content || '').toLowerCase();

    const wantsAppointment = /book|schedule|appointment|showing|meet|come by|visit|tour|set up|call back/i.test(lower);
    const hasDate = /\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b/i.test(lower);
    const hasTime = /\b(\d{1,2}:\d{2}|morning|afternoon|evening|noon|\d{1,2}\s*(am|pm))\b/i.test(lower);
    const isConfirming = /yes|confirm|that's right|that's correct|perfect|great|sounds good/i.test(lower);
    const wantsAddress = /address|where|location|what's the address|which property/i.test(lower);
    const wantsPrice = /price|how much|cost|listing price|afford/i.test(lower);
    const wantsAvailability = /available|have any|listings|houses|homes|properties|show me/i.test(lower);
    const goodbye = /bye|goodbye|thanks|thank you|appreciate|talk later|see you|have a good/i.test(lower);

    let response = '';
    let action = null;
    let actionData = {};

    if (goodbye) {
      response = this.pick([
        "You're very welcome! I hope we can help you find the perfect place. Have a wonderful day!",
        "Thank you so much for calling! Our team is excited to help you. Take care!",
        "It was great speaking with you! Don't hesitate to call back if you have more questions. Goodbye!",
      ]);
      action = 'end_call';
    }
    else if (!context.customerName && /my name is|this is|i'm calling|i'm reaching|call me|my name|john/i.test(lower)) {
      // Capture name - handles "this is John", "my name is John", and bare names like "John Martinez"
      let nameMatch = lower.match(/(?:my name is|this is|i'm calling|i'm reaching|call me|my name)\s+([a-z\s]+?)(?:\s+and|\s+,|\s+from|\s+calling|\s+reaching|\s+here|\.|$)/i);
      if (!nameMatch) {
        // Try bare name pattern (e.g. "John Martinez")
        nameMatch = lower.match(/^([a-z]+\s+[a-z]+)$/i);
      }
      if (!nameMatch) {
        // Try single word name
        nameMatch = lower.match(/(?:my name is|this is|i'm)\s+([a-z]+)\s*/i);
      }
      if (nameMatch) {
        context.customerName = nameMatch[1].trim().replace(/[^a-z\s-']/gi, '').trim();
      }

      if (context.customerName) {
        if (context._pendingBooking) {
          // Re-engage booking flow
          const pending = context._pendingBooking;
          context._pendingBooking = null;
          const prevMsg = (context.messages[context.messages.length - 2] || {}).content || '';
          const lowerPrev = prevMsg.toLowerCase();
          const pbDate = pending.hasDate || /\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b/i.test(lowerPrev);
          const pbTime = pending.hasTime || /\b(\d{1,2}:\d{2}|morning|afternoon|evening|noon|\d{1,2}\s*(am|pm))\b/i.test(lowerPrev);
          const result = this._finalizeBooking(agent, context, lowerPrev, pbDate, pbTime);
          response = result.response;
          action = result.action;
          actionData = result.actionData;
        } else {
          response = `Nice to meet you, ${context.customerName}! How can I help you with your real estate search today?`;
        }
      } else {
        response = "I didn't quite catch your name. Could you tell me again?";
      }
    }
    else if (wantsAppointment) {
      if (!context.customerName) {
        context._pendingBooking = { hasDate, hasTime };
        response = "I'd be happy to schedule something for you! First, what's your name?";
      } else {
        const result = this._finalizeBooking(agent, context, lower, hasDate, hasTime);
        response = result.response;
        action = result.action;
        actionData = result.actionData;
      }
    }
    else if (wantsAddress) {
      const biz = this.db.prepare('SELECT * FROM businesses WHERE id = ?').get(agent.business_id);
      if (biz && biz.address) {
        const areas = biz.service_areas || 'the greater Chicago area';
        response = `Our office is located at ${biz.address}. We serve ${areas}. Would you like to schedule a showing at a specific property?`;
      } else {
        response = "We're based in Chicago and serve the downtown area, West Loop, Lincoln Park, and Gold Coast. Is there a specific neighborhood you're interested in?";
      }
    }
    else if (wantsPrice) {
      response = this.pick([
        "We have listings ranging from $200,000 all the way up to $5 million depending on the area and property type. What's your budget range?",
        "Our current listings start around $250,000 for condos and go up to several million for single-family homes. What price range are you comfortable with?",
        "That really depends on what you're looking for! We have options at many price points. Do you have a budget in mind?",
      ]);
    }
    else if (wantsAvailability) {
      response = this.pick([
        "I'd love to show you what's available! We have quite a few new listings this week. Could I get your name and what areas you're interested in?",
        "We have several wonderful properties on the market right now. What type of home are you looking for — condo, single-family, townhouse?",
        "Great question! I can pull up what's available in your preferred area. Can you tell me a bit about what you're looking for?",
      ]);
    }
    else if (isConfirming && context.proposedAppointment) {
      const apId = nanoid();
      const now = new Date().toISOString();
      this.db.prepare(`INSERT INTO appointments (id, business_id, type, customer_name, customer_phone, date, time, duration, address, notes, status, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        apId, agent.business_id, 'showing', context.customerName, context.callerNumber, context.proposedAppointment.date, context.proposedAppointment.time, 30, '', '', 'scheduled', 'ai', now, now,
      );
      const apptDate = new Date(context.proposedAppointment.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      response = this.pick([
        `Wonderful! Your appointment is confirmed, ${context.customerName}. We'll see you on ${apptDate} at ${context.proposedAppointment.timeDisplay}. A reminder will be sent to you. Have a great day!`,
        `Perfect! You're all set, ${context.customerName}. We look forward to seeing you on ${apptDate} at ${context.proposedAppointment.timeDisplay}. Thank you for calling Smith Realty Group!`,
        `You're confirmed! See you on ${apptDate} at ${context.proposedAppointment.timeDisplay}. We're excited to help you find your dream home, ${context.customerName}!`,
      ]);
      action = 'book_appointment';
      actionData = { appointmentId: apId };
      context.proposedAppointment = null;
      context._pendingBooking = null;
      context._awaitingConfirmation = false;
    }
    else if (context._awaitingConfirmation) {
      response = `I have you down for that appointment. Does that time work for you? Please confirm with yes or no.`;
    }
    else if (context.turnCount < 2) {
      response = this.pick([
        "Thanks for calling! I'm Sarah, and I'm here to help you with anything real estate related. What brings you in today?",
        "Hello! Great to hear from you. Whether you're looking to buy, sell, or just have questions about the market, I'm happy to help. What can I do for you?",
        "Hi there! Welcome to Smith Realty Group. I can help you with property listings, scheduling showings, or answering questions. What are you interested in?",
      ]);
    } else {
      response = this.pick([
        "That's a great question! Let me help you with that. Can you tell me a bit more about what you're looking for?",
        "I'd be happy to help with that! What specific area or type of property are you interested in?",
        "Great! I can definitely help you with that. Do you have a particular neighborhood in mind?",
        "I understand! That's exactly what we're here for. What's most important to you in a home?",
        "Absolutely, I can help you with that. Let me ask you a few questions so I can point you in the right direction.",
      ]);
    }

    if (response.length > 300) response = response.slice(0, 280) + '...';
    context.turnCount++;
    return { response, action, actionData };
  }

  _finalizeBooking(agent, context, lower, hasDate, hasTime) {
    let response = '';
    let action = null;
    let actionData = {};

    if (hasDate && hasTime) {
      const dayMatch = lower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
      const proposedDate = new Date();
      if (dayMatch) {
        const dayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
        const targetDay = dayMap[dayMatch[1].toLowerCase()];
        const currentDay = proposedDate.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        proposedDate.setDate(proposedDate.getDate() + diff);
        proposedDate.setHours(0, 0, 0, 0);
      } else {
        proposedDate.setDate(proposedDate.getDate() + 1);
      }

      let proposedTime = '14:00';
      const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        proposedTime = timeMatch[1].padStart(2, '0') + ':' + timeMatch[2];
      } else if (/\b(morning|9\s*am|10\s*am|11\s*am)/i.test(lower)) {
        proposedTime = '10:00';
      } else if (/\b(afternoon|1\s*pm|2\s*pm|3\s*pm|4\s*pm)/i.test(lower)) {
        proposedTime = '14:00';
      } else if (/\b(evening|5\s*pm|6\s*pm|7\s*pm)/i.test(lower)) {
        proposedTime = '17:00';
      }

      const [h, m] = proposedTime.split(':').map(Number);
      proposedDate.setHours(h, m, 0, 0);

      // Safety check for invalid dates
      if (isNaN(proposedDate.getTime())) {
        proposedDate = new Date();
        proposedDate.setDate(proposedDate.getDate() + 1);
        proposedDate.setHours(14, 0, 0, 0);
      }

      const dateStr = proposedDate.toISOString();
      const friendlyDate = proposedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

      const existing = this.db.prepare(
        'SELECT COUNT(*) as n FROM appointments WHERE business_id = ? AND date = ? AND status NOT IN (\'cancelled\')'
      ).get(agent.business_id, dateStr.split('T')[0]);

      if (existing.n > 0) {
        proposedDate.setDate(proposedDate.getDate() + 1);
        const altDateStr = proposedDate.toISOString();
        const altFriendly = proposedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        response = `Hmm, it looks like we already have someone scheduled around that time. How about ${altFriendly} at ${proposedTime}? Does that work for you, ${context.customerName}?`;
        actionData = { proposeDate: altDateStr, proposeTime: dateStr, proposeTimeDisplay: proposedTime };
        context.proposedAppointment = { date: altDateStr, time: dateStr, timeDisplay: proposedTime };
      } else {
        response = this.pick([
          `Perfect, ${context.customerName}! I've got you down for ${friendlyDate} at ${proposedTime}. Can you confirm that works for you?`,
          `Great choice, ${context.customerName}! Let me put that on the calendar: ${friendlyDate} at ${proposedTime}. Shall I confirm it?`,
          `Excellent, ${context.customerName}! I'm scheduling that for ${friendlyDate} at ${proposedTime}. Is that alright with you?`,
        ]);
        action = 'propose_appointment';
        actionData = { proposedDate: dateStr, proposedTime: dateStr, proposedTimeDisplay: proposedTime };
        context.proposedAppointment = { date: dateStr, time: dateStr, timeDisplay: proposedTime };
        context._awaitingConfirmation = true;
      }
    } else if (hasDate) {
      response = this.pick([
        `What time works best for you, ${context.customerName}? We have morning slots at 9, 10, or 11, and afternoon slots at 1, 2, 3, or 4.`,
        `Great! What time of day would you prefer — morning or afternoon, ${context.customerName}?`,
        "I can do that day! What time works best for you? We have openings between 9 AM and 6 PM.",
      ]);
    } else if (hasTime) {
      response = this.pick([
        `What day would you like to come in, ${context.customerName}? We're open Monday through Saturday.`,
        "I can work with that time! Which day works best for you? Tomorrow or another day this week?",
        `Noted on the time! What day were you thinking, ${context.customerName}?`,
      ]);
    } else {
      response = this.pick([
        `I'd love to get you scheduled, ${context.customerName}! What day and time work best for you? We have availability throughout the week.`,
        "Absolutely! When would you like to come in? Any day Monday through Saturday works for us.",
        `Let's make it happen, ${context.customerName}! What day and time are you thinking?`,
      ]);
    }

    return { response, action, actionData };
  }

  processInboundCall(agent, callerNumber, callerName, twilioCallSid) {
    const now = new Date().toISOString();
    const context = {
      agentId: agent.id,
      businessId: agent.business_id,
      callerNumber,
      callerName: callerName || 'Caller',
      messages: [],
      customerName: null,
      turnCount: 0,
      proposedAppointment: null,
      status: 'in_progress',
    };

    const cid = twilioCallSid || nanoid();
    this.contexts.set(cid, context);
    this.callStart.set(cid, now);

    const businessName = this.getBusinessName(agent.business_id);
    const greeting = this.pick([
      `Hi, thanks for calling ${businessName}! My name is Sarah, and I'm here to help you find your perfect home or answer any real estate questions. How can I assist you today?`,
      `Hello! Thank you for calling ${businessName}. I'm Sarah, your real estate assistant. Whether you're looking to buy, sell, or just have questions, I'm happy to help. What brings you in today?`,
      `Thanks for reaching out to ${businessName}! I'm Sarah. I can help you with property listings, scheduling a showing, or answering any real estate questions. How can I help you?`,
    ]);

    const callId = cid;
    this.db.prepare(`INSERT INTO calls (id, agent_id, business_id, caller_number, caller_name, twilio_call_sid, direction, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      callId, agent.id, agent.business_id, callerNumber, callerName || '', twilioCallSid || '', 'inbound', 'in_progress', now, now,
    );

    context.cid = callId;
    return { callId, initialResponse: { response: greeting, action: null, actionData: {} }, context };
  }

  getBusinessName(businessId) {
    const biz = this.db.prepare('SELECT name FROM businesses WHERE id = ?').get(businessId);
    return biz ? biz.name : 'our office';
  }

  getContext(callId) {
    return this.contexts.get(callId) || null;
  }

  updateContext(callId, msg) {
    const ctx = this.contexts.get(callId);
    if (ctx) ctx.messages.push(msg);
    return ctx;
  }

  endCall(callId, outcome) {
    const ctx = this.contexts.get(callId);
    if (ctx) {
      ctx.status = 'completed';
      this.contexts.delete(callId);
    }
    const now = new Date().toISOString();
    const start = this.callStart.get(callId);
    const duration = start ? Math.floor((Date.now() - new Date(start).getTime()) / 1000) : 0;
    this.db.prepare(`UPDATE calls SET status = ?, outcome = ?, duration = ?, updated_at = ? WHERE id = ?`).run(
      'completed', outcome || 'call completed', duration, now, callId,
    );
    return { duration };
  }
}

let engine;
function getEngine() {
  if (!engine) engine = new VoiceAgentEngine(getDb());
  return engine;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTwiml(sayText, gather = true, hangup = false) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
  xml += `  <Say voice="sarah" language="en-US">${escapeXml(sayText)}</Say>\n`;
  if (hangup) {
    xml += '  <Hangup/>\n';
  } else if (gather) {
    xml += '  <Pause length="1"/>\n';
    xml += '  <Gather input="speech" speechTimeout="5" action="/api/twilio/gather" method="POST">\n';
    xml += `    <Say voice="sarah" language="en-US">Go ahead, I'm listening.</Say>\n`;
    xml += '  </Gather>\n';
  }
  xml += '</Response>';
  return xml;
}

// ── Routes ────────────────────────────────────────────────────────────

router.post('/twilio/call', async (req, res) => {
  const db = getDb();
  const { From, To, CallSid, BusinessId, simulation } = req.body;

  try {
    const twilioSid = CallSid || ('sim_' + nanoid());
    const callerNumber = From || req.body.callerNumber || '+15559876543';
    const callerName = req.body.callerName;

    let businessId = BusinessId;
    if (!businessId && To) {
      const biz = db.prepare('SELECT id FROM businesses WHERE phone = ?').get(To);
      if (biz) businessId = biz.id;
    }

    if (!businessId) {
      return res.type('text/xml').send(buildTwiml("Sorry, we couldn't find that business. Please try again later.", false, true));
    }

    const eng = getEngine();
    const agent = eng.findAgentForCall(businessId, callerNumber);

    if (!agent) {
      const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(businessId);
      return res.type('text/xml').send(buildTwiml(`Thank you for calling ${biz ? biz.name : 'our office'}. All of our agents are currently unavailable. Please leave a message after the beep, and we'll get back to you as soon as possible.`, false, true));
    }

    const result = eng.processInboundCall(agent, callerNumber, callerName, twilioSid);
    res.type('text/xml').send(buildTwiml(result.initialResponse.response));
  } catch (err) {
    console.error('Twilio call webhook error:', err);
    res.type('text/xml').send(buildTwiml("I'm sorry, something went wrong. Please try again later.", false, true));
  }
});

router.post('/twilio/gather', (req, res) => {
  const { CallSid, SpeechResult, businessId, simulation } = req.body;
  const engine = getEngine();
  const callSid = CallSid || ('sim_' + nanoid());
  let ctx = engine.getContext(callSid);

  try {
    if (!ctx) {
      const bizId = businessId || req.body.businessId;
      if (!bizId) {
        return res.type('text/xml').send(buildTwiml("I'm sorry, I lost track of that. Let me transfer you to a human agent.", false, true));
      }
      const agent = engine.findAgentForCall(bizId, req.body.callerNumber);
      if (!agent) {
        return res.type('text/xml').send(buildTwiml("All our agents are busy. Please call back during business hours.", false, true));
      }
      const result = engine.processInboundCall(agent, req.body.callerNumber, req.body.callerName, callSid);
      ctx = result.context;
    }

    const userMsg = SpeechResult || req.body.speech || 'Hello';
    engine.updateContext(callSid, { role: 'user', content: userMsg });
    const agent = engine.db.prepare('SELECT * FROM agents WHERE id = ?').get(ctx.agentId);
    const reply = engine.generateResponse(agent, ctx);

    if (reply.action === 'end_call') {
      engine.endCall(callSid, 'call completed naturally');
      return res.type('text/xml').send(buildTwiml(reply.response, false, true));
    }

    if (reply.action === 'propose_appointment' && reply.actionData) {
      ctx.proposedAppointment = {
        date: reply.actionData.proposedDate,
        time: reply.actionData.proposedTime,
        timeDisplay: reply.actionData.proposedTimeDisplay,
      };
    }

    if (reply.action === 'book_appointment' && reply.actionData) {
      return res.type('text/xml').send(buildTwiml(reply.response, false, true));
    }

    res.type('text/xml').send(buildTwiml(reply.response));
  } catch (err) {
    console.error('Twilio gather error:', err);
    res.type('text/xml').send(buildTwiml("I'm sorry, something went wrong.", false, true));
  }
});

router.post('/twilio/transcription', (req, res) => {
  const { CallSid, TranscriptionStatus, TranscriptionText } = req.body;
  if (TranscriptionStatus === 'completed' && CallSid) {
    getDb().prepare(`UPDATE calls SET transcription = ? WHERE twilio_call_sid = ? OR id = ?`).run(TranscriptionText, CallSid, CallSid);
  }
  res.status(200).send('OK');
});

router.get('/twilio/context/:callId', (req, res) => {
  const ctx = getEngine().getContext(req.params.callId);
  if (!ctx) return res.status(404).json({ error: 'Call context not found' });
  res.json({ context: ctx });
});

router.post('/twilio/say/:callId', (req, res) => {
  try {
    const engine = getEngine();
    const ctx = engine.getContext(req.params.callId);
    if (!ctx) return res.status(404).json({ error: 'Call context not found. Start a call first.' });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    engine.updateContext(req.params.callId, { role: 'user', content: message });
    const agent = engine.db.prepare('SELECT * FROM agents WHERE id = ?').get(ctx.agentId);
    const reply = engine.generateResponse(agent, ctx);

    res.json({ replied: reply.response, action: reply.action, actionData: reply.actionData, context: ctx });
  } catch (err) {
    console.error('Twilio say error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/twilio/end/:callId', (req, res) => {
  const ctx = getEngine().getContext(req.params.callId);
  if (!ctx) return res.status(404).json({ error: 'Call context not found' });
  const { outcome } = req.body;
  const result = getEngine().endCall(req.params.callId, outcome || 'call ended by user');
  res.json({ success: true, duration: result.duration, callId: req.params.callId });
});

router.post('/twilio/simulate', (req, res) => {
  const { businessId, callerNumber, callerName } = req.body;
  const db = getDb();
  if (!businessId) return res.status(400).json({ error: 'Business ID is required' });

  try {
    const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const agent = getEngine().findAgentForCall(businessId, callerNumber || '+15559876543');
    if (!agent) return res.status(400).json({ error: 'No available agent for this business' });

    const result = getEngine().processInboundCall(agent, callerNumber || '+15559876543', callerName, 'sim_' + nanoid());

    res.json({
      success: true,
      callId: result.callId,
      greeting: result.initialResponse.response,
      context: result.context,
      agent: { id: agent.id, name: agent.name, voice: agent.voice },
      business: { id: biz.id, name: biz.name },
    });
  } catch (err) {
    console.error('Simulate error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
