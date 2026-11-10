import { PrismaClient, Usuario } from '@prisma/client';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { normalizePhone, hashPhone } from '../utils/phone.js';

export interface IUserService {
  findOrCreateByPhone(rawPhone: string): Promise<{ user: Usuario; isNew: boolean }>;
}

export class UserService implements IUserService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || defaultPrisma;
  }

  /**
   * Identifica ou provisiona silenciosamente um usuário pelo número de telefone.
   *
   * RN-04.1: Normaliza o telefone para formato E.164 (apenas dígitos).
   * RN-04.2: Cria o usuário automaticamente se não existir (just-in-time).
   * RN-04.3: Retorna isNew=true para o primeiro contato (mensagem de boas-vindas).
   * RN-04.4: Armazena apenas telefone normalizado e hash SHA-256 (LGPD).
   *
   * @param rawPhone - Identificador bruto do gateway WhatsApp
   * @returns Objeto com o usuário e flag indicando se é novo
   */
  async findOrCreateByPhone(rawPhone: string): Promise<{ user: Usuario; isNew: boolean }> {
    const phone = normalizePhone(rawPhone);

    // Busca usuário existente pelo telefone normalizado
    const existingUser = await this.prisma.usuario.findUnique({
      where: { telefone: phone },
    });

    if (existingUser) {
      // Atualiza último acesso sem bloquear o fluxo
      const updatedUser = await this.prisma.usuario.update({
        where: { id: existingUser.id },
        data: { ultimo_acesso: new Date() },
      });

      return { user: updatedUser, isNew: false };
    }

    // Provisionamento silencioso: cria novo usuário
    const telefoneHash = hashPhone(phone, env.APP_SECRET_SALT);

    const newUser = await this.prisma.usuario.create({
      data: {
        telefone: phone,
        telefone_hash: telefoneHash,
      },
    });

    return { user: newUser, isNew: true };
  }
}

export const userService = new UserService();
