const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const p = await b.newPage();
  await p.goto("http://localhost:8765/index.html");
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const looks = [["Você", RZG.PLOOK], ["Marta", RZ.PEOPLE.marta.look], ["Tomás", RZ.PEOPLE.tomas.look], ["Seu Bento", RZ.PEOPLE.bento.look], ["Manto (série)", RZ.PEOPLE.emilia.look]];
    const dirs = ["down", "left", "right", "up"], S = 6;
    const cv = document.createElement("canvas"); cv.width = looks.length * 4 * 20 * S; cv.height = 2 * 28 * S + 30;
    const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
    c.fillStyle = "#7fb069"; c.fillRect(0, 0, cv.width, cv.height);
    looks.forEach(([n, lk], i) => {
      c.fillStyle = "#1d2a14"; c.font = "bold 22px sans-serif"; c.fillText(n, i * 80 * S + 10, 24);
      dirs.forEach((d, j) => [0, 1].forEach(f => c.drawImage(RZG.personCanvas(lk, d, f), (i * 80 + j * 20) * S, 30 + f * 28 * S, 18 * S, 26 * S)));
    });
    // modelo 48x128
    const m = document.createElement("canvas"); m.width = 48; m.height = 128;
    const mc = m.getContext("2d");
    dirs.forEach((d, row) => [0, 1, 3].forEach((f, col) => mc.drawImage(RZG.personCanvas(RZ.PEOPLE.emilia.look, d, f), col * 16 - 1, row * 32 + 7)));
    // guia ampliado com grade
    const g = document.createElement("canvas"); g.width = 48 * 8; g.height = 128 * 8;
    const gc = g.getContext("2d"); gc.imageSmoothingEnabled = false; gc.fillStyle = "#e9e4d8"; gc.fillRect(0, 0, g.width, g.height);
    gc.drawImage(m, 0, 0, g.width, g.height); gc.strokeStyle = "rgba(200,40,40,.8)"; gc.lineWidth = 2;
    for (let x = 0; x <= 3; x++) { gc.beginPath(); gc.moveTo(x * 128, 0); gc.lineTo(x * 128, g.height); gc.stroke(); }
    for (let y = 0; y <= 4; y++) { gc.beginPath(); gc.moveTo(0, y * 256); gc.lineTo(g.width, y * 256); gc.stroke(); }
    return [cv.toDataURL(), m.toDataURL(), g.toDataURL()];
  });
  const w = (f, d) => fs.writeFileSync(f, Buffer.from(d.split(",")[1], "base64"));
  w("/tmp/preview.png", r[0]); w("sprites/modelo.png", r[1]); w("docs/modelo-ampliado.png", r[2]);
  await b.close();
})();
