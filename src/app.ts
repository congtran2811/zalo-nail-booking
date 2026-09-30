import express from 'express';
import mainRoutes from './routes/index.js';

const app = express();

app.use(express.json());

// Endpoint: Ping to avoid Render spindown
app.get('/ping', (_req, res) => {
  res.status(200).send('PONG');
});

// Load API routes
app.use('/api', mainRoutes);

export default app;
