import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from './app.js';

// Mock do userService para testes de integração (sem banco real)
vi.mock('./services/user.service.js', () => {
  const mockFindOrCreateByPhone = vi.fn();
  return {
    userService: {
      findOrCreateByPhone: mockFindOrCreateByPhone,
    },
    UserService: vi.fn(),
    __mockFindOrCreateByPhone: mockFindOrCreateByPhone,
  };
});

// Mock do transactionService para testes de integração (sem banco real)
vi.mock('./services/transaction.service.js', () => {
  const mockCreate = vi.fn();
  const mockUndoLast = vi.fn();
  const mockGetMonthSummary = vi.fn();
  return {
    transactionService: {
      create: mockCreate,
      undoLast: mockUndoLast,
      getMonthSummary: mockGetMonthSummary,
    },
    TransactionService: vi.fn(),
    __mockCreate: mockCreate,
    __mockUndoLast: mockUndoLast,
    __mockGetMonthSummary: mockGetMonthSummary,
  };
});

// Importa os mocks para controlar retornos nos testes
import { userService } from './services/user.service.js';
import { transactionService } from './services/transaction.service.js';

const mockFindOrCreate = userService.findOrCreateByPhone as ReturnType<typeof vi.fn>;
const mockCreateTransaction = transactionService.create as ReturnType<typeof vi.fn>;
const mockUndoLastTransaction = transactionService.undoLast as ReturnType<typeof vi.fn>;
const mockGetMonthSummary = transactionService.getMonthSummary as ReturnType<typeof vi.fn>;

describe('Fastify Base Application', () => {
  it('GET /health deve retornar status 200 com ok', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});

describe('POST /webhook — RF-04: Identificação Silenciosa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTransaction.mockResolvedValue({
      id: 'tx-default',
      usuario_id: 'uuid-default',
      tipo: 'DESPESA',
      valor: 35,
      descricao: 'almoço',
      categoria: 'Alimentação',
      data_transacao: new Date(),
      deletado_em: null,
    });
  });

  const validPayload = {
    senderPhone: '5586999998888@s.whatsapp.net',
    text: 'almoço 35',
    messageId: 'msg-abc-123',
    timestamp: 1730937600,
  };

  it('deve retornar 200 e isNew=true para novo usuário (RN-04.2 + RN-04.3)', async () => {
    mockFindOrCreate.mockResolvedValue({
      user: {
        id: 'uuid-novo',
        telefone: '5586999998888',
        telefone_hash: 'hash123',
        criado_em: new Date(),
        ultimo_acesso: new Date(),
      },
      isNew: true,
    });

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
    expect(body.userId).toBe('uuid-novo');
    expect(body.isNew).toBe(true);
    expect(body.welcomeMessage).toContain('Bem-vindo ao RegistraAI');
  });

  it('deve retornar 200 e isNew=false para usuário existente (RN-04.2)', async () => {
    mockFindOrCreate.mockResolvedValue({
      user: {
        id: 'uuid-existente',
        telefone: '5586999998888',
        telefone_hash: 'hash123',
        criado_em: new Date(),
        ultimo_acesso: new Date(),
      },
      isNew: false,
    });

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.received).toBe(true);
    expect(body.isNew).toBe(false);
    expect(body.welcomeMessage).toBeUndefined();
  });

  it('deve retornar 400 quando senderPhone está ausente', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        text: 'almoço 35',
        messageId: 'msg-abc-123',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Payload inválido');
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });

  it('deve retornar 400 quando senderPhone é vazio', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        ...validPayload,
        senderPhone: '',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });

  it('deve retornar 400 quando text está ausente', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888',
        messageId: 'msg-abc-123',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });

  it('deve retornar 400 quando text é curto demais (< 3 caracteres)', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        ...validPayload,
        text: 'ab',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });

  it('deve retornar 400 quando messageId está ausente', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888',
        text: 'almoço 35',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });

  it('deve retornar 400 quando payload é totalmente vazio', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(mockFindOrCreate).not.toHaveBeenCalled();
  });

  it('deve retornar 500 quando o serviço de usuário falha', async () => {
    mockFindOrCreate.mockRejectedValue(new Error('Erro de conexão com o banco'));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.error).toContain('Erro interno');
  });
});

describe('POST /webhook — RF-01: Registro Imediato de Transação', () => {
  const existingUser = {
    id: 'user-uuid-rf01',
    telefone: '5586999998888',
    telefone_hash: 'hash123',
    criado_em: new Date(),
    ultimo_acesso: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOrCreate.mockResolvedValue({
      user: existingUser,
      isNew: false,
    });
  });

  it('Caminho Feliz (Despesa): deve interpretar "almoço 35,00", persistir no banco e retornar confirmação formatada', async () => {
    const persistedTx = {
      id: 'tx-uuid-almoco',
      usuario_id: existingUser.id,
      tipo: 'DESPESA',
      valor: 35,
      descricao: 'almoço',
      categoria: 'Alimentação',
      data_transacao: new Date(),
      deletado_em: null,
    };
    mockCreateTransaction.mockResolvedValue(persistedTx);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'almoço 35,00',
        messageId: 'msg-rf01-happy-1',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.received).toBe(true);
    expect(body.registered).toBe(true);
    expect(body.transaction.id).toBe('tx-uuid-almoco');
    expect(mockCreateTransaction).toHaveBeenCalledWith({
      usuarioId: existingUser.id,
      tipo: 'DESPESA',
      valor: 35,
      descricao: 'almoço',
      categoria: 'Alimentação',
    });
    expect(body.message).toContain('✅ Lançamento registrado!');
    expect(body.message).toContain('• Tipo: 🔴 Despesa');
    expect(body.message).toContain('• Valor: R$ 35,00');
    expect(body.message).toContain('• Descrição: almoço');
    expect(body.message).toContain('• Categoria: Alimentação');
  });

  it('Caminho Feliz (Receita): deve interpretar "recebi 1500 salario", persistir e retornar confirmação de receita', async () => {
    const persistedTx = {
      id: 'tx-uuid-salario',
      usuario_id: existingUser.id,
      tipo: 'RECEITA',
      valor: 1500,
      descricao: 'salario',
      categoria: 'Renda',
      data_transacao: new Date(),
      deletado_em: null,
    };
    mockCreateTransaction.mockResolvedValue(persistedTx);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'recebi 1500 salario',
        messageId: 'msg-rf01-happy-2',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.registered).toBe(true);
    expect(mockCreateTransaction).toHaveBeenCalledWith({
      usuarioId: existingUser.id,
      tipo: 'RECEITA',
      valor: 1500,
      descricao: 'salario',
      categoria: 'Renda',
    });
    expect(body.message).toContain('• Tipo: 🟢 Receita');
    expect(body.message).toContain('• Valor: R$ 1.500,00');
    expect(body.message).toContain('• Categoria: Renda');
  });

  it('Caminho de Erro (Sem valor numérico): NÃO deve persistir no banco e deve retornar aviso amigável (BDD RF-01)', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'comprei um tênis novo hoje no shopping',
        messageId: 'msg-rf01-err-1',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.received).toBe(true);
    expect(body.registered).toBe(false);
    expect(mockCreateTransaction).not.toHaveBeenCalled();
    expect(body.message).toBe(
      "⚠️ Não identifiquei o valor. Envie o que foi gasto/recebido e o valor numérico. Exemplo: 'almoço 35' ou 'recebi 200'."
    );
  });

  it('Caminho de Erro (Valor fora dos limites): NÃO deve persistir valores <= 0 ou > 999.999,99 (RN-01.2)', async () => {
    const app = buildApp();

    const resZero = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'almoço 0',
        messageId: 'msg-rf01-err-zero',
        timestamp: 1730937600,
      },
    });

    expect(resZero.statusCode).toBe(200);
    expect(JSON.parse(resZero.payload).registered).toBe(false);

    const resMax = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'mansao 1000000',
        messageId: 'msg-rf01-err-max',
        timestamp: 1730937600,
      },
    });

    expect(resMax.statusCode).toBe(200);
    expect(JSON.parse(resMax.payload).registered).toBe(false);
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });

  it('Idempotência (RN-01.5): deve ignorar mensagens duplicadas com o mesmo messageId em 60s', async () => {
    mockCreateTransaction.mockResolvedValue({
      id: 'tx-uuid-1',
      usuario_id: existingUser.id,
      tipo: 'DESPESA',
      valor: 35,
      descricao: 'almoço',
      categoria: 'Alimentação',
      data_transacao: new Date(),
      deletado_em: null,
    });

    const app = buildApp();
    const payload = {
      senderPhone: '5586999998888@s.whatsapp.net',
      text: 'almoço 35',
      messageId: 'msg-duplicada-01',
      timestamp: 1730937600,
    };

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload,
    });
    expect(firstResponse.statusCode).toBe(200);
    expect(JSON.parse(firstResponse.payload).registered).toBe(true);

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload,
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(JSON.parse(secondResponse.payload).duplicate).toBe(true);

    // Garante que o banco foi acionado apenas uma vez
    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('POST /webhook — RF-03: Desfazer / Exclusão do Último Lançamento', () => {
  const existingUser = {
    id: 'user-uuid-rf03',
    telefone: '5586999998888',
    telefone_hash: 'hash123',
    criado_em: new Date(),
    ultimo_acesso: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOrCreate.mockResolvedValue({
      user: existingUser,
      isNew: false,
    });
  });

  it('Caminho Feliz: deve desfazer a última transação elegível (< 30 min) e retornar confirmação com descrição capitalizada (BDD RF-03)', async () => {
    const undoneTx = {
      id: 'tx-uuid-undo-1',
      usuario_id: existingUser.id,
      tipo: 'DESPESA',
      valor: 350,
      descricao: 'almoço',
      categoria: 'Alimentação',
      data_transacao: new Date(Date.now() - 2 * 60 * 1000),
      deletado_em: new Date(),
    };
    mockUndoLastTransaction.mockResolvedValue(undoneTx);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'desfazer',
        messageId: 'msg-rf03-happy-1',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.received).toBe(true);
    expect(body.userId).toBe(existingUser.id);
    expect(body.isNew).toBe(false);
    expect(body.undone).toBe(true);
    expect(body.transaction.id).toBe('tx-uuid-undo-1');
    expect(mockUndoLastTransaction).toHaveBeenCalledWith(existingUser.id);
    expect(mockCreateTransaction).not.toHaveBeenCalled();
    expect(body.message).toBe(
      [
        '🗑️ Lançamento desfeito com sucesso!',
        '• Removido: Almoço (R$ 350,00)',
        '',
        'Seu saldo foi recalculado automaticamente.',
      ].join('\n')
    );
  });

  it('Caminho de Falha: deve retornar undone=false e aviso amigável quando não há transação recente (< 30 min) (BDD RF-03)', async () => {
    mockUndoLastTransaction.mockResolvedValue(null);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'desfazer',
        messageId: 'msg-rf03-fail-1',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.received).toBe(true);
    expect(body.undone).toBe(false);
    expect(body.transaction).toBeUndefined();
    expect(mockUndoLastTransaction).toHaveBeenCalledWith(existingUser.id);
    expect(mockCreateTransaction).not.toHaveBeenCalled();
    expect(body.message).toBe(
      '⚠️ Nenhuma transação recente encontrada para desfazer (limite de 30 minutos). Suas transações permanecem salvas.'
    );
  });
});

describe('POST /webhook — RF-02: Consulta de Resumo / Saldo Consolidado', () => {
  const existingUser = {
    id: 'user-uuid-rf02',
    telefone: '5586999998888',
    telefone_hash: 'hash123',
    criado_em: new Date(),
    ultimo_acesso: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOrCreate.mockResolvedValue({
      user: existingUser,
      isNew: false,
    });
  });

  it('Caminho Feliz: deve processar comando "resumo" e retornar layout consolidado com totais e saldo (BDD RF-02)', async () => {
    const fakeSummary = {
      mesReferencia: 'Outubro/2026',
      totalReceitas: 2500,
      totalDespesas: 1340.5,
      saldo: 1159.5,
      totalTransacoes: 18,
    };
    mockGetMonthSummary.mockResolvedValue(fakeSummary);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'resumo',
        messageId: 'msg-rf02-happy-1',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.received).toBe(true);
    expect(body.summary).toBe(true);
    expect(body.data).toEqual(fakeSummary);
    expect(mockGetMonthSummary).toHaveBeenCalledWith(existingUser.id);
    expect(mockCreateTransaction).not.toHaveBeenCalled();
    expect(mockUndoLastTransaction).not.toHaveBeenCalled();
    expect(body.message).toBe(
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

  it('Caminho Zero-State: deve processar comando "saldo" quando usuário não possui transações (BDD RF-02)', async () => {
    const emptySummary = {
      mesReferencia: 'Outubro/2026',
      totalReceitas: 0,
      totalDespesas: 0,
      saldo: 0,
      totalTransacoes: 0,
    };
    mockGetMonthSummary.mockResolvedValue(emptySummary);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'saldo',
        messageId: 'msg-rf02-empty-1',
        timestamp: 1730937600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.received).toBe(true);
    expect(body.summary).toBe(true);
    expect(body.data.totalTransacoes).toBe(0);
    expect(mockGetMonthSummary).toHaveBeenCalledWith(existingUser.id);
    expect(body.message).toBe(
      "📊 Você ainda não tem lançamentos registrados em Outubro/2026. Envie algo como 'mercado 80' para começar!"
    );
  });

  it('Variações de comando: deve aceitar palavras com acento e em caixa alta ("mês", "EXTRATO")', async () => {
    mockGetMonthSummary.mockResolvedValue({
      mesReferencia: 'Outubro/2026',
      totalReceitas: 100,
      totalDespesas: 50,
      saldo: 50,
      totalTransacoes: 2,
    });

    const app = buildApp();

    const resMes = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'mês',
        messageId: 'msg-rf02-cmd-mes',
        timestamp: 1730937600,
      },
    });
    expect(resMes.statusCode).toBe(200);
    expect(JSON.parse(resMes.payload).summary).toBe(true);

    const resExtrato = await app.inject({
      method: 'POST',
      url: '/webhook',
      payload: {
        senderPhone: '5586999998888@s.whatsapp.net',
        text: 'EXTRATO',
        messageId: 'msg-rf02-cmd-extrato',
        timestamp: 1730937600,
      },
    });
    expect(resExtrato.statusCode).toBe(200);
    expect(JSON.parse(resExtrato.payload).summary).toBe(true);
    expect(mockGetMonthSummary).toHaveBeenCalledTimes(2);
  });
});
