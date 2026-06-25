# ⚽ Jadwal Piala Dunia 2026 — Realtime

Aplikasi web untuk **jadwal, klasemen, dan bagan (bracket) Piala Dunia 2026**
(🇺🇸 Amerika Serikat · 🇨🇦 Kanada · 🇲🇽 Meksiko) yang **terintegrasi secara realtime**.

Format baru turnamen: **48 tim · 12 grup (A–L) · 104 pertandingan**.

![Bagan Piala Dunia 2026](https://img.shields.io/badge/Tim-48-2dd4bf) ![Grup](https://img.shields.io/badge/Grup-12-6366f1) ![Laga](https://img.shields.io/badge/Laga-104-f5c542)

---

## ✨ Fitur

| Tab | Isi |
|-----|-----|
| 🔴 **Live** | Ringkasan turnamen, laga yang sedang berlangsung, jadwal hari ini, hasil terbaru |
| 📅 **Jadwal** | 104 laga dikelompokkan per tanggal, dengan filter per babak (grup → final) |
| 📊 **Klasemen** | 12 tabel grup dihitung otomatis + tabel **8 peringkat-3 terbaik** |
| 🏆 **Bagan** | Bracket **dua sisi (kiri–kanan)** yang bertemu di Final tengah; 32 Besar → 16 Besar → Perempat → Semifinal → Juara 3 → Final, dengan **bendera tiap tim** (termasuk bendera kandidat pada slot yang belum pasti) |

### Integrasi Realtime
Skor sebuah laga langsung **menggerakkan klasemen dan mengisi bagan** tanpa reload:

1. **Pub/Sub internal** — UI menggambar ulang seketika saat data berubah.
2. **`localStorage`** — hasil tersimpan dan tetap ada saat halaman dibuka lagi.
3. **`BroadcastChannel`** — perubahan **tersinkron realtime antar-tab/jendela**
   (ubah skor di satu tab, tab lain ikut berubah seketika).
4. **Simulator Live** — mode otomatis yang menjalankan laga menit-demi-menit
   (menit & gol bertambah), lalu klasemen + bagan ikut berubah realtime.
5. **Bagan adaptif** — slot babak gugur menampilkan label (mis. *"Juara Grup A"*,
   *"Peringkat-3 #1"*, *"Pemenang M73"*) dan **terisi otomatis** begitu hasilnya pasti.
   Babak gugur yang imbang otomatis diselesaikan lewat **adu penalti**.

### Data Live dari Internet (TheSportsDB)
Aplikasi mencoba menarik **data nyata** (grup, jadwal, skor) dari TheSportsDB
melalui fungsi serverless Vercel `GET /api/wc`, lalu memperbaruinya otomatis
tiap 30 detik. Chip di kanan atas menunjukkan sumber data:

- 🟢 **Data Live** — berhasil menarik 12 grup lengkap dari API.
- 🟡 **Data contoh** — API belum tersedia/lengkap; aplikasi memakai data bawaan.

Konfigurasi (Vercel → Project → Settings → Environment Variables, semuanya opsional):

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `SPORTSDB_KEY` | `3` | Kunci API TheSportsDB (gratis untuk uji; isi kunci berbayar bila perlu). |
| `SPORTSDB_LEAGUE` | `4429` | ID liga FIFA World Cup di TheSportsDB. |
| `SPORTSDB_SEASON` | `2026` | Musim. |

> Buka `/api/wc` di browser untuk melihat respons mentah & menyesuaikan `league`/`season`
> bila grup belum terdeteksi. Pengambilan data berjalan di sisi server/klien (bukan saat build),
> sehingga selalu mengikuti kondisi terkini.

---

## 🚀 Menjalankan

Tidak ada langkah build — cukup file statis.

```bash
# opsi 1: server statis sederhana
npm start            # -> http://localhost:3000

# opsi 2: langsung
python3 -m http.server 3000
# lalu buka http://localhost:3000
```

> 💡 Untuk mencoba realtime antar-tab: buka aplikasi di **dua tab**, lalu ubah skor
> di panel kontrol (tombol 🎮) pada salah satu tab — tab lain ikut diperbarui.

### Menjalankan tes

```bash
npm test    # memvalidasi 104 laga, klasemen, peringkat-3, resolusi bagan, adu penalti
```

---

## 🎮 Panel Kontrol Realtime

Klik tombol melayang **🎮** di kanan bawah:

- **Mulai Mode Live** — menyalakan simulator (atur kecepatannya dengan slider).
- **Atur Skor Manual** — tombol `+ / −` per tim, plus `Live` / `Selesai` / `Reset` tiap laga.
- **Reset Semua** — kembalikan seluruh hasil ke jadwal awal.

Setiap perubahan langsung tercermin di tab Live, Klasemen, dan Bagan.

---

## ☁️ Deploy

Situs statis murni, bisa langsung di-deploy ke mana saja:

- **Vercel** — sudah ada `vercel.json`. Cukup `vercel` atau impor repo.
- **GitHub Pages / Netlify / Cloudflare Pages** — arahkan ke root repo.

---

## 🗂️ Struktur Proyek

```
.
├── index.html              # Kerangka halaman + panel kontrol
├── assets/
│   ├── css/style.css       # Tema gelap responsif
│   └── js/
│       ├── data.js         # 48 tim, 12 grup, generator 104 jadwal, struktur bagan
│       ├── engine.js       # Klasemen, peringkat-3, resolusi bagan, adu penalti
│       ├── realtime.js     # Sumber kebenaran + sinkron realtime + simulator
│       └── app.js          # Rendering UI & interaksi
├── test/logic.test.js      # Tes logika inti (Node, tanpa browser)
├── vercel.json
└── package.json
```

---

## 📝 Catatan Data

- **Format, jumlah laga, tanggal babak, dan 16 kota tuan rumah** mengikuti
  struktur resmi Piala Dunia 2026.
- **Pembagian tim ke grup** dibuat representatif (tuan rumah Meksiko/Kanada/AS
  diunggulkan) dan **mudah diganti** — cukup sunting `GROUPS` di `assets/js/data.js`.
- **Pemetaan slot bagan** (juara/runner-up/peringkat-3 → laga 32 Besar) konsisten
  dan valid; dapat disesuaikan dengan tabel alokasi resmi FIFA bila diperlukan.

---

Dibuat untuk memantau serunya **Piala Dunia 2026**. ⚽🏆
