import { Server, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { LockService } from '../services/lock.service.js';

let ioInstance: Server | null = null;

export const initSocket = (httpServer: HTTPServer) => {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('hold_slot', async (data: { slotKey: string }) => {
      const success = await LockService.acquireSlotHold(data.slotKey, socket.id);
      if (success) {
        io.emit('slot_held', { slotKey: data.slotKey, by: socket.id });
      } else {
        socket.emit('hold_failed', { slotKey: data.slotKey, message: 'Slot is currently being held' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = (): Server | null => {
  return ioInstance;
};
