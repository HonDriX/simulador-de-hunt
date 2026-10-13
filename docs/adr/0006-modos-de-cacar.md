# 0006 — Modos de caçar e combos por nome do Pokémon

**Data:** 2026-10-02

## Decisão
- **Combos guardam o nome do Pokémon** (`Zoroark cds 1 a 6`), não a posição no time. O nome é procurado no time sem diferenciar acentos nem maiúsculas. O antigo `poke N` ainda é aceito ao digitar e é convertido para o nome de quem está naquela posição; combos salvos antes são convertidos ao carregar. Pokémon que não está no time gera erro ao executar ou simular.
- **Modo de caçar** = nome + lista de combos + nomes dos Pokémon do time. Não guarda cards nem danos. Há sempre pelo menos um modo ("Modo 1"), no máximo 30, com criar, duplicar, renomear e excluir. O modo selecionado é o que está em edição.
- **Trocar de modo remonta o time pelos nomes:** usa o card que já está no time; se não está, a versão mais recente da biblioteca com aquele nome. Quem não é do modo sai do time. A biblioteca só é lida.
- **Proteção contra perda:** se um Pokémon que vai sair tem alterações que não estão iguais em nenhum card da biblioteca, a troca pede confirmação. Pokémon do modo que não existe no time nem na biblioteca é deixado de fora, com aviso.
- **Backup:** ganha `modes` e `mode`; `combos` continua gravado com os combos do modo ativo. Backup sem `modes` abre como um modo único.
- Disco, crítico e ATK globais e o limite de espera do revive continuam únicos para todos os modos.

## Contexto
Hunts diferentes usam Pokémon diferentes, então alternar entre conjuntos de combos exige trocar o time. Com combos presos à posição, qualquer troca de time mudava o significado dos combos. A biblioteca já é o lugar onde os Pokémon e seus danos ficam salvos, e não deve ser alterada pela troca de modo; por isso o modo guarda apenas nomes e o time é remontado a partir do que já existe.

Consequências aceitas: renomear um Pokémon no card quebra os combos que usam o nome antigo até serem corrigidos, e dois Pokémon com o mesmo nome no time são indistinguíveis para o combo (vale o primeiro). A troca de time reaproveita `pokeCards.restore`, que reinicia box e cooldowns.
