import { FastifyInstance } from 'fastify';
import { webhookHandler } from '../controllers/webhook.controller.js';
import { webhookAuthMiddleware } from '../middlewares/webhook-auth.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/webhook',
    {
      preHandler: webhookAuthMiddleware,
    },
    webhookHandler
  );
}
