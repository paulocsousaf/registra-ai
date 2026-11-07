import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url().optional().default('postgresql://usuario:senha@localhost:5432/registra_ai?schema=public'),
  WHATSAPP_GATEWAY_URL: z.string().url().optional().default('http://localhost:8080'),
  WHATSAPP_API_TOKEN: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  APP_SECRET_SALT: z.string().optional().default('registra_ai_default_salt'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Variáveis de ambiente inválidas:', _env.error.format());
  throw new Error('Configuração de ambiente inválida.');
}

export const env = _env.data;
