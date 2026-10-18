# 0007 — Preservação de dados e consistência de tempo

**Data:** 2026-10-18

## Dados e compatibilidade

- `modes` guarda todos os combos, inclusive rascunhos incompletos, com até 20 slots por modo. `mode` e `combo` guardam a seleção.
- `combos` é um espelho legado com exatamente seis slots (os seis primeiros do modo ativo, preenchidos com null quando necessário). Isso mantém compatibilidade com o trigger existente de `pokemon_saves`, sem reduzir os limites ou permissões do banco. Ao carregar, a fonte completa é `modes`.
- `automation` preserva a edição atual para leitores antigos. Na migração de um backup sem modos, uma sequência não vazia é recuperada em um slot livre ou novo, sem sobrescrever combos existentes. Se houver vinte slots ocupados, ela ganha um modo separado.
- Uma sequência incompleta pode ser guardada e exportada; a execução continua exigindo uma sequência válida.
- Os backups não incluem credenciais. As políticas de acesso por usuário e o controle de concorrência da conta permanecem ativos.

## Itens e intervalos

- Revive de 4 ou 5 minutos compartilha um cooldown global e recupera apenas o Pokémon em campo.
- A projeção passa a aplicar o mesmo intervalo após o revive que a execução na tela.
- O elixir de ATK possui cooldown global de 210 segundos. A sequência espera quando necessário; cada comando consome uma carga e o bônus se aplica a todos os golpes da próxima etapa de Pokémon.
- O elixir não acrescenta um intervalo de golpe. O tempo de espera pelo item avança todos os cooldowns.
- Ao terminar um combo com a opção de próximo lure, a troca acontece antes do intervalo final, tanto na projeção quanto na execução.
- Nova box mantém cooldowns de Pokémon e itens. Reiniciar box e CDs zera ambos.

## Verificação

`node test_hourly.js` cobre a projeção, alvos restantes e limites de tempo.
`node test_regressions.cjs` cobre migração, compatibilidade com seis slots legados, rascunhos e a equivalência entre a sequência da tela e a projeção com relógio controlado.
