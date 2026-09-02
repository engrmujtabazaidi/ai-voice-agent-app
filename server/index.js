import express from 'express';
import cors from 'cors';
import { getDb, initDb, seedDemo } from './db.js';
import businessesRoutes from './routes/businesses.js';
import agentsRoutes from './routes/agents.js';
import appointmentsRoutes from './routes/appointments.js';
import callsRoutes from './routes/calls.js';
import twilioRoutes from './routes/twilio.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', businessesRoutes);
app.use('/api', agentsRoutes);
app.use('/api', appointmentsRoutes);
app.use('/api', callsRoutes);
app.use('/api', twilioRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use((err, _, res, __) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function main() {
  await initDb();
  await seedDemo();
  getDb();

  const server = app.listen(PORT, () => {
    console.log(`Voice Agent API server running on http://localhost:${PORT}`);
    console.log(`Frontend dev server: http://localhost:5173`);
    console.log('Twilio webhook: POST /api/twilio/call');
    console.log('Twilio transcription: POST /api/twilio/transcription');
  });

  const shutdown = () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
