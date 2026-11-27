// Teste rápido: node tests/smoke.js  (precisa de um servidor em http://localhost:8765)
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = [];
  p.on("pageerror", e => errs.push(String(e)));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto("http://localhost:8765/index.html");
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.screenshot({ path: "/tmp/s0_title.png" });
  await p.click("#tNew"); await p.fill("#tName input", "Teste"); await p.click("#tName button");
  await p.waitForTimeout(300);
  for (let i = 0; i < 5; i++) await p.evaluate(() => RZG.advance());
  await p.waitForTimeout(300);
  await p.screenshot({ path: "/tmp/s1_quarto.png" });
  // validações de mapa
  const v = await p.evaluate(() => {
    const out = [];
    for (const id in RZ.maps) {
      const mp = RZ.maps[id];
      mp.portals.forEach(pt => {
        const dst = RZ.maps[pt.to];
        if (RZG.solidTile(dst, pt.tx, pt.ty)) out.push(`chegada sólida ${id}->${pt.to} ${pt.tx},${pt.ty}`);
      });
    }
    for (const id in RZ.PEOPLE) RZ.PEOPLE[id].sched.forEach(s => {
      if (s[1] && RZG.solidTile(RZ.maps[s[1]], s[2], s[3], true)) out.push(`rotina sólida ${id} ${s}`);
    });
    return out;
  });
  console.log("validação:", v.length ? v : "ok");
  // andar
  await p.keyboard.down("ArrowRight"); await p.waitForTimeout(500); await p.keyboard.up("ArrowRight");
  const shots = [["mansao", 21, 16], ["estrada", 22, 15], ["irlam", 20, 18], ["salao", 14, 8], ["casa1", 5, 6]];
  for (const [m, x, y] of shots) {
    await p.evaluate(([m, x, y]) => { RZG.goMap(m, x, y, "down"); RZG.S.min = m === "irlam" ? 11 * 60 : 8 * 60; }, [m, x, y]);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `/tmp/s_${m}.png` });
  }
  // conversa
  await p.evaluate(() => { RZG.S.min = 8 * 60; RZG.goMap("salao", 25, 4, "up"); });
  await p.waitForTimeout(200);
  console.log("alvo biblioteca:", await p.evaluate(() => JSON.stringify(RZG.target())));
  await p.evaluate(() => RZG.interact());
  await p.waitForTimeout(200);
  await p.screenshot({ path: "/tmp/s_talk.png" });
  await p.click("#dlg .ch button:last-child");
  // pesca
  await p.evaluate(() => { RZG.goMap("estrada", 28, 15, "up"); });
  await p.waitForTimeout(300);
  console.log("alvo pier:", await p.evaluate(() => JSON.stringify(RZG.target())));
  await p.keyboard.down("e"); await p.waitForTimeout(700); await p.keyboard.up("e");
  let st = "";
  for (let i = 0; i < 80; i++) { st = await p.evaluate(() => RZG.F && RZG.F.ph); if (st === "bite") break; await p.waitForTimeout(100); }
  console.log("fase:", st);
  await p.keyboard.press("e");
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/s_reel.png" });
  // bot: segura quando o peixe está acima da barra
  for (let i = 0; i < 300; i++) {
    const f = await p.evaluate(() => RZG.F && RZG.F.ph === "reel" ? [RZG.F.f, RZG.F.bar + RZG.F.bh / 2] : null);
    if (!f) break;
    if (f[0] > f[1]) await p.keyboard.down("e"); else await p.keyboard.up("e");
    await p.waitForTimeout(30);
  }
  await p.keyboard.up("e");
  await p.waitForTimeout(300);
  console.log("peixes:", await p.evaluate(() => JSON.stringify(RZG.S.inv)));
  await p.screenshot({ path: "/tmp/s_catch.png" });
  for (let i = 0; i < 3; i++) await p.evaluate(() => RZG.advance());
  // menu
  await p.click("#btnB"); await p.waitForTimeout(200);
  await p.screenshot({ path: "/tmp/s_menu.png" });
  await p.click("#panel .px");
  // noite + dormir
  await p.evaluate(() => { RZG.goMap("mansao", 21, 14, "down"); RZG.S.min = 21 * 60; RZG.S.weather = "chuva"; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/tmp/s_night.png" });
  await p.evaluate(() => { RZG.S.gold = 900; RZG.buyHouse("irlam"); RZG.advance(); RZG.sleep("irlam", false); });
  await p.waitForTimeout(900);
  console.log("após dormir:", await p.evaluate(() => [RZG.S.day, RZG.S.map, RZG.S.home, RZG.S.gold].join(" ")));
  await p.screenshot({ path: "/tmp/s_morning.png" });
  // estações
  await p.evaluate(() => { RZG.advance(); RZG.S.season = 3; RZG.goMap("mansao", 21, 22, "down"); RZG.S.weather = "neve"; RZG.S.min = 10 * 60; });
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/s_winter.png" });
  // simula um dia inteiro passando para testar NPCs andando
  await p.evaluate(() => { RZG.S.season = 0; RZG.S.weather = "sol"; RZG.goMap("salao", 14, 10, "down"); });
  for (let h = 6; h < 26; h += 1) { await p.evaluate(h => { RZG.S.min = h * 60; }, h); await p.waitForTimeout(250); }
  console.log("hora final:", await p.evaluate(() => [RZG.S.min, RZG.S.day, !!RZG.cur].join(" ")));
  console.log("erros:", errs.length ? errs : "nenhum");
  await b.close();
})();
