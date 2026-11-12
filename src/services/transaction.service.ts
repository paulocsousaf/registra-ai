import { PrismaClient, Transacao } from '@prisma/client';
import { prisma as defaultPrisma } from '../lib/prisma.js';
import { CategoriaTransacao, MonthSummary, TipoTransacao } from '../types/index.js';
import { getMonthReferenceName } from '../utils/parser.js';

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
  getMonthSummary(usuarioId: string, referenceDate?: Date): Promise<MonthSummary>;
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

  /**
   * Consolida as receitas, despesas e saldo do mês civil vigente do usuário (RF-02).
   *
   * - RN-02.1: Escopo do primeiro dia do mês civil vigente até o fim do mês em America/Sao_Paulo
   * - RN-02.2: Fórmula determinística de consolidação:
   *     Total_Receitas = sum(valor) onde tipo = 'RECEITA' e deletado_em IS NULL
   *     Total_Despesas = sum(valor) onde tipo = 'DESPESA' e deletado_em IS NULL
   *     Saldo_Mes = Total_Receitas - Total_Despesas
   * - RN-02.4: Caso não existam lançamentos, retorna valores zerados (R$ 0,00)
   * - Regra 6.3: Isolamento rigoroso pelo usuario_id
   * - Regra 6.4: Cálculos matemáticos determinísticos sem uso de LLM
   */
  async getMonthSummary(usuarioId: string, referenceDate: Date = new Date()): Promise<MonthSummary> {
    if (!usuarioId || typeof usuarioId !== 'string' || !usuarioId.trim()) {
      throw new Error('usuarioId é obrigatório.');
    }

    // Calcula os limites temporais do mês civil no fuso America/Sao_Paulo
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'numeric',
    });
    const parts = formatter.formatToParts(referenceDate);
    const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
    const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);

    const monthStr = String(month).padStart(2, '0');
    const startOfMonth = new Date(`${year}-${monthStr}-01T00:00:00.000-03:00`);

    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextMonthStr = String(nextMonth).padStart(2, '0');
    const startOfNextMonth = new Date(`${nextYear}-${nextMonthStr}-01T00:00:00.000-03:00`);

    // Consulta transações ativas do usuário dentro da janela do mês corrente
    const transactions = await this.prisma.transacao.findMany({
      where: {
        usuario_id: usuarioId,
        deletado_em: null,
        data_transacao: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      select: {
        tipo: true,
        valor: true,
      },
    });

    // Agregação determinística em centavos inteiros para evitar imprecisões de ponto flutuante
    let totalReceitasCents = 0;
    let totalDespesasCents = 0;

    for (const tx of transactions) {
      const cents = Math.round(Number(tx.valor) * 100);
      if (tx.tipo === 'RECEITA') {
        totalReceitasCents += cents;
      } else if (tx.tipo === 'DESPESA') {
        totalDespesasCents += cents;
      }
    }

    const totalReceitas = totalReceitasCents / 100;
    const totalDespesas = totalDespesasCents / 100;
    const saldo = (totalReceitasCents - totalDespesasCents) / 100;
    const mesReferencia = getMonthReferenceName(referenceDate);

    return {
      mesReferencia,
      totalReceitas,
      totalDespesas,
      saldo,
      totalTransacoes: transactions.length,
    };
  }
}

export const transactionService = new TransactionService();
