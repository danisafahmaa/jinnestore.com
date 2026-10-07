# 🛍️ LapakKu – Website Jual Beli Barang

Website lapak jual beli barang berbasis HTML, CSS, dan JavaScript murni (tanpa framework, tanpa build step). Halaman pertama adalah **login/daftar**; setelah masuk, pengguna dapat melihat, mencari, memasang, mengedit, dan menghapus iklan barang.

## Fitur

- Login dan registrasi (password di-hash SHA-256 + salt, sesi tersimpan di browser)
- Etalase barang dengan pencarian, filter kategori, dan pengurutan harga/terbaru
- Pasang iklan: nama, harga, kategori, kondisi, deskripsi, foto (otomatis dikompres)
- Lapak Saya: edit, hapus, tandai terjual/tersedia
- Favorit per pengguna
- Tombol **Hubungi via WhatsApp** dengan pesan otomatis ke penjual
- Responsif (HP dan desktop), perlindungan XSS dasar (semua input di-escape)

## Struktur Proyek

```
.
├── index.html   # Struktur halaman (login + etalase + dialog)
├── style.css    # Tampilan responsif
├── app.js       # Logika aplikasi (auth, CRUD, filter, favorit)
└── README.md
```

## Menjalankan Secara Lokal

Cukup buka `index.html` di browser. Disarankan memakai server lokal agar `crypto.subtle` (hash password) aktif penuh:

```bash
# Python
python -m http.server 8000
# lalu buka http://localhost:8000
```

## Deploy ke GitHub Pages

1. Buat repository baru di GitHub (misal `lapakku`).
2. Unggah keempat file di atas ke branch `main`:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: LapakKu"
   git branch -M main
   git remote add origin https://github.com/USERNAME/lapakku.git
   git push -u origin main
   ```
3. Buka **Settings → Pages**.
4. Pada *Build and deployment*, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
5. Tunggu 1–2 menit. Situs tersedia di `https://USERNAME.github.io/lapakku/`.

## ⚠️ Batasan (Wajib Dibaca)

GitHub Pages hanya menyajikan file statis dan tidak menjalankan kode server. Akibatnya:

| Batasan | Dampak |
|---|---|
| Data di `localStorage` | Akun dan barang hanya ada di browser tersebut; pengguna lain tidak melihat iklan Anda. |
| Autentikasi di sisi klien | Tidak aman untuk produksi; siapa pun dengan akses ke browser dapat membaca/mengubah data. |
| Kuota ±5 MB | Terlalu banyak foto akan membuat penyimpanan penuh. |
| Tidak ada pembayaran/escrow | Transaksi dilakukan langsung antar pengguna lewat WhatsApp. |

Proyek ini layak untuk **demo, portofolio, dan pembelajaran**, bukan marketplace sungguhan.

## Pengembangan Lanjutan (Agar Benar-Benar Multi-Pengguna)

Ganti lapisan `store` di `app.js` dengan backend sebagai layanan:

- **Supabase** (Postgres + Auth + Storage) atau **Firebase** (Auth + Firestore + Storage)
- Pindahkan autentikasi ke layanan tersebut (jangan menyimpan hash password sendiri)
- Simpan foto di object storage, bukan base64
- Tambahkan aturan keamanan (Row Level Security / Firestore Rules) agar pengguna hanya bisa mengubah barangnya sendiri

## Lisensi

MIT – bebas digunakan dan dimodifikasi.
