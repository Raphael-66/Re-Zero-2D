/* Re:Zero 2D — dados do jogo (mapas, pessoas, itens, peixes, falas).
   Jogo de fã, sem fins lucrativos. Textos e desenhos são originais. */
(function () {
  "use strict";
  var RZ = (window.RZ = {});

  /* ---------- utilidades ---------- */
  function rng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  RZ.rng = rng;

  function mk(w, h, ch) {
    var g = [];
    for (var y = 0; y < h; y++) {
      var r = [];
      for (var x = 0; x < w; x++) r.push(ch);
      g.push(r);
    }
    return { w: w, h: h, g: g };
  }
  function set(m, x, y, c) {
    if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.g[y][x] = c;
  }
  function get(m, x, y) {
    return x >= 0 && y >= 0 && x < m.w && y < m.h ? m.g[y][x] : null;
  }
  function rect(m, x, y, w, h, c) {
    for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) set(m, i, j, c);
  }
  function ellipse(m, cx, cy, rx, ry, c) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(m, x, y, c);
      }
  }
  function border(m, c, th, gaps) {
    for (var y = 0; y < m.h; y++)
      for (var x = 0; x < m.w; x++) {
        if (x < th || y < th || x >= m.w - th || y >= m.h - th) {
          var gap = false;
          (gaps || []).forEach(function (g) {
            if (x >= g[0] && x <= g[1] && y >= g[2] && y <= g[3]) gap = true;
          });
          if (!gap) set(m, x, y, c);
        }
      }
  }
  /* casa: telhado em cima, 2 fileiras de parede embaixo, porta na última */
  function house(m, x, y, w, h, doorX, roof, wall, win, door) {
    rect(m, x, y, w, h - 2, roof);
    rect(m, x, y + h - 2, w, 2, wall);
    for (var i = x + 1; i < x + w - 1; i += 2) if (Math.abs(i - doorX) > 1) set(m, i, y + h - 2, win);
    set(m, doorX, y + h - 1, door);
  }
  function scatter(m, seed, n, chars, ok) {
    var r = rng(seed);
    for (var k = 0; k < n; k++) {
      var x = Math.floor(r() * m.w), y = Math.floor(r() * m.h);
      if (ok(x, y)) set(m, x, y, chars[Math.floor(r() * chars.length)]);
    }
  }

  /* ---------- tiles ---------- */
  // sólidos: árvore, pinheiro, sebe, cerca, pedra, paredes, telhados, fonte, poço, móveis
  RZ.SOLID = "TPhFrWVwvRQoO#BLtskpXSmy";
  RZ.GROUND = ".,f:=_cb";

  /* ---------- mapas ---------- */
  var maps = (RZ.maps = {});

  // Mansão (exterior)
  (function () {
    var m = mk(44, 34, ".");
    border(m, "T", 2, [[20, 23, 30, 33]]);
    house(m, 8, 2, 28, 10, 21, "Q", "V", "v", "E");
    set(m, 22, 11, "E");
    rect(m, 17, 12, 10, 3, "=");
    rect(m, 21, 15, 2, 19, "=");
    rect(m, 18, 17, 8, 5, "=");
    rect(m, 20, 18, 4, 3, "o");
    rect(m, 6, 16, 10, 1, "h");
    rect(m, 28, 16, 10, 1, "h");
    rect(m, 6, 17, 10, 6, ".");
    rect(m, 28, 17, 10, 6, ".");
    scatter(m, 7, 70, "f", function (x, y) { return ((x >= 6 && x < 16) || (x >= 28 && x < 38)) && y >= 17 && y < 23; });
    ellipse(m, 10, 27, 4.2, 2.6, "~");
    set(m, 25, 13, "X");
    set(m, 19, 29, "S");
    scatter(m, 11, 40, "TTP,r", function (x, y) {
      var c = get(m, x, y);
      return c === "." && y > 23 && (x < 18 || x > 25) && !(x > 4 && x < 16 && y > 23 && y < 31);
    });
    scatter(m, 12, 20, "T", function (x, y) { return get(m, x, y) === "." && y > 12 && y < 16 && (x < 7 || x > 37); });
    maps.mansao = {
      id: "mansao", name: "Mansão Roswaal", m: m, roof: "Q", fish: "lagoa", forage: 5,
      portals: [
        { x: 21, y: 11, to: "salao", tx: 14, ty: 18, dir: "up" },
        { x: 22, y: 11, to: "salao", tx: 15, ty: 18, dir: "up" },
        { x: 21, y: 33, to: "estrada", tx: 21, ty: 1, dir: "down" },
        { x: 22, y: 33, to: "estrada", tx: 22, ty: 1, dir: "down" }
      ],
      signs: { "19,29": "Mansão Roswaal ↑  ·  Estrada do Bosque e Vila de Irlam ↓" }
    };
  })();

  // Salão (interior da mansão)
  (function () {
    var m = mk(30, 21, "#");
    rect(m, 1, 1, 28, 19, "_");
    rect(m, 8, 1, 1, 19, "#");
    rect(m, 21, 1, 1, 19, "#");
    rect(m, 1, 10, 7, 1, "#");
    rect(m, 22, 10, 7, 1, "#");
    set(m, 8, 5, "_"); set(m, 8, 15, "_"); set(m, 21, 5, "_"); set(m, 21, 15, "_");
    rect(m, 13, 2, 4, 18, "c");
    rect(m, 0, 20, 30, 1, "#");
    set(m, 14, 20, "D"); set(m, 15, 20, "D");
    // quarto
    set(m, 2, 2, "B"); set(m, 2, 3, "L");
    set(m, 5, 2, "t"); set(m, 7, 1, "p"); rect(m, 3, 6, 3, 2, "c");
    // cozinha
    rect(m, 1, 11, 7, 1, "k");
    rect(m, 3, 15, 2, 2, "t");
    // biblioteca
    rect(m, 22, 1, 7, 1, "s");
    rect(m, 23, 4, 4, 1, "s");
    rect(m, 23, 7, 4, 1, "s");
    // escritório
    rect(m, 22, 11, 7, 1, "s");
    rect(m, 24, 13, 3, 1, "t");
    set(m, 28, 18, "p");
    // salão
    set(m, 9, 1, "p"); set(m, 20, 1, "p"); set(m, 9, 19, "p"); set(m, 20, 19, "p");
    maps.salao = {
      id: "salao", name: "Salão da Mansão", m: m, indoor: true,
      portals: [
        { x: 14, y: 20, to: "mansao", tx: 21, ty: 12, dir: "down" },
        { x: 15, y: 20, to: "mansao", tx: 22, ty: 12, dir: "down" }
      ],
      rooms: [
        [1, 1, 7, 9, "Seu quarto"], [1, 11, 7, 9, "Cozinha"], [22, 1, 7, 9, "Biblioteca"],
        [22, 11, 7, 9, "Escritório"], [9, 1, 12, 19, "Salão principal"]
      ]
    };
  })();

  // Estrada do Bosque (lago e chalé)
  (function () {
    var m = mk(44, 34, ".");
    border(m, "T", 2, [[21, 22, 0, 1], [21, 22, 32, 33]]);
    rect(m, 21, 0, 2, 34, ":");
    ellipse(m, 33, 15, 7.5, 6.2, "~");
    rect(m, 10, 15, 15, 2, ":");
    rect(m, 25, 15, 7, 2, "b");
    house(m, 7, 6, 7, 6, 10, "R", "W", "w", "D");
    rect(m, 10, 12, 1, 3, ":");
    set(m, 12, 13, "S");
    set(m, 19, 4, "S");
    scatter(m, 21, 230, "TTTPP,,r", function (x, y) {
      var c = get(m, x, y);
      if (c !== ".") return false;
      if (x >= 19 && x <= 24) return false;
      if (x >= 5 && x <= 15 && y >= 4 && y <= 17) return false;
      if (y >= 13 && y <= 18 && x < 26) return false;
      if (x >= 24 && y >= 7 && y <= 23) return false;
      return true;
    });
    maps.estrada = {
      id: "estrada", name: "Estrada do Bosque", m: m, roof: "R", fish: "lago", forage: 9,
      portals: [
        { x: 21, y: 0, to: "mansao", tx: 21, ty: 32, dir: "up" },
        { x: 22, y: 0, to: "mansao", tx: 22, ty: 32, dir: "up" },
        { x: 21, y: 33, to: "irlam", tx: 21, ty: 1, dir: "down" },
        { x: 22, y: 33, to: "irlam", tx: 22, ty: 1, dir: "down" },
        { x: 10, y: 11, to: "casa2", tx: 6, ty: 8, dir: "up", house: "lago" }
      ],
      signs: {
        "12,13": "Chalé do Lago. Fale com o Tomás, em Irlam, para comprar.",
        "19,4": "↑ Mansão Roswaal   ·   ↓ Vila de Irlam   ·   → Lago"
      }
    };
  })();

  // Vila de Irlam
  (function () {
    var m = mk(44, 34, ".");
    border(m, "T", 2, [[21, 22, 0, 1]]);
    rect(m, 21, 0, 2, 31, ":");
    rect(m, 4, 15, 36, 2, ":");
    rect(m, 16, 12, 12, 7, "=");
    rect(m, 21, 14, 2, 2, "O");
    house(m, 6, 5, 7, 6, 9, "R", "W", "w", "D");
    house(m, 28, 5, 7, 6, 31, "R", "W", "w", "D");
    house(m, 6, 20, 7, 6, 9, "R", "W", "w", "D");
    house(m, 30, 20, 8, 6, 33, "R", "W", "w", "D");
    rect(m, 9, 11, 1, 4, ":");
    rect(m, 31, 11, 1, 4, ":");
    rect(m, 9, 17, 1, 3, ":");
    rect(m, 33, 17, 1, 3, ":");
    set(m, 33, 11, "S");
    set(m, 11, 26, "S");
    rect(m, 16, 20, 4, 1, "m");
    rect(m, 29, 28, 9, 1, "F"); rect(m, 29, 31, 9, 1, "F");
    rect(m, 29, 28, 1, 4, "F"); rect(m, 37, 28, 1, 4, "F");
    scatter(m, 31, 40, "f", function (x, y) { return x > 29 && x < 37 && y > 28 && y < 31; });
    scatter(m, 33, 90, "f,,TPr", function (x, y) {
      var c = get(m, x, y);
      if (c !== ".") return false;
      if (x >= 14 && x <= 29 && y >= 10 && y <= 22) return false;
      if (y >= 13 && y <= 18) return false;
      if (x >= 20 && x <= 23) return false;
      if (x >= 28 && y >= 27) return false;
      return y > 26 || x < 5 || x > 38 || y < 4;
    });
    maps.irlam = {
      id: "irlam", name: "Vila de Irlam", m: m, roof: "R", forage: 3,
      portals: [
        { x: 21, y: 0, to: "estrada", tx: 21, ty: 32, dir: "up" },
        { x: 22, y: 0, to: "estrada", tx: 22, ty: 32, dir: "up" },
        { x: 31, y: 10, to: "casa1", tx: 5, ty: 8, dir: "up", house: "irlam" }
      ],
      doors: {
        "9,10": "A casa da família da Petra. Melhor não entrar sem convite.",
        "9,25": "A oficina do Tomás. Ele costuma ficar do lado de fora.",
        "33,25": "Uma casa com cheiro de pão saindo pela janela. Está trancada."
      },
      signs: {
        "33,11": "Casinha de Irlam: à venda. Procure o Tomás.",
        "11,26": "Oficina do Tomás: consertos, móveis e casas."
      }
    };
  })();

  // Casas compráveis (interiores)
  function casa(id, name, back) {
    var m = mk(12, 10, "#");
    rect(m, 1, 1, 10, 8, "_");
    set(m, 1, 1, "B"); set(m, 1, 2, "L");
    rect(m, 7, 2, 2, 1, "t");
    set(m, 10, 1, "p");
    rect(m, 4, 5, 4, 3, "c");
    set(m, 10, 8, "p");
    var dx = id === "casa1" ? 5 : 6;
    set(m, dx, 9, "D");
    maps[id] = {
      id: id, name: name, m: m, indoor: true,
      portals: [{ x: dx, y: 9, to: back[0], tx: back[1], ty: back[2], dir: "down" }]
    };
  }
  casa("casa1", "Casinha de Irlam", ["irlam", 31, 11]);
  casa("casa2", "Chalé do Lago", ["estrada", 10, 12]);

  /* ---------- casas ---------- */
  RZ.HOUSES = {
    mansao: { name: "Quarto na Mansão", price: 0, map: "salao", wake: [3, 3], desc: "Seu primeiro lar. Café da manhã da Rem incluso." },
    irlam: { name: "Casinha de Irlam", price: 800, map: "casa1", wake: [2, 2], desc: "Pertinho da praça e da banca da Marta." },
    lago: { name: "Chalé do Lago", price: 2500, map: "casa2", wake: [2, 2], desc: "Acorda do lado do lago. Mais energia de manhã (+10)." }
  };

  /* ---------- calendário ---------- */
  RZ.SEASONS = ["Primavera", "Verão", "Outono", "Inverno"];
  RZ.WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  RZ.DAYS_PER_SEASON = 28;

  /* ---------- itens ---------- */
  // k: tipo (fish, forage, food, gift) · p: preço de venda · e: energia ao comer · c: cor do ícone
  RZ.ITEMS = {
    lambari: { n: "Lambari-do-bosque", k: "fish", p: 30, c: "#9fb7c9" },
    carpa: { n: "Carpa-dourada", k: "fish", p: 55, c: "#e0a63a" },
    truta: { n: "Truta-prateada", k: "fish", p: 70, c: "#c9d6df" },
    perca: { n: "Perca-listrada", k: "fish", p: 45, c: "#8fae5a" },
    bagre: { n: "Bagre-de-lodo", k: "fish", p: 40, c: "#7a6a52" },
    enguia: { n: "Enguia-da-lua", k: "fish", p: 120, c: "#5a5f8f" },
    salmao: { n: "Salmão-de-outono", k: "fish", p: 150, c: "#d8735a" },
    gelo: { n: "Peixe-gelo", k: "fish", p: 110, c: "#bfe6f2" },
    mana: { n: "Peixe-de-mana", k: "fish", p: 260, c: "#b07ae0" },
    rei: { n: "Rei do Lago", k: "fish", p: 800, c: "#f2c94c" },
    flor: { n: "Flor-da-lua", k: "forage", p: 35, c: "#e6d3ff" },
    amora: { n: "Amora", k: "forage", p: 25, e: 8, c: "#6b2a5a" },
    cogumelo: { n: "Cogumelo", k: "forage", p: 40, e: 10, c: "#c0704a" },
    erva: { n: "Erva-doce", k: "forage", p: 20, c: "#7fbf5a" },
    cristal: { n: "Pedra brilhante", k: "forage", p: 90, c: "#7fe0e8" },
    pinha: { n: "Pinha", k: "forage", p: 15, c: "#8a5a30" },
    raiz: { n: "Raiz-de-inverno", k: "forage", p: 45, e: 12, c: "#d9c27a" },
    cha: { n: "Chá de ervas", k: "food", p: 10, e: 20, buy: 25, c: "#a8c76a" },
    doce: { n: "Doce de leite", k: "food", p: 15, e: 25, buy: 40, c: "#c98a4a" },
    bolo: { n: "Bolo de mel", k: "food", p: 30, e: 50, buy: 70, c: "#f0c060" },
    buque: { n: "Buquê de flores", k: "gift", p: 60, buy: 200, c: "#f08aa8" }
  };
  RZ.SHOP = ["cha", "doce", "bolo", "buque"];

  // coleta por estação (0 primavera … 3 inverno)
  RZ.FORAGE = [
    ["flor", "flor", "erva", "erva", "amora"],
    ["amora", "amora", "flor", "erva"],
    ["cogumelo", "cogumelo", "erva", "amora"],
    ["pinha", "pinha", "raiz"]
  ];

  /* ---------- peixes ---------- */
  // at: lugares · se: estações (vazio = todas) · h: [início, fim] em horas · rain: só na chuva · w: peso · d: dificuldade · b: comportamento
  RZ.FISH = {
    lambari: { at: ["lago", "lagoa"], w: 10, d: 15, b: "calmo" },
    carpa: { at: ["lagoa", "lago"], w: 6, d: 30, b: "misto" },
    truta: { at: ["lago"], se: [0, 1, 2], w: 5, d: 45, b: "rapido", h: [6, 18] },
    perca: { at: ["lago", "lagoa"], se: [0, 1], w: 7, d: 30, b: "misto" },
    bagre: { at: ["lagoa", "lago"], w: 6, d: 35, b: "afunda" },
    enguia: { at: ["lago"], w: 3, d: 60, b: "rapido", h: [18, 26] },
    salmao: { at: ["lago"], se: [2], w: 4, d: 55, b: "misto" },
    gelo: { at: ["lago", "lagoa"], se: [3], w: 5, d: 50, b: "flutua" },
    mana: { at: ["lago"], rain: true, w: 2, d: 70, b: "rapido" },
    rei: { at: ["lago"], w: 0.35, d: 90, b: "rapido", rare: true }
  };

  /* ---------- pessoas ---------- */
  // look: aparência (as pessoas da série usam o mesmo manto neutro; só os moradores originais têm visual próprio)
  var NEUTRO = { cloak: "#8d8577", skin: "#f1cfb4" };
  RZ.PEOPLE = {
    emilia: { n: "Emilia", f: true, canon: true, look: NEUTRO, love: ["flor", "buque", "cristal"], like: ["cha", "amora", "erva"], hate: ["bagre"],
      sched: [[6, "mansao", 13, 19, "down"], [11, "salao", 11, 6, "down"], [17, "mansao", 30, 19, "down"], [20, "salao", 11, 13, "down"]] },
    rem: { n: "Rem", f: true, canon: true, look: NEUTRO, love: ["bolo", "buque", "erva"], like: ["truta", "carpa", "cogumelo", "cha"], hate: [],
      sched: [[6, "salao", 4, 13, "up"], [10, "irlam", 18, 19, "down"], [14, "salao", 5, 13, "up"], [19, "salao", 17, 8, "down"]] },
    ram: { n: "Ram", f: true, canon: true, look: NEUTRO, love: ["doce", "cha"], like: ["bolo", "salmao", "flor"], hate: ["pinha"],
      sched: [[6, "mansao", 24, 14, "down"], [11, "mansao", 33, 21, "left"], [15, "salao", 18, 15, "down"], [20, "salao", 5, 17, "right"]] },
    beatrice: { n: "Beatrice", f: true, canon: true, look: NEUTRO, love: ["doce", "bolo"], like: ["cha", "flor", "cristal"], hate: ["lambari", "carpa", "truta", "perca", "bagre", "enguia", "salmao", "gelo"],
      sched: [[6, "salao", 25, 3, "down"]] },
    roswaal: { n: "Roswaal", f: false, canon: true, look: NEUTRO, love: ["cristal", "mana"], like: ["enguia", "rei", "cha"], hate: ["amora"],
      sched: [[6, "salao", 25, 14, "down"], [13, "mansao", 23, 23, "down"], [16, "salao", 25, 14, "down"]] },
    petra: { n: "Petra", f: true, canon: true, look: NEUTRO, love: ["flor", "amora", "doce"], like: ["cristal", "buque", "bolo"], hate: ["bagre", "pinha"],
      sched: [[8, "irlam", 25, 18, "down"], [13, "irlam", 13, 17, "down"], [17, "irlam", 9, 12, "down"], [20, null]] },
    marta: { n: "Marta", f: true, look: { hair: "#c9c4bd", skin: "#e7b892", top: "#a5483a", legs: "#5a4a3a", apron: "#efe8da" },
      love: ["erva", "cha"], like: ["lambari", "perca", "carpa", "cogumelo"], hate: [], shop: true,
      sched: [[7, "irlam", 17, 21, "up"], [19, null]] },
    tomas: { n: "Tomás", f: false, look: { hair: "#5a3a22", skin: "#d9a57a", top: "#4f7a4a", legs: "#4a3b2c", beard: "#5a3a22" },
      love: ["pinha", "raiz"], like: ["bolo", "cogumelo", "doce"], hate: ["flor"], realtor: true,
      sched: [[7, "irlam", 10, 27, "down"], [17, "irlam", 13, 14, "down"], [21, null]] },
    bento: { n: "Seu Bento", f: false, look: { hair: "#e8e2d8", skin: "#c98f68", top: "#3d5f8a", legs: "#3a3a3a", hat: "#d9bf72" },
      love: ["rei", "mana"], like: ["enguia", "salmao", "truta", "cha"], hate: ["buque"],
      sched: [[6, "estrada", 31, 16, "right"], [17, "irlam", 26, 17, "down"], [21, null]] }
  };

  /* ---------- falas (texto próprio) ---------- */
  // a: até 2 corações · b: 3 a 5 · c: 6 ou mais · noite / chuva: falas especiais
  RZ.TALK = {
    emilia: {
      a: ["Bom dia! Já se acostumou com a mansão? Ela é enorme, eu ainda me perco às vezes.",
        "As flores do jardim abriram hoje. Eu converso com elas de manhã... é estranho?",
        "Se precisar de alguma coisa, é só me chamar, tá bom?"],
      b: ["Você parece mais animado hoje. Isso me deixa feliz também.",
        "A Ram contou que você ajudou na limpeza. Obrigada, {n}.",
        "Às vezes eu treino magia no jardim bem cedinho. Pode assistir, se quiser."],
      c: ["Sabe... eu fico contente quando vejo você chegando.",
        "Vamos ver as estrelas da varanda um dia desses? Prometo não dormir no meio."],
      noite: ["Já está tarde. Não fique acordado demais, combinado?"],
      chuva: ["A chuva deixa o jardim com um cheiro tão bom..."]
    },
    rem: {
      a: ["Bom dia. O café da manhã já está pronto, se quiser.",
        "A cozinha é o meu lugar favorito da casa. Tudo tem o seu lugar aqui.",
        "Vou à vila mais tarde fazer compras. Precisa de algo?"],
      b: ["Eu reparei que você tem se esforçado bastante, {n}.",
        "Quer provar o tempero novo? Seja sincero, por favor.",
        "Em Irlam todo mundo já pergunta por você."],
      c: ["Ter você por perto deixa os dias mais leves.",
        "Se um dia estiver cansado demais, pode se apoiar em mim."],
      noite: ["Deixei chá quente na cozinha. Para quando você voltar."],
      chuva: ["Com chuva, a roupa não seca. Mas o chá fica mais gostoso."]
    },
    ram: {
      a: ["Hm. Se vai ficar parado aí, pelo menos segure a vassoura.",
        "A mansão não se limpa sozinha. Infelizmente.",
        "Não espere elogios. Ainda."],
      b: ["Até que você não é um completo desastre.",
        "O chá de hoje ficou aceitável. Pode agradecer.",
        "Se for à vila, traga algo doce. Não é para mim. Talvez seja."],
      c: ["...Obrigada pela ajuda de ontem. Não vou repetir isso.",
        "Você melhorou. Um pouco. Considere isso um elogio raro."],
      noite: ["Vá dormir. Olheiras não combinam com a mansão."],
      chuva: ["Chuva significa barro no tapete. Limpe os pés."]
    },
    beatrice: {
      a: ["Quem deixou você entrar na biblioteca? Feche a porta ao sair.",
        "Esses livros são mais velhos do que esta casa inteira. Não toque em nada.",
        "Estou lendo. Silêncio, por favor."],
      b: ["Você de novo. ...Pode sentar ali. Quieto.",
        "Este livro fala de estrelas que mudam de lugar. Não que você vá entender.",
        "Se for pegar um livro, devolva no lugar certo. Eu vou saber."],
      c: ["Se trouxer doces, talvez eu leia uma história em voz alta. Talvez.",
        "A biblioteca fica menos silenciosa com você aqui. Não é elogio... nem reclamação."],
      noite: ["A biblioteca não tem hora para fechar. Mas você tem hora para dormir."],
      chuva: ["Chuva é o melhor clima para ler. Nisso, pelo menos, concordamos."]
    },
    roswaal: {
      a: ["Ah, nosso hóspede favorito! A casa está do seu gosto?",
        "Uma mansão grande precisa de gente animada. Você serve muito bem.",
        "Tenho papéis demais e paciência de menos hoje."],
      b: ["Os moradores de Irlam falam bem de você. Interessante, muito interessante.",
        "Continue explorando. Gosto de ver as pessoas crescendo por conta própria."],
      c: ["Você virou parte desta casa. Não esperava por isso. Que ótima surpresa!"],
      noite: ["A noite é ótima para pensar. E péssima para quem precisa acordar cedo."],
      chuva: ["Dias de chuva pedem lareira e um bom livro. Ou dois."]
    },
    petra: {
      a: ["Oi! Você é o moço novo da mansão, né?",
        "Eu sei o nome de todas as flores daqui. Quer que eu te ensine?",
        "Minha mãe diz que eu falo demais. Você acha?"],
      b: ["Quando eu crescer, quero trabalhar na mansão também!",
        "Uma vez achei uma pedra brilhante perto do lago. Se achar uma, me mostra?",
        "Brinca de pega-pega comigo depois? Só um pouquinho!"],
      c: ["Você é o meu amigo favorito. Mas não conta pros outros!",
        "Fiz uma coroa de flores pra você. Ficou torta, mas foi com carinho."],
      noite: ["Já tenho que ir pra casa... até amanhã!"],
      chuva: ["Eu adoro pular nas poças! Minha mãe, nem tanto."]
    },
    marta: {
      a: ["Bem-vindo à banca da Marta! Frutas, chás e doces fresquinhos.",
        "Compro peixe e coisas da floresta também, viu?",
        "O bolo de mel acabou de sair. Dá energia pro dia inteiro."],
      b: ["Você de novo! Já separei o chá mais cheiroso pra você.",
        "Se vier na chuva, a fila é menor. Ninguém gosta de se molhar."],
      c: ["Meu falecido marido também adorava pescar. Você me lembra ele.",
        "Pra você eu sempre guardo o melhor pedaço de bolo."],
      noite: ["Já estou fechando, meu bem. Volte amanhã cedinho!"],
      chuva: ["Que chuvarada! Entre debaixo do toldo."]
    },
    tomas: {
      a: ["Sou o Tomás, carpinteiro. Se quiser uma casa só sua, é comigo.",
        "A casinha perto da praça está vazia. Madeira boa, telhado firme.",
        "Martelo na mão e café na caneca. Assim começa um bom dia."],
      b: ["O Chalé do Lago tem a melhor vista da região. Pena que é longe de tudo.",
        "Consertei a cerca da Marta ontem. Ela pagou em bolo. Bom negócio."],
      c: ["Se um dia quiser reformar alguma coisa, faço preço de amigo.",
        "Você ajudou essa vila mais do que imagina, {n}."],
      noite: ["Hora de guardar as ferramentas. Boa noite!"],
      chuva: ["Chuva boa pra testar telhado. O meu passou."]
    },
    bento: {
      a: ["Shhh... os peixes ouvem tudo.",
        "Segure o botão pra lançar mais longe. Lançamento forte, peixe raro.",
        "Na chuva o lago fica mais generoso."],
      b: ["Dizem que um peixe enorme vive no fundo do lago. O tal do Rei do Lago.",
        "De noite aparecem as enguias. Escorregadias que só.",
        "No outono, o salmão sobe o rio. Fica de olho."],
      c: ["Você já pesca melhor que eu. Não espalha, hein.",
        "Se pegar o Rei do Lago, me chama. Quero ver com esses olhos."],
      noite: ["Pescaria rendeu hoje. Hora de ir pra casa."],
      chuva: ["Chuva é sinal de peixe raro. Pega a vara!"]
    }
  };

  // reações a presentes: [amou, gostou, normal, não gostou]
  RZ.GIFT = {
    emilia: ["Que lindo! Vou guardar com muito carinho. Obrigada!", "Para mim? Obrigada, {n}!", "Oh, obrigada. Foi gentil da sua parte.", "Hm... obrigada mesmo assim."],
    rem: ["Isso é perfeito. Muito obrigada, de coração.", "Que gentileza. Obrigada.", "Obrigada. Vou dar um bom uso.", "Ah... não é bem o meu gosto."],
    ram: ["...Você acertou. Não se acostume.", "Aceitável. Obrigada.", "Hm. Vou guardar em algum lugar.", "Por que você me daria isso?"],
    beatrice: ["I-isso é... aceitável! Muito aceitável! Pode ir agora.", "Hm. Até que você tem bom gosto.", "Vou deixar em cima da mesa. Em algum momento.", "Tire isso da minha biblioteca. Agora."],
    roswaal: ["Maravilhoso! Que presente esplêndido!", "Que atencioso! Obrigado.", "Ora, obrigado.", "Que... curioso. Obrigado?"],
    petra: ["Uaaau! É o melhor presente do mundo!", "Obrigada! Vou mostrar pra minha mãe!", "Obrigada!", "Eca... mas obrigada."],
    marta: ["Ah, meu bem, você me conhece! Obrigada!", "Que mimo! Obrigada.", "Obrigada, querido.", "Hm, vou achar uma utilidade."],
    tomas: ["Isso sim é presente! Valeu demais!", "Opa, obrigado!", "Valeu.", "Hã... valeu, eu acho."],
    bento: ["Mas que beleza! Nunca vou esquecer.", "Bom, bom. Obrigado.", "Obrigado, rapaz.", "Isso aí não pesca nada."]
  };

  // garante que os pontos das rotinas estejam livres
  Object.keys(RZ.PEOPLE).forEach(function (id) {
    RZ.PEOPLE[id].sched.forEach(function (s) {
      if (!s[1]) return;
      var m = maps[s[1]].m;
      if (RZ.SOLID.indexOf(m.g[s[3]][s[2]]) >= 0) m.g[s[3]][s[2]] = maps[s[1]].indoor ? "_" : ".";
    });
  });

  RZ.BOOKS = [
    "Um livro sobre espíritos das estações. Diz que eles gostam de quem cuida de jardins.",
    "Um atlas antigo de Lugunica. Algumas estradas desenhadas nem existem mais.",
    "Um livro de receitas com uma página dobrada: bolo de mel.",
    "Um diário de viagem sobre o deserto do leste. As páginas têm areia de verdade.",
    "Um livro de contos para crianças. Alguém sublinhou a palavra \"amizade\".",
    "Um tratado sobre magia de gelo. As letras são tão pequenas que dão sono."
  ];

  RZ.QUESTS = [
    { id: "t_emilia", t: "Conversar com a Emilia", r: 30 },
    { id: "t_rem", t: "Conversar com a Rem", r: 30 },
    { id: "t_ram", t: "Conversar com a Ram", r: 30 },
    { id: "t_beatrice", t: "Achar a biblioteca da Beatrice", r: 50 },
    { id: "fish1", t: "Pescar o primeiro peixe", r: 60 },
    { id: "ship1", t: "Vender algo na caixa de entregas", r: 40 },
    { id: "irlam", t: "Visitar a Vila de Irlam", r: 40 },
    { id: "house1", t: "Comprar uma casa", r: 200 }
  ];
})();
