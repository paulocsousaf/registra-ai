import { PrismaClient, Transacao } from '@prisma/client';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { CategoriaTransacao, TipoTransacao } from '../types/index.js';

export interface CreateTransactionDTO {
  usuarioId: string;
  tipo: TipoTransacao;
  valor: number;
  descricao: string;
  categoria: CategoriaTransacao;
}

export interface ITransactionService {
  create(data: CreateTransactionDTO): Promise<Transacao>;
  undoLast(usuarioId: string): Promise<Transacao | null>;
  getMonthSummary(usuarioId: string, referenceDate: Date): Promise<unknown>;
}

const MIN_VALUE = 0.01;
const MAX_VALUE = 999999.99;

export class TransactionService implements ITransactionService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || defaultPrisma;
  }

  /**
   * Persiste uma nova transação financeira vinculada ao usuário (RF-01).
   *
   * - Garante isolamento por usuario_id
   * - Valida limites numéricos (R$ 0,01 a R$ 999.999,99)
   * - Normaliza valor para 2 casas decimais
   */
  async create(data: CreateTransactionDTO): Promise<Transacao> {
    if (!data.usuarioId || typeof data.usuarioId !== 'string') {
      throw new Error('usuarioId é obrigatório.');
    }

    if (data.tipo !== 'DESPESA' && data.tipo !== 'RECEITA') {
      throw new Error('Tipo de transação inválido. Use DESPESA ou RECEITA.');
    }

    if (
      typeof data.valor !== 'number' ||
      !Number.isFinite(data.valor) ||
      data.valor < MIN_VALUE ||
      data.valor > MAX_VALUE
    ) {
      throw new Error('Valor da transação deve estar entre R$ 0,01 e R$ 999.999,99.');
    }

    const descricao = data.descricao?.trim();
    if (!descricao || descricao.length > 150) {
      throw new Error('Descrição da transação é obrigatória e deve ter até 150 caracteres.');
    }

    const valorNormalizado = Math.round(data.valor * 100) / 100;

    return this.prisma.transacao.create({
      data: {
        usuario_id: data.usuarioId,
        tipo: data.tipo,
        valor: valorNormalizado,
        descricao,
        categoria: data.categoria,
      },
    });
  }

  async undoLast(_usuarioId: string): Promise<Transacao | null> {
    // Stub: Lógica de soft delete (janela de 30min) será implementada no RF-03
    throw new Error('Método não implementado.');
  }

  async getMonthSummary(_usuarioId: string, _referenceDate: Date): Promise<unknown> {
    // Stub: Lógica de consolidação e saldo mensal será implementada no RF-02
    throw new Error('Método não implementado.');
  }
}

export const transactionService = new TransactionService();
