# RegistraAI 🤖💰

> **Assistente financeiro conversacional via WhatsApp focado em registro imediato e sem atrito de receitas e despesas.**

---

## 1. Contexto e Dor Real

### O Cenário
A maioria das pessoas reconhece a importância de gerenciar o orçamento pessoal, mas abandona a prática nos primeiros 15 dias.

### A Dor Real
- **Aversão a planilhas e apps tradicionais:** O preenchimento manual em planilhas exige sentar na frente do computador, abrir arquivos pesados e classificar colunas. Aplicativos de gestão financeira costumam ser lentos, cheios de menus, telas de login e popups para upsell de assinaturas.
- **Atraso no registro ("efeito esquecimento"):** O gasto acontece no mundo real em segundos (um café, um almoço, um transporte), mas o registro é adiado para o final do dia ou da semana. Nesse intervalo, recibos são perdidos e pequenas despesas diárias desaparecem do radar.
- **Sobrecarga cognitiva:** Usuários que têm dificuldade em acompanhar gastos precisam de simplicidade radical: registrar no exato momento da compra através de um canal que já usam o dia todo (WhatsApp).

### Privacidade e Conformidade (LGPD)
O projeto adota o princípio de **Privacy by Design** e **Minimização de Dados**:
- Nenhum dado bancário sensível (senhas, agência, conta, tokens bancários) é solicitado ou armazenado.
- Os dados armazenados limitam-se ao identificador do canal de mensagem (número de WhatsApp com hash/mascaramento de exibição) e aos registros das transações informadas voluntariamente.
- Não há cruzamento de dados com birôs de crédito ou compartilhamento com terceiros.

---

## 2. Proposta de Valor (Pitch)

> **Para** pessoas que têm dificuldade de acompanhar os próprios gastos diários,  
> **o RegistraAI é** um assistente financeiro no WhatsApp  
> **que** registra receitas e despesas a partir de mensagens simples de texto, organiza os lançamentos e apresenta resumos consolidados,  
> **diferentemente de** planilhas e aplicativos convencionais que exigem preenchimento manual burocrático e estruturado.

---

## 3. Escopo do MVP 1 (Prazo: 4 Semanas)

### 3.1. Requisito Funcional Core (RF-CORE)
*Se esta funcionalidade falhar, o produto não existe.*

- **[RF-CORE] Registro Imediato via Mensagem de Texto:**
  O sistema deve receber mensagens de texto livre via WhatsApp (ex.: *"almoço 32,50"*, *"uber 18"*, *"recebi freela 450"*), interpretar com precisão o **valor numérico**, a **classificação (receita ou despesa)** e a **descrição**, persistir o lançamento no banco de dados vinculado ao usuário e retornar uma mensagem de confirmação instantânea em até 3 segundos.

---

### 3.2. Requisitos Funcionais Indispensáveis (Mínimo Viável)

| ID | Nome | Descrição |
| :--- | :--- | :--- |
| **RF01** | **Registro de Transação (RF-CORE)** | Processar texto natural simples, extrair valor, categoria preliminar e tipo (despesa/receita), persistir e confirmar. |
| **RF02** | **Consulta de Resumo Periódico** | Fornecer saldo atual e consolidado de despesas e receitas sob demanda (ex.: comando `"resumo"`, `"saldo"` ou `"mês"`). |
| **RF03** | **Desfazer / Exclusão do Último Lançamento** | Permitir ao usuário corrigir erros imediatos de digitação através de comando direto (ex.: `"desfazer"` ou `"apagar"`). |
| **RF04** | **Identificação Sem Fricção por Telefone** | Reconhecer o usuário automaticamente pelo número do WhatsApp no primeiro contato, sem formulários de cadastro ou senhas. |

---

## 4. 🚫 Lista Proibida (Fora do Escopo do MVP 1)

As seguintes ideias foram **vetadas** no MVP 1 para garantir a entrega funcional em 4 semanas:

1. **Áudio / Mensagens de Voz (Speech-to-Text / Whisper):** Risco de custo de API, latência e falhas de sotaque/ruído.
2. **OCR de Recibos, Comprovantes ou Notinhas:** Complexidade técnica desproporcional para a hipótese inicial.
3. **Integração com Open Finance / Bancos:** Alta burocracia regulatória, dependência de terceiros e instabilidade de conectores.
4. **Painel / Dashboard Web ou Aplicativo Mobile:** Duplicação desnecessária de stack; o produto deve viver 100% no WhatsApp.
5. **Gráficos complexos e exportação para PDF/Excel:** Alto esforço de geração dinâmica de mídia sem ganho de validação primária.
6. **Múltiplas Contas, Cartões de Crédito e Parcelamentos:** Regras de fechamento de fatura e parcelas adicionam complexidade excessiva ao modelo de dados.
7. **Orçamentos, Metas e Alertas Proativos:** Scheduling de lembretes e regras de limiar de gastos ficam para a fase de retenção.
8. **Contas Compartilhadas (Casal/Família) e Grupos de WhatsApp:** Desafios de permissões e privacidade relacional fora do foco individual.

---

## 5. Arquitetura Proposta para 4 Semanas

```text
[ Usuário no WhatsApp ]
         │ (Mensagem de Texto)
         ▼
[ Provedor WhatsApp / Webhook ] (Evolution API / Z-API / Baileys / Cloud API)
         │
         ▼
[ API Backend ] (FastAPI / Express / NestJS)
   ├── Extrator / Parser de Mensagem (Regex heurístico + LLM leve fallback)
   └── Regras de Negócio (Lançamentos e Balanços)
         │
         ▼
[ Banco de Dados Relacional ] (PostgreSQL / SQLite gerenciado)
   ├── Tabela 'usuarios' (id, telefone_hash, criado_em)
   └── Tabela 'transacoes' (id, usuario_id, tipo, valor, categoria, descricao, data)
```

---

## 6. Hipótese a Validar e Métricas de Sucesso

### Hipótese Central
> *"Pessoas que não controlam seus gastos por acharem planilhas trabalhosas manterão registros financeiros consistentes se puderem fazê-lo pelo WhatsApp em menos de 5 segundos por transação."*

### Critérios de Sucesso do MVP 1
- **Taxa de Conclusão do Registro:** > 90% das mensagens de registro interpretadas corretamente sem intervenção manual.
- **Tempo de Resposta do Bot:** Confirmação entregue em menos de 3 segundos.
- **Retenção de 7 Dias:** Pelo menos 40% dos usuários piloto continuam registrando gastos na segunda semana de uso.
