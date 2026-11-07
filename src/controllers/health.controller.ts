import { FastifyReply, FastifyRequest } from 'fastify';

export async function healthCheckHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return reply.status(200).send({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
