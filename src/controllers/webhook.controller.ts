import { FastifyReply, FastifyRequest } from 'fastify';

export async function webhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Ponto de entrada estrutural para os eventos da Evolution API / Gateway WhatsApp
  return reply.status(200).send({ received: true });
}
