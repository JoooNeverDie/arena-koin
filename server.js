/**
 * 🎮 ARENA KOIN — Game Multiplayer Demo (WebSocket / Socket.IO)
 * ------------------------------------------------------------
 * Konsep: SERVER-AUTHORITATIVE
 *   - Server = "wasit" & sumber kebenaran: posisi semua pemain
 *     disimpan DI SERVER, bukan di client (anti-cheat sederhana).
 *   - Client hanya KIRIM INPUT arah {dx, dy}.
 *   - Server gerakin pemain di game loop, lalu broadcast "state"
 *     ke semua pemain 20x per detik.
 *
 * Alur pesan:
 *   client  --join(name)-->   server   (masuk arena)
 *   client  --input(dx,dy)--> server   (arah gerak)
 *   server  --state(...)-->   semua client (posisi semua pemain + koin)
 *   client  --chat(msg)-->    server -> broadcast ke semua
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

// ====== PENGATURAN GAME (silakan diubah-ubah!) ======
const WORLD   = { w: 1000, h: 620 }; // ukuran arena
const SPEED   = 240;   // kecepatan pemain (px/detik)
const TICK_MS = 50;    // detak game loop (50ms = 20x/detik)
const PLAYER_R = 17;   // radius pemain
const COIN_R   = 11;   // radius koin
const MAX_COINS = 10;  // jumlah koin di arena
const COLORS = ["#7c5cfc", "#00d4d4", "#ff6b9d", "#ffb347", "#7bed9f",
                "#70a1ff", "#ff7f50", "#eccc68", "#ff96d1", "#9aed91"];

// ====== WEB SERVER STATIS (serve index.html) ======
const server = http.createServer((req, res) => {
  // API statistik untuk bot / halaman lain
  if (req.url === "/api/stats") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({
      online: players.size,
      uptime: Math.round(process.uptime()),
      players: [...players.values()]
        .map((p) => ({ name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score),
    }));
    return;
  }

  const file = path.join(__dirname, "public", req.url === "/" ? "index.html" : req.url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
  });
});

// ====== WEBSOCKET ======
const io = new Server(server);

const players = new Map(); // socketId -> data pemain
const coins = [];

function spawnCoin() {
  coins.push({
    x: COIN_R + 20 + Math.random() * (WORLD.w - (COIN_R + 20) * 2),
    y: COIN_R + 20 + Math.random() * (WORLD.h - (COIN_R + 20) * 2),
  });
}
for (let i = 0; i < MAX_COINS; i++) spawnCoin();

io.on("connection", (socket) => {
  let joined = false;

  // ---- pemain masuk ----
  socket.on("join", (rawName) => {
    if (joined) return;
    joined = true;
    let name = String(rawName || "").trim().slice(0, 14) || "Anonim";
    // hindari nama kembar
    const sama = [...players.values()].filter((p) => p.name === name).length;
    if (sama) name = name.slice(0, 11) + " " + (players.size + 1);

    players.set(socket.id, {
      id: socket.id,
      name,
      x: 60 + Math.random() * (WORLD.w - 120),
      y: 60 + Math.random() * (WORLD.h - 120),
      dx: 0, dy: 0,                 // arah gerak saat ini
      color: COLORS[players.size % COLORS.length],
      score: 0,
    });

    socket.emit("joined", { id: socket.id, world: WORLD, name });
    console.log(`➕ ${name} masuk (${players.size} online)`);
  });

  // ---- input arah dari client ----
  socket.on("input", (inp) => {
    const p = players.get(socket.id);
    if (!p) return;
    let dx = Number(inp && inp.dx) || 0;
    let dy = Number(inp && inp.dy) || 0;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; } // normalisasi
    p.dx = dx;
    p.dy = dy;
  });

  // ---- chat ----
  socket.on("chat", (raw) => {
    const p = players.get(socket.id);
    if (!p) return;
    const msg = String(raw || "").trim().slice(0, 120);
    if (!msg) return;
    io.emit("chat", { name: p.name, color: p.color, msg });
  });

  // ---- pemain keluar ----
  socket.on("disconnect", () => {
    const p = players.get(socket.id);
    if (p) console.log(`➖ ${p.name} keluar (${Math.max(0, players.size - 1)} online)`);
    players.delete(socket.id);
  });
});

// ====== GAME LOOP — detak jantung server ======
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - last) / 1000, 0.1); // delta time (detik)
  last = now;

  for (const p of players.values()) {
    // gerakkan pemain sesuai input terakhir
    p.x += p.dx * SPEED * dt;
    p.y += p.dy * SPEED * dt;
    // jangan keluar arena
    p.x = Math.max(PLAYER_R, Math.min(WORLD.w - PLAYER_R, p.x));
    p.y = Math.max(PLAYER_R, Math.min(WORLD.h - PLAYER_R, p.y));

    // tabrakan dengan koin?
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (Math.hypot(p.x - c.x, p.y - c.y) < PLAYER_R + COIN_R) {
        coins.splice(i, 1);
        p.score += 1;
        spawnCoin(); // koin baru muncul di tempat lain
      }
    }
  }

  // broadcast state ke SEMUA pemain
  io.emit("state", {
    players: [...players.values()].map((p) => ({
      id: p.id, name: p.name,
      x: Math.round(p.x), y: Math.round(p.y),
      color: p.color, score: p.score,
    })),
    coins: coins.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })),
  });
}, TICK_MS);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎮 Arena Koin jalan di http://0.0.0.0:${PORT}`);
  console.log("   Buka di 2 tab / 2 device untuk tes multiplayer!");
});
