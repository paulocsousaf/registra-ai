# Regras de Governança e Diretrizes para Agentes de Código 🤖🛡️

> **Repositório:** RegistraAI  
> **Documento Vinculado:** [ESPECIFICACAO-MVP.md](file:///home/paulo/ifpi/registra-ai/ESPECIFICACAO-MVP.md) e [README.md](file:///home/paulo/ifpi/registra-ai/README.md)  
> **Finalidade:** Definir regras inegociáveis de conduta técnica, arquitetura, testes, segurança e conformidade ética para qualquer agente de IA ou desenvolvedor atuando neste projeto.

---

## 1. Imutabilidade da Especificação Funcional

1. **Vedação a Alterações Autônomas de Escopo:**
   - O agente está **terminantemente proibido** de modificar os requisitos funcionais, regras de negócio ou limites declarados em [ESPECIFICACAO-MVP.md](file:///home/paulo/ifpi/registra-ai/ESPECIFICACAO-MVP.md) sem expressa aprovação e orientação humana documentada.
2. **Defesa Ativa contra "Feature Creep" (Escopo Inflado):**
   - Sob nenhuma circunstância o agente deve sugerir ou implementar recursos pertencentes à **Lista Proibida** do MVP 1 (mensagens de voz/áudio, OCR de comprovantes, Open Finance/APIs bancárias, telas web/mobile, gráficos dinâmicos, parcelamentos complexos, grupos de WhatsApp ou orçamentos proativos).
3. **Respeito aos Contratos de Interface:**
   - As saídas conversacionais, nomes de tabelas, tipos de dados e limites numéricos já definidos na especificação são contratos sagrados. Não modifique payloads ou estruturas de dados sem justificativa técnica prévia submetida ao revisor humano.

---

## 2. Implementação Incremental Estrita (Um RF por Vez)

1. **Proibição de "Geração Monolítica de Uma Vez" (*No One-Shot Apps*):**
   - O agente **não deve** tentar gerar a aplicação inteira em um único prompt ou lote massivo de arquivos. Grandes saltos de código escondem falhas conceituais, quebram a rastreabilidade do Git e inviabilizam revisões eficientes.
2. **Ordem de Precedência Técnica Obrigatória:**
   A implementação deve seguir estritamente o grafo de dependências naturais:
   - **Fase 0 (Fundação):** Configuração de ambiente, `.env.example`, `.gitignore`, conexão com o PostgreSQL, schemas básicos e roteamento inicial de webhook.
   - **Fase 1 (RF-04):** Identificação e provisionamento silencioso de usuário pelo número de WhatsApp.
   - **Fase 2 (RF-01 - RF-CORE):** Parser e persistência de despesas/receitas via texto livre com confirmação imediata.
   - **Fase 3 (RF-03):** Mecanismo de reversão (*Soft Delete*) do último lançamento dentro da janela de 30 minutos.
   - **Fase 4 (RF-02):** Consolidação agregada e consulta de resumo/saldo mensal.
3. **Critério de Pronto (*Definition of Done - DoD*):**
   - Um Requisito Funcional só é considerado concluído quando possuir:
     1. Código fonte funcional e tipado;
     2. Validações e tratamento defensivo de erro conforme suas Regras de Negócio;
     3. Testes automatizados ou roteiro de verificação ponta a ponta executado com sucesso.

---

## 3. Obrigatoriedade de Testes para Cenários de Sucesso e Falha

1. **Cobertura Biparte Obrigatória:**
   - Para **cada** Requisito Funcional implementado, o agente deve obrigatoriamente fornecer testes automatizados (unitários e/ou integração) ou scripts de teste manual que cubram:
     - **Cenário de Sucesso (Caminho Feliz):** Validação de que entradas corretas geram a persistência e a saída visual esperadas no WhatsApp e no banco de dados.
     - **Cenário de Falha (Caminho de Exceção e Borda):** Validação de que dados ausentes, strings malformadas, valores fora dos limites (ex.: $\le 0$ ou $> 999.999,99$) ou violações de regras temporais (ex.: tentar desfazer após 30 minutos) são bloqueados com avisos amigáveis e defensivos.
2. **Determinismo nos Cálculos:**
   - Testes de conciliação financeira do RF-02 não toleram divergências de centavos. Devem ser testados casos de múltiplos lançamentos, receitas misturadas com despesas e transações desfeitas (*soft-deleted*) para comprovar que o saldo permanece matematicamente exato.
3. **Não-Regressão:**
   - A implementação de um novo RF jamais pode invalidar ou quebrar os testes dos RFs anteriores.

---

## 4. Gestão Rigorosa de Segredos e Variáveis de Ambiente

1. **Tolerância Zero para Chaves e Senhas no Código:**
   - **Nunca** escreva tokens de API (Meta, Evolution API, Z-API, Gemini, OpenAI), credenciais de banco de dados (`DATABASE_URL` com usuário/senha) ou segredos de hash no código fonte, comentários ou commits.
2. **Padronização de Arquivos de Ambiente:**
   - O arquivo `.env` deve estar explicitamente incluído no arquivo `.gitignore`.
   - O arquivo `.env.example` deve ser rigorosamente mantido e atualizado com todas as variáveis exigidas pela aplicação, utilizando apenas valores fictícios ou placeholders instrutivos:
     ```env
     # Exemplo de configuração (.env.example)
     PORT=3000
     DATABASE_URL=postgresql://usuario:senha@localhost:5432/registra_ai
     WHATSAPP_GATEWAY_URL=http://localhost:8080
     WHATSAPP_API_TOKEN=seu_token_aqui
     GEMINI_API_KEY=sua_api_key_aqui
     APP_SECRET_SALT=chave_aleatoria_para_hash_telefone
     ```
3. **Inspeção Pré-Commit:**
   - Antes de sugerir comandos de commit, o agente deve inspecionar as alterações (`git diff` / `git status`) para assegurar que nenhum dado sensível esteja prestes a ser versionado.

---

## 5. Protocolo de Comportamento perante Ambiguidade

1. **Parar e Questionar (*Stop and Clarify*):**
   - Se houver conflito entre requisitos, bibliotecas descontinuadas, ambiguidades de regras de negócio ou indefinição arquitetural, o agente **não deve presumir ou inventar soluções complexas**.
   - O agente deve interromper o raciocínio de código, expor o dilema de forma concisa e apresentar as opções viáveis com prós e contras para decisão do desenvolvedor humano.
2. **Priorizar a Simplicidade (Princípio KISS e YAGNI):**
   - Na dúvida entre uma solução hiper-abstrata (microsserviços, message brokers pesados como Kafka/RabbitMQ) e uma abordagem direta (fila simples in-memory, job assíncrono simples ou execução síncrona transacional), opte sempre pela arquitetura mais enxuta compatível com o MVP de 4 semanas.

---

## 6. Diretrizes Éticas, de Privacidade e Domínio de Negócio (LGPD)

1. **Princípio da Minimização de Dados (*Data Minimization*):**
   - O RegistraAI processa dados financeiros pessoais, que exigem cautela extrema. Colete estritamente o necessário: número de telefone e o registro textual de gastos/receitas.
   - É **proibido** criar tabelas ou colunas para armazenar dados como CPF, número de cartão de crédito, código de segurança (CVV), agência, conta ou senhas bancárias.
2. **Mascaramento e Higienização de Logs:**
   - Logs de aplicação (stdout, arquivos de log, serviços de telemetria) **jamais devem exibir o número de telefone completo** ou mensagens que contenham dados identificáveis. Use mascaramento:
     - *Correto:* `[INFO] Transação processada para o usuário 5586*****1234`
     - *Incorreto:* `[INFO] Mensagem recebida de 5586999991234: "comprei antidepressivo 120"`
3. **Isolamento Absoluto entre Contas:**
   - Cada consulta (`SELECT`, `UPDATE`, `DELETE`) deve conter obrigatoriamente a cláusula de restrição de escopo pelo `usuario_id`. Vazamento de dados entre usuários diferentes em um chatbot conversacional é uma falha crítica de segurança de severidade máxima.
4. **Cálculo Determinístico vs. Inteligência Artificial:**
   - A IA (LLM/Regex) deve ser usada **exclusivamente para interpretação e extração de intenções/valores** da linguagem natural.
   - **Nunca use LLMs para somar, subtrair ou calcular balanços.** Cálculos matemáticos e totalizadores devem ser executados 100% de forma determinística pelo banco de dados relacional (PostgreSQL `SUM`, `DECIMAL`) ou pelo motor de backend.
5. **Neutralidade e Respeito:**
   - O assistente é uma ferramenta neutra de registro e visualização contábil. É proibido programar o assistente para emitir juízos morais, sarcasmo ou aconselhamento de investimentos invasivo sobre como o usuário gasta seu dinheiro (ex.: recriminar compras em bares, jogos ou fast-food).
