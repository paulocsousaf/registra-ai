import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { webhookPayloadSchema } from '../schemas/webhook.schema.js';
import { userService } from '../services/user.service.js';
import { transactionService } from '../services/transaction.service.js';
import {
  formatTransactionConfirmation,
  parseTransactionMessage,
  TransactionParseError,
} from '../utils/parser.js';

const DEDUP_WINDOW_MS = 60_000;
const WELCOME_MESSAGE =
  '👋 Olá! Bem-vindo ao RegistraAI.\nSua conta foi criada automaticamente com base no seu número de WhatsApp.';

const processedMessagesByServer = new WeakMap<FastifyInstance, Map<string, number>>();

function getProcessedMessagesMap(server: FastifyInstance): Map<string, number> {
  let map = processedMessagesByServer.get(server);
  if (!map) {
    map = new Map<string, number>();
    processedMessagesByServer.set(server, map);
  }
  return map;
}

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

  const { senderPhone, text, messageId } = parsed.data;

  // RN-01.5: Idempotência e prevenção de duplo registro na janela de 60 segundos
  const now = Date.now();
  const dedupMap = getProcessedMessagesMap(request.server);
  const previousTimestamp = dedupMap.get(messageId);
  if (previousTimestamp !== undefined && now - previousTimestamp < DEDUP_WINDOW_MS) {
    return reply.status(200).send({
      received: true,
      duplicate: true,
    });
  }

  try {
    // RF-04: Identificação e provisionamento silencioso do usuário
    const { user, isNew } = await userService.findOrCreateByPhone(senderPhone);

    // Log mascarado conforme LGPD (sem número completo e sem conteúdo sensível)
    const cleanPhone = user.telefone || senderPhone.split('@')[0];
    const maskedPhone = `${cleanPhone.slice(0, 4)}*****${cleanPhone.slice(-4)}`;

    // Monta a resposta base
    const response: Record<string, unknown> = {
      received: true,
      userId: user.id,
      isNew,
    };

    // RN-04.3: Flag de boas-vindas para primeiro contato
    if (isNew) {
      response.welcomeMessage = WELCOME_MESSAGE;
    }

    // RF-01: Parsing do texto e persistência da transação
    try {
      const parsedTx = parseTransactionMessage(text);

      const transaction = await transactionService.create({
        usuarioId: user.id,
        tipo: parsedTx.tipo,
        valor: parsedTx.valor,
        descricao: parsedTx.descricao,
        categoria: parsedTx.categoria,
      });

      dedupMap.set(messageId, now);

      response.registered = true;
      response.transaction = transaction;
      response.message = formatTransactionConfirmation(parsedTx);

      request.log.info(
        { userId: user.id, isNew, maskedPhone, messageId, registered: true },
        `Transação processada para o usuário ${maskedPhone}`
      );

      return reply.status(200).send(response);
    } catch (parseErr) {
      if (parseErr instanceof TransactionParseError) {
        dedupMap.set(messageId, now);

        response.registered = false;
        response.message = parseErr.userMessage;

        request.log.info(
          { userId: user.id, isNew, maskedPhone, messageId, registered: false, code: parseErr.code },
          `Mensagem sem transação válida para o usuário ${maskedPhone}`
        );

        return reply.status(200).send(response);
      }

      throw parseErr;
    }
  } catch (err) {
    request.log.error(
      { err, messageId },
      'Erro ao processar mensagem no webhook'
    );

    return reply.status(500).send({
      error: 'Erro interno ao processar a mensagem',
    });
  }
}
