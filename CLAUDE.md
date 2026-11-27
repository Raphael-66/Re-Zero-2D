# Re:Zero 2D — guia para o Claude

Jogo de fã 2D (estilo Stardew Valley) inspirado em Re:Zero, em **português do Brasil**. Dono: Raphael-66. Irmão do repositório `return-from-death-zero-` (jogo de cartas/menus), de onde vêm a história, os personagens e as ideias de sistemas.

## Regras do projeto
- Texto do jogo e conversas com o dono em **português do Brasil**, tom leve e caloroso, frases curtas.
- Personagens da série podem aparecer, mas **sem reproduzir falas ou textos oficiais**. Nada de arte oficial, e **não desenhar os personagens da série**: eles usam o mesmo manto neutro (`NEUTRO` em `js/data.js`) com o nome em cima. Só o protagonista e os moradores originais (Marta, Tomás, Bento) têm visual próprio.
- Romance e família sempre leves e adequados.
- Precisa funcionar **offline** e no **celular** (390 px de largura é a referência).
- **Nunca quebre saves antigos** (`rz2d_save` no `localStorage`): campo novo precisa de padrão em `defState` e ajuste em `normalize`.

## Arquivos
- `index.html`: CSS, HUD, botões, diálogo, painel e tela inicial.
- `js/data.js`: mapas (montados por código: `house`, `rect`, `ellipse`, `scatter`), tiles sólidos (`SOLID`), casas, itens, peixes, pessoas e rotinas (`sched: [hora, mapa, x, y, direção]`), falas (`TALK`, `GIFT`), tarefas.
- `js/game.js`: motor. Tiles desenhados em código (`drawTile`, cache por mapa+estação em `mapCanvas`), pessoas (`drawPerson`), ícones (`icon`), NPCs com caminho por BFS, relógio e dias (`sleep`, `passOut`), pesca (`F`, `updateFish`), diálogos (`say`), painéis (`openPanel`, `TAB`). `window.RZG` expõe funções para os testes.
- `sw.js`: service worker. **Troque `V` a cada atualização.**
- `tests/smoke.js`: teste com Playwright (precisa de `python3 -m http.server 8765` na raiz).

## Fluxo de uma atualização
1. Editar; `node --check js/*.js`.
2. Rodar `tests/smoke.js` e olhar os prints em `/tmp`.
3. Trocar a versão em `sw.js`, atualizar `docs/HISTORICO.md`.
4. Commit em português e push na `main`.
