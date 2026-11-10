import { FastifyReply, FastifyRequest } from 'fastify';
import { webhookPayloadSchema } from '../schemas/webhook.schema.js';
import { userService } from '../services/user.service.js';

export async function webhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Valida o payload do webhook com o schema Zod
  const parsed = webhookPayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    request.log.error(
      { errors: parsed.error.flatten().fieldErrors },
      'Payload de webhook inválido recebido'
    );

    return reply.status(400).send({
      error: 'Payload inválido',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { senderPhone, text, messageId, timestamp } = parsed.data;

  try {
    // RF-04: Identificação e provisionamento silencioso do usuário
    const { user, isNew } = await userService.findOrCreateByPhone(senderPhone);

    // Monta a resposta base
    const response: Record<string, unknown> = {
      received: true,
      userId: user.id,
      isNew,
    };

    // RN-04.3: Flag de boas-vindas para primeiro contato
    if (isNew) {
      response.welcomeMessage =
        '👋 Olá! Bem-vindo ao RegistraAI.\nSua conta foi criada automaticamente com base no seu número de WhatsApp.';
    }

    // Log mascarado conforme LGPD (sem número completo)
    const maskedPhone = `${senderPhone.slice(0, 4)}*****${senderPhone.slice(-4)}`;
    request.log.info(
      { userId: user.id, isNew, maskedPhone, messageId },
      `Webhook processado para usuário ${maskedPhone}`
    );

    return reply.status(200).send(response);
  } catch (err) {
    request.log.error(
      { err, messageId },
      'Erro ao processar identificação de usuário no webhook'
    );

    return reply.status(500).send({
      error: 'Erro interno ao processar a mensagem',
    });
  }
}
