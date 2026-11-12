import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionService } from './transaction.service.js';

function createMockPrisma() {
  return {
    transacao: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
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

  describe('undoLast — RF-03 (Cenários de Sucesso e Falha)', () => {
    it('Cenário de Sucesso: deve aplicar soft delete (deletado_em) quando a última transação ativa tem menos de 30 minutos', async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const activeTx = {
        id: 'tx-recente-1',
        usuario_id: 'user-uuid-1',
        tipo: 'DESPESA',
        valor: 350,
        descricao: 'almoço',
        categoria: 'Alimentação',
        data_transacao: twoMinutesAgo,
        deletado_em: null,
      };

      const softDeletedTx = {
        ...activeTx,
        deletado_em: new Date(),
      };

      mockPrisma.transacao.findFirst.mockResolvedValue(activeTx);
      mockPrisma.transacao.update.mockResolvedValue(softDeletedTx);

      const result = await service.undoLast('user-uuid-1');

      expect(mockPrisma.transacao.findFirst).toHaveBeenCalledWith({
        where: {
          usuario_id: 'user-uuid-1',
          deletado_em: null,
        },
        orderBy: {
          data_transacao: 'desc',
        },
      });

      expect(mockPrisma.transacao.update).toHaveBeenCalledWith({
        where: {
          id: 'tx-recente-1',
          usuario_id: 'user-uuid-1',
        },
        data: {
          deletado_em: expect.any(Date),
        },
      });

      expect(result).toEqual(softDeletedTx);
      expect(result?.deletado_em).not.toBeNull();
    });

    it('Cenário de Falha (Janela > 30 min): deve retornar null e NÃO alterar o banco quando a última transação tem 45 minutos (RN-03.2)', async () => {
      const fortyFiveMinutesAgo = new Date(Date.now() - 45 * 60 * 1000);
      const oldTx = {
        id: 'tx-antiga-1',
        usuario_id: 'user-uuid-1',
        tipo: 'DESPESA',
        valor: 35,
        descricao: 'almoço',
        categoria: 'Alimentação',
        data_transacao: fortyFiveMinutesAgo,
        deletado_em: null,
      };

      mockPrisma.transacao.findFirst.mockResolvedValue(oldTx);

      const result = await service.undoLast('user-uuid-1');

      expect(result).toBeNull();
      expect(mockPrisma.transacao.update).not.toHaveBeenCalled();
    });

    it('Cenário de Falha (Sem transações ativas): deve retornar null quando o usuário não possui lançamentos ativos', async () => {
      mockPrisma.transacao.findFirst.mockResolvedValue(null);

      const result = await service.undoLast('user-uuid-1');

      expect(result).toBeNull();
      expect(mockPrisma.transacao.update).not.toHaveBeenCalled();
    });

    it('Cenário de Falha (Validação): deve rejeitar quando usuarioId está vazio', async () => {
      await expect(service.undoLast('')).rejects.toThrow('usuarioId é obrigatório');
      expect(mockPrisma.transacao.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('getMonthSummary — RF-02', () => {
    const referenceDate = new Date('2026-10-15T15:00:00Z');

    it('Cenário de Sucesso: deve consolidar receitas, despesas e saldo líquido com precisão (BDD RF-02)', async () => {
      const fakeTransactions = [
        { tipo: 'RECEITA', valor: 2000 },
        { tipo: 'RECEITA', valor: 500 },
        { tipo: 'DESPESA', valor: 1000 },
        { tipo: 'DESPESA', valor: 340.5 },
      ];

      mockPrisma.transacao.findMany.mockResolvedValue(fakeTransactions);

      const summary = await service.getMonthSummary('user-uuid-1', referenceDate);

      expect(mockPrisma.transacao.findMany).toHaveBeenCalledWith({
        where: {
          usuario_id: 'user-uuid-1',
          deletado_em: null,
          data_transacao: {
            gte: new Date('2026-10-01T00:00:00.000-03:00'),
            lt: new Date('2026-11-01T00:00:00.000-03:00'),
          },
        },
        select: {
          tipo: true,
          valor: true,
        },
      });

      expect(summary).toEqual({
        mesReferencia: 'Outubro/2026',
        totalReceitas: 2500,
        totalDespesas: 1340.5,
        saldo: 1159.5,
        totalTransacoes: 4,
      });
    });

    it('Determinismo nos Cálculos: deve somar centavos com exatidão matemática sem divergência de float', async () => {
      const centTransactions = [
        { tipo: 'RECEITA', valor: 0.1 },
        { tipo: 'RECEITA', valor: 0.2 },
        { tipo: 'DESPESA', valor: 0.05 },
        { tipo: 'DESPESA', valor: 0.01 },
      ];

      mockPrisma.transacao.findMany.mockResolvedValue(centTransactions);

      const summary = await service.getMonthSummary('user-uuid-1', referenceDate);

      expect(summary.totalReceitas).toBe(0.3);
      expect(summary.totalDespesas).toBe(0.06);
      expect(summary.saldo).toBe(0.24);
      expect(summary.totalTransacoes).toBe(4);
    });

    it('Cenário de Saldo Negativo: deve calcular saldo negativo quando despesas superam receitas', async () => {
      const negativeTransactions = [
        { tipo: 'RECEITA', valor: 200 },
        { tipo: 'DESPESA', valor: 550 },
      ];

      mockPrisma.transacao.findMany.mockResolvedValue(negativeTransactions);

      const summary = await service.getMonthSummary('user-uuid-1', referenceDate);

      expect(summary.totalReceitas).toBe(200);
      expect(summary.totalDespesas).toBe(550);
      expect(summary.saldo).toBe(-350);
      expect(summary.totalTransacoes).toBe(2);
    });

    it('Cenário de Borda (Ausência de Movimentação - RN-02.4): deve retornar zeros quando não há transações no mês', async () => {
      mockPrisma.transacao.findMany.mockResolvedValue([]);

      const summary = await service.getMonthSummary('user-uuid-1', referenceDate);

      expect(summary).toEqual({
        mesReferencia: 'Outubro/2026',
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        totalTransacoes: 0,
      });
    });

    it('Cenário de Falha (Validação): deve rejeitar quando usuarioId está vazio', async () => {
      await expect(service.getMonthSummary('')).rejects.toThrow('usuarioId é obrigatório');
      expect(mockPrisma.transacao.findMany).not.toHaveBeenCalled();
    });
  });
});
