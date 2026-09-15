# 🪙 Arena Koin — Game Multiplayer WebSocket

Game multiplayer real-time sederhana untuk belajar: masuk arena, gerakkan
karakter, kumpulkan koin, lihat pemain lain bergerak **langsung** di layarmu.

## 🧠 Konsep utama: Server-Authoritative

```
Client (browser)                    Server (Node.js)
─────────────────                   ─────────────────────
ketik tombol/tap  ──input(dx,dy)──▶ gerakkan pemain di game loop
                                    cek tabrakan koin
gambar posisi     ◀────state──────── broadcast posisi SEMUA pemain + koin
                  ◀────chat───────── relay pesan chat
```

- **Server = wasit**: posisi & skor hanya disimpan di server (anti-cheat dasar).
- **Client = remote + layar**: cuma kirim arah, lalu gambar state yang dikirim server.
- Server broadcast **20×/detik**, client menggambar 60fps dengan *lerp* (posisi
  digambar dihaluskan menuju posisi terbaru dari server).

## ▶️ Cara menjalankan

```bash
cd game-multiplayer
npm install        # sekali saja (install socket.io)
node server.js     # jalan di http://localhost:3000
```

Buka `http://localhost:3000` di **2 tab / 2 device** → langsung saling lihat.

## 📁 Struktur

| File | Isi |
|---|---|
| `server.js` | Web server + WebSocket + game loop (semua logika game) |
| `public/index.html` | Client: canvas, input keyboard/tap, chat, leaderboard |

## 🔧 Pengaturan cepat (di `server.js`)

```js
const WORLD   = { w: 1000, h: 620 }; // ukuran arena
const SPEED   = 240;                 // kecepatan pemain
const TICK_MS = 50;                  // 20 update per detik
const MAX_COINS = 10;                // jumlah koin
```

## 🚀 Deploy biar bisa main bareng teman

Pilih salah satu (semuanya gratis untuk pemakaian kecil):

1. **Railway** (paling gampang): hubungkan repo GitHub → auto-deploy → dapat URL publik.
2. **Render**: buat *Web Service* → build `npm install` → start `node server.js`.
3. **VPS/Ubuntu**: `npm install` → jalankan dengan pm2:
   ```bash
   npm i -g pm2
   pm2 start server.js --name arena-koin
   pm2 save && pm2 startup
   ```

## 💡 Ide pengembangan

- Tambah **power-up** (speed boost, magnet koin)
- **Bot/AI** pemain yang jalan sendiri (untuk isi arena)
- Tim 2 warna + skor tim
- Integrasi ke **bot WhatsApp**: lobby & undangan via chat, arena tetap di web
- Anti-cheat lebih ketat: validasi jarak tempuh maksimum per tick

## 🤖 Fitur bot WhatsApp

Plugin `plugins/user/arena.js` — command **`.arena`** / `.game` / `.koin`:
mengirim kartu HTML berisi **data live** (pemain online + leaderboard,
diambil dari `GET /api/stats`) + tombol langsung main.

Pengaturan di atas file plugin:
```js
const GAME_URL = "http://localhost:3000"; // ganti: link publik untuk pemain
const API_URL  = "http://localhost:3000"; // bisa localhost kalau se-mesin
```

Server game juga harus jalan bersama bot, contoh dengan pm2:
```bash
pm2 start game-multiplayer/server.js --name arena-koin
```

## ⚠️ Catatan

- Tanpa database: pemain & skor hilang saat server restart (belajar dulu, ok).
- Socket.IO otomatis fallback ke HTTP long-polling kalau WebSocket diblokir jaringan.
