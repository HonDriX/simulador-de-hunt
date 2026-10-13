# 0005 — Pokémon para o próximo lure

**Data:** 2026-10-02

## Decisão
- **Opção por combo** (`pullNext`, checkbox "Ao terminar, puxar o Pokémon do próximo lure"): ao fim do combo, o primeiro Pokémon do próximo combo sai da ball.
- **Próximo combo** é o seguinte na ordem das abas, voltando ao primeiro depois do último, mesmo que ele venha a ser pulado pelo revive. Se o pulado também tiver a opção, ele puxa o Pokémon do combo depois dele; nada precisa prever o futuro.
- **Momento da troca:** depois da última etapa executada e **antes das targets**. Vale também quando a box fecha no meio do combo e quando o revive é pulado (combo inteiro ou só o resto).
- **Box ao vivo:** mesma regra ao concluir a sequência, ao fechar a box e ao pular no revive, com aviso de quem saiu da ball. Com "Repetir" ligado a opção não se aplica.

## Contexto
Fora da ball o cooldown recupera 1s por segundo; dentro, só na taxa do disco. Como o tempo entre boxes é zero na simulação, trocar só quando o próximo combo começa não dá vantagem nenhuma: a opção só faz diferença se a troca acontecer antes das targets, que não pertencem a nenhum Pokémon específico. O custo é guardar o Pokémon atual mais cedo, o que pode atrasar o combo em que ele voltar; por isso é opção por combo e não regra geral.
