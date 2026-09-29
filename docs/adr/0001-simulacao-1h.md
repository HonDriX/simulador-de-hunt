# 0001 — Simulação de 1h na box de treino

**Data:** 2026-09-29

## Decisão
`hourly.js` estima quantos mobs morrem em 1h executando todos os combos salvos em ordem cíclica (1, 2, …, N, 1, …), cada um em uma box de 6 alvos.

- **Por eventos, sem relógio real.** O tempo salta direto para o fim do cooldown ou do intervalo do combo usando `CooldownEngine.advance`, então valem as mesmas regras da tela: fora da ball recupera 1s/s, dentro da ball 1s a cada `disk` segundos, e sem disco não recupera.
- **Hora inteira, não uma rotação só.** A primeira rotação começa com todos os cooldowns prontos e seria otimista. Os cooldowns continuam de uma box para a outra.
- **Toda box conta 6 mobs.** Na prática nunca se deixa mob para trás; se o combo não fecha, o log do combo registra a falha, quantos mobs sobraram e a vida média restante.
- **Tempo entre boxes = 0.** O limite real é o cooldown do primeiro Pokémon do combo seguinte, que a simulação já espera.
- **O intervalo do combo é o tempo de reação** entre golpes. A latência do tick de 100 ms da automação ao vivo não entra.
- **Resultado em boxes inteiras:** conta as boxes concluídas até 3600s inclusive (mobs = boxes × 6). Quando todos os alvos morrem, vale o instante da última morte (`finishedAt`), mesmo que o intervalo posterior ultrapasse 1h. Esse intervalo continua avançando os cooldowns normalmente. Se restarem alvos para finalizar com target, mantém-se o fim do combo como referência. A box concluída depois de 1h não entra; não há taxa fracionária.
- **Monte Carlo:** 100 horas por clique (~150 ms), com mediana, p10 e p90 de boxes, porque o crítico é sorteado por hit.

## Contexto
A box da tela continua com 8 dummies; só a simulação usa 6 (`newBox(count)`). A flag "repetir" do combo é ignorada: cada combo roda uma vez por box.
