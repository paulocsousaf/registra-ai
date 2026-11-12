import { describe, it, expect } from 'vitest';
import {
  parseTransactionMessage,
  formatCurrencyBRL,
  formatTransactionConfirmation,
  formatUndoConfirmation,
  isUndoCommand,
  isSummaryCommand,
  getMonthReferenceName,
  formatMonthSummary,
  TransactionParseError,
} from './parser.js';

describe('parseTransactionMessage — RF-01', () => {
  describe('Cenários de Sucesso (Caminho Feliz)', () => {
    it('deve interpretar despesa simples com inteiro ("almoço 35")', () => {
      const result = parseTransactionMessage('almoço 35');
      expect(result).toEqual({
        tipo: 'DESPESA',
        valor: 35,
        descricao: 'almoço',
        categoria: 'Alimentação',
      });
    });

    it('deve interpretar despesa com vírgula decimal ("almoço 35,50")', () => {
      const result = parseTransactionMessage('almoço 35,50');
      expect(result).toEqual({
        tipo: 'DESPESA',
        valor: 35.5,
        descricao: 'almoço',
        categoria: 'Alimentação',
      });
    });

    it('deve interpretar despesa com ponto decimal ("uber 18.90")', () => {
      const result = parseTransactionMessage('uber 18.90');
      expect(result).toEqual({
        tipo: 'DESPESA',
        valor: 18.9,
        descricao: 'uber',
        categoria: 'Transporte',
      });
    });

    it('deve interpretar frase natural com verbo ("gastei 120 no mercado")', () => {
      const result = parseTransactionMessage('gastei 120 no mercado');
      expect(result).toEqual({
        tipo: 'DESPESA',
        valor: 120,
        descricao: 'mercado',
        categoria: 'Alimentação',
      });
    });

    it('deve interpretar receita por palavra-chave ("recebi 1500 salario")', () => {
      const result = parseTransactionMessage('recebi 1500 salario');
      expect(result).toEqual({
        tipo: 'RECEITA',
        valor: 1500,
        descricao: 'salario',
        categoria: 'Renda',
      });
    });

    it('deve interpretar receita com prefixo "+" ("+300 freela")', () => {
      const result = parseTransactionMessage('+300 freela');
      expect(result).toEqual({
        tipo: 'RECEITA',
        valor: 300,
        descricao: 'freela',
        categoria: 'Renda',
      });
    });

    it('deve normalizar valor negativo explícito para positivo e classificar como DESPESA ("-45 farmacia")', () => {
      const result = parseTransactionMessage('-45 farmacia');
      expect(result).toEqual({
        tipo: 'DESPESA',
        valor: 45,
        descricao: 'farmacia',
        categoria: 'Saúde',
      });
    });

    it('deve aceitar prefixo monetário R$ maiúsculo ou minúsculo ("aluguel R$ 1.250,00")', () => {
      const result = parseTransactionMessage('aluguel R$ 1.250,00');
      expect(result).toEqual({
        tipo: 'DESPESA',
        valor: 1250,
        descricao: 'aluguel',
        categoria: 'Moradia',
      });
    });

    it('deve categorizar corretamente Transporte quando o app é "99" ("99 24,90")', () => {
      const result = parseTransactionMessage('99 24,90');
      expect(result).toEqual({
        tipo: 'DESPESA',
        valor: 24.9,
        descricao: '99',
        categoria: 'Transporte',
      });
    });

    it('deve categorizar Lazer ("cerveja no bar 65") e Outros ("presente aniversario 80")', () => {
      expect(parseTransactionMessage('cerveja no bar 65').categoria).toBe('Lazer');
      expect(parseTransactionMessage('presente aniversario 80').categoria).toBe('Outros');
    });

    it('deve aceitar valores nos limites exatos (R$ 0,01 e R$ 999.999,99)', () => {
      const minResult = parseTransactionMessage('cafe 0,01');
      expect(minResult.valor).toBe(0.01);

      const maxResult = parseTransactionMessage('apartamento 999.999,99');
      expect(maxResult.valor).toBe(999999.99);
    });
  });

  describe('Cenários de Falha (Caminho de Exceção e Borda)', () => {
    it('deve rejeitar mensagem sem valor numérico ("comprei um tênis novo hoje no shopping")', () => {
      expect(() =>
        parseTransactionMessage('comprei um tênis novo hoje no shopping')
      ).toThrowError(TransactionParseError);

      try {
        parseTransactionMessage('comprei um tênis novo hoje no shopping');
      } catch (err) {
        expect(err).toBeInstanceOf(TransactionParseError);
        const parseErr = err as TransactionParseError;
        expect(parseErr.code).toBe('NO_VALUE');
        expect(parseErr.userMessage).toContain('⚠️ Não identifiquei o valor');
      }
    });

    it('deve rejeitar valor igual a zero ("almoço 0" ou "almoço 0,00")', () => {
      expect(() => parseTransactionMessage('almoço 0')).toThrowError(TransactionParseError);
      expect(() => parseTransactionMessage('almoço 0,00')).toThrowError(TransactionParseError);
    });

    it('deve rejeitar valor acima do limite máximo de R$ 999.999,99 ("casa 1000000")', () => {
      expect(() => parseTransactionMessage('casa 1000000')).toThrowError(TransactionParseError);
      expect(() => parseTransactionMessage('casa 1.000.000,00')).toThrowError(
        TransactionParseError
      );
    });

    it('deve rejeitar mensagem curta demais (< 3 caracteres) ou acima de 255 caracteres', () => {
      expect(() => parseTransactionMessage('a1')).toThrowError(TransactionParseError);
      expect(() => parseTransactionMessage('a'.repeat(256) + ' 10')).toThrowError(
        TransactionParseError
      );
    });

    it('deve rejeitar mensagem contendo apenas número sem descrição ("350")', () => {
      expect(() => parseTransactionMessage('350')).toThrowError(TransactionParseError);
    });
  });
});

describe('Formatação de Saída — RF-01', () => {
  it('deve formatar moeda no padrão BRL ("R$ #.##0,00")', () => {
    expect(formatCurrencyBRL(35)).toBe('R$ 35,00');
    expect(formatCurrencyBRL(1500.5)).toBe('R$ 1.500,50');
    expect(formatCurrencyBRL(999999.99)).toBe('R$ 999.999,99');
  });

  it('deve formatar a mensagem de confirmação exatamente como especificado no RF-01', () => {
    const message = formatTransactionConfirmation({
      tipo: 'DESPESA',
      valor: 35,
      descricao: 'almoço',
      categoria: 'Alimentação',
    });

    expect(message).toBe(
      [
        '✅ Lançamento registrado!',
        '• Tipo: 🔴 Despesa',
        '• Valor: R$ 35,00',
        '• Descrição: almoço',
        '• Categoria: Alimentação',
        '',
        '💡 Digite "desfazer" se registrou por engano.',
      ].join('\n')
    );
  });
});

describe('isUndoCommand & formatUndoConfirmation — RF-03', () => {
  describe('isUndoCommand — Cenários de Sucesso', () => {
    it.each(['desfazer', 'apagar', 'cancelar', 'excluir', 'voltar'])(
      'deve reconhecer a palavra exata "%s" em minúsculas',
      (cmd) => {
        expect(isUndoCommand(cmd)).toBe(true);
      }
    );

    it.each(['DESFAZER', 'Apagar', '  Cancelar  ', 'EXCLUIR', 'Voltar'])(
      'deve reconhecer "%s" de forma case-insensitive e ignorando espaços nas extremidades',
      (cmd) => {
        expect(isUndoCommand(cmd)).toBe(true);
      }
    );
  });

  describe('isUndoCommand — Cenários de Falha', () => {
    it('deve rejeitar frases compostas ou variações que não sejam a palavra exata', () => {
      expect(isUndoCommand('desfazer ultimo')).toBe(false);
      expect(isUndoCommand('apagar lançamento')).toBe(false);
      expect(isUndoCommand('almoço 35')).toBe(false);
      expect(isUndoCommand('quero cancelar')).toBe(false);
    });

    it('deve rejeitar strings vazias ou maiores que 30 caracteres', () => {
      expect(isUndoCommand('')).toBe(false);
      expect(isUndoCommand('   ')).toBe(false);
      expect(isUndoCommand('a'.repeat(31))).toBe(false);
    });
  });

  describe('formatUndoConfirmation', () => {
    it('deve capitalizar a primeira letra da descrição e formatar o valor em BRL', () => {
      const msg = formatUndoConfirmation('almoço', 35);
      expect(msg).toBe(
        [
          '🗑️ Lançamento desfeito com sucesso!',
          '• Removido: Almoço (R$ 35,00)',
          '',
          'Seu saldo foi recalculado automaticamente.',
        ].join('\n')
      );
    });
  });

  describe('isSummaryCommand — RF-02', () => {
    describe('Cenários de Sucesso', () => {
      it('deve reconhecer palavras-chave exatas (RN-02)', () => {
        const keywords = ['resumo', 'saldo', 'relatorio', 'gastos', 'extrato', 'mes'];
        for (const kw of keywords) {
          expect(isSummaryCommand(kw)).toBe(true);
        }
      });

      it('deve reconhecer palavras com acentuação ("relatório", "mês")', () => {
        expect(isSummaryCommand('relatório')).toBe(true);
        expect(isSummaryCommand('mês')).toBe(true);
      });

      it('deve ser insensível a maiúsculas e minúsculas', () => {
        expect(isSummaryCommand('RESUMO')).toBe(true);
        expect(isSummaryCommand('Saldo')).toBe(true);
        expect(isSummaryCommand('ExTrAtO')).toBe(true);
        expect(isSummaryCommand('MÊS')).toBe(true);
      });

      it('deve ignorar espaços em branco nas extremidades', () => {
        expect(isSummaryCommand('  saldo  ')).toBe(true);
        expect(isSummaryCommand('\tresumo\n')).toBe(true);
      });
    });

    describe('Cenários de Rejeição', () => {
      it('deve rejeitar frases que contenham valor ou não sejam o comando exato', () => {
        expect(isSummaryCommand('resumo 50')).toBe(false);
        expect(isSummaryCommand('saldo 100')).toBe(false);
        expect(isSummaryCommand('gastei 50 no mercado')).toBe(false);
        expect(isSummaryCommand('almoço 35')).toBe(false);
        expect(isSummaryCommand('quero ver meu saldo')).toBe(false);
      });

      it('deve rejeitar strings vazias ou maiores que 50 caracteres', () => {
        expect(isSummaryCommand('')).toBe(false);
        expect(isSummaryCommand('   ')).toBe(false);
        expect(isSummaryCommand('a'.repeat(51))).toBe(false);
      });
    });
  });

  describe('formatCurrencyBRL', () => {
    it('deve formatar valores positivos, zeros e negativos corretamente', () => {
      expect(formatCurrencyBRL(0)).toBe('R$ 0,00');
      expect(formatCurrencyBRL(35)).toBe('R$ 35,00');
      expect(formatCurrencyBRL(1250.5)).toBe('R$ 1.250,50');
      expect(formatCurrencyBRL(-150)).toBe('-R$ 150,00');
      expect(formatCurrencyBRL(-0.05)).toBe('-R$ 0,05');
    });
  });

  describe('getMonthReferenceName', () => {
    it('deve formatar mês e ano corretamente no padrão capitalizado', () => {
      const dateOutubro = new Date('2026-10-15T15:00:00Z');
      expect(getMonthReferenceName(dateOutubro)).toBe('Outubro/2026');

      const dateDezembro = new Date('2026-12-05T12:00:00Z');
      expect(getMonthReferenceName(dateDezembro)).toBe('Dezembro/2026');
    });
  });

  describe('formatMonthSummary', () => {
    it('deve formatar layout completo quando há movimentações (BDD RF-02)', () => {
      const summary = {
        mesReferencia: 'Outubro/2026',
        totalReceitas: 2500,
        totalDespesas: 1340.5,
        saldo: 1159.5,
        totalTransacoes: 18,
      };

      const msg = formatMonthSummary(summary);
      expect(msg).toBe(
        [
          '📊 Resumo Financeiro - Outubro/2026',
          '',
          '🟢 Total de Receitas: R$ 2.500,00',
          '🔴 Total de Despesas: R$ 1.340,50',
          '────────────────────────',
          '💰 Saldo do Mês: R$ 1.159,50',
          '',
          'Total de transações registradas: 18',
        ].join('\n')
      );
    });

    it('deve formatar saldo negativo quando despesas superam receitas', () => {
      const summary = {
        mesReferencia: 'Novembro/2026',
        totalReceitas: 500,
        totalDespesas: 750,
        saldo: -250,
        totalTransacoes: 3,
      };

      const msg = formatMonthSummary(summary);
      expect(msg).toContain('💰 Saldo do Mês: -R$ 250,00');
    });

    it('deve formatar aviso amigável quando não há transações no período (Zero-State BDD RF-02)', () => {
      const summary = {
        mesReferencia: 'Outubro/2026',
        totalReceitas: 0,
        totalDespesas: 0,
        saldo: 0,
        totalTransacoes: 0,
      };

      const msg = formatMonthSummary(summary);
      expect(msg).toBe(
        "📊 Você ainda não tem lançamentos registrados em Outubro/2026. Envie algo como 'mercado 80' para começar!"
      );
    });
  });
});
