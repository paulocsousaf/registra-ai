import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user.service.js';

// Mock do módulo de configuração para fornecer um salt fixo nos testes
vi.mock('../config/env.js', () => ({
  env: {
    APP_SECRET_SALT: 'test_salt_fixo',
  },
}));

// Funções mock do Prisma
function createMockPrisma() {
  return {
    usuario: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

describe('UserService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let service: UserService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new UserService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('findOrCreateByPhone — Cenários de Sucesso', () => {
    it('deve criar novo usuário quando telefone não existe (RN-04.2)', async () => {
      const fakeUser = {
        id: 'uuid-novo',
        telefone: '5586999998888',
        telefone_hash: expect.any(String),
        criado_em: new Date(),
        ultimo_acesso: new Date(),
      };

      mockPrisma.usuario.findUnique.mockResolvedValue(null);
      mockPrisma.usuario.create.mockResolvedValue(fakeUser);

      const result = await service.findOrCreateByPhone('5586999998888@s.whatsapp.net');

      expect(result.isNew).toBe(true);
      expect(result.user).toEqual(fakeUser);

      // Verifica que buscou pelo telefone normalizado (sem sufixo)
      expect(mockPrisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { telefone: '5586999998888' },
      });

      // Verifica que criou com telefone normalizado e hash SHA-256
      expect(mockPrisma.usuario.create).toHaveBeenCalledWith({
        data: {
          telefone: '5586999998888',
          telefone_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });
    });

    it('deve retornar usuário existente e atualizar ultimo_acesso (RN-04.2)', async () => {
      const existingUser = {
        id: 'uuid-existente',
        telefone: '5586999998888',
        telefone_hash: 'hash_existente',
        criado_em: new Date('2026-10-01'),
        ultimo_acesso: new Date('2026-10-01'),
      };

      const updatedUser = {
        ...existingUser,
        ultimo_acesso: new Date(),
      };

      mockPrisma.usuario.findUnique.mockResolvedValue(existingUser);
      mockPrisma.usuario.update.mockResolvedValue(updatedUser);

      const result = await service.findOrCreateByPhone('5586999998888');

      expect(result.isNew).toBe(false);
      expect(result.user).toEqual(updatedUser);

      // Verifica que NÃO tentou criar
      expect(mockPrisma.usuario.create).not.toHaveBeenCalled();

      // Verifica que atualizou o ultimo_acesso
      expect(mockPrisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'uuid-existente' },
        data: { ultimo_acesso: expect.any(Date) },
      });
    });

    it('deve normalizar telefone com sufixo WhatsApp antes de buscar (RN-04.1)', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(null);
      mockPrisma.usuario.create.mockResolvedValue({
        id: 'uuid-novo',
        telefone: '5586999998888',
        telefone_hash: 'hash',
        criado_em: new Date(),
        ultimo_acesso: new Date(),
      });

      await service.findOrCreateByPhone('5586999998888@s.whatsapp.net');

      expect(mockPrisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { telefone: '5586999998888' },
      });
    });

    it('deve normalizar telefone com +, espaços e hífens (RN-04.1)', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(null);
      mockPrisma.usuario.create.mockResolvedValue({
        id: 'uuid-novo',
        telefone: '5586999998888',
        telefone_hash: 'hash',
        criado_em: new Date(),
        ultimo_acesso: new Date(),
      });

      await service.findOrCreateByPhone('+55 86 99999-8888');

      expect(mockPrisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { telefone: '5586999998888' },
      });
    });
  });

  describe('findOrCreateByPhone — Cenários de Falha', () => {
    it('deve lançar erro para telefone vazio', async () => {
      await expect(service.findOrCreateByPhone('')).rejects.toThrow('obrigatório');
      expect(mockPrisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it('deve lançar erro para telefone curto demais', async () => {
      await expect(service.findOrCreateByPhone('999998888')).rejects.toThrow('entre 10 e 15');
      expect(mockPrisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it('deve lançar erro para telefone com letras', async () => {
      await expect(service.findOrCreateByPhone('5586abc998888')).rejects.toThrow(
        'caracteres inválidos'
      );
      expect(mockPrisma.usuario.findUnique).not.toHaveBeenCalled();
    });
  });
});
