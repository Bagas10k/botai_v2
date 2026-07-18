# Peta Program & Kode Sumber Berdasarkan Fungsi (Program Map)

Dokumen ini memetakan seluruh file di dalam proyek **Asisten Virtual WhatsApp Jajan Digital** ke dalam fungsionalitasnya masing-masing. Peta ini mempermudah pencarian berkas kode sumber saat ingin melakukan pengembangan modul baru atau perbaikan bug.

---

## 1. Titik Masuk Utama (Core Entry Point)
Menangani inisialisasi server web, koneksi Socket.io untuk dasbor real-time, registrasi API, dan inisialisasi modul WhatsApp.

*   **[index.js](file:///c:/Users/bagas/Desktop/jjn%20digital/index.js)**:
    *   Menginisialisasi server ExpressJS di port `3000`.
    *   Mendaftarkan seluruh sub-router API REST.
    *   Menyambungkan server Socket.io untuk mengirim QR Code, log obrolan, dan notifikasi ke dasbor web secara instan.
    *   Menangani proteksi kesalahan global (`uncaughtException`, `unhandledRejection`).
*   **[package.json](file:///c:/Users/bagas/Desktop/jjn%20digital/package.json)**:
    *   Menyimpan dependensi npm (seperti `whatsapp-web.js`, `socket.io`, `sqlite3`, `pdf-parse`, `tesseract.js`) dan script startup.
*   **[config.json](file:///c:/Users/bagas/Desktop/jjn%20digital/config.json)**:
    *   Berkas penyimpanan parameter sensitif (API keys Gemini/Groq/OpenRouter, nomor WhatsApp Bos, credential admin login, waktu laporan harian).

---

## 2. Antarmuka Pengguna & Dasbor Web (Frontend)
Bagian antarmuka kontrol dasbor admin real-time yang dapat diakses melalui browser.

*   **[public/index.html](file:///c:/Users/bagas/Desktop/jjn%20digital/public/index.html)**:
    *   Layout visual dasbor berbasis grid dan navigasi tab bergaya iOS.
    *   Memuat form parameter bot, visual editor pohon menu produk, log obrolan, panel kontrol grup, serta parameter AI.
*   **[public/client.js](file:///c:/Users/bagas/Desktop/jjn%20digital/public/client.js)**:
    *   Menghubungkan client web ke server backend menggunakan WebSocket (Socket.io).
    *   Menangani manajemen data frontend (load list pelanggan, edit pohon menu, visualisasi status bot, sinkronisasi grup dengan loading bar interaktif).
*   **[public/login.html](file:///c:/Users/bagas/Desktop/jjn%20digital/public/login.html)**:
    *   Halaman login aman bagi Host Admin/Pemilik toko untuk masuk ke dasbor.

---

## 3. Modul API REST / Endpoint Backend (Routing Layer)
Memisahkan endpoint API Express menjadi berkas terpisah berdasarkan fungsionalitasnya untuk menghindari file index.js yang gemuk.

*   **[src/routes/configRoute.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/routes/configRoute.js)**:
    *   Membaca dan memperbarui isi dari `config.json` melalui dasbor web.
*   **[src/routes/files.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/routes/files.js)**:
    *   Mengatur daftar berkas dokumen basis pengetahuan (`knowledge/`) dan aset gambar/media (`media/`) beserta aksi hapus/unggah.
*   **[src/routes/groups.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/routes/groups.js)**:
    *   Mengatur parameter konfigurasi grup WhatsApp (nama grup, keaktifan bot, sinkronisasi data, jadwal tutup/buka otomatis).
*   **[src/routes/hostAdmin.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/routes/hostAdmin.js)**:
    *   Mengelola profil admin, ganti kata sandi login dasbor, serta daftarkan nomor admin baru.
*   **[src/routes/misc.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/routes/misc.js)**:
    *   Menyediakan API untuk notepad mini (Word Mini), backup zip data server, restore data, dan restart client WhatsApp.
*   **[src/routes/orders.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/routes/orders.js)**:
    *   Mengontrol data transaksi, pembuatan manual/otomatis invoice, status pembukuan pembayaran, serta pengiriman riwayat log kas.
*   **[src/routes/premium.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/routes/premium.js)**:
    *   Melacak stok akun premium (akun sharing/private) yang disewakan serta pengingat jatuh tempo masa aktif.
*   **[src/routes/shop.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/routes/shop.js)**:
    *   Mengelola simpan/tambah/hapus node/kategori dalam pohon menu produk interaktif.

---

## 4. Manajemen Basis Data (Database Layer)
Menangani koneksi ke database SQLite dan menyediakan fungsi query transaksi data.

*   **[src/db/sqlite.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/db/sqlite.js)**:
    *   Membuka koneksi ke `database.sqlite` dan merancang skema tabel (`group_configs`, `shop_customers`, `invoices`, `reminders`, `key_value_store`).
    *   Mengotomatiskan migrasi data saat pertama kali server beralih dari format file JSON lama.
*   **[src/db/models.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/db/models.js)**:
    *   Kumpulan fungsi CRUD (Create, Read, Update, Delete) siap pakai seperti `getGroupConfigs()`, `saveGroupConfig()`, `addCustomer()`, `addReminder()`, dan `getShopData()`.

---

## 5. Konfigurasi & Manajemen API Key (Configuration Layer)
Mengelola pembacaan dan pembaruan pengaturan parameter bot secara dinamis.

*   **[src/config/config.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/config/config.js)**:
    *   Menyediakan singleton objek konfigurasi.
    *   Mengotomatiskan perbaikan path executable Chrome berdasarkan sistem operasi (Windows/Linux).
    *   Mengatur algoritma **Gemini API Key Rotation** untuk bergantian menggunakan kunci API baru jika terjadi limitasi kuota (rate limit).

---

## 6. Mesin WhatsApp & Orkestrator (WhatsApp Engine)
Mengaktifkan integrasi WhatsApp dan meneruskan pesan masuk ke modul handler yang sesuai.

*   **[src/services/whatsapp/client.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/services/whatsapp/client.js)**:
    *   Menginisialisasi `whatsapp-web.js` dan browser Puppeteer headless.
    *   Menangkap status autentikasi (mengirim QR Code ke dasbor) dan mengontrol auto-restart jika browser terputus.
*   **[src/services/whatsapp/messageHandler.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/services/whatsapp/messageHandler.js)**:
    *   Bertindak sebagai **orkestrator utama (Brain)** yang ramping.
    *   Menerima pesan masuk, menyiapkan objek reply kustom (dengan dukungan tag `@user` / `@nama`), dan memanggil modular handlers di bawah secara sekuensial.

---

## 7. Penanganan Pesan Modular (Message Handlers)
Memecah file monolitis `messageHandler.js` (2.692 baris) menjadi 8 modul logika independen untuk kestabilan kode yang maksimal.

*   **[src/handlers/helpers.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/handlers/helpers.js)**:
    *   Fungsi utilitas bersama (normalisasi nomor HP, pencocokan tipe MIME, parser waktu pengingat, pencarian pencocokan nama node menu, rendering teks menu otomatis).
*   **[src/handlers/guardHandler.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/handlers/guardHandler.js)**:
    *   Memastikan keamanan hak akses pengirim (apakah Bos/Admin), memeriksa keaktifan bot di grup/pribadi, mencatat otomatis nomor baru ke CRM, dan mengirim kartu nama bisnis (auto-VCard).
*   **[src/handlers/orderHandler.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/handlers/orderHandler.js)**:
    *   Mendeteksi kata kunci pembelian (`pesan:`/`beli:`) dari pelanggan dan merekam data order baru ke database transaksi.
*   **[src/handlers/adminMenuHandler.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/handlers/adminMenuHandler.js)**:
    *   Mengendalikan alur interaktif berbasis state machine dari menu administrasi WA (`!admin`).
*   **[src/handlers/adminCommandHandler.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/handlers/adminCommandHandler.js)**:
    *   Mengeksekusi command admin cepat yang diawali simbol dot/tanda seru (seperti `.buka`, `.tutup`, `.kick`, `.proses`, `.done`, `.promote`, `.demote`, `.akun`).
*   **[src/handlers/mediaHandler.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/handlers/mediaHandler.js)**:
    *   Menangani penerimaan media berkas teks murni, ekstraksi & ringkasan dokumen PDF, serta pembacaan OCR kuitansi/struk belanja dari foto kuitansi Bos.
*   **[src/handlers/bossAiHandler.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/handlers/bossAiHandler.js)**:
    *   Memproses update ingatan bot (`#akubosmu`), jadwal laporan harian (`#jadwallaporan`), penjadwalan pengingat harian (`#ingatkan`), dan melayani obrolan umum dengan Bos menggunakan model kecerdasan buatan terpadu.
*   **[src/handlers/customerHandler.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/handlers/customerHandler.js)**:
    *   Mengatur respon navigasi pilihan angka menu, deteksi promo aktif, informasi pembayaran QRIS, pencocokan pemicu kata kunci custom, dan fallback asisten pelayanan pelanggan AI (CS Fallback AI).

---

## 8. Layanan AI & OCR (AI & OCR Engines)
Menyediakan kecerdasan analisis teks serta pengenalan karakter visual pada gambar.

*   **[src/services/ai/aiService.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/services/ai/aiService.js)**:
    *   Mengontrol koneksi API ke model Gemini, Groq, OpenRouter, DeepSeek, Qwen.
    *   Menyusun memori AI dan panduan toko menjadi prompt terpadu (RAG / Retrieval-Augmented Generation).
*   **[src/services/ocr/ocrService.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/services/ocr/ocrService.js)**:
    *   Mengintegrasikan engine `tesseract.js` lokal untuk mengekstraksi teks pada struk pembayaran pelanggan secara akurat.

---

## 9. Pekerjaan Latar Belakang & Penjadwalan (Scheduler & Jobs)
Mengotomatiskan pengiriman laporan harian dan pemantauan status server secara periodik.

*   **[src/scheduler/reminderJob.js](file:///c:/Users/bagas/Desktop/jjn%20digital/src/scheduler/reminderJob.js)**:
    *   Mengotomatiskan pengiriman Laporan Harian Status Server & Bot ke nomor WhatsApp Bos setiap pagi.
    *   Mengotomatiskan trigger pengingat harian (`reminders`) tepat waktu ke WhatsApp Bos.
    *   Mengotomatiskan jam tutup/buka grup chat WhatsApp sesuai jadwal operasional yang diatur di dasbor.
