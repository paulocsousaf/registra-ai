import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

export async function webhookAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Verificação base de token de webhook (a ser refinada na integração com o gateway)
  if (!env.WHATSAPP_API_TOKEN) {
    return;
  }

  const token = request.headers['x-api-key'] || request.headers['authorization'];

  if (!token) {
    return reply.status(401).send({ error: 'Token de autenticação não fornecido' });
  }
}
