import { describe, it, expect } from 'vitest';
import { normalizePhone, hashPhone } from './phone.js';

describe('normalizePhone', () => {
  it('deve retornar número limpo quando já está no formato E.164', () => {
    expect(normalizePhone('5586999998888')).toBe('5586999998888');
  });

  it('deve remover sufixo @s.whatsapp.net', () => {
    expect(normalizePhone('5586999998888@s.whatsapp.net')).toBe('5586999998888');
  });

  it('deve remover prefixo + e formatação com espaços e hífens', () => {
    expect(normalizePhone('+55 86 99999-8888')).toBe('5586999998888');
  });

  it('deve remover parênteses de DDD', () => {
    expect(normalizePhone('+55 (86) 99999-8888')).toBe('5586999998888');
  });

  it('deve aceitar número com 10 dígitos (mínimo E.164)', () => {
    expect(normalizePhone('8699998888')).toBe('8699998888');
  });

  it('deve aceitar número com 15 dígitos (máximo E.164)', () => {
    expect(normalizePhone('558699999888812')).toBe('558699999888812');
  });

  it('deve rejeitar número com menos de 10 dígitos', () => {
    expect(() => normalizePhone('999998888')).toThrow('entre 10 e 15 dígitos');
  });

  it('deve rejeitar número com mais de 15 dígitos', () => {
    expect(() => normalizePhone('5586999998888123456')).toThrow('entre 10 e 15 dígitos');
  });

  it('deve rejeitar string vazia', () => {
    expect(() => normalizePhone('')).toThrow('obrigatório');
  });

  it('deve rejeitar caracteres alfabéticos no meio do número', () => {
    expect(() => normalizePhone('5586abc998888')).toThrow('caracteres inválidos');
  });
});

describe('hashPhone', () => {
  it('deve gerar hash SHA-256 de 64 caracteres hexadecimais', () => {
    const hash = hashPhone('5586999998888', 'test_salt');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('deve ser determinístico para mesma entrada e salt', () => {
    const hash1 = hashPhone('5586999998888', 'salt_fixo');
    const hash2 = hashPhone('5586999998888', 'salt_fixo');
    expect(hash1).toBe(hash2);
  });

  it('deve gerar hashes diferentes para salts diferentes', () => {
    const hash1 = hashPhone('5586999998888', 'salt_a');
    const hash2 = hashPhone('5586999998888', 'salt_b');
    expect(hash1).not.toBe(hash2);
  });

  it('deve gerar hashes diferentes para telefones diferentes', () => {
    const hash1 = hashPhone('5586999998888', 'mesmo_salt');
    const hash2 = hashPhone('5586999997777', 'mesmo_salt');
    expect(hash1).not.toBe(hash2);
  });
});
