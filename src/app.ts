import express from 'express';
import mainRoutes from './routes/index.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Endpoint: Ping to avoid Render spindown
app.get('/ping', (_req, res) => {
  res.status(200).send('PONG');
});

// Load API routes
app.use('/api', mainRoutes);

export default app;
