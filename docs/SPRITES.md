# Sprites das pessoas

O jogo desenha todo mundo em código: os moradores originais e o protagonista com visual próprio, e as pessoas da série com o manto neutro. Você pode trocar qualquer um por uma imagem sua.

## Formato
- PNG de **48 x 128** pixels, fundo transparente.
- 3 colunas: parado, passo 1, passo 2.
- 4 linhas: olhando para baixo, esquerda, direita, cima.
- Cada quadro tem **16 x 32**. Os pés ficam na última linha do quadro, no centro.
- Modelo pronto: `sprites/modelo.png` (tamanho real) e `docs/modelo-ampliado.png` (com grade).

## Como colocar no jogo
1. Salve a imagem em `sprites/`, por exemplo `sprites/rem.png`.
2. Em `js/sprites.js`, tire o `//` da linha da pessoa.
3. Recarregue o jogo. Se a imagem faltar, o visual padrão volta sozinho.

Ids: `player`, `emilia`, `rem`, `ram`, `beatrice`, `roswaal`, `petra`, `marta`, `tomas`, `bento`.

Para ver o visual padrão de todos: `node tests/sprites_preview.js` (com o servidor em 8765). Gera `/tmp/preview.png` e atualiza o modelo.
