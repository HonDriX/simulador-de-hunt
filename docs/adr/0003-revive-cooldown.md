# 0003 — Cooldown do revive e teste de 2 voltas

**Data:** 2026-10-02

## Decisão
- **O revive tem cooldown.** `revive` vale 5 min e `revive 4` vale 4 min. Os dois dividem um contador único (`state.reviveRemaining`); a duração vem do revive usado.
- **Tempo real.** O contador desce em `CooldownEngine.advance`, igual dentro ou fora da ball, e para junto com a simulação pausada. "Reiniciar box e CDs" zera; "Nova box · manter CDs" mantém.
- **Regra em um lugar só:** `CooldownEngine.revive(state, cooldown)` é usada pela box ao vivo e pelas simulações.
- **Revive em cooldown espera.** A sequência aguarda o revive liberar e anota o tempo perdido. Na box, a mensagem mostra quanto falta e, ao usar, quanto esperou. Nas simulações, o tempo de espera entra no tempo da box e o resultado mostra quantas vezes e por quanto tempo cada combo esperou.
- **Teste de 2 voltas** (`simulateLaps` em `hourly.js`): roda os combos não pulados duas vezes em ordem, com as mesmas regras da simulação de 1h e 100 execuções. Para cada volta e combo informa se o dano fechou, o que sobrou, o cooldown do revive no início e no fim da box e o tempo de espera pelo revive.

## Contexto
Antes o revive era ilimitado, o que deixava a simulação otimista para qualquer combo que dependesse dele. O teste tem duas voltas porque na primeira o revive está sempre carregado; é a segunda que mostra se ele está na posição certa do lure. Como duas voltas costumam durar menos que o cooldown, o ciclo longo continua sendo responsabilidade da simulação de 1h, que agora mostra quantas vezes por hora cada combo esperou pelo revive.
