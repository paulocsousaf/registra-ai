import { Transacao } from '@prisma/client';
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

export class TransactionService implements ITransactionService {
  async create(_data: CreateTransactionDTO): Promise<Transacao> {
    // Stub: Lógica de persistência e validação será implementada no RF-01
    throw new Error('Método não implementado.');
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
