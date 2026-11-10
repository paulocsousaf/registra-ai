import { z } from 'zod';

/**
 * Schema Zod para validação do payload mínimo do webhook da Evolution API.
 *
 * Garante que o corpo da requisição contenha os campos obrigatórios
 * para identificação do usuário e processamento da mensagem.
 */
export const webhookPayloadSchema = z.object({
  senderPhone: z
    .string({ required_error: 'Campo senderPhone é obrigatório' })
    .min(10, 'senderPhone deve ter pelo menos 10 caracteres')
    .max(30, 'senderPhone deve ter no máximo 30 caracteres'),
  text: z
    .string({ required_error: 'Campo text é obrigatório' })
    .min(3, 'text deve ter pelo menos 3 caracteres')
    .max(255, 'text deve ter no máximo 255 caracteres'),
  messageId: z
    .string({ required_error: 'Campo messageId é obrigatório' })
    .min(1, 'messageId não pode ser vazio'),
  timestamp: z
    .number({ required_error: 'Campo timestamp é obrigatório' })
    .int('timestamp deve ser um inteiro')
    .positive('timestamp deve ser positivo'),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
