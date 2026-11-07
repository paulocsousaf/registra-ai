import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes.js';
import { webhookRoutes } from './webhook.routes.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(webhookRoutes);
}
