import { createHash } from 'node:crypto';

/**
 * Normaliza um identificador de telefone bruto do WhatsApp para o formato E.164 (apenas dígitos).
 *
 * Remove sufixos de mensageiro (@s.whatsapp.net), prefixo +, espaços, hífens e parênteses.
 * Valida que o resultado tenha entre 10 e 15 dígitos numéricos.
 *
 * @param raw - Identificador bruto do gateway (ex: "5586999998888@s.whatsapp.net")
 * @returns Telefone normalizado com apenas dígitos (ex: "5586999998888")
 * @throws Error se o resultado não tiver entre 10 e 15 dígitos
 */
export function normalizePhone(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Identificador de telefone é obrigatório.');
  }

  // Remove sufixo do WhatsApp
  let phone = raw.split('@')[0];

  // Remove +, espaços, hífens, parênteses e pontos
  phone = phone.replace(/[+\s\-().]/g, '');

  // Verifica se restaram apenas dígitos
  if (!/^\d+$/.test(phone)) {
    throw new Error(`Telefone contém caracteres inválidos após normalização: "${phone}"`);
  }

  // Valida comprimento E.164 (sem o +): entre 10 e 15 dígitos
  if (phone.length < 10 || phone.length > 15) {
    throw new Error(
      `Telefone normalizado deve ter entre 10 e 15 dígitos, recebeu ${phone.length}: "${phone}"`
    );
  }

  return phone;
}

/**
 * Gera hash SHA-256 do telefone concatenado com o salt da aplicação.
 * Usado para integridade e conformidade LGPD (mascaramento em logs/auditoria).
 *
 * @param phone - Telefone normalizado (apenas dígitos)
 * @param salt - Salt secreto da aplicação (APP_SECRET_SALT)
 * @returns String hexadecimal de 64 caracteres (SHA-256)
 */
export function hashPhone(phone: string, salt: string): string {
  return createHash('sha256').update(`${phone}:${salt}`).digest('hex');
}
