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

// Importa o mock para controlar retornos nos testes
import { userService } from './services/user.service.js';
const mockFindOrCreate = userService.findOrCreateByPhone as ReturnType<typeof vi.fn>;

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
