# Especificação Técnica do MVP 1 - RegistraAI 📋

> **Documento de Requisitos de Engenharia de Software**  
> **Versão:** 1.0.0  
> **Prazo de Execução:** 4 semanas  
> **Status:** Aprovado para Desenvolvimento  

---

## 1. Visão Geral da Arquitetura Funcional

Este documento estabelece a especificação formal e não ambígua dos 4 Requisitos Funcionais indispensáveis que compõem o MVP 1 do **RegistraAI**. O objetivo primordial é mitigar riscos de implementação, evitar estouro de escopo (*scope creep*) e fornecer critérios objetivos de aceitação e teste.

```
+-------------------------------------------------------------------------------+
|                                JORNADA DO MVP 1                               |
|                                                                               |
|  [Mensagem WhatsApp]                                                          |
|          |                                                                    |
|          v                                                                    |
|  +---------------+    Não existe?     +------------------+                    |
|  |     RF-04     | -----------------> | Provisionamento  |                    |
|  | Identificação |                    | Silencioso User  |                    |
|  +---------------+                    +------------------+                    |
|          |                                     |                              |
|          +-----------------+-------------------+                              |
|                            |                                                  |
|                            v                                                  |
|                   [Classificação Texto]                                       |
|                            |                                                  |
|            +---------------+---------------+                                  |
|            |                               |                                  |
|            v                               v                                  |
|     +-------------+                 +-------------+                           |
|     |    RF-01    |                 | RF-02/RF-03 |                           |
|     |  Registro   |                 | Resumo ou   |                           |
|     |  Transação  |                 |  Desfazer   |                           |
|     +-------------+                 +-------------+                           |
+-------------------------------------------------------------------------------+
```

---

## 2. Especificação Detalhada dos Requisitos Funcionais

---

### RF-01: Registro Imediato de Transação (RF-CORE)

#### Ator
Usuário final autenticado implicitamente pelo identificador único do WhatsApp.

#### Entradas
- `mensagem_texto`: String UTF-8 contendo a descrição e o valor da operação.
  - **Formatos aceitos:** 
    - Sintaxe livre com valor numérico e rótulo textual: ex. `"almoço 35"`, `"almoço 35,50"`, `"gastei 120 no mercado"`, `"recebi 1500 salario"`, `"+300 freela"`, `"-45 farmacia"`.
    - Separadores decimais aceitos: vírgula (`,`) ou ponto (`.`).
    - Prefixo monetário opcional: `"R$"`, `"r$"`.
  - **Limites máximos e mínimos:**
    - Comprimento da string: mínimo de 3 caracteres, máximo de 255 caracteres.
    - Valor monetário: mínimo de **R$ 0,01**, máximo de **R$ 999.999,99**.
- `timestamp_mensagem`: Unix timestamp fornecido pelo webhook do WhatsApp.
- `message_id`: String alfanumérica única fornecida pelo gateway (usada para deduplicação).

#### Regras de Negócio
- **RN-01.1 (Detecção de Tipo da Transação):**
  - O sistema classifica como `RECEITA` se a mensagem contiver termos explícitos como `"recebi"`, `"ganhei"`, `"salario"`, `"deposito"`, `"pix recebido"` ou o prefixo `"+"`.
  - O sistema classifica como `DESPESA` se contiver termos como `"gastei"`, `"comprei"`, `"paguei"`, `"-"` ou se não houver operador explícito (comportamento padrão orientado a gastos cotidianos: ex. `"padaria 15"` é despesa).
- **RN-01.2 (Extração e Parsing Numérico):**
  - O parser isola o primeiro valor numérico válido da mensagem.
  - Valores negativos explícitos são normalizados para número positivo, definindo o tipo como `DESPESA`.
  - Valores menores que R$ 0,01 ou maiores que R$ 999.999,99 são sumariamente rejeitados.
- **RN-01.3 (Categorização Preliminar Automática):**
  - O sistema associa a transação a uma categoria fixa via correspondência de palavras-chave:
    - *Alimentação:* almoço, jantar, lanche, padaria, restaurante, comida, ifood, mercado.
    - *Transporte:* uber, 99, gasolina, combustivel, onibus, pedagio, estacionamento.
    - *Saúde:* farmacia, remedio, consulta, medico, dentista.
    - *Moradia:* aluguel, luz, agua, internet, condomínio.
    - *Lazer:* cinema, cerveja, bar, show, festa.
    - *Renda (para receitas):* salario, freela, rendimento, pix.
    - *Outros:* fallback para mensagens sem correspondência taxativa.
- **RN-01.4 (Data do Lançamento):**
  - A data de competência é sempre a data e hora do recebimento da mensagem no fuso horário oficial (`America/Sao_Paulo` / UTC-3). Não há suporte a datas retroativas manuais no MVP 1.
- **RN-01.5 (Idempotência e Prevenção de Duplo Registro):**
  - Mensagens com o mesmo `message_id` recebidas em uma janela de 60 segundos são ignoradas, prevenindo reenvios automáticos de rede.

#### Saída Observável
- **Interface WhatsApp:** Mensagem de texto formatada com feedback instantâneo (latência < 3s):
  ```text
  ✅ Lançamento registrado!
  • Tipo: 🔴 Despesa
  • Valor: R$ 35,00
  • Descrição: almoço
  • Categoria: Alimentação
  
  💡 Digite "desfazer" se registrou por engano.
  ```
- **Banco de Dados (Tabela `transacoes`):**
  - Inserção de uma nova tupla:
    - `id`: UUID (v4)
    - `usuario_id`: UUID (chave estrangeira para `usuarios.id`)
    - `tipo`: VARCHAR(10) (`'DESPESA'` ou `'RECEITA'`)
    - `valor`: DECIMAL(10,2) (ex. `35.00`)
    - `descricao`: VARCHAR(150) (ex. `"almoço"`)
    - `categoria`: VARCHAR(50) (ex. `"Alimentação"`)
    - `data_transacao`: TIMESTAMP WITH TIME ZONE
    - `deletado_em`: NULL

#### Cenário de Sucesso (BDD)
```gherkin
Cenário: Registro de despesa comum em linguagem natural
  Dado que o usuário está ativo no sistema
  Quando envia a mensagem "almoço 35,00" via WhatsApp
  Então o sistema deve extrair o valor 35.00 e o tipo "DESPESA"
  E deve categorizar como "Alimentação"
  E deve salvar o registro na tabela "transacoes"
  E deve responder via WhatsApp com a confirmação formatada em menos de 3 segundos
```

#### Cenário de Falha (BDD)
```gherkin
Cenário: Tentativa de registro sem valor numérico identificável
  Dado que o usuário envia a mensagem "comprei um tênis novo hoje no shopping"
  Quando o motor de parsing processa o texto
  Então nenhum valor monetário válido é extraído
  E o sistema NÃO deve persistir nenhum registro no banco de dados
  E deve responder com aviso: "⚠️ Não identifiquei o valor. Envie o que foi gasto/recebido e o valor numérico. Exemplo: 'almoço 35' ou 'recebi 200'."
```

---

### RF-02: Consulta de Resumo / Saldo Consolidado

#### Ator
Usuário final autenticado pelo identificador do WhatsApp.

#### Entradas
- `comando_texto`: String com palavra-chave de invocação.
  - **Valores aceitos (case-insensitive, com ou sem acentos):**
    `"resumo"`, `"saldo"`, `"relatorio"`, `"gastos"`, `"extrato"`, `"mes"`, `"mês"`.
  - **Limite máximo:** 50 caracteres.

#### Regras de Negócio
- **RN-02.1 (Escopo Temporal Padrão):**
  - O cálculo abrange rigorosamente do primeiro dia do mês civil vigente às 00:00:00 até o momento atual no fuso horário `America/Sao_Paulo`.
- **RN-02.2 (Fórmula de Consolidação):**
  - $Total_{Receitas} = \sum valor$ onde $tipo = 'RECEITA'$, $deletado\_em \text{ IS NULL}$ e $data \ge \text{inicio\_mes}$.
  - $Total_{Despesas} = \sum valor$ onde $tipo = 'DESPESA'$, $deletado\_em \text{ IS NULL}$ e $data \ge \text{inicio\_mes}$.
  - $Saldo_{Mes} = Total_{Receitas} - Total_{Despesas}$.
- **RN-02.3 (Formatação de Moeda):**
  - Exibição obrigatória no formato contábil brasileiro: `R$ #.##0,00`.
- **RN-02.4 (Ausência de Movimentação):**
  - Caso não existam lançamentos no mês corrente, o sistema exibe valores zerados (`R$ 0,00`), mantendo a estabilidade da interface sem retornar erros genéricos.

#### Saída Observável
- **Interface WhatsApp:** Mensagem consolidada em texto plano:
  ```text
  📊 Resumo Financeiro - Outubro/2026

  🟢 Total de Receitas: R$ 2.500,00
  🔴 Total de Despesas: R$ 1.340,50
  ────────────────────────
  💰 Saldo do Mês: R$ 1.159,50
  
  Total de transações ativas: 18
  ```
- **Banco de Dados:**
  - Nenhuma escrita realizada. Operação estritamente de leitura (`SELECT` agregador indexado por `usuario_id` e `data_transacao`).

#### Cenário de Sucesso (BDD)
```gherkin
Cenário: Usuário solicita resumo com transações cadastradas
  Dado que o usuário possui R$ 2.500,00 de receitas e R$ 1.340,50 de despesas registradas no mês corrente
  Quando o usuário envia a mensagem "resumo"
  Então o sistema calcula a soma das receitas, a soma das despesas e o saldo líquido de R$ 1.159,50
  E responde via WhatsApp com a mensagem detalhada em menos de 2 segundos
```

#### Cenário de Falha (BDD)
```gherkin
Cenário: Usuário solicita resumo sem possuir transações no período
  Dado que o usuário iniciou o uso recentemente e possui 0 transações no mês atual
  Quando o usuário envia a mensagem "saldo"
  Então o sistema não gera exceção
  E responde com: "📊 Você ainda não tem lançamentos registrados em Outubro/2026. Envie algo como 'mercado 80' para começar!"
```

---

### RF-03: Desfazer / Exclusão do Último Lançamento

#### Ator
Usuário final autenticado pelo identificador do WhatsApp.

#### Entradas
- `comando_texto`: String de cancelamento.
  - **Valores aceitos (case-insensitive):**
    `"desfazer"`, `"apagar"`, `"cancelar"`, `"excluir"`, `"voltar"`.
  - **Limite máximo:** 30 caracteres.

#### Regras de Negócio
- **RN-03.1 (Alvo da Operação):**
  - O sistema seleciona estritamente a última transação ativa do usuário remetente:
    `WHERE usuario_id = :id AND deletado_em IS NULL ORDER BY data_transacao DESC LIMIT 1`.
- **RN-03.2 (Janela Temporal de Tolerância):**
  - A operação só é permitida se a transação alvo tiver sido criada há menos de **30 minutos**. Transações mais antigas não são passíveis de exclusão por este comando no MVP 1 (proteção contra deleção acidental de histórico consolidado).
- **RN-03.3 (Soft Delete Obrigatório):**
  - A transação nunca é excluída fisicamente do banco de dados (`DELETE FROM`). O sistema preenche a coluna `deletado_em = CURRENT_TIMESTAMP`, preservando a rastreabilidade e integridade para fins de auditoria.
- **RN-03.4 (Impacto Imediato no Balanço):**
  - Qualquer consulta subsequente ao resumo financeiro (RF-02) ignora imediatamente o registro marcado com `deletado_em`.

#### Saída Observável
- **Interface WhatsApp:** Confirmação explícita do item removido:
  ```text
  🗑️ Lançamento desfeito com sucesso!
  • Removido: Almoço (R$ 35,00)
  
  Seu saldo foi recalculado automaticamente.
  ```
- **Banco de Dados (Tabela `transacoes`):**
  - Execução de `UPDATE transacoes SET deletado_em = NOW() WHERE id = :transacao_id`.

#### Cenário de Sucesso (BDD)
```gherkin
Cenário: Usuário erra o valor digitado e cancela dentro do prazo
  Dado que o usuário registrou um gasto incorreto de "almoço 350" há 2 minutos
  Quando o usuário envia o comando "desfazer"
  Então o sistema localiza a última transação ativa do usuário
  E atualiza a coluna "deletado_em" com a data e hora atual
  E responde via WhatsApp confirmando a remoção do item de R$ 350,00
```

#### Cenário de Falha (BDD)
```gherkin
Cenário: Tentativa de desfazer quando não há transação recente elegível
  Dado que o usuário realizou seu último lançamento há 45 minutos (acima do limite de 30 min)
  Quando o usuário envia o comando "desfazer"
  Então o sistema bloqueia a operação sem alterar registros no banco
  E responde com aviso: "⚠️ Nenhuma transação recente encontrada para desfazer (limite de 30 minutos). Suas transações permanecem salvas."
```

---

### RF-04: Identificação Sem Fricção por Número de Telefone

#### Ator
Sistema (execução transparente e automática disparada pelo evento da mensagem).

#### Entradas
- `remetente_id`: String contendo o identificador telefônico bruto fornecido no payload do gateway (ex.: `"5586999998888@s.whatsapp.net"` ou `"5586999998888"`).
- **Limites:** Obrigatório, não nulo, comprimento entre 10 e 30 caracteres.

#### Regras de Negócio
- **RN-04.1 (Normalização e Higienização):**
  - O sistema limpa caracteres especiais, sufixos de mensageiro (`@s.whatsapp.net`) e normaliza o número no padrão E.164 (código do país + DDD + número: ex. `5586999998888`).
- **RN-04.2 (Provisionamento Just-in-Time / Silencioso):**
  - Se o `remetente_id` não existir na tabela `usuarios`, o sistema insere o usuário instantaneamente antes de processar a mensagem original.
  - O fluxo da mensagem recebida não é interrompido ou suspenso para preenchimento de cadastros.
- **RN-04.3 (Mensagem de Onboarding no Primeiro Contato):**
  - Na primeira interação daquele número, o sistema anexa uma introdução curta de boas-vindas antes do feedback do comando:
    ```text
    👋 Olá! Bem-vindo ao RegistraAI.
    Sua conta foi criada automaticamente com base no seu número de WhatsApp.
    ```
- **RN-04.4 (Conformidade com LGPD - Minimização de Dados):**
  - Nenhum dado pessoal adicional (CPF, e-mail, nome de batismo, dados bancários) é requisitado ou coletado. O número telefônico é tratado sob a base legal de execução de contrato/prestação do serviço solicitado pelo titular.

#### Saída Observável
- **Interface WhatsApp:**
  - Primeira interação: Saudação de boas-vindas seguida do resultado da ação executada.
  - Interações recorrentes: Resposta direta ao comando sem mensagens redundantes de boas-vindas.
- **Banco de Dados (Tabela `usuarios`):**
  - Inserção de registro na primeira mensagem:
    - `id`: UUID (v4)
    - `telefone`: VARCHAR(20) (E.164 normalizado, UNIQUE)
    - `telefone_hash`: CHAR(64) (SHA-256 do telefone com Salt do sistema para integridade)
    - `criado_em`: TIMESTAMP WITH TIME ZONE
    - `ultimo_acesso`: TIMESTAMP WITH TIME ZONE

#### Cenário de Sucesso (BDD)
```gherkin
Cenário: Novo usuário envia sua primeira mensagem com um gasto
  Dado que um número de telefone novo ("5586999998888") envia "mercado 60"
  Quando o backend intercepta a chamada de webhook
  Então cria automaticamente o registro na tabela "usuarios"
  E associa a despesa de R$ 60,00 ao ID do novo usuário
  E responde com mensagem combinada contendo boas-vindas e a confirmação do lançamento
```

#### Cenário de Falha (BDD)
```gherkin
Cenário: Payload do webhook sem identificador de remetente válido
  Dado que a requisição de webhook do WhatsApp chega corrompida ou sem o campo do remetente
  Quando o middleware de autenticação/validação inspeciona o payload
  Então a requisição é rejeitada imediatamente com código HTTP 400 Bad Request
  E nenhum registro de usuário ou transação é criado no banco de dados
  E um log de erro de segurança/integração é gravado
```

---

## 3. Limitações Declaradas do MVP 1

Para salvaguardar o prazo inegociável de 4 semanas, as seguintes restrições de engenharia são contratualmente assumidas:

1. **Canal Estritamente Textual:**
   - O assistente processa exclusivamente texto plano. Mensagens de voz/áudio, imagens, PDFs, vídeos, contatos ou localização não são processados e recebem resposta orientativa automática solicitando texto.
2. **Moeda Exclusiva:**
   - Suporte unicamente a Real Brasileiro (BRL / R$). Lançamentos em moedas estrangeiras (USD, EUR) ou criptoativos estão fora do escopo.
3. **Escopo de Balanço Fixo no Mês Calendário:**
   - Consultas de saldo e resumo aplicam-se exclusivamente ao mês civil corrente. Não há filtros dinâmicos de período (ex. *"gastos de ontem"*, *"semana passada"* ou *"ano de 2025"*).
4. **Ausência de Regime de Competência para Parcelamentos:**
   - Não há lógica de compras parceladas (ex. *"10x de 50"*). Se o usuário registrar *"compra 500"*, todo o montante impactará o mês da mensagem.
5. **Sem Conexões Externas com Bancos (Zero Open Finance):**
   - Não há leitura automática de extratos bancários, webhooks de instituições financeiras ou leitura de notificações de push de apps de banco.
6. **Contas Individuais (Monousuário por Chat):**
   - O identificador de sessão é estritamente 1:1. Mensagens enviadas dentro de grupos de WhatsApp são ignoradas pelo bot para proteção de privacidade.

---

## 4. Stack Tecnológica Inicial

A seleção de tecnologia foi balizada pelo menor tempo de desenvolvimento (*Time-to-Market*), custo operacional zero/mínimo durante a validação e facilidade de deploy:

| Componente | Tecnologia Escolhida | Justificativa Arquitetural |
| :--- | :--- | :--- |
| **Gateway WhatsApp** | **Evolution API** (Self-hosted) ou **Z-API** | Permite integração rápida via Webhooks HTTP e envio via REST sem burocracia de aprovação de templates corporativos da Meta no período de teste inicial. |
| **Backend Framework** | **TypeScript + Node.js (Fastify)** *ou* **Python (FastAPI)** | I/O assíncrono de alta performance para gerenciar webhooks simultâneos com baixíssima latência e validação robusta de tipos (Zod / Pydantic). |
| **Motor de Extração** | **Expressões Regulares (Regex) + LLM Fallback (Gemini 1.5 Flash)** | Pipeline em 2 estágios: 80% das mensagens comuns são resolvidas em menos de 10ms via Regex local a custo zero. Mensagens ambíguas caem na LLM leve com chamada estruturada (JSON mode). |
| **Banco de Dados** | **PostgreSQL 15+** | Confiabilidade ACID para operações financeiras, integridade referencial nativa e suporte a tipos numéricos precisos (`DECIMAL(10,2)`). |
| **Camada de Acesso a Dados** | **Prisma ORM** (Node.js) ou **SQLAlchemy / SQLModel** (Python) | Migrações seguras e geração de schemas tipados para velocidade de desenvolvimento sem SQL manual vulnerável. |
| **Hospedagem & Infra** | **Render / Railway / VPS Dockerizada** | Deploy contínuo simplificado a partir do Git, com separação de ambientes de *Staging* e *Production*. |
