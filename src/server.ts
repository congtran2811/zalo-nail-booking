import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { initSocket } from './socket/index.js';

dotenv.config();

const httpServer = createServer(app);

// Initialize WebSockets
initSocket(httpServer);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
