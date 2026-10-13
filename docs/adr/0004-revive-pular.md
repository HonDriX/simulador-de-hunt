# 0004 — Revive pulável e quantidade de combos customizável

**Data:** 2026-10-02

## Decisão
- **Quantidade de combos customizável**: começa com 6 e vai de 1 a 20, com "+" na barra de abas e "Remover combo" no editor. Remover renumera os combos seguintes. As abas podem ser arrastadas (ou movidas com Alt + ← / →) para reordenar; a ordem dos combos é a ordem da volta nas simulações. O backup guarda a lista do tamanho que estiver e é carregado sem completar com vazios. Com isso, o antigo "Pular na simulação de 1h" por combo deixou de existir.
- **Revive pulável.** A etapa `revive pular` / `revive 4 pular` (checkbox "pular se em cooldown" no construtor) olha o cooldown ao ser alcançada: se falta até o limite, espera e usa; se falta mais, o resto do combo não roda nessa volta. Revive sem a opção continua sempre esperando.
- **Limite único** "Esperar o revive até (s)" na Box de treino, padrão 5s, salvo no backup como `reviveWait` (0 a 300).
- **Cada combo continua valendo uma box.**
  - Revive pulável antes de qualquer golpe (combo de box nova): o combo é pulado inteiro, não conta box e não gasta tempo.
  - Revive pulável depois de algum golpe (segunda rajada na mesma box): a box conta e os mobs vivos vão para as targets.
- **Trava contra giro em falso.** Se uma volta inteira é pulada sem o tempo andar, a simulação avança o relógio até o revive caber no limite.
- **Teste de voltas configurável** (1 a 20), para ver o revive alternando de posição entre as voltas.

## Contexto
Com o revive de 4 min, a volta dos combos não coincide com o cooldown, então a posição em que o revive está disponível muda a cada volta. A alternativa de dar a cada combo uma segunda sequência "com revive" foi descartada: o revive pulável resolve com um editor só e decide na própria linha, com o cooldown real daquele momento. Tratar o trecho pós-revive como uma box dentro do mesmo combo também foi descartado; combos extras deixam explícito o que é box nova e o que é a mesma box.
