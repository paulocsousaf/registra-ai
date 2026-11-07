import { Usuario } from '@prisma/client';

export interface IUserService {
  findOrCreateByPhone(rawPhone: string): Promise<{ user: Usuario; isNew: boolean }>;
}

export class UserService implements IUserService {
  async findOrCreateByPhone(_rawPhone: string): Promise<{ user: Usuario; isNew: boolean }> {
    // Stub: Lógica de provisionamento silencioso e hash do telefone será implementada no RF-04
    throw new Error('Método não implementado.');
  }
}

export const userService = new UserService();
