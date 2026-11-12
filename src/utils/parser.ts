import { CategoriaTransacao, MonthSummary, TipoTransacao } from '../types/index.js';

export interface ParsedTransaction {
  tipo: TipoTransacao;
  valor: number;
  descricao: string;
  categoria: CategoriaTransacao;
}

export type ParseErrorCode =
  | 'INVALID_LENGTH'
  | 'NO_VALUE'
  | 'INVALID_VALUE_RANGE'
  | 'NO_DESCRIPTION';

export class TransactionParseError extends Error {
  public readonly code: ParseErrorCode;
  public readonly userMessage: string;

  constructor(code: ParseErrorCode, userMessage?: string) {
    const defaultMessage =
      "⚠️ Não identifiquei o valor. Envie o que foi gasto/recebido e o valor numérico. Exemplo: 'almoço 35' ou 'recebi 200'.";
    super(userMessage || defaultMessage);
    this.name = 'TransactionParseError';
    this.code = code;
    this.userMessage = userMessage || defaultMessage;
  }
}

const MIN_TEXT_LENGTH = 3;
const MAX_TEXT_LENGTH = 255;
const MIN_TRANSACTION_VALUE = 0.01;
const MAX_TRANSACTION_VALUE = 999999.99;

const RECEITA_KEYWORDS = [
  'pix recebido',
  'recebi',
  'ganhei',
  'salario',
  'deposito',
];

const CATEGORY_KEYWORDS: Record<Exclude<CategoriaTransacao, 'Outros'>, string[]> = {
  Alimentação: [
    'almoco',
    'jantar',
    'lanche',
    'padaria',
    'restaurante',
    'comida',
    'ifood',
    'mercado',
  ],
  Transporte: [
    'uber',
    '99',
    'gasolina',
    'combustivel',
    'onibus',
    'pedagio',
    'estacionamento',
  ],
  Saúde: ['farmacia', 'remedio', 'consulta', 'medico', 'dentista'],
  Moradia: ['aluguel', 'luz', 'agua', 'internet', 'condominio'],
  Lazer: ['cinema', 'cerveja', 'bar', 'show', 'festa'],
  Renda: ['salario', 'freela', 'rendimento', 'pix'],
};

const STOP_WORDS = new Set([
  'gastei',
  'comprei',
  'paguei',
  'recebi',
  'ganhei',
  'no',
  'na',
  'nos',
  'nas',
  'em',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'com',
  'por',
  'para',
  'pra',
  'pro',
  'um',
  'uma',
]);

/**
 * Remove acentos e converte para minúsculas para comparação insensível a diacríticos.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Converte uma string numérica capturada (ex: "1.500,50", "35,50", "35.50", "1.500")
 * para número de ponto flutuante arredondado em 2 casas decimais.
 */
function parseNumericToken(rawNumber: string): number {
  const cleaned = rawNumber.trim();

  // Caso 1: Formato brasileiro com ponto de milhar e vírgula decimal (ex: 1.500,50 ou 999.999,99)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    return Number(normalized);
  }

  // Caso 2: Contém apenas vírgula como separador decimal (ex: 35,50 ou 0,01)
  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(',', '.');
    return Number(normalized);
  }

  // Caso 3: Contém ponto(s) e nenhuma vírgula
  if (cleaned.includes('.')) {
    // Se tiver múltiplos pontos (ex: 1.000.000) ou exatamente 3 dígitos após o ponto (ex: 1.500),
    // trata como separador de milhar
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      return Number(cleaned.replace(/\./g, ''));
    }
    // Caso contrário (1 ou 2 dígitos após o ponto, ex: 35.5 ou 35.50), é separador decimal
    return Number(cleaned);
  }

  // Caso 4: Inteiro simples
  return Number(cleaned);
}

/**
 * Detecta a categoria preliminar com base em palavras-chave (RN-01.3).
 */
export function detectCategory(textWithoutPrice: string, tipo: TipoTransacao): CategoriaTransacao {
  const normalized = normalizeText(textWithoutPrice);
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);

  const matchesKeyword = (keyword: string): boolean => {
    if (keyword.includes(' ')) {
      return normalized.includes(keyword);
    }
    return tokens.includes(keyword);
  };

  if (tipo === 'RECEITA') {
    for (const kw of CATEGORY_KEYWORDS.Renda) {
      if (matchesKeyword(kw)) {
        return 'Renda';
      }
    }
  }

  const orderedCategories: Exclude<CategoriaTransacao, 'Outros'>[] = [
    'Alimentação',
    'Transporte',
    'Saúde',
    'Moradia',
    'Lazer',
    'Renda',
  ];

  for (const category of orderedCategories) {
    for (const kw of CATEGORY_KEYWORDS[category]) {
      if (matchesKeyword(kw)) {
        return category;
      }
    }
  }

  return 'Outros';
}

/**
 * Extrai e limpa a descrição textual da mensagem, removendo o valor monetário
 * e verbos/preposições auxiliares quando houver substantivo descritivo.
 */
function extractDescription(rawText: string, matchedPriceSegment: string): string {
  const withoutPrice = rawText
    .replace(matchedPriceSegment, ' ')
    .replace(/\bR\$\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-+:,.;\s]+|[-+:,.;\s]+$/g, '')
    .trim();

  if (!withoutPrice) {
    return '';
  }

  const words = withoutPrice.split(/\s+/);
  const meaningfulWords = words.filter((word) => {
    const norm = normalizeText(word).replace(/[^a-z0-9]/g, '');
    return norm.length > 0 && !STOP_WORDS.has(norm);
  });

  if (meaningfulWords.length > 0) {
    return meaningfulWords.join(' ').slice(0, 150);
  }

  return withoutPrice.slice(0, 150);
}

/**
 * Faz o parsing determinístico de uma mensagem de transação financeira (RF-01).
 *
 * - RN-01.1: Detecta RECEITA ou DESPESA
 * - RN-01.2: Extrai o primeiro valor numérico válido (entre 0,01 e 999.999,99)
 * - RN-01.3: Classifica em categoria preliminar por palavras-chave
 */
export function parseTransactionMessage(rawText: string): ParsedTransaction {
  if (typeof rawText !== 'string') {
    throw new TransactionParseError('INVALID_LENGTH');
  }

  const trimmed = rawText.trim();
  if (trimmed.length < MIN_TEXT_LENGTH || trimmed.length > MAX_TEXT_LENGTH) {
    throw new TransactionParseError('INVALID_LENGTH');
  }

  // Regex para isolar valores numéricos (com suporte a sinal +/-, R$ opcional, milhar e decimais)
  const priceRegex =
    /(?:([+-])\s*)?(?:R\$\s*)?([+-])?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d+))?/gi;

  const matches = Array.from(trimmed.matchAll(priceRegex));
  if (matches.length === 0) {
    throw new TransactionParseError('NO_VALUE');
  }

  // Se o primeiro número for exatamente "99" (app de transporte) e houver outro número na mensagem,
  // utiliza o segundo número como valor monetário
  let selectedMatch = matches[0];
  if (matches.length > 1 && selectedMatch[0].trim() === '99') {
    selectedMatch = matches[1];
  }

  const fullMatch = selectedMatch[0];
  const signBeforeCurrency = selectedMatch[1];
  const signBeforeNumber = selectedMatch[2];
  const integerPart = selectedMatch[3];
  const decimalPart = selectedMatch[4];

  const sign = signBeforeNumber || signBeforeCurrency || '';
  const reconstructedNumber =
    decimalPart !== undefined ? `${integerPart},${decimalPart}` : integerPart;

  const rawValue = parseNumericToken(reconstructedNumber);

  if (Number.isNaN(rawValue)) {
    throw new TransactionParseError('NO_VALUE');
  }

  const normalizedValue = Math.round(Math.abs(rawValue) * 100) / 100;

  if (normalizedValue < MIN_TRANSACTION_VALUE || normalizedValue > MAX_TRANSACTION_VALUE) {
    throw new TransactionParseError('INVALID_VALUE_RANGE');
  }

  // Reconstrói o texto sem o trecho exato do valor capturado
  const matchStartInTrimmed = selectedMatch.index ?? 0;
  const matchEndInTrimmed = matchStartInTrimmed + fullMatch.length;
  const textWithoutPrice =
    trimmed.slice(0, matchStartInTrimmed) + ' ' + trimmed.slice(matchEndInTrimmed);

  const descricao = extractDescription(
    trimmed.slice(0, matchStartInTrimmed) +
      ' __PRICE__ ' +
      trimmed.slice(matchEndInTrimmed),
    '__PRICE__'
  );

  if (!descricao) {
    throw new TransactionParseError('NO_DESCRIPTION');
  }

  // RN-01.1 & RN-01.2: Determinação do tipo (DESPESA vs RECEITA)
  const normalizedFullText = normalizeText(textWithoutPrice);
  const tokens = normalizedFullText.split(/[^a-z0-9]+/).filter(Boolean);

  let tipo: TipoTransacao = 'DESPESA';

  if (sign === '-') {
    // RN-01.2: Valores negativos explícitos definem o tipo como DESPESA
    tipo = 'DESPESA';
  } else if (sign === '+') {
    // RN-01.1: Prefixo "+" define RECEITA
    tipo = 'RECEITA';
  } else {
    const isReceita = RECEITA_KEYWORDS.some((kw) => {
      if (kw.includes(' ')) {
        return normalizedFullText.includes(kw);
      }
      return tokens.includes(kw);
    });

    if (isReceita) {
      tipo = 'RECEITA';
    }
  }

  const categoria = detectCategory(textWithoutPrice, tipo);

  return {
    tipo,
    valor: normalizedValue,
    descricao,
    categoria,
  };
}

const MAX_UNDO_COMMAND_LENGTH = 30;
const UNDO_COMMANDS = new Set(['desfazer', 'apagar', 'cancelar', 'excluir', 'voltar']);

export const UNDO_NOT_FOUND_MESSAGE =
  '⚠️ Nenhuma transação recente encontrada para desfazer (limite de 30 minutos). Suas transações permanecem salvas.';

/**
 * Verifica se o texto recebido corresponde exatamente a um comando de cancelamento/desfazer (RF-03).
 *
 * - Valores aceitos (case-insensitive): "desfazer", "apagar", "cancelar", "excluir", "voltar"
 * - Limite máximo: 30 caracteres
 */
export function isUndoCommand(rawText: string): boolean {
  if (typeof rawText !== 'string') {
    return false;
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_UNDO_COMMAND_LENGTH) {
    return false;
  }

  return UNDO_COMMANDS.has(trimmed.toLowerCase());
}

/**
 * Formata um valor numérico no padrão contábil brasileiro (ex: "R$ 35,00", "R$ 1.500,50", "-R$ 50,00").
 */
export function formatCurrencyBRL(value: number): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const fixed = absValue.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-' : ''}R$ ${formattedInt},${decPart}`;
}

/**
 * Formata a mensagem de confirmação do lançamento para o WhatsApp conforme especificação do RF-01.
 */
export function formatTransactionConfirmation(tx: ParsedTransaction): string {
  const tipoLabel = tx.tipo === 'RECEITA' ? '🟢 Receita' : '🔴 Despesa';
  const valorFormatado = formatCurrencyBRL(tx.valor);

  return [
    '✅ Lançamento registrado!',
    `• Tipo: ${tipoLabel}`,
    `• Valor: ${valorFormatado}`,
    `• Descrição: ${tx.descricao}`,
    `• Categoria: ${tx.categoria}`,
    '',
    '💡 Digite "desfazer" se registrou por engano.',
  ].join('\n');
}

/**
 * Formata a mensagem de confirmação de exclusão do último lançamento conforme especificação do RF-03.
 * Capitaliza a primeira letra da descrição.
 */
export function formatUndoConfirmation(descricao: string, valor: number): string {
  const trimmedDesc = descricao.trim();
  const capitalizedDesc =
    trimmedDesc.length > 0
      ? trimmedDesc.charAt(0).toUpperCase() + trimmedDesc.slice(1)
      : trimmedDesc;
  const valorFormatado = formatCurrencyBRL(valor);

  return [
    '🗑️ Lançamento desfeito com sucesso!',
    `• Removido: ${capitalizedDesc} (${valorFormatado})`,
    '',
    'Seu saldo foi recalculado automaticamente.',
  ].join('\n');
}

const MAX_SUMMARY_COMMAND_LENGTH = 50;
const SUMMARY_COMMANDS = new Set([
  'resumo',
  'saldo',
  'relatorio',
  'gastos',
  'extrato',
  'mes',
]);

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Retorna o nome do mês em português capitalizado seguido pelo ano (ex: "Outubro/2026"),
 * considerando o fuso horário padrão (America/Sao_Paulo).
 */
export function getMonthReferenceName(date: Date = new Date(), timeZone = 'America/Sao_Paulo'): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const monthNumber = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
  const yearNumber = parts.find((p) => p.type === 'year')?.value || `${date.getFullYear()}`;
  const monthName = MONTH_NAMES_PT[monthNumber - 1] || 'Janeiro';
  return `${monthName}/${yearNumber}`;
}

/**
 * Verifica se o texto recebido corresponde a um comando de consulta de resumo / saldo (RF-02).
 *
 * - Valores aceitos (case-insensitive, com ou sem acentos):
 *   "resumo", "saldo", "relatorio", "gastos", "extrato", "mes", "mês"
 * - Limite máximo: 50 caracteres
 */
export function isSummaryCommand(rawText: string): boolean {
  if (typeof rawText !== 'string') {
    return false;
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SUMMARY_COMMAND_LENGTH) {
    return false;
  }

  const normalized = normalizeText(trimmed);
  return SUMMARY_COMMANDS.has(normalized);
}

/**
 * Formata a mensagem de resumo financeiro mensal para o WhatsApp conforme especificação do RF-02.
 */
export function formatMonthSummary(summary: MonthSummary): string {
  if (summary.totalTransacoes === 0) {
    return `📊 Você ainda não tem lançamentos registrados em ${summary.mesReferencia}. Envie algo como 'mercado 80' para começar!`;
  }

  const receitasFormatadas = formatCurrencyBRL(summary.totalReceitas);
  const despesasFormatadas = formatCurrencyBRL(summary.totalDespesas);
  const saldoFormatado = formatCurrencyBRL(summary.saldo);

  return [
    `📊 Resumo Financeiro - ${summary.mesReferencia}`,
    '',
    `🟢 Total de Receitas: ${receitasFormatadas}`,
    `🔴 Total de Despesas: ${despesasFormatadas}`,
    '────────────────────────',
    `💰 Saldo do Mês: ${saldoFormatado}`,
    '',
    `Total de transações registradas: ${summary.totalTransacoes}`,
  ].join('\n');
}
