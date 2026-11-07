import { FastifyInstance } from 'fastify';
import { healthCheckHandler } from '../controllers/health.controller.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', healthCheckHandler);
}
