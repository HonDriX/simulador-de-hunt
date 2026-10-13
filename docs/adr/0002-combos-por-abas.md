# 0002 — Oito combos editados por abas

**Data:** 2026-10-02

## Decisão
- **8 combos** em vez de 6. Substituído depois pela quantidade customizável (ver 0004): padrão 6, de 1 a 20, sem completar com vazios.
- **Abas em "Configurar combos".** Um único editor; a aba escolhida é o combo em edição e os campos da tela sempre mostram esse combo.
- **Salvamento automático no combo da aba.** Toda alteração válida (etapas, comandos, intervalo, repetir) grava no combo na hora. Sequência vazia esvazia o combo; sequência ou intervalo inválido não grava e mostra o erro. Não há mais "Salvar em" nem "Salvar atual". Enviar para a conta continua sendo "Salvar alterações".
- **Pular combo foi removido** (ver 0004): com a quantidade de combos customizável, quem não quer um combo na simulação o remove. O campo `skip` de backups antigos é aceito e ignorado.

## Contexto
Antes havia um editor solto e seis espaços: para ver o Combo 2 era preciso ir à box e clicar em "Editar", e para gravar era preciso escolher o destino. Com as abas não existe mais rascunho fora de um combo, então o campo `automation` do backup perdeu a função. Ele continua no formato, com valor fixo, para que backups antigos e novos sejam validados pela mesma regra; ao carregar, ele é ignorado.
