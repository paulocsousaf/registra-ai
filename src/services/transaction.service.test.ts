import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionService } from './transaction.service.js';

function createMockPrisma() {
  return {
    transacao: {
      create: vi.fn(),
    },
  } as any;
}

describe('TransactionService — RF-01', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let service: TransactionService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new TransactionService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('create — Cenários de Sucesso', () => {
    it('deve persistir uma DESPESA válida vinculada ao usuario_id', async () => {
      const fakeTx = {
        id: 'tx-uuid-1',
        usuario_id: 'user-uuid-1',
        tipo: 'DESPESA',
        valor: 35,
        descricao: 'almoço',
        categoria: 'Alimentação',
        data_transacao: new Date(),
        deletado_em: null,
      };

      mockPrisma.transacao.create.mockResolvedValue(fakeTx);

      const result = await service.create({
        usuarioId: 'user-uuid-1',
        tipo: 'DESPESA',
        valor: 35,
        descricao: 'almoço',
        categoria: 'Alimentação',
      });

      expect(result).toEqual(fakeTx);
      expect(mockPrisma.transacao.create).toHaveBeenCalledWith({
        data: {
          usuario_id: 'user-uuid-1',
          tipo: 'DESPESA',
          valor: 35,
          descricao: 'almoço',
          categoria: 'Alimentação',
        },
      });
    });

    it('deve persistir uma RECEITA válida vinculada ao usuario_id', async () => {
      const fakeTx = {
        id: 'tx-uuid-2',
        usuario_id: 'user-uuid-1',
        tipo: 'RECEITA',
        valor: 1500,
        descricao: 'salario',
        categoria: 'Renda',
        data_transacao: new Date(),
        deletado_em: null,
      };

      mockPrisma.transacao.create.mockResolvedValue(fakeTx);

      const result = await service.create({
        usuarioId: 'user-uuid-1',
        tipo: 'RECEITA',
        valor: 1500,
        descricao: '  salario  ',
        categoria: 'Renda',
      });

      expect(result).toEqual(fakeTx);
      expect(mockPrisma.transacao.create).toHaveBeenCalledWith({
        data: {
          usuario_id: 'user-uuid-1',
          tipo: 'RECEITA',
          valor: 1500,
          descricao: 'salario',
          categoria: 'Renda',
        },
      });
    });
  });

  describe('create — Cenários de Falha', () => {
    it('deve rejeitar quando usuarioId está vazio', async () => {
      await expect(
        service.create({
          usuarioId: '',
          tipo: 'DESPESA',
          valor: 35,
          descricao: 'almoço',
          categoria: 'Alimentação',
        })
      ).rejects.toThrow('usuarioId é obrigatório');
      expect(mockPrisma.transacao.create).not.toHaveBeenCalled();
    });

    it('deve rejeitar valor menor que R$ 0,01', async () => {
      await expect(
        service.create({
          usuarioId: 'user-uuid-1',
          tipo: 'DESPESA',
          valor: 0,
          descricao: 'almoço',
          categoria: 'Alimentação',
        })
      ).rejects.toThrow('entre R$ 0,01 e R$ 999.999,99');
      expect(mockPrisma.transacao.create).not.toHaveBeenCalled();
    });

    it('deve rejeitar valor maior que R$ 999.999,99', async () => {
      await expect(
        service.create({
          usuarioId: 'user-uuid-1',
          tipo: 'DESPESA',
          valor: 1000000,
          descricao: 'casa',
          categoria: 'Moradia',
        })
      ).rejects.toThrow('entre R$ 0,01 e R$ 999.999,99');
      expect(mockPrisma.transacao.create).not.toHaveBeenCalled();
    });

    it('deve rejeitar descrição vazia', async () => {
      await expect(
        service.create({
          usuarioId: 'user-uuid-1',
          tipo: 'DESPESA',
          valor: 35,
          descricao: '   ',
          categoria: 'Alimentação',
        })
      ).rejects.toThrow('Descrição da transação é obrigatória');
      expect(mockPrisma.transacao.create).not.toHaveBeenCalled();
    });
  });
});
