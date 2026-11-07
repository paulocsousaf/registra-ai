export type TipoTransacao = 'DESPESA' | 'RECEITA';

export type CategoriaTransacao =
  | 'Alimentação'
  | 'Transporte'
  | 'Saúde'
  | 'Moradia'
  | 'Lazer'
  | 'Renda'
  | 'Outros';

export interface WebhookMessagePayload {
  messageId: string;
  senderPhone: string;
  text: string;
  timestamp: number;
}
