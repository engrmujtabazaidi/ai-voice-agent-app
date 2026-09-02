const base = '/api';

async function request(path, options = {}) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Businesses
export const getBusinesses = () => request('/businesses');
export const getBusiness = (id) => request(`/businesses/${id}`);
export const createBusiness = (body) => request('/businesses', { method: 'POST', body: JSON.stringify(body) });
export const updateBusiness = (id, body) => request(`/businesses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteBusiness = (id) => request(`/businesses/${id}`, { method: 'DELETE' });

// Agents
export const getAgents = () => request('/agents');
export const getAgent = (id) => request(`/agents/${id}`);
export const createAgent = (body) => request('/agents', { method: 'POST', body: JSON.stringify(body) });
export const updateAgent = (id, body) => request(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteAgent = (id) => request(`/agents/${id}`, { method: 'DELETE' });
export const toggleAgent = (id) => request(`/agents/${id}/toggle`, { method: 'POST' });

// Appointments
export const getAppointments = (params) => {
  const qs = params ? new URLSearchParams(Object.entries(params).filter(([_, v]) => v != null && v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
  return request(`/appointments${qs ? '?' + qs : ''}`);
};
export const getAppointment = (id) => request(`/appointments/${id}`);
export const createAppointment = (body) => request('/appointments', { method: 'POST', body: JSON.stringify(body) });
export const updateAppointment = (id, body) => request(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteAppointment = (id) => request(`/appointments/${id}`, { method: 'DELETE' });

// Call logs
export const getCallLogs = (params) => {
  const qs = params ? new URLSearchParams(Object.entries(params).filter(([_, v]) => v != null && v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
  return request(`/calls${qs ? '?' + qs : ''}`);
};
export const getCall = (id) => request(`/calls/${id}`);

// Twilio webhook
export const twilioWebhook = (body) => request('/twilio/call', { method: 'POST', body: JSON.stringify(body) });
export const transcriptionWebhook = (body) => request('/twilio/transcription', { method: 'POST', body: JSON.stringify(body) });
