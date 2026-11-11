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
const UNDO_WINDOW_MS = 30 * 60 * 1000; // 30 minutos em milissegundos

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

  /**
   * Reverte (Soft Delete) a última transação ativa do usuário se criada há menos de 30 minutos (RF-03).
   *
   * - RN-03.1: Seleciona estritamente a última transação ativa (deletado_em IS NULL) do usuario_id
   * - RN-03.2: Permite apenas se criada dentro da janela de tolerância de 30 minutos
   * - RN-03.3: Executa soft delete preenchendo deletado_em com a data/hora atual
   */
  async undoLast(usuarioId: string): Promise<Transacao | null> {
    if (!usuarioId || typeof usuarioId !== 'string' || !usuarioId.trim()) {
      throw new Error('usuarioId é obrigatório.');
    }

    const lastTransaction = await this.prisma.transacao.findFirst({
      where: {
        usuario_id: usuarioId,
        deletado_em: null,
      },
      orderBy: {
        data_transacao: 'desc',
      },
    });

    if (!lastTransaction) {
      return null;
    }

    const now = new Date();
    const elapsedMs = now.getTime() - new Date(lastTransaction.data_transacao).getTime();

    if (elapsedMs > UNDO_WINDOW_MS) {
      return null;
    }

    return this.prisma.transacao.update({
      where: {
        id: lastTransaction.id,
        usuario_id: usuarioId,
      },
      data: {
        deletado_em: now,
      },
    });
  }

  async getMonthSummary(_usuarioId: string, _referenceDate: Date): Promise<unknown> {
    // Stub: Lógica de consolidação e saldo mensal será implementada no RF-02
    throw new Error('Método não implementado.');
  }
}

export const transactionService = new TransactionService();
