import fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from './routes/index.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  registerRoutes(app);

  return app;
}
