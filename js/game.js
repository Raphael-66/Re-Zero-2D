/* Re:Zero 2D — motor do jogo. Um arquivo, sem bibliotecas. */
(function () {
  "use strict";
  var RZ = window.RZ, T = 16;
  var $ = function (s) { return document.querySelector(s); };
  var cv = $("#cv"), ctx = cv.getContext("2d");
  var W = 0, H = 0, dpr = 1, sc = 2;
  var S = null; // save atual
  var SAVEKEY = "rz2d_save";

  /* ================= utilidades ================= */
  function hash(x, y, i) {
    var s = Math.sin(x * 127.1 + y * 311.7 + (i || 0) * 74.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmtH(min) {
    var h = Math.floor(min / 60) % 24, m = Math.floor(min % 60 / 10) * 10;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function hour() { return S.min / 60; }
  function dayKey() { return S.year * 1000 + S.season * 100 + S.day; }
  function weekday() { return RZ.WEEK[(S.day - 1) % 7]; }
  function txt(t) { return String(t).replace(/\{n\}/g, S.name); }

  /* ================= tela ================= */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    sc = Math.max(2, Math.floor(Math.min(W, H * 0.85) / (T * 12)));
  }
  window.addEventListener("resize", resize);
  resize();

  /* ================= estado e save ================= */
  function defState(name) {
    return {
      v: 1, name: name || "Viajante", day: 1, season: 0, year: 1, min: 6 * 60,
      gold: 150, energy: 100, emax: 100, map: "salao", x: 3 * T + 8, y: 3 * T + 14, dir: "down",
      inv: {}, rel: {}, houses: { mansao: true }, home: "mansao", ship: {}, forage: {},
      quests: {}, weather: "sol", tomorrow: "sol", stats: { fish: 0, sold: 0, caught: {} },
      snack: 0, well: 0, sound: true, seen: {}
    };
  }
  function normalize(s) {
    var d = defState(s.name);
    Object.keys(d).forEach(function (k) { if (s[k] === undefined || s[k] === null) s[k] = d[k]; });
    if (!s.stats.caught) s.stats.caught = {};
    s.houses.mansao = true;
    if (!RZ.HOUSES[s.home] || !s.houses[s.home]) s.home = "mansao";
    if (!RZ.maps[s.map]) { s.map = "salao"; s.x = 3 * T + 8; s.y = 3 * T + 14; }
    Object.keys(RZ.PEOPLE).forEach(function (id) {
      if (!s.rel[id]) s.rel[id] = { p: 0, t: 0, g: 0 };
    });
    Object.keys(s.inv).forEach(function (k) { if (!RZ.ITEMS[k] || !(s.inv[k] > 0)) delete s.inv[k]; });
    return s;
  }
  function save() {
    if (!S) return;
    try { localStorage.setItem(SAVEKEY, JSON.stringify(S)); } catch (e) { /* sem espaço */ }
  }
  function loadSave() {
    try {
      var j = localStorage.getItem(SAVEKEY);
      return j ? normalize(JSON.parse(j)) : null;
    } catch (e) { return null; }
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) save(); });

  /* ================= som ================= */
  var AC = null;
  function audio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === "suspended") AC.resume();
  }
  function beep(f, d, type, vol, delay) {
    if (!AC || !S || !S.sound) return;
    var t = AC.currentTime + (delay || 0);
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "square"; o.frequency.value = f;
    g.gain.setValueAtTime(vol || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
  }
  var SFX = {
    talk: function () { beep(620, 0.05, "square", 0.03); },
    pick: function () { beep(880, 0.07, "triangle", 0.06); beep(1320, 0.08, "triangle", 0.05, 0.06); },
    coin: function () { beep(988, 0.06, "square", 0.04); beep(1319, 0.12, "square", 0.04, 0.06); },
    bite: function () { beep(1200, 0.08, "square", 0.06); beep(1200, 0.08, "square", 0.06, 0.12); },
    catch: function () { [523, 659, 784, 1047].forEach(function (f, i) { beep(f, 0.12, "triangle", 0.06, i * 0.08); }); },
    miss: function () { beep(300, 0.2, "sawtooth", 0.04); beep(200, 0.25, "sawtooth", 0.04, 0.15); },
    door: function () { beep(180, 0.08, "triangle", 0.07); },
    heart: function () { beep(784, 0.08, "sine", 0.06); beep(1047, 0.15, "sine", 0.06, 0.08); }
  };

  /* ================= cores e tiles ================= */
  var GR = [
    ["#6db04f", "#5e9e43", "#86c766"],
    ["#58a03f", "#4a8c34", "#6db552"],
    ["#a9a04a", "#958c3c", "#c2b75e"],
    ["#e8eef3", "#d2dbe3", "#f8fbfd"]
  ];
  var FLOW = [["#f4a6c6", "#fff07a", "#ffffff"], ["#e8503c", "#5aa0f0", "#ffd23c"], ["#e8883c", "#c8503c", "#f0c03c"], ["#c8e8ff", "#ffffff", "#c8e8ff"]];
  var CROWN = [["#3f8f3a", "#58a84a", "#f4b6d2"], ["#2f7f30", "#46993f", "#46993f"], ["#c0652c", "#e08a35", "#a84a24"], ["#5f7f6a", "#eef3f6", "#ffffff"]];
  var GROUNDS = ".,f:=_cb";

  function chAt(mp, x, y) {
    var m = mp.m;
    return x >= 0 && y >= 0 && x < m.w && y < m.h ? m.g[y][x] : null;
  }
  function under(mp, x, y) {
    var n = [[x - 1, y], [x + 1, y], [x, y + 1], [x, y - 1]];
    for (var i = 0; i < n.length; i++) {
      var c = chAt(mp, n[i][0], n[i][1]);
      if (c && GROUNDS.indexOf(c) >= 0 && c !== "f" && c !== "b") return c;
    }
    return mp.indoor ? "_" : ".";
  }

  function grass(c, X, Y, x, y, se) {
    var g = GR[se];
    R(c, X, Y, T, T, g[0]);
    for (var i = 0; i < 6; i++) R(c, X + Math.floor(hash(x, y, i) * 15), Y + Math.floor(hash(x, y, i + 9) * 15), 1, 1, g[1]);
    for (i = 0; i < 3; i++) R(c, X + Math.floor(hash(x, y, i + 20) * 15), Y + Math.floor(hash(x, y, i + 30) * 15), 1, 1, g[2]);
  }
  function ground(c, mp, X, Y, x, y, ch, se) {
    var i;
    switch (ch) {
      case ".": grass(c, X, Y, x, y, se); break;
      case ",":
        grass(c, X, Y, x, y, se);
        for (i = 0; i < 4; i++) {
          var bx = X + 2 + Math.floor(hash(x, y, i + 40) * 11), by = Y + 4 + Math.floor(hash(x, y, i + 50) * 9);
          R(c, bx, by, 1, 4, GR[se][1]); R(c, bx + 1, by + 1, 1, 3, GR[se][1]);
        }
        break;
      case "f":
        grass(c, X, Y, x, y, se);
        for (i = 0; i < 3; i++) {
          var fx = X + 2 + Math.floor(hash(x, y, i + 60) * 11), fy = Y + 2 + Math.floor(hash(x, y, i + 70) * 11);
          if (se !== 3) R(c, fx, fy + 2, 1, 2, "#3d7a32");
          R(c, fx - 1, fy, 3, 2, FLOW[se][Math.floor(hash(x, y, i + 80) * 3)]);
        }
        break;
      case ":":
        R(c, X, Y, T, T, se === 3 ? "#d8d2c8" : "#c9a46c");
        for (i = 0; i < 5; i++) R(c, X + Math.floor(hash(x, y, i + 3) * 15), Y + Math.floor(hash(x, y, i + 13) * 15), 2, 1, se === 3 ? "#bdb5a8" : "#b08a55");
        break;
      case "=":
        R(c, X, Y, T, T, "#b8b1a3");
        R(c, X, Y + 7, T, 1, "#9d9688"); R(c, X, Y + 15, T, 1, "#9d9688");
        R(c, X + ((y % 2) ? 4 : 11), Y, 1, 7, "#9d9688"); R(c, X + ((y % 2) ? 11 : 4), Y + 8, 1, 7, "#9d9688");
        R(c, X + 1, Y + 1, 2, 1, "#ccc6b9");
        break;
      case "_":
        R(c, X, Y, T, T, "#b37b4a");
        R(c, X, Y + 3, T, 1, "#99643a"); R(c, X, Y + 7, T, 1, "#99643a"); R(c, X, Y + 11, T, 1, "#99643a"); R(c, X, Y + 15, T, 1, "#99643a");
        R(c, X + Math.floor(hash(x, y, 1) * 14), Y + 4, 1, 3, "#99643a");
        R(c, X + Math.floor(hash(x, y, 2) * 14), Y + 12, 1, 3, "#99643a");
        break;
      case "c":
        R(c, X, Y, T, T, "#9b2f3e");
        if (chAt(mp, x - 1, y) !== "c") R(c, X, Y, 2, T, "#d9b04a");
        if (chAt(mp, x + 1, y) !== "c") R(c, X + 14, Y, 2, T, "#d9b04a");
        if (chAt(mp, x, y - 1) !== "c") R(c, X, Y, T, 2, "#d9b04a");
        if (chAt(mp, x, y + 1) !== "c") R(c, X, Y + 14, T, 2, "#d9b04a");
        if ((x + y) % 2 === 0) R(c, X + 7, Y + 7, 2, 2, "#c4485a");
        break;
      case "b":
        water(c, mp, X, Y, x, y, se);
        R(c, X, Y, T, T, "#a87444");
        for (i = 0; i < 4; i++) R(c, X + i * 4 + 3, Y, 1, T, "#86582f");
        if (chAt(mp, x, y - 1) !== "b") R(c, X, Y, T, 2, "#7a4f2a");
        if (chAt(mp, x, y + 1) !== "b") { R(c, X, Y + 14, T, 2, "#6b4424"); R(c, X + 2, Y + 15, 2, 1, "#4a2f18"); }
        break;
      default: grass(c, X, Y, x, y, se);
    }
  }
  function water(c, mp, X, Y, x, y, se) {
    var wc = se === 3 ? "#7fa7c9" : "#3f7fc6";
    R(c, X, Y, T, T, wc);
    for (var i = 0; i < 3; i++) R(c, X + Math.floor(hash(x, y, i + 90) * 12), Y + Math.floor(hash(x, y, i + 95) * 14), 4, 1, se === 3 ? "#9cc0dd" : "#5d98d6");
    var isW = function (c2) { return c2 === "~" || c2 === "b" || c2 === "o"; };
    var edge = se === 3 ? "#e8f2f8" : "#8cc4ec";
    if (!isW(chAt(mp, x, y - 1))) { R(c, X, Y, T, 3, GR[se][1]); R(c, X, Y + 3, T, 1, edge); }
    if (!isW(chAt(mp, x, y + 1))) R(c, X, Y + 14, T, 2, edge);
    if (!isW(chAt(mp, x - 1, y))) R(c, X, Y, 2, T, edge);
    if (!isW(chAt(mp, x + 1, y))) R(c, X + 14, Y, 2, T, edge);
  }
  function roof(c, mp, X, Y, x, y, ch) {
    var col = ch === "Q" ? ["#4f5f7e", "#3f4d68", "#6a7ba0"] : ["#a64b3c", "#87392d", "#c46a55"];
    R(c, X, Y, T, T, col[0]);
    for (var j = 0; j < 4; j++) {
      R(c, X, Y + j * 4 + 3, T, 1, col[1]);
      R(c, X + ((j + y) % 2 ? 2 : 9), Y + j * 4, 1, 3, col[1]);
    }
    if (chAt(mp, x, y - 1) !== ch) R(c, X, Y, T, 2, col[2]);
    if (chAt(mp, x - 1, y) !== ch) R(c, X, Y, 2, T, col[1]);
    if (chAt(mp, x + 1, y) !== ch) R(c, X + 14, Y, 2, T, col[1]);
    if (chAt(mp, x, y + 1) !== ch) { R(c, X, Y + 13, T, 3, col[1]); R(c, X, Y + 15, T, 1, "#2a1f1a"); }
  }
  function wall(c, X, Y, stone) {
    if (stone) {
      R(c, X, Y, T, T, "#d3cbbb");
      R(c, X, Y + 5, T, 1, "#b5ac9a"); R(c, X, Y + 11, T, 1, "#b5ac9a");
      R(c, X + 5, Y, 1, 5, "#b5ac9a"); R(c, X + 12, Y + 6, 1, 5, "#b5ac9a"); R(c, X + 3, Y + 12, 1, 4, "#b5ac9a");
    } else {
      R(c, X, Y, T, T, "#eadfc4");
      R(c, X, Y, 2, T, "#8a5a36"); R(c, X + 14, Y, 2, T, "#8a5a36");
    }
    R(c, X, Y + 14, T, 2, stone ? "#9a917f" : "#b9a888");
  }

  function drawTile(c, mp, x, y, se, top) {
    var X = x * T, Y = y * T, ch = mp.m.g[y][x], b, i;
    if (top) {
      if (ch === "T") {
        var cr = CROWN[se];
        c.fillStyle = cr[0];
        c.beginPath(); c.arc(X + 8, Y - 3, 10, 0, 7); c.fill();
        c.fillStyle = cr[1];
        c.beginPath(); c.arc(X + 6, Y - 6, 6, 0, 7); c.fill();
        c.beginPath(); c.arc(X + 12, Y - 1, 4, 0, 7); c.fill();
        for (i = 0; i < 4; i++) R(c, X + Math.floor(hash(x, y, i + 5) * 16) - 2, Y - 12 + Math.floor(hash(x, y, i + 7) * 16), 2, 2, cr[2]);
      } else if (ch === "P") {
        var pc = se === 3 ? ["#3f5f4f", "#eef3f6"] : se === 2 ? ["#3f6a3a", "#56804a"] : ["#2f6a3f", "#3f8550"];
        for (i = 0; i < 3; i++) {
          c.fillStyle = i % 2 ? pc[1] : pc[0];
          c.beginPath(); c.moveTo(X + 8, Y - 14 + i * 6); c.lineTo(X - 2 + i, Y + 2 + i * 3); c.lineTo(X + 18 - i, Y + 2 + i * 3); c.closePath(); c.fill();
        }
      } else if (ch === "O" && chAt(mp, x, y - 1) !== "O") {
        if (chAt(mp, x - 1, y) !== "O") R(c, X + 1, Y - 10, 2, 14, "#6b4426");
        if (chAt(mp, x + 1, y) !== "O") R(c, X + 13, Y - 10, 2, 14, "#6b4426");
        R(c, X, Y - 10, T, 2, "#5a3a22");
        c.fillStyle = "#a64b3c"; c.fillRect(X - (chAt(mp, x - 1, y) !== "O" ? 2 : 0), Y - 15, T + (chAt(mp, x - 1, y) !== "O" ? 2 : 0) + (chAt(mp, x + 1, y) !== "O" ? 2 : 0), 5);
        if (chAt(mp, x + 1, y) === "O") { R(c, X + 15, Y - 8, 1, 8, "#c2bbad"); R(c, X + 13, Y - 2, 5, 4, "#7a4f2a"); }
      } else if (ch === "m") {
        for (i = 0; i < 4; i++) R(c, X + i * 4, Y - 12, 4, 6, i % 2 ? "#f4efe4" : "#c8463c");
        R(c, X, Y - 6, T, 1, "#7a2a24");
        if (chAt(mp, x - 1, y) !== "m") R(c, X + 1, Y - 6, 1, 8, "#6b4424");
        if (chAt(mp, x + 1, y) !== "m") R(c, X + 14, Y - 6, 1, 8, "#6b4424");
      }
      return;
    }
    if (GROUNDS.indexOf(ch) >= 0) { ground(c, mp, X, Y, x, y, ch, se); return; }
    switch (ch) {
      case "~": water(c, mp, X, Y, x, y, se); break;
      case "T":
        grass(c, X, Y, x, y, se);
        c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(X + 8, Y + 13, 8, 3, 0, 0, 7); c.fill();
        R(c, X + 6, Y + 4, 4, 10, "#6b4426"); R(c, X + 6, Y + 4, 1, 10, "#4f311b");
        break;
      case "P":
        grass(c, X, Y, x, y, se);
        c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(X + 8, Y + 13, 7, 3, 0, 0, 7); c.fill();
        R(c, X + 7, Y + 6, 3, 8, "#5a3a22");
        break;
      case "h":
        grass(c, X, Y, x, y, se);
        R(c, X, Y + 2, T, 13, se === 3 ? "#5f7f6a" : "#3f7f34");
        R(c, X, Y + 2, T, 3, se === 3 ? "#eef3f6" : "#58a048");
        for (i = 0; i < 5; i++) R(c, X + Math.floor(hash(x, y, i) * 14), Y + 5 + Math.floor(hash(x, y, i + 3) * 8), 2, 2, "#2f6428");
        R(c, X, Y + 14, T, 1, "#24461f");
        break;
      case "F":
        ground(c, mp, X, Y, x, y, under(mp, x, y), se);
        if (chAt(mp, x - 1, y) === "F" || chAt(mp, x + 1, y) === "F") { R(c, X, Y + 5, T, 2, "#9a6a3e"); R(c, X, Y + 10, T, 2, "#9a6a3e"); }
        if (chAt(mp, x, y - 1) === "F" || chAt(mp, x, y + 1) === "F") R(c, X + 7, Y, 2, T, "#9a6a3e");
        R(c, X + 6, Y + 3, 4, 11, "#7a4f2a"); R(c, X + 6, Y + 3, 4, 1, "#b88a58");
        break;
      case "r":
        grass(c, X, Y, x, y, se);
        c.fillStyle = "#8f8a82"; c.beginPath(); c.ellipse(X + 8, Y + 10, 6, 5, 0, 0, 7); c.fill();
        R(c, X + 5, Y + 6, 4, 2, "#b5b0a8"); R(c, X + 3, Y + 13, 10, 1, "#5f5a54");
        break;
      case "W": wall(c, X, Y, false); break;
      case "V": wall(c, X, Y, true); break;
      case "w": case "v":
        wall(c, X, Y, ch === "v");
        R(c, X + 3, Y + 2, 10, 10, "#5a3a22"); R(c, X + 4, Y + 3, 8, 8, "#86b9df");
        R(c, X + 8, Y + 3, 1, 8, "#5a3a22"); R(c, X + 4, Y + 7, 8, 1, "#5a3a22"); R(c, X + 5, Y + 4, 2, 2, "#d6ecfa");
        break;
      case "D":
        if (mp.indoor) {
          R(c, X, Y, T, T, "#4a3527"); R(c, X + 1, Y, 14, 12, "#b37b4a"); R(c, X + 2, Y + 9, 12, 5, "#7a5a3a");
        } else {
          wall(c, X, Y, false);
          R(c, X + 3, Y + 1, 10, 15, "#6b4426"); R(c, X + 4, Y + 2, 8, 14, "#8a5a32");
          R(c, X + 10, Y + 9, 1, 2, "#e8c870");
        }
        break;
      case "E":
        wall(c, X, Y, true);
        R(c, X + (chAt(mp, x - 1, y) === "E" ? 0 : 2), Y + 1, 14, 15, "#4f2f1f");
        R(c, X + (chAt(mp, x - 1, y) === "E" ? 0 : 3), Y + 2, 12, 14, "#7a4a2c");
        R(c, X + (chAt(mp, x - 1, y) === "E" ? 2 : 12), Y + 9, 2, 2, "#e8c870");
        break;
      case "R": case "Q": roof(c, mp, X, Y, x, y, ch); break;
      case "o":
        ground(c, mp, X, Y, x, y, "=", se);
        R(c, X, Y, T, T, "#a9a293");
        var isO = function (dx, dy) { return chAt(mp, x + dx, y + dy) === "o"; };
        var l = isO(-1, 0) ? 0 : 3, r2 = isO(1, 0) ? 16 : 13, t2 = isO(0, -1) ? 0 : 3, b2 = isO(0, 1) ? 16 : 13;
        R(c, X + l, Y + t2, r2 - l, b2 - t2, se === 3 ? "#a9c9e3" : "#4a8fd6");
        R(c, X + l, Y + t2, r2 - l, 1, "#9ccdf0");
        if (isO(-1, 0) && isO(1, 0) && isO(0, -1) && isO(0, 1)) { R(c, X + 6, Y + 4, 4, 8, "#cfc9bb"); R(c, X + 7, Y + 1, 2, 3, "#d8efff"); }
        break;
      case "O":
        ground(c, mp, X, Y, x, y, "=", se);
        var isW2 = function (dx, dy) { return chAt(mp, x + dx, y + dy) === "O"; };
        R(c, X + (isW2(-1, 0) ? 0 : 1), Y + (isW2(0, -1) ? 0 : 1), T - (isW2(-1, 0) ? 0 : 1) - (isW2(1, 0) ? 0 : 1), T - (isW2(0, -1) ? 0 : 1) - (isW2(0, 1) ? 0 : 1), "#a9a293");
        var l2 = isW2(-1, 0) ? 0 : 4, r3 = isW2(1, 0) ? 16 : 12, t3 = isW2(0, -1) ? 0 : 4, b3 = isW2(0, 1) ? 16 : 12;
        R(c, X + l2, Y + t3, r3 - l2, b3 - t3, "#1f2f44");
        if (!isW2(0, -1)) R(c, X + l2, Y + t3, r3 - l2, 1, "#3f5f84");
        if (!isW2(0, 1)) R(c, X + 1, Y + 14, 14, 1, "#7d7668");
        break;
      case "#":
        var below = chAt(mp, x, y + 1);
        if (below && below !== "#" && y < mp.m.h - 1) {
          R(c, X, Y, T, T, "#e2d3b4");
          for (i = 0; i < 4; i++) R(c, X + i * 4 + 1, Y, 1, 12, "#d2c09c");
          R(c, X, Y + 12, T, 4, "#7a5a3a"); R(c, X, Y + 12, T, 1, "#9a7a52");
        } else {
          R(c, X, Y, T, T, "#3e2f25"); R(c, X, Y, T, 1, "#55433a");
        }
        break;
      case "B": case "L":
        ground(c, mp, X, Y, x, y, "_", se);
        R(c, X + 1, Y, 14, T, "#6b4426");
        if (ch === "B") { R(c, X + 1, Y, 14, 3, "#4f311b"); R(c, X + 3, Y + 4, 10, 6, "#f4f0e6"); R(c, X + 2, Y + 11, 12, 5, "#4a6fb0"); }
        else { R(c, X + 2, Y, 12, 13, "#4a6fb0"); R(c, X + 2, Y + 4, 12, 1, "#3a5a94"); R(c, X + 1, Y + 13, 14, 3, "#4f311b"); }
        break;
      case "t":
        ground(c, mp, X, Y, x, y, under(mp, x, y), se);
        R(c, X + 1, Y + 3, 14, 9, "#8a5a32"); R(c, X + 1, Y + 3, 14, 2, "#a8743f"); R(c, X + 2, Y + 12, 2, 4, "#5a3a22"); R(c, X + 12, Y + 12, 2, 4, "#5a3a22");
        if (hash(x, y, 4) > 0.5) { R(c, X + 5, Y + 4, 4, 3, "#f4f0e6"); R(c, X + 6, Y + 3, 2, 1, "#c8463c"); }
        break;
      case "s":
        R(c, X, Y, T, T, "#4f311b"); R(c, X + 1, Y + 1, 14, 14, "#6b4426");
        for (var sh = 0; sh < 2; sh++) {
          for (i = 0; i < 6; i++) R(c, X + 2 + i * 2, Y + 2 + sh * 7, 2, 5, ["#a83a3a", "#3a6aa8", "#d9b04a", "#3a8a5a", "#8a4aa8"][Math.floor(hash(x, y, i + sh * 9) * 5)]);
          R(c, X + 1, Y + 7 + sh * 7, 14, 1, "#4f311b");
        }
        break;
      case "k":
        ground(c, mp, X, Y, x, y, "_", se);
        R(c, X, Y, T, 13, "#8a6a4a"); R(c, X, Y, T, 4, "#d8cdb8"); R(c, X, Y + 13, T, 3, "#5a3a22");
        if (hash(x, y, 1) > 0.6) { R(c, X + 4, Y - 1, 7, 4, "#5f5f5f"); R(c, X + 5, Y - 2, 5, 1, "#7f7f7f"); }
        break;
      case "p":
        ground(c, mp, X, Y, x, y, under(mp, x, y), se);
        R(c, X + 4, Y + 9, 8, 6, "#a85a3a"); R(c, X + 4, Y + 9, 8, 1, "#c87a5a");
        c.fillStyle = "#3f8f3a"; c.beginPath(); c.arc(X + 8, Y + 6, 5, 0, 7); c.fill();
        R(c, X + 5, Y + 3, 2, 2, "#58a84a");
        break;
      case "X":
        ground(c, mp, X, Y, x, y, under(mp, x, y), se);
        R(c, X + 1, Y + 3, 14, 12, "#9a6a3e"); R(c, X + 1, Y + 3, 14, 3, "#7a4f2a");
        R(c, X + 1, Y + 9, 14, 1, "#7a4f2a"); R(c, X + 6, Y + 5, 4, 2, "#e8c870");
        break;
      case "S":
        ground(c, mp, X, Y, x, y, under(mp, x, y), se);
        R(c, X + 7, Y + 8, 2, 8, "#6b4426"); R(c, X + 2, Y + 2, 12, 7, "#a8743f"); R(c, X + 2, Y + 2, 12, 1, "#c89a62");
        R(c, X + 4, Y + 4, 8, 1, "#6b4426"); R(c, X + 4, Y + 6, 6, 1, "#6b4426");
        break;
      case "m":
        ground(c, mp, X, Y, x, y, under(mp, x, y), se);
        R(c, X, Y + 2, T, 12, "#8a5a32"); R(c, X, Y + 2, T, 3, "#b88a58");
        R(c, X + 3, Y, 3, 3, ["#e8503c", "#f0c03c", "#7fbf5a", "#a84ac8"][x % 4]); R(c, X + 9, Y, 3, 3, ["#f0c03c", "#e8503c", "#a84ac8", "#7fbf5a"][x % 4]);
        break;
      default: grass(c, X, Y, x, y, se);
    }
  }

  var MAPC = {};
  function mapCanvas(id) {
    var key = id + ":" + S.season;
    if (MAPC[key]) return MAPC[key];
    var mp = RZ.maps[id], m = mp.m;
    var base = document.createElement("canvas"), top = document.createElement("canvas");
    base.width = top.width = m.w * T; base.height = top.height = m.h * T;
    var bc = base.getContext("2d"), tc = top.getContext("2d");
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) { drawTile(bc, mp, x, y, S.season, false); drawTile(tc, mp, x, y, S.season, true); }
    MAPC[key] = { base: base, top: top };
    return MAPC[key];
  }

  /* ================= pessoas (desenho) ================= */
  // Estilo: bonequinho de 16x24 com cabeça grande, sombra e contorno escuro.
  // Cada pose é desenhada uma vez num canvas pequeno e guardada em cache.
  // Sprites próprios: veja js/sprites.js e docs/SPRITES.md (folha 48x128, quadros 16x32).
  var PLOOK = { hair: "#4a2f22", skin: "#f1c7a5", top: "#3c6fb0", legs: "#3b3b4a" };
  var OUTLINE = "#2b1d1a";
  function sh(hex, k) { // k<0 escurece, k>0 clareia
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); }
    return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")";
  }
  function stepOf(fr) { return fr % 2 ? (fr === 1 ? 1 : -1) : 0; }

  // pinta a pose em coordenadas locais (0..15 x 0..23); pés na linha 23
  function paintPerson(c, lk, dir, fr) {
    var st = stepOf(fr), side = dir === "left" || dir === "right", P = function (x, y, w, h, col) { R(c, x, y, w, h, col); };
    var skin = lk.skin, skinD = sh(skin, -0.18), shoe = "#3a2a24";
    if (lk.cloak) { paintCloak(c, lk, dir, st, side); return; }
    var top = lk.top, topD = sh(top, -0.28), topL = sh(top, 0.18), legs = lk.legs, legsD = sh(legs, -0.3);
    var hair = lk.hair, hairD = sh(hair, -0.3), hairL = sh(hair, 0.28);
    // pernas e sapatos
    if (side) {
      P(6 + st, 18, 2, 4, legs); P(8 - st, 18, 2, 4, legsD);
      P(dir === "left" ? 5 + st : 6 + st, 22, 3, 2, shoe); P(dir === "left" ? 7 - st : 8 - st, 22, 3, 2, shoe);
    } else {
      var la = st > 0 ? 1 : 0, lb = st < 0 ? 1 : 0;
      P(5, 18, 2, 4 - la, legs); P(9, 18, 2, 4 - lb, legsD);
      P(5, 22 - la, 2, 2, shoe); P(9, 22 - lb, 2, 2, shoe);
    }
    // tronco
    P(4, 11, 8, 7, top); P(10, 11, 2, 7, topD); P(4, 11, 2, 1, topL);
    P(4, 17, 8, 1, topD); // cinto/bainha
    if (lk.apron) { P(5, 13, 6, 6, lk.apron); P(9, 13, 2, 6, sh(lk.apron, -0.12)); P(5, 12, 6, 1, sh(lk.apron, -0.2)); }
    if (dir === "down" && !lk.apron) P(7, 11, 2, 2, sh(top, -0.12)); // gola
    // braços
    if (side) {
      var ax = dir === "left" ? 7 : 8, sw = st;
      P(ax, 12, 2, 5, topD); P(ax, 17 + (sw ? 0 : 0), 2, 1, skin);
    } else {
      var a = st;
      P(3, 12 + a, 1, 5, top); P(12, 12 - a, 1, 5, topD);
      P(3, 17 + a, 1, 1, skin); P(12, 17 - a, 1, 1, skinD);
    }
    // cabeça
    P(4, 3, 8, 8, skin); P(3, 5, 1, 4, skin); P(12, 5, 1, 4, skinD);
    P(4, 10, 8, 1, skinD);
    // cabelo
    if (lk.bun) { P(6, 0, 4, 3, hair); P(7, 0, 2, 1, hairL); }
    P(3, 2, 10, 3, hair); P(4, 1, 8, 1, hair); P(5, 1, 4, 1, hairL); P(4, 2, 3, 1, hairL);
    if (dir === "up") { P(3, 2, 10, 8, hair); P(11, 3, 2, 7, hairD); P(4, 9, 8, 1, hairD); P(5, 2, 4, 2, hairL); }
    else if (dir === "left") { P(7, 2, 6, 7, hair); P(11, 4, 2, 5, hairD); P(3, 5, 2, 1, hair); }
    else if (dir === "right") { P(3, 2, 6, 7, hair); P(3, 4, 2, 5, hairD); P(11, 5, 2, 1, hair); }
    else { P(3, 5, 1, 4, hair); P(12, 5, 1, 4, hairD); P(5, 5, 1, 1, hair); P(8, 5, 2, 1, hair); }
    // chapéu
    if (lk.hat) { var ht = lk.hat, htD = sh(ht, -0.3); P(1, 4, 14, 1, htD); P(2, 3, 12, 1, ht); P(4, 0, 8, 3, ht); P(4, 2, 8, 1, htD); P(5, 0, 3, 1, sh(ht, 0.25)); }
    // barba
    if (lk.beard && dir !== "up") {
      if (dir === "down") { P(4, 8, 8, 3, lk.beard); P(6, 8, 4, 1, skinD); }
      else P(dir === "left" ? 3 : 7, 8, 6, 3, lk.beard);
    }
    // rosto
    var eye = "#2a2230";
    if (dir === "down") {
      P(5, 6, 2, 2, eye); P(9, 6, 2, 2, eye); P(5, 6, 1, 1, "#fff"); P(9, 6, 1, 1, "#fff");
      if (!lk.beard) { P(4, 8, 1, 1, sh(skin, -0.08) ); P(11, 8, 1, 1, sh(skin, -0.08)); P(7, 9, 2, 1, skinD); }
    } else if (dir === "left") { P(4, 6, 2, 2, eye); P(4, 6, 1, 1, "#fff"); }
    else if (dir === "right") { P(10, 6, 2, 2, eye); P(11, 6, 1, 1, "#fff"); }
  }

  // manto neutro: o mesmo para todas as pessoas da série
  function paintCloak(c, lk, dir, st, side) {
    var P = function (x, y, w, h, col) { R(c, x, y, w, h, col); };
    var k = lk.cloak, kD = sh(k, -0.25), kDD = sh(k, -0.42), kL = sh(k, 0.18), skin = lk.skin, trim = "#c9b98f", shoe = "#3a2a24";
    // pés
    if (side) { P(6 + st, 21, 3, 3, shoe); P(8 - st, 21, 3, 3, sh(shoe, -0.2)); }
    else { P(4, 22 - (st > 0 ? 1 : 0), 3, 2, shoe); P(9, 22 - (st < 0 ? 1 : 0), 3, 2, shoe); }
    // corpo em trapézio
    var sw = st ? 1 : 0;
    P(4, 10, 8, 2, k); P(3, 12, 10, 4, k); P(2, 16, 12, 5, k); P(2 + (st < 0 ? 0 : sw), 21, 12 - sw, 1, k);
    P(2, 21, 12, 1, trim); P(2, 20, 12, 1, kD);
    if (side) { P(dir === "left" ? 10 : 2, 12, 3, 9, kD); P(dir === "left" ? 6 : 8, 13, 2, 6, kDD); }
    else {
      P(10, 12, 3, 9, kD); P(3, 12, 2, 4, kL);
      if (dir === "down") { P(7, 12, 2, 8, kD); P(7, 11, 2, 2, trim); P(7, 11, 1, 1, sh(trim, 0.4)); P(3, 16 - st, 1, 1, skin); P(12, 16 + st, 1, 1, sh(skin, -0.18)); }
      else { P(7, 12, 2, 8, kD); P(4, 10, 8, 2, kD); }
    }
    // capuz
    P(3, 1, 10, 10, k); P(4, 0, 8, 1, k); P(5, 0, 4, 1, kL); P(4, 1, 3, 1, kL);
    if (dir === "down") {
      P(5, 4, 6, 6, kDD); P(5, 5, 6, 5, skin); P(5, 5, 6, 1, sh(skin, -0.3)); P(10, 6, 1, 4, sh(skin, -0.15));
      P(6, 7, 1, 2, "#2a2230"); P(9, 7, 1, 2, "#2a2230");
      P(11, 2, 2, 9, kD); P(4, 10, 8, 1, kD);
    } else if (dir === "left") {
      P(3, 4, 5, 6, kDD); P(3, 5, 4, 5, skin); P(3, 5, 4, 1, sh(skin, -0.3)); P(4, 7, 1, 2, "#2a2230");
      P(10, 2, 3, 9, kD); P(8, 3, 1, 7, kL);
    } else if (dir === "right") {
      P(8, 4, 5, 6, kDD); P(9, 5, 4, 5, skin); P(9, 5, 4, 1, sh(skin, -0.3)); P(11, 7, 1, 2, "#2a2230");
      P(3, 2, 3, 9, kD); P(7, 3, 1, 7, kL);
    } else { P(11, 2, 2, 9, kD); P(7, 2, 2, 8, kD); P(3, 10, 10, 1, kD); }
  }

  var PCACHE = {};
  function personCanvas(lk, dir, fr) {
    var f = fr % 2 ? fr : 0, key = JSON.stringify(lk) + dir + f;
    if (PCACHE[key]) return PCACHE[key];
    var w = 18, h = 26;
    var body = document.createElement("canvas"); body.width = w; body.height = h;
    var bc = body.getContext("2d"); bc.translate(1, 1); paintPerson(bc, lk, dir, f);
    var sil = document.createElement("canvas"); sil.width = w; sil.height = h;
    var sc = sil.getContext("2d"); sc.drawImage(body, 0, 0); sc.globalCompositeOperation = "source-in"; R(sc, 0, 0, w, h, OUTLINE);
    var out = document.createElement("canvas"); out.width = w; out.height = h;
    var oc = out.getContext("2d");
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) { oc.drawImage(sil, d[0], d[1]); });
    oc.drawImage(body, 0, 0);
    PCACHE[key] = out;
    return out;
  }

  // sprites próprios (opcionais): folha 48x128, 4 linhas (baixo, esquerda, direita, cima) x 3 quadros (parado, passo 1, passo 2)
  var SPR = {}, SROW = { down: 0, left: 1, right: 2, up: 3 };
  (function loadSprites() {
    var list = window.RZ_SPRITES || {};
    Object.keys(list).forEach(function (id) {
      var im = new Image();
      im.onload = function () { SPR[id] = im; };
      im.onerror = function () { delete SPR[id]; };
      im.src = list[id];
    });
  })();

  function drawPerson(c, x, y, lk, dir, fr, id) {
    x = Math.round(x); y = Math.round(y);
    c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(x, y - 1, 6, 2.2, 0, 0, 7); c.fill();
    var im = id && SPR[id];
    if (im) {
      var col = fr === 1 ? 1 : fr === 3 ? 2 : 0;
      c.drawImage(im, col * 16, (SROW[dir] || 0) * 32, 16, 32, x - 8, y - 32, 16, 32);
      return;
    }
    c.drawImage(personCanvas(lk, dir, fr), x - 9, y - 25);
  }

  /* ================= ícones de itens ================= */
  var ICON = {}, ICONURL = {};
  function icon(id) {
    if (ICON[id]) return ICON[id];
    var it = RZ.ITEMS[id], k = document.createElement("canvas");
    k.width = k.height = 16;
    var c = k.getContext("2d"), col = it.c;
    if (it.k === "fish") {
      c.fillStyle = col; c.beginPath(); c.ellipse(7, 8, 6, 3.5, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(12, 8); c.lineTo(16, 4); c.lineTo(16, 12); c.closePath(); c.fill();
      R(c, 3, 7, 1, 1, "#1a1a2a"); R(c, 5, 10, 5, 1, "rgba(0,0,0,.2)"); R(c, 4, 5, 4, 1, "rgba(255,255,255,.5)");
      if (id === "rei") { R(c, 4, 2, 6, 2, "#f2c94c"); R(c, 4, 1, 1, 1, "#f2c94c"); R(c, 7, 1, 1, 1, "#f2c94c"); R(c, 9, 1, 1, 1, "#f2c94c"); }
    } else if (id === "flor" || id === "buque") {
      if (id === "buque") { c.fillStyle = "#e8d8b8"; c.beginPath(); c.moveTo(4, 8); c.lineTo(12, 8); c.lineTo(8, 16); c.closePath(); c.fill(); }
      R(c, 7, 7, 2, 7, "#3d7a32");
      var fl = id === "buque" ? [[5, 5, "#f08aa8"], [10, 5, "#fff07a"], [8, 3, "#e8503c"]] : [[8, 5, col]];
      fl.forEach(function (f) { c.fillStyle = f[2]; c.beginPath(); c.arc(f[0], f[1], 3, 0, 7); c.fill(); R(c, f[0] - 1, f[1] - 1, 2, 2, "#ffe27a"); });
    } else if (id === "amora") {
      [[6, 8], [9, 8], [7, 10], [10, 11], [5, 11], [8, 13]].forEach(function (p) { c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1], 2, 0, 7); c.fill(); });
      R(c, 7, 4, 2, 3, "#3d7a32");
    } else if (id === "cogumelo") {
      R(c, 6, 9, 4, 6, "#efe8da"); c.fillStyle = col; c.beginPath(); c.ellipse(8, 8, 7, 4, 0, Math.PI, 0); c.fill();
      R(c, 5, 5, 2, 2, "#fff"); R(c, 10, 6, 1, 1, "#fff");
    } else if (id === "erva") {
      R(c, 7, 6, 2, 9, "#3d7a32");
      [[4, 6], [11, 5], [5, 10], [11, 10]].forEach(function (p) { c.fillStyle = col; c.beginPath(); c.ellipse(p[0], p[1], 3, 1.6, 0.6, 0, 7); c.fill(); });
    } else if (id === "cristal") {
      c.fillStyle = col; c.beginPath(); c.moveTo(8, 1); c.lineTo(14, 7); c.lineTo(8, 15); c.lineTo(2, 7); c.closePath(); c.fill();
      c.fillStyle = "#d8fbff"; c.beginPath(); c.moveTo(8, 1); c.lineTo(10, 7); c.lineTo(6, 7); c.closePath(); c.fill();
    } else if (id === "pinha") {
      c.fillStyle = col; c.beginPath(); c.ellipse(8, 9, 4, 6, 0, 0, 7); c.fill();
      for (var i = 0; i < 4; i++) R(c, 5, 5 + i * 3, 6, 1, "#5a3a1a");
    } else if (id === "raiz") {
      c.fillStyle = col; c.beginPath(); c.ellipse(8, 9, 3.5, 5, 0.3, 0, 7); c.fill();
      R(c, 7, 2, 1, 4, "#3d7a32"); R(c, 9, 3, 1, 3, "#3d7a32"); R(c, 10, 14, 2, 1, "#a8904a");
    } else if (id === "cha") {
      R(c, 3, 6, 9, 8, "#f4f0e6"); R(c, 4, 7, 7, 2, col); R(c, 12, 8, 2, 4, "#f4f0e6"); R(c, 2, 14, 12, 1, "#c8c0b0");
      R(c, 6, 2, 1, 3, "rgba(255,255,255,.7)"); R(c, 8, 1, 1, 3, "rgba(255,255,255,.7)");
    } else if (id === "doce") {
      R(c, 4, 5, 8, 10, "#e8dcc8"); R(c, 4, 8, 8, 7, col); R(c, 3, 3, 10, 3, "#c8463c"); R(c, 5, 9, 2, 3, "rgba(255,255,255,.4)");
    } else if (id === "bolo") {
      c.fillStyle = col; c.beginPath(); c.moveTo(2, 14); c.lineTo(14, 14); c.lineTo(14, 7); c.lineTo(2, 10); c.closePath(); c.fill();
      R(c, 2, 9, 12, 2, "#fff4d8"); R(c, 10, 4, 2, 3, "#e8503c");
    } else { R(c, 3, 3, 10, 10, col); }
    ICON[id] = k;
    return k;
  }
  function iconURL(id) { if (!ICONURL[id]) ICONURL[id] = icon(id).toDataURL(); return ICONURL[id]; }
  function ico(id, big) { return '<img class="ico' + (big ? " big" : "") + '" src="' + iconURL(id) + '" alt="">'; }

  /* ================= inventário ================= */
  function addItem(id, n) { S.inv[id] = (S.inv[id] || 0) + (n || 1); }
  function takeItem(id, n) { n = n || 1; if ((S.inv[id] || 0) < n) return false; S.inv[id] -= n; if (S.inv[id] <= 0) delete S.inv[id]; return true; }
  function invList(f) { return Object.keys(S.inv).filter(function (k) { return S.inv[k] > 0 && (!f || f(RZ.ITEMS[k], k)); }); }

  /* ================= mundo ================= */
  var MP = null; // mapa atual
  function portalAt(mp, x, y) {
    for (var i = 0; i < mp.portals.length; i++) { var p = mp.portals[i]; if (p.x === x && p.y === y) return p; }
    return null;
  }
  function portalOk(p) { return !p.house || S.houses[p.house]; }
  function solidTile(mp, tx, ty, forNpc) {
    var c = chAt(mp, tx, ty);
    if (c === null) return true;
    if (c === "D" || c === "E") { var p = portalAt(mp, tx, ty); return !(p && (forNpc || portalOk(p))); }
    if (c === "~") return true;
    return RZ.SOLID.indexOf(c) >= 0;
  }
  function blockedAt(px, py) {
    var pts = [[px - 5, py - 5], [px + 5, py - 5], [px - 5, py - 1], [px + 5, py - 1]];
    for (var i = 0; i < pts.length; i++) if (solidTile(MP, Math.floor(pts[i][0] / T), Math.floor(pts[i][1] / T))) return true;
    for (var id in NPC) {
      var n = NPC[id];
      if (n.hidden || n.map !== S.map || n.path.length) continue;
      if (Math.abs(n.x - px) < 10 && Math.abs(n.y - py) < 7) return true;
    }
    return false;
  }

  var fade = 0, fadeDir = 0, fadeCb = null;
  function doFade(cb) { fadeDir = 1; fadeCb = cb; }
  function goMap(id, tx, ty, dir, quiet) {
    S.map = id; MP = RZ.maps[id];
    S.x = tx * T + 8; S.y = ty * T + 14; S.dir = dir || S.dir;
    if (!quiet) toast(MP.name);
    if (id === "irlam") doneQ("irlam");
    save();
  }

  /* ---------- NPCs em tempo real ---------- */
  var NPC = {};
  function schedFor(p) {
    var h = hour(), s = p.sched[0];
    for (var i = 0; i < p.sched.length; i++) if (p.sched[i][0] <= h) s = p.sched[i];
    return s;
  }
  function placeNPC(n, s) {
    if (!s[1]) { n.hidden = true; n.map = null; return; }
    n.hidden = false; n.map = s[1]; n.x = s[2] * T + 8; n.y = s[3] * T + 14; n.dir = s[4] || "down"; n.path = []; n.leave = null;
  }
  function initNPCs() {
    Object.keys(RZ.PEOPLE).forEach(function (id) {
      var s = schedFor(RZ.PEOPLE[id]);
      NPC[id] = { id: id, path: [], key: s.join(","), fr: 0, wt: 0 };
      placeNPC(NPC[id], s);
    });
  }
  function bfs(mp, sx, sy, goal) {
    var w = mp.m.w, h = mp.m.h, prev = new Int32Array(w * h).fill(-2), q = [sy * w + sx];
    prev[sy * w + sx] = -1;
    while (q.length) {
      var cur = q.shift(), cx = cur % w, cy = (cur - cx) / w;
      if (goal(cx, cy)) {
        var path = [], k = cur;
        while (k !== -1 && k !== sy * w + sx) { path.unshift([k % w, Math.floor(k / w)]); k = prev[k]; }
        return path;
      }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = cx + d[0], ny = cy + d[1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        var ni = ny * w + nx;
        if (prev[ni] !== -2 || solidTile(mp, nx, ny, true)) return;
        prev[ni] = cur; q.push(ni);
      });
    }
    return null;
  }
  function planNPC(n, s) {
    if (n.hidden || n.map !== S.map) { placeNPC(n, s); return; }
    var mp = RZ.maps[n.map], sx = Math.floor(n.x / T), sy = Math.floor((n.y - 4) / T), path;
    if (s[1] === n.map) path = bfs(mp, sx, sy, function (x, y) { return x === s[2] && y === s[3]; });
    else { path = bfs(mp, sx, sy, function (x, y) { return !!portalAt(mp, x, y); }); n.leave = s; }
    if (!path) { placeNPC(n, s); return; }
    n.path = path;
  }
  function updateNPCs(dt) {
    for (var id in NPC) {
      var n = NPC[id], p = RZ.PEOPLE[id], s = schedFor(p), key = s.join(",");
      if (key !== n.key) { n.key = key; planNPC(n, s); }
      if (n.path.length) {
        var nx = n.path[0][0] * T + 8, ny = n.path[0][1] * T + 14, dx = nx - n.x, dy = ny - n.y, d = Math.hypot(dx, dy), sp = 40 * dt;
        if (Math.abs(dx) > Math.abs(dy)) n.dir = dx > 0 ? "right" : "left"; else if (d > 0.1) n.dir = dy > 0 ? "down" : "up";
        if (d <= sp) { n.x = nx; n.y = ny; n.path.shift(); } else { n.x += dx / d * sp; n.y += dy / d * sp; }
        n.wt += dt; n.fr = Math.floor(n.wt * 6) % 4;
        if (!n.path.length) {
          if (n.leave) { var lv = n.leave; n.leave = null; placeNPC(n, lv); }
          else { n.dir = s[4] || "down"; n.fr = 0; }
        }
      } else n.fr = 0;
    }
  }
  function npcsHere() {
    var a = [];
    for (var id in NPC) if (!NPC[id].hidden && NPC[id].map === S.map) a.push(NPC[id]);
    return a;
  }

  /* ---------- coleta ---------- */
  function spawnForage() {
    S.forage = {};
    var r = RZ.rng(dayKey() * 7 + 3);
    Object.keys(RZ.maps).forEach(function (id) {
      var mp = RZ.maps[id];
      if (!mp.forage) return;
      var list = [], n = mp.forage + Math.floor(r() * 3), tries = 0;
      while (list.length < n && tries++ < 400) {
        var x = 2 + Math.floor(r() * (mp.m.w - 4)), y = 2 + Math.floor(r() * (mp.m.h - 4)), c = mp.m.g[y][x];
        if (".,".indexOf(c) < 0 || portalAt(mp, x, y)) continue;
        if (list.some(function (f) { return f[0] === x && f[1] === y; })) continue;
        var it = r() < 0.05 ? "cristal" : RZ.FORAGE[S.season][Math.floor(r() * RZ.FORAGE[S.season].length)];
        list.push([x, y, it]);
      }
      S.forage[id] = list;
    });
  }
  function forageAt(tx, ty) {
    var l = S.forage[S.map] || [];
    for (var i = 0; i < l.length; i++) if (l[i][0] === tx && l[i][1] === ty) return i;
    return -1;
  }
  function pickForage(i) {
    var f = S.forage[S.map][i];
    S.forage[S.map].splice(i, 1);
    addItem(f[2]); SFX.pick();
    toast("+1 " + RZ.ITEMS[f[2]].n, f[2]);
  }

  /* ================= tempo e dias ================= */
  function rollWeather(se) {
    var r = Math.random();
    if (se === 3) return r < 0.25 ? "neve" : "sol";
    return r < [0.2, 0.12, 0.22][se] ? "chuva" : "sol";
  }
  var WICON = { sol: "☀", chuva: "☂", neve: "❄" }, WNAME = { sol: "Sol", chuva: "Chuva", neve: "Neve" };

  function sleep(houseId, passed) {
    var late = S.min > 24 * 60 ? (S.min - 24 * 60) / 60 : 0;
    doFade(function () {
      // caixa de entregas
      var tot = 0, lines = [];
      Object.keys(S.ship).forEach(function (k) {
        var v = RZ.ITEMS[k].p * S.ship[k]; tot += v; lines.push(S.ship[k] + "× " + RZ.ITEMS[k].n);
      });
      S.ship = {}; S.gold += tot; S.stats.sold += tot;
      // novo dia
      S.day++;
      if (S.day > RZ.DAYS_PER_SEASON) { S.day = 1; S.season++; if (S.season > 3) { S.season = 0; S.year++; } }
      S.weather = S.tomorrow; S.tomorrow = rollWeather(S.day === RZ.DAYS_PER_SEASON ? (S.season + 1) % 4 : S.season);
      if (S.day === 1 && S.season === 0) S.weather = "sol";
      Object.keys(S.rel).forEach(function (k) { S.rel[k].t = 0; S.rel[k].g = 0; });
      S.home = houseId;
      S.energy = passed ? Math.round(S.emax * 0.5) : Math.round(S.emax - late * 15);
      if (houseId === "lago" && !passed) S.energy += 10;
      S.min = 6 * 60;
      var hs = RZ.HOUSES[houseId];
      goMap(hs.map, hs.wake[0], hs.wake[1], "down", true);
      spawnForage(); initNPCs(); rain = [];
      save();
      var msg = RZ.SEASONS[S.season] + ", dia " + S.day + " (" + weekday() + ") · Ano " + S.year + "\nTempo: " + WICON[S.weather] + " " + WNAME[S.weather] + ".";
      if (S.day === 1) msg = "Começou o " + RZ.SEASONS[S.season].toLowerCase() + "!\n" + msg;
      if (tot) msg += "\n\nCaixa de entregas: ¤" + tot + "\n" + lines.join(", ");
      if (late > 0 && !passed) msg += "\n\nVocê dormiu tarde e acordou um pouco cansado.";
      if (houseId === "lago" && !passed) msg += "\n\nA vista do lago deixa você com energia de sobra (+10).";
      say(null, msg);
      if (tot) SFX.coin();
    });
  }
  function passOut() {
    var lost = Math.min(100, Math.floor(S.gold * 0.1));
    S.gold -= lost;
    fishEnd();
    say(null, "Já são 2h da manhã... Tudo escurece e você desmaia de cansaço." + (lost ? "\nAlguém levou você para casa, e você deixou ¤" + lost + " pelo caminho." : ""), null, function () { sleep(S.home, true); });
  }

  /* ================= amizade ================= */
  function hearts(id) { return Math.floor(S.rel[id].p / 100); }
  function relAdd(id, v) { var r = S.rel[id]; r.p = clamp(r.p + v, 0, 1000); }
  function heartsHTML(id) {
    var h = hearts(id), s = "";
    for (var i = 0; i < 10; i++) s += i < h ? "♥" : "♡";
    return '<span class="hearts">' + s + "</span>";
  }

  function talkTo(id) {
    var p = RZ.PEOPLE[id], n = NPC[id], r = S.rel[id], tk = RZ.TALK[id];
    var dx = S.x - n.x, dy = S.y - n.y;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    var h = hearts(id), pool = tk.a.slice();
    if (h >= 3) pool = pool.concat(tk.b, tk.b);
    if (h >= 6) pool = pool.concat(tk.c, tk.c, tk.c);
    var line;
    if (hour() >= 20 && tk.noite && Math.random() < 0.5) line = pick(tk.noite);
    else if (S.weather !== "sol" && tk.chuva && Math.random() < 0.4) line = pick(tk.chuva);
    else line = pool[(S.day * 3 + r.p + (r.t ? 1 : 0)) % pool.length];
    if (!r.t) {
      r.t = 1; relAdd(id, 20); SFX.heart();
      if (["emilia", "rem", "ram", "beatrice"].indexOf(id) >= 0) doneQ("t_" + id);
    } else SFX.talk();
    var ch = [];
    if (!r.g && invList().length) ch.push(["Dar presente", function () { giftMenu(id); }]);
    if (p.shop) { ch.push(["Comprar", shopMenu]); ch.push(["Vender", sellMenu]); }
    if (p.realtor) ch.push(["Casas à venda", houseMenu]);
    ch.push(["Tchau", null]);
    say(p.n, txt(line), ch);
  }
  function giveGift(id, it) {
    var p = RZ.PEOPLE[id], g = RZ.GIFT[id], v, t;
    if (!takeItem(it)) return;
    S.rel[id].g = 1;
    if (p.love.indexOf(it) >= 0 || (it === "buque" && p.hate.indexOf("buque") < 0)) { v = 80; t = g[0]; }
    else if (p.like.indexOf(it) >= 0) { v = 45; t = g[1]; }
    else if (p.hate.indexOf(it) >= 0) { v = -20; t = g[3]; }
    else { v = 20; t = g[2]; }
    relAdd(id, v);
    closePanel();
    if (v > 0) SFX.heart(); else SFX.miss();
    say(p.n, txt(t));
  }

  /* ================= casas ================= */
  function buyHouse(id) {
    var hs = RZ.HOUSES[id];
    if (S.houses[id]) return;
    if (S.gold < hs.price) { toast("Faltam ¤" + (hs.price - S.gold) + "."); return; }
    S.gold -= hs.price; S.houses[id] = true; SFX.coin();
    doneQ("house1"); save();
    closePanel();
    say("Tomás", "Negócio fechado! A chave do " + hs.name + " agora é sua. Durma lá uma noite para virar o seu lar.");
  }
  function houseOfMap(map) {
    for (var k in RZ.HOUSES) if (RZ.HOUSES[k].map === map) return k;
    return null;
  }

  /* ================= tarefas ================= */
  function doneQ(id) {
    if (!S || S.quests[id]) return;
    var q = RZ.QUESTS.filter(function (x) { return x.id === id; })[0];
    if (!q) return;
    S.quests[id] = 1; S.gold += q.r;
    setTimeout(function () { toast("✓ " + q.t + " (+¤" + q.r + ")"); SFX.coin(); }, 400);
  }

  /* ================= interação ================= */
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function facing() {
    var d = DIRS[S.dir], fx = S.x + d[0] * 12, fy = S.y - 4 + d[1] * 12;
    return { fx: fx, fy: fy, tx: Math.floor(fx / T), ty: Math.floor(fy / T) };
  }
  function target() {
    var f = facing(), best = null, bd = 14;
    npcsHere().forEach(function (n) {
      var d = Math.hypot(n.x - f.fx, n.y - 6 - f.fy);
      if (d < bd) { bd = d; best = n; }
    });
    if (best) return { k: "npc", id: best.id, l: "Falar" };
    var c = chAt(MP, f.tx, f.ty), key = f.tx + "," + f.ty;
    var fi = forageAt(f.tx, f.ty);
    if (fi >= 0) return { k: "forage", i: fi, l: "Pegar" };
    switch (c) {
      case "B": case "L": return { k: "bed", l: "Dormir" };
      case "X": return { k: "box", l: "Abrir" };
      case "S": return { k: "sign", key: key, l: "Ler" };
      case "m": return { k: "stall", l: "Banca" };
      case "D": case "E":
        var p = portalAt(MP, f.tx, f.ty);
        if (p && !portalOk(p)) return { k: "forsale", h: p.house, l: "Ver" };
        if (!p) return { k: "door", key: key, l: "Bater" };
        return null;
      case "s": return { k: "book", l: "Ler" };
      case "k": return { k: "kitchen", l: "Olhar" };
      case "O": return { k: "well", l: "Poço" };
      case "o": return { k: "fountain", l: "Olhar" };
      case "~": return MP.fish ? { k: "water", l: "Pescar" } : null;
    }
    return null;
  }
  function interact() {
    var t = target();
    if (!t) return;
    switch (t.k) {
      case "npc": talkTo(t.id); break;
      case "forage": pickForage(t.i); break;
      case "bed":
        var hid = houseOfMap(S.map);
        say(null, "Dormir agora?\nPrevisão para amanhã: " + WICON[S.tomorrow] + " " + WNAME[S.tomorrow] + ".", [["Dormir", function () { sleep(hid, false); }], ["Ainda não", null]]);
        break;
      case "box": shipMenu(); break;
      case "sign": say(null, (MP.signs || {})[t.key] || "Uma placa apagada pelo tempo."); break;
      case "stall":
        if (NPC.marta && !NPC.marta.hidden && NPC.marta.map === S.map) talkTo("marta");
        else say(null, "A banca da Marta está fechada. Ela abre às 7h.");
        break;
      case "forsale":
        var hs = RZ.HOUSES[t.h];
        say(null, hs.name + " está à venda por ¤" + hs.price + ".\n" + hs.desc, [["Comprar", function () { buyHouse(t.h); }], ["Agora não", null]]);
        break;
      case "door": say(null, (MP.doors || {})[t.key] || "Está trancada."); break;
      case "book":
        if (S.map === "salao" && S.x > 21 * T && S.y < 10 * T) say(null, pick(RZ.BOOKS));
        else say(null, "Prateleiras cheias de pastas e papéis. Melhor não mexer.");
        break;
      case "kitchen":
        if (S.map === "salao" && S.snack !== dayKey()) {
          S.snack = dayKey(); S.energy = Math.min(S.emax, S.energy + 25); SFX.pick();
          say(null, "Tem um prato coberto com um bilhete: \"Para o " + S.name + ". Coma direito.\" (+25 energia)");
        } else say(null, "A bancada está limpinha. Cheiro de pão no ar.");
        break;
      case "well":
        if (S.well !== dayKey() && S.gold > 0) {
          S.well = dayKey(); S.gold -= 1; SFX.coin();
          say(null, "Você joga uma moedinha no poço e faz um pedido. (−¤1)\nParece que hoje é um bom dia para pescar algo raro.");
        } else say(null, "O poço é fundo. Dá para ouvir a água lá embaixo.");
        break;
      case "fountain": say(null, "A água da fonte brilha com a luz. Alguém deixou uma flor na beirada."); break;
      case "water": fishStart(); break;
    }
  }

  /* ================= pesca ================= */
  var F = null;
  function fishStart() {
    if (S.energy <= 0) { say(null, "Você está exausto demais para pescar. Coma algo ou vá dormir."); return; }
    F = { ph: "charge", p: 0, d: 1 };
  }
  function fishCast() {
    var pw = F.p, d = DIRS[S.dir], dist = 1 + Math.round(pw * 3), tx, ty;
    for (; dist >= 1; dist--) {
      tx = Math.floor((S.x + d[0] * dist * T) / T); ty = Math.floor((S.y - 4 + d[1] * dist * T) / T);
      if (chAt(MP, tx, ty) === "~") break;
    }
    if (dist < 1) { F = null; toast("A linha caiu fora da água."); return; }
    S.energy = Math.max(0, S.energy - 3);
    F = { ph: "wait", pw: pw, bx: tx * T + 8, by: ty * T + 8, t: rnd(1.2, 4.5) * (1 - pw * 0.35) };
    beep(500, 0.06, "triangle", 0.04);
  }
  function pickFish(pw) {
    var spot = MP.fish, h = hour(), luck = S.well === dayKey() ? 0.4 : 0, list = [], tot = 0;
    Object.keys(RZ.FISH).forEach(function (k) {
      var f = RZ.FISH[k];
      if (f.at.indexOf(spot) < 0) return;
      if (f.se && f.se.indexOf(S.season) < 0) return;
      if (f.h && (h < f.h[0] || h >= f.h[1])) return;
      if (f.rain && S.weather === "sol") return;
      var w = f.w * (f.d >= 50 ? 0.6 + pw * 1.2 + luck : 1) * (f.rare ? 0.5 + pw * 2 + luck * 2 : 1);
      if (S.weather !== "sol" && f.d >= 50) w *= 1.4;
      list.push([k, w]); tot += w;
    });
    var r = Math.random() * tot;
    for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i][0]; }
    return list.length ? list[0][0] : "lambari";
  }
  function fishPress() {
    if (!F) return;
    if (F.ph === "wait") { F = null; toast("Puxou cedo demais."); return; }
    if (F.ph === "bite") {
      var id = pickFish(F.pw), fd = RZ.FISH[id];
      F = { ph: "reel", id: id, d: fd.d, b: fd.b, bar: 0, bv: 0, bh: 0.3 - fd.d / 100 * 0.08, f: 0.4, ft: 0.5, tt: 0, prog: 0.3, perfect: true,
        chest: Math.random() < 0.15 ? { y: rnd(0.1, 0.9), p: 0, got: false } : null };
    }
  }
  function fishEnd() { F = null; }
  function updateFish(dt) {
    if (!F) return;
    if (F.ph === "charge") {
      F.p += F.d * dt * 1.3;
      if (F.p >= 1) { F.p = 1; F.d = -1; } else if (F.p <= 0) { F.p = 0; F.d = 1; }
    } else if (F.ph === "wait") {
      F.t -= dt;
      if (F.t <= 0) { F.ph = "bite"; F.t = 0.85; SFX.bite(); if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {} }
    } else if (F.ph === "bite") {
      F.t -= dt;
      if (F.t <= 0) { F = null; SFX.miss(); toast("O peixe escapou..."); }
    } else if (F.ph === "reel") {
      var hold = aHeld || canvasHeld;
      F.bv += (hold ? 2.6 : -2.2) * dt;
      F.bar += F.bv * dt;
      if (F.bar < 0) { F.bar = 0; F.bv *= -0.3; }
      if (F.bar > 1 - F.bh) { F.bar = 1 - F.bh; F.bv *= -0.3; }
      // peixe
      F.tt -= dt;
      var spd = 0.25 + F.d / 100 * 1.5;
      if (F.tt <= 0) {
        var bias = F.b === "afunda" ? [0, 0.55] : F.b === "flutua" ? [0.45, 1] : [0, 1];
        F.ft = rnd(bias[0], bias[1]);
        F.tt = F.b === "calmo" ? rnd(1.2, 2.2) : F.b === "rapido" ? rnd(0.25, 0.8) : rnd(0.6, 1.4);
        if (F.b === "rapido" && Math.random() < 0.3) spd *= 2;
      }
      var df = F.ft - F.f;
      F.f += Math.sign(df) * Math.min(Math.abs(df), spd * dt * (F.b === "rapido" ? 1.6 : 1));
      if (F.b === "rapido") F.f += rnd(-0.004, 0.004) * F.d / 30;
      F.f = clamp(F.f, 0.02, 0.98);
      var inside = F.f >= F.bar && F.f <= F.bar + F.bh;
      F.prog += (inside ? 0.3 : -0.2) * dt;
      if (!inside) F.perfect = false;
      if (F.chest && !F.chest.got) {
        if (F.chest.y >= F.bar && F.chest.y <= F.bar + F.bh) F.chest.p += dt * 0.6;
        if (F.chest.p >= 1) { F.chest.got = true; SFX.pick(); }
      }
      if (F.prog >= 1) fishCatch();
      else if (F.prog <= 0) { F = null; SFX.miss(); toast("O peixe escapou..."); }
    }
  }
  function fishCatch() {
    var id = F.id, it = RZ.ITEMS[id], perfect = F.perfect, chest = F.chest && F.chest.got;
    F = null;
    addItem(id); S.stats.fish++; S.stats.caught[id] = (S.stats.caught[id] || 0) + 1;
    doneQ("fish1"); SFX.catch();
    var msg = "Você pescou: " + it.n + "! (vale ¤" + it.p + ")";
    if (S.stats.caught[id] === 1) msg += "\nPrimeira vez que pesca essa espécie!";
    if (perfect) { S.gold += 20; msg += "\nCaptura perfeita! +¤20"; }
    if (chest) {
      if (Math.random() < 0.35) { addItem("cristal"); msg += "\nNo baú: uma Pedra brilhante!"; }
      else { var g = Math.floor(rnd(40, 140)); S.gold += g; msg += "\nNo baú: ¤" + g + "!"; }
    }
    if (id === "rei") msg += "\n\nO lendário Rei do Lago! O Seu Bento não vai acreditar.";
    sayIcon(id, msg);
  }

  /* ================= entrada ================= */
  var keys = {}, joy = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, aHeld = false, canvasHeld = false;
  window.addEventListener("keydown", function (e) {
    if (!S || $("#title").style.display !== "none") return;
    if (e.target && e.target.tagName === "INPUT") return;
    var k = e.key.toLowerCase();
    keys[k] = true;
    if (e.repeat) return;
    if (k === " " || k === "e" || k === "enter" || k === "z") { e.preventDefault(); aHeld = true; aPress(); }
    else if (k === "escape" || k === "i" || k === "tab" || k === "x") { e.preventDefault(); bPress(); }
    else if (/^[1-4]$/.test(k) && cur && cur.ch) { var b = $("#dlg .ch").children[+k - 1]; if (b) b.click(); }
  });
  window.addEventListener("keyup", function (e) {
    var k = e.key.toLowerCase();
    keys[k] = false;
    if (k === " " || k === "e" || k === "enter" || k === "z") { aHeld = false; aRelease(); }
  });
  function aPress() {
    audio();
    if (cur) { if (!cur.ch) advance(); return; }
    if (menuOpen || fade > 0) return;
    if (F) { fishPress(); return; }
    interact();
  }
  function aRelease() { if (F && F.ph === "charge") fishCast(); }
  function bPress() {
    audio();
    if (cur) return;
    if (F && F.ph !== "reel") { F = null; return; }
    if (menuOpen) closePanel(); else openMenu("bag");
  }
  var bA = $("#btnA"), bB = $("#btnB");
  bA.addEventListener("pointerdown", function (e) { e.preventDefault(); aHeld = true; bA.classList.add("on"); aPress(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
    bA.addEventListener(ev, function () { if (aHeld) { aHeld = false; bA.classList.remove("on"); aRelease(); } });
  });
  bB.addEventListener("pointerdown", function (e) { e.preventDefault(); bPress(); });

  var jb = $("#joy"), jk = $("#knob");
  cv.addEventListener("touchstart", function (e) {
    audio();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (F && F.ph === "reel") { canvasHeld = true; continue; }
      if (cur) { if (!cur.ch) advance(); continue; }
      if (F && F.ph === "bite") { fishPress(); continue; }
      if (!joy.on && t.clientX < W * 0.6) {
        joy.on = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = 0; joy.y = 0;
        jb.style.left = t.clientX - 50 + "px"; jb.style.top = t.clientY - 50 + "px"; jb.style.display = "block"; jk.style.transform = "translate(0,0)";
      }
    }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener("touchmove", function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (joy.on && t.identifier === joy.id) {
        var dx = t.clientX - joy.ox, dy = t.clientY - joy.oy, d = Math.hypot(dx, dy), m = 40;
        if (d > m) { dx = dx / d * m; dy = dy / d * m; }
        joy.x = dx / m; joy.y = dy / m;
        jk.style.transform = "translate(" + dx + "px," + dy + "px)";
      }
    }
    e.preventDefault();
  }, { passive: false });
  function touchEnd(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (joy.on && e.changedTouches[i].identifier === joy.id) { joy.on = false; joy.x = joy.y = 0; jb.style.display = "none"; }
    }
    if (!e.touches.length) canvasHeld = false;
  }
  cv.addEventListener("touchend", touchEnd);
  cv.addEventListener("touchcancel", touchEnd);
  cv.addEventListener("mousedown", function () { audio(); if (F && F.ph === "reel") canvasHeld = true; else if (cur && !cur.ch) advance(); });
  window.addEventListener("mouseup", function () { canvasHeld = false; });

  /* ================= interface: diálogo ================= */
  var queue = [], cur = null;
  function say(name, text, choices, then) { queue.push({ n: name, t: text, ch: choices, then: then }); if (!cur) nextDlg(); }
  function sayIcon(id, text) { queue.push({ n: null, t: text, icon: id }); if (!cur) nextDlg(); }
  function nextDlg() {
    var d = $("#dlg");
    cur = queue.shift() || null;
    if (!cur) { d.hidden = true; return; }
    d.hidden = false;
    d.querySelector(".nm").textContent = cur.n || "";
    d.querySelector(".nm").style.display = cur.n ? "" : "none";
    d.querySelector(".tx").innerHTML = (cur.icon ? ico(cur.icon, true) : "") + esc(cur.t).replace(/\n/g, "<br>");
    var ch = d.querySelector(".ch");
    ch.innerHTML = "";
    if (cur.ch) cur.ch.forEach(function (c) {
      var b = document.createElement("button");
      b.textContent = c[0];
      b.onclick = function (ev) {
        ev.stopPropagation();
        cur = null; $("#dlg").hidden = true;
        if (c[1]) c[1]();
        if (!cur) nextDlg();
      };
      ch.appendChild(b);
    });
    d.querySelector(".more").style.display = cur.ch ? "none" : "";
  }
  function advance() {
    if (!cur || cur.ch) return;
    var f = cur.then; cur = null;
    if (f) f();
    if (!cur) nextDlg();
  }
  $("#dlg").addEventListener("click", function () { if (cur && !cur.ch) advance(); });

  var toastT = 0;
  function toast(t, id) {
    var el = $("#toast");
    el.innerHTML = (id ? ico(id) : "") + esc(t);
    el.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove("show"); }, 1900);
  }

  /* ================= interface: painéis ================= */
  var menuOpen = false, panelFn = null, menuTab = "bag";
  function openPanel(title, fn) {
    menuOpen = true; panelFn = fn;
    $("#panel").hidden = false;
    $("#panel .pt").textContent = title;
    renderPanel();
  }
  function renderPanel() { if (panelFn) $("#panel .pb").innerHTML = panelFn(); }
  function closePanel() { menuOpen = false; panelFn = null; $("#panel").hidden = true; save(); }
  $("#panel .px").addEventListener("click", closePanel);

  var TABS = [["bag", "Mochila"], ["ppl", "Pessoas"], ["hse", "Casas"], ["qst", "Tarefas"], ["sys", "Jogo"]];
  function openMenu(tab) {
    menuTab = tab || menuTab;
    openPanel("Menu", function () {
      var h = '<div class="tabs">' + TABS.map(function (t) { return '<button data-a="tab:' + t[0] + '" class="' + (t[0] === menuTab ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div>";
      return h + TAB[menuTab]();
    });
  }
  var TAB = {
    bag: function () {
      var l = invList();
      var h = '<p class="muted">¤' + S.gold + " · Energia " + Math.round(S.energy) + "/" + S.emax + "</p>";
      if (!l.length) return h + '<p class="muted">A mochila está vazia. Procure coisas pelo chão, pesque ou compre na banca da Marta.</p>';
      return h + '<div class="list">' + l.map(function (k) {
        var it = RZ.ITEMS[k];
        return '<div class="row">' + ico(k) + '<div class="g"><b>' + esc(it.n) + "</b> ×" + S.inv[k] + '<small>Vale ¤' + it.p + (it.e ? " · +" + it.e + " energia" : "") + "</small></div>" +
          (it.e ? '<button data-a="eat:' + k + '">Comer</button>' : "") + "</div>";
      }).join("") + "</div>";
    },
    ppl: function () {
      return '<div class="list">' + Object.keys(RZ.PEOPLE).map(function (id) {
        var p = RZ.PEOPLE[id], r = S.rel[id];
        return '<div class="row"><div class="g"><b>' + esc(p.n) + "</b> " + heartsHTML(id) + "<small>" +
          (r.t ? "Conversou hoje" : "Ainda não conversou hoje") + (r.g ? " · Presente dado" : "") + "</small></div></div>";
      }).join("") + '</div><p class="muted">Converse todo dia (+♥) e dê um presente por dia. Cada pessoa tem gostos próprios.</p>';
    },
    hse: function () {
      return '<div class="list">' + Object.keys(RZ.HOUSES).map(function (id) {
        var hs = RZ.HOUSES[id], own = S.houses[id];
        return '<div class="row"><div class="g"><b>' + esc(hs.name) + "</b>" + (S.home === id ? ' <span class="tag">Seu lar</span>' : "") +
          "<small>" + esc(hs.desc) + "<br>" + (own ? "Sua. Durma lá para mudar de lar." : "À venda: ¤" + hs.price + " (com o Tomás, em Irlam)") + "</small></div></div>";
      }).join("") + "</div>";
    },
    qst: function () {
      return '<div class="list">' + RZ.QUESTS.map(function (q) {
        var ok = S.quests[q.id];
        return '<div class="row' + (ok ? " done" : "") + '"><div class="g"><b>' + (ok ? "✓ " : "○ ") + esc(q.t) + "</b><small>Recompensa ¤" + q.r + "</small></div></div>";
      }).join("") + '</div><p class="muted">Peixes pescados: ' + S.stats.fish + " · Espécies: " + Object.keys(S.stats.caught).length + "/" + Object.keys(RZ.FISH).length + " · Vendido: ¤" + S.stats.sold + "</p>";
    },
    sys: function () {
      return '<div class="list">' +
        '<button class="wide" data-a="save">Salvar agora</button>' +
        '<button class="wide" data-a="snd">Som: ' + (S.sound ? "ligado" : "desligado") + "</button>" +
        '<button class="wide" data-a="full">Tela cheia</button>' +
        '<button class="wide" data-a="help">Como jogar</button>' +
        '<button class="wide" data-a="title">Voltar ao início</button>' +
        '<button class="wide danger" data-a="reset">Apagar save e recomeçar</button></div>' +
        '<p class="muted">O jogo salva sozinho ao dormir e ao trocar de lugar. Jogo de fã, sem fins lucrativos.</p>';
    }
  };

  function shopMenu() {
    openPanel("Banca da Marta", function () {
      return '<p class="muted">Você tem ¤' + S.gold + "</p><div class=\"list\">" + RZ.SHOP.map(function (k) {
        var it = RZ.ITEMS[k];
        return '<div class="row">' + ico(k) + '<div class="g"><b>' + esc(it.n) + "</b><small>" + (it.e ? "+" + it.e + " energia" : "Presente que quase todo mundo ama") + " · tem " + (S.inv[k] || 0) + "</small></div>" +
          '<button data-a="buy:' + k + '"' + (S.gold < it.buy ? " disabled" : "") + ">¤" + it.buy + "</button></div>";
      }).join("") + "</div>";
    });
  }
  function sellList(act) {
    var l = invList();
    if (!l.length) return '<p class="muted">Nada para vender.</p>';
    return '<div class="list">' + l.map(function (k) {
      var it = RZ.ITEMS[k];
      return '<div class="row">' + ico(k) + '<div class="g"><b>' + esc(it.n) + "</b> ×" + S.inv[k] + "<small>¤" + it.p + " cada</small></div>" +
        '<button data-a="' + act + "1:" + k + '">1</button><button data-a="' + act + "all:" + k + '">Todos</button></div>';
    }).join("") + "</div>";
  }
  function sellMenu() {
    openPanel("Vender para a Marta", function () { return '<p class="muted">Pagamento na hora. Você tem ¤' + S.gold + "</p>" + sellList("sell"); });
  }
  function shipMenu() {
    openPanel("Caixa de entregas", function () {
      var pend = 0;
      Object.keys(S.ship).forEach(function (k) { pend += RZ.ITEMS[k].p * S.ship[k]; });
      return '<p class="muted">O que você deixar aqui é vendido durante a noite. Na caixa: ¤' + pend + "</p>" + sellList("ship");
    });
  }
  function giftMenu(id) {
    openPanel("Presente para " + RZ.PEOPLE[id].n, function () {
      return '<div class="list">' + invList().map(function (k) {
        return '<div class="row">' + ico(k) + '<div class="g"><b>' + esc(RZ.ITEMS[k].n) + "</b> ×" + S.inv[k] + '</div><button data-a="gift:' + id + ":" + k + '">Dar</button></div>';
      }).join("") + "</div>";
    });
  }
  function houseMenu() {
    openPanel("Casas do Tomás", function () {
      return '<p class="muted">Você tem ¤' + S.gold + '</p><div class="list">' + Object.keys(RZ.HOUSES).filter(function (k) { return RZ.HOUSES[k].price; }).map(function (id) {
        var hs = RZ.HOUSES[id];
        return '<div class="row"><div class="g"><b>' + esc(hs.name) + "</b><small>" + esc(hs.desc) + "</small></div>" +
          (S.houses[id] ? '<span class="tag">Sua</span>' : '<button data-a="house:' + id + '"' + (S.gold < hs.price ? " disabled" : "") + ">¤" + hs.price + "</button>") + "</div>";
      }).join("") + "</div>";
    });
  }
  function help() {
    closePanel();
    say(null, "Como jogar:\n• Celular: arraste o dedo no lado esquerdo da tela para andar. A fala, pega, pesca e interage. B abre o menu.\n• Teclado: setas ou WASD, E ou Espaço para A, Esc para o menu.");
    say(null, "Pesca: de frente para a água, segure A e solte para lançar (mais forte = peixes raros). Quando aparecer \"!\", toque A. Depois segure para subir a barra verde e manter o peixe dentro dela.");
    say(null, "O dia começa às 6h. Depois das 2h você desmaia. Durma na sua cama para salvar e ver o que a caixa de entregas vendeu.");
  }

  $("#panel .pb").addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]");
    if (!b || b.disabled) return;
    var a = b.getAttribute("data-a").split(":");
    var it = a[1] && RZ.ITEMS[a[1]];
    switch (a[0]) {
      case "tab": menuTab = a[1]; break;
      case "eat":
        if (takeItem(a[1])) { S.energy = Math.min(S.emax + 10, S.energy + it.e); SFX.pick(); toast("+" + it.e + " energia"); }
        break;
      case "buy":
        if (S.gold >= it.buy) { S.gold -= it.buy; addItem(a[1]); SFX.coin(); }
        break;
      case "sell1": case "sellall":
        var n = a[0] === "sell1" ? 1 : S.inv[a[1]];
        if (takeItem(a[1], n)) { S.gold += it.p * n; S.stats.sold += it.p * n; SFX.coin(); }
        break;
      case "ship1": case "shipall":
        var m = a[0] === "ship1" ? 1 : S.inv[a[1]];
        if (takeItem(a[1], m)) { S.ship[a[1]] = (S.ship[a[1]] || 0) + m; doneQ("ship1"); SFX.pick(); }
        break;
      case "gift": giveGift(a[1], a[2]); return;
      case "house": buyHouse(a[1]); return;
      case "save": save(); toast("Jogo salvo."); break;
      case "snd": S.sound = !S.sound; break;
      case "full":
        try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (er) {}
        break;
      case "help": help(); return;
      case "title": closePanel(); save(); showTitle(); return;
      case "reset":
        closePanel();
        say(null, "Apagar todo o progresso? Isso não pode ser desfeito.", [["Apagar", function () { localStorage.removeItem(SAVEKEY); S = null; showTitle(); }], ["Cancelar", null]]);
        return;
    }
    renderPanel();
  });

  /* ================= HUD ================= */
  var hudCache = "";
  function hud() {
    var s = RZ.SEASONS[S.season] + " " + S.day + " · " + weekday() + "|" + fmtH(S.min) + "|" + WICON[S.weather] + "|" + S.gold + "|" + Math.round(S.energy);
    if (s === hudCache) return;
    hudCache = s;
    var p = s.split("|");
    $("#hDate").textContent = p[0];
    $("#hTime").textContent = p[2] + " " + p[1];
    $("#hGold").textContent = "¤" + p[3];
    var e = clamp(S.energy / S.emax, 0, 1.1);
    $("#hEn i").style.height = Math.min(100, e * 100) + "%";
    $("#hEn i").style.background = e > 0.5 ? "#6fcf5a" : e > 0.2 ? "#f0c040" : "#e8503c";
  }
  var aLabel = "";
  function setA(l) { if (l !== aLabel) { aLabel = l; bA.textContent = l || "A"; bA.classList.toggle("lbl", !!l); } }

  /* ================= laço principal ================= */
  var rain = [], last = 0, walkT = 0;
  function update(dt) {
    if (fadeDir) {
      fade += fadeDir * dt * 4;
      if (fade >= 1 && fadeDir > 0) { fade = 1; fadeDir = -1; var cb = fadeCb; fadeCb = null; if (cb) cb(); }
      if (fade <= 0 && fadeDir < 0) { fade = 0; fadeDir = 0; }
      return;
    }
    if (cur || menuOpen) return;
    if (F && F.ph === "reel") { updateFish(dt); return; }
    // relógio
    S.min += dt * (10 / 7);
    if (S.min >= 26 * 60) { S.min = 26 * 60; passOut(); return; }
    updateNPCs(dt);
    updateFish(dt);
    // movimento
    var mx = 0, my = 0;
    if (!F) {
      if (keys.arrowleft || keys.a) mx -= 1;
      if (keys.arrowright || keys.d) mx += 1;
      if (keys.arrowup || keys.w) my -= 1;
      if (keys.arrowdown || keys.s) my += 1;
      if (joy.on && Math.hypot(joy.x, joy.y) > 0.2) { mx = joy.x; my = joy.y; }
    }
    var ml = Math.hypot(mx, my);
    if (ml > 0.01) {
      if (ml > 1) { mx /= ml; my /= ml; }
      var sp = (S.energy <= 0 ? 48 : 78) * dt;
      if (Math.abs(mx) > Math.abs(my)) S.dir = mx > 0 ? "right" : "left"; else S.dir = my > 0 ? "down" : "up";
      var nx = S.x + mx * sp, ny = S.y + my * sp;
      if (!blockedAt(nx, S.y)) S.x = nx;
      if (!blockedAt(S.x, ny)) S.y = ny;
      walkT += dt;
      var tx = Math.floor(S.x / T), ty = Math.floor((S.y - 3) / T);
      var p = portalAt(MP, tx, ty);
      if (p && portalOk(p)) {
        SFX.door();
        doFade(function () { goMap(p.to, p.tx, p.ty, p.dir); });
        return;
      }
      var fi = forageAt(tx, ty);
      if (fi >= 0) pickForage(fi);
    } else walkT = 0;
  }

  function render(t) {
    var s = dpr * sc, vw = W / sc, vh = H / sc, mw = MP.m.w * T, mh = MP.m.h * T;
    var cx = mw < vw ? -(vw - mw) / 2 : clamp(S.x - vw / 2, 0, mw - vw);
    var cy = mh < vh ? -(vh - mh) / 2 : clamp(S.y - 10 - vh / 2, 0, mh - vh);
    cx = Math.round(cx * s) / s; cy = Math.round(cy * s) / s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = MP.indoor ? "#1a1410" : "#24331f";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    var mc = mapCanvas(S.map);
    ctx.drawImage(mc.base, 0, 0);
    // brilho da água
    var x0 = Math.max(0, Math.floor(cx / T)), y0 = Math.max(0, Math.floor(cy / T)), x1 = Math.min(MP.m.w - 1, Math.ceil((cx + vw) / T)), y1 = Math.min(MP.m.h - 1, Math.ceil((cy + vh) / T));
    var ph = Math.floor(t / 400);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var ch = MP.m.g[y][x];
      if (ch === "~" || ch === "o") {
        if (hash(x, y, ph) > 0.6) R(ctx, x * T + 3 + Math.floor(hash(x, y, ph + 1) * 9), y * T + 5 + Math.floor(hash(x, y, ph + 2) * 7), 3, 1, "rgba(255,255,255,.55)");
      }
    }
    // coleta
    (S.forage[S.map] || []).forEach(function (f) {
      var bob = Math.sin(t / 300 + f[0]) * 1;
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(f[0] * T + 8, f[1] * T + 13, 5, 2, 0, 0, 7); ctx.fill();
      ctx.drawImage(icon(f[2]), f[0] * T + 2, f[1] * T + 1 + bob, 12, 12);
    });
    // pessoas
    var ents = npcsHere().map(function (n) { return { y: n.y, f: function () { drawPerson(ctx, n.x, n.y, RZ.PEOPLE[n.id].look, n.dir, n.fr, n.id); } }; });
    var pfr = walkT > 0 ? Math.floor(walkT * 8) % 4 : 0;
    ents.push({ y: S.y, f: function () { drawPerson(ctx, S.x, S.y, PLOOK, S.dir, pfr, "player"); } });
    ents.sort(function (a, b) { return a.y - b.y; }).forEach(function (e) { e.f(); });
    ctx.drawImage(mc.top, 0, 0);
    // pesca (no mundo)
    if (F) {
      var d = DIRS[S.dir], hx = S.x + d[0] * 6, hy = S.y - 12;
      if (F.ph === "charge") {
        R(ctx, S.x - 10, S.y - 32, 20, 4, "#2a2020"); R(ctx, S.x - 9, S.y - 31, 18 * F.p, 2, F.p > 0.8 ? "#6fcf5a" : F.p > 0.4 ? "#f0c040" : "#e8883c");
      } else if (F.ph === "wait" || F.ph === "bite") {
        var bb = F.ph === "bite" ? Math.sin(t / 40) * 2 : Math.sin(t / 300) * 1;
        ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + F.bx) / 2, Math.min(hy, F.by) - 8, F.bx, F.by + bb); ctx.stroke();
        R(ctx, F.bx - 2, F.by - 2 + bb, 4, 4, "#e8503c"); R(ctx, F.bx - 2, F.by + bb, 4, 2, "#fff");
        if (F.ph === "bite") { R(ctx, S.x - 3, S.y - 38, 6, 10, "#fff"); R(ctx, S.x - 1, S.y - 36, 2, 5, "#e8503c"); R(ctx, S.x - 1, S.y - 30, 2, 2, "#e8503c"); }
      }
    }
    // camada de tela
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // nomes
    ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    npcsHere().forEach(function (n) {
      var sx = (n.x - cx) * sc, sy = (n.y - 26 - cy) * sc;
      if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20) return;
      var nm = RZ.PEOPLE[n.id].n, w = ctx.measureText(nm).width + 10;
      ctx.fillStyle = "rgba(20,16,30,.62)"; roundRect(ctx, sx - w / 2, sy - 8, w, 16, 6); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(nm, sx, sy + 0.5);
    });
    // clima
    if (!MP.indoor && S.weather !== "sol") {
      var sn = S.weather === "neve";
      while (rain.length < (sn ? 60 : 90)) rain.push({ x: Math.random() * W, y: Math.random() * H, v: sn ? rnd(30, 60) : rnd(380, 520) });
      ctx.fillStyle = sn ? "rgba(255,255,255,.85)" : "rgba(180,200,255,.55)";
      rain.forEach(function (r) {
        r.y += r.v * 0.016; r.x += sn ? Math.sin(r.y / 30) * 0.4 : -1.2;
        if (r.y > H) { r.y = -10; r.x = Math.random() * W; }
        if (sn) ctx.fillRect(r.x, r.y, 2.5, 2.5); else ctx.fillRect(r.x, r.y, 1.2, 9);
      });
      ctx.fillStyle = "rgba(40,50,70,.18)"; ctx.fillRect(0, 0, W, H);
    }
    // noite
    var h = hour(), a = 0;
    if (h >= 18) a = Math.min(0.58, (h - 18) / 3 * 0.58);
    else if (h < 6.6) a = 0.25 * (6.6 - h) / 0.6;
    if (MP.indoor) a *= 0.35;
    if (a > 0) { ctx.fillStyle = "rgba(18,22,64," + a + ")"; ctx.fillRect(0, 0, W, H); }
    // minijogo
    if (F && F.ph === "reel") drawReel();
    if (fade > 0) { ctx.fillStyle = "rgba(0,0,0," + fade + ")"; ctx.fillRect(0, 0, W, H); }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function drawReel() {
    var ph = Math.min(300, H * 0.5), pw = 54, px = W - pw - 92, py = (H - ph) / 2 - 30;
    if (W < 500) px = W / 2 + 30;
    ctx.fillStyle = "rgba(20,16,30,.8)"; roundRect(ctx, px - 8, py - 8, pw + 40, ph + 16, 10); ctx.fill();
    ctx.fillStyle = "#2f5f8f"; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "#3f7fc6"; ctx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    var by = py + ph - (F.bar + F.bh) * ph, bh = F.bh * ph;
    var inside = F.f >= F.bar && F.f <= F.bar + F.bh;
    ctx.fillStyle = inside ? "rgba(120,230,110,.85)" : "rgba(120,230,110,.5)"; ctx.fillRect(px + 4, by, pw - 8, bh);
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(px + 4, by, pw - 8, 2); ctx.fillRect(px + 4, by + bh - 2, pw - 8, 2);
    if (F.chest && !F.chest.got) {
      var cy2 = py + ph - F.chest.y * ph;
      ctx.fillStyle = "#9a6a3e"; ctx.fillRect(px + pw / 2 - 8, cy2 - 6, 16, 12); ctx.fillStyle = "#e8c870"; ctx.fillRect(px + pw / 2 - 2, cy2 - 2, 4, 3);
      ctx.fillStyle = "#e8c870"; ctx.fillRect(px + pw / 2 - 8, cy2 + 8, 16 * F.chest.p, 2);
    }
    var fy = py + ph - F.f * ph;
    ctx.save(); ctx.translate(px + pw / 2 - 10, fy - 10); ctx.scale(1.3, 1.3); ctx.imageSmoothingEnabled = false; ctx.drawImage(icon(F.id), 0, 0); ctx.restore();
    // progresso
    ctx.fillStyle = "#1a1410"; ctx.fillRect(px + pw + 10, py, 14, ph);
    var pg = clamp(F.prog, 0, 1);
    ctx.fillStyle = pg > 0.66 ? "#6fcf5a" : pg > 0.33 ? "#f0c040" : "#e8503c";
    ctx.fillRect(px + pw + 12, py + ph - pg * ph, 10, pg * ph);
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Segure para subir", px + pw / 2 + 16, py + ph + 24);
  }

  function loop(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (S && MP && $("#title").style.display === "none") {
      update(dt);
      if (S) {
        render(t);
        hud();
        var tg = !cur && !menuOpen && !F ? target() : null;
        setA(F ? (F.ph === "reel" ? "Puxar" : F.ph === "charge" ? "Soltar" : "Fisgar") : tg ? tg.l : "");
      }
    }
    requestAnimationFrame(loop);
  }

  /* ================= início ================= */
  function showTitle() {
    $("#title").style.display = "flex";
    $("#game").style.display = "none";
    var sv = loadSave();
    $("#tCont").style.display = sv ? "" : "none";
    if (sv) $("#tCont").textContent = "Continuar (" + sv.name + " · " + RZ.SEASONS[sv.season] + " " + sv.day + ")";
    $("#tNew").style.display = "";
    $("#tName").style.display = "none";
  }
  function startGame(s, fresh) {
    S = s; MP = RZ.maps[S.map]; MAPC = {}; hudCache = "";
    queue = []; cur = null; F = null; menuOpen = false;
    $("#dlg").hidden = true; $("#panel").hidden = true;
    $("#title").style.display = "none";
    $("#game").style.display = "block";
    if (fresh || !S.forage || !Object.keys(S.forage).length) spawnForage();
    initNPCs();
    if (fresh) {
      say(null, "Depois de dias difíceis, " + S.name + " encontrou abrigo na Mansão Roswaal.");
      say(null, "Aqui ganhou um quarto, uma cama macia e pessoas que, aos poucos, viram família.");
      say(null, "Explore, converse, pesque e, um dia, compre uma casa só sua. Um dia de cada vez.");
      say(null, matchMedia("(pointer:coarse)").matches
        ? "Arraste o dedo no lado esquerdo da tela para andar. O botão A fala, pega e pesca. B abre o menu (lá tem as Tarefas)."
        : "Ande com as setas ou WASD. E ou Espaço interage, Esc abre o menu (lá tem as Tarefas).");
    } else toast(MP.name);
  }
  $("#tCont").addEventListener("click", function () { audio(); var sv = loadSave(); if (sv) startGame(sv, false); });
  $("#tNew").addEventListener("click", function () {
    audio();
    $("#tNew").style.display = "none"; $("#tCont").style.display = "none"; $("#tName").style.display = "flex";
    $("#tName input").focus();
  });
  $("#tName").addEventListener("submit", function (e) {
    e.preventDefault();
    var nm = ($("#tName input").value || "").trim().slice(0, 14) || "Viajante";
    var s = normalize(defState(nm));
    s.tomorrow = rollWeather(0);
    startGame(s, true);
    save();
  });

  window.RZG = { // usado pelos testes
    get S() { return S; }, get F() { return F; }, NPC: NPC, goMap: goMap, sleep: sleep, target: target, interact: interact,
    talkTo: talkTo, buyHouse: buyHouse, addItem: addItem, solidTile: solidTile, advance: advance, get cur() { return cur; },
    personCanvas: personCanvas, PLOOK: PLOOK, get SPR() { return SPR; }
  };
  showTitle();
  requestAnimationFrame(loop);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
