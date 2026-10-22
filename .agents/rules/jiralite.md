# Aturan Project JiraLite

## Konteks
JiraLite adalah aplikasi manajemen proyek versi ringan, terinspirasi Jira. Fokus: board Kanban, backlog, sprint, work item, peran anggota, dan notifikasi.

## Aturan umum
- Gunakan stack yang SUDAH ada di repo. Jangan mengganti framework, ORM, atau library utama tanpa persetujuan.
- Pelajari struktur kode yang ada sebelum menulis kode baru. Ikuti gaya dan pola yang sudah dipakai.
- Kerjakan hanya yang diminta. Jangan refactor besar di luar cakupan.
- Semua perubahan skema database lewat migrasi yang aman. JANGAN pernah menjalankan perintah yang menghapus atau mereset data (`migrate reset`, `drop`, `truncate`) tanpa izin eksplisit.
- Jangan menulis kredensial/rahasia di kode. Gunakan `.env` dan pastikan `.env` di `.gitignore`.

## Bahasa
- Teks antarmuka: Bahasa Indonesia yang natural dan ramah, dikumpulkan di satu tempat (`lib/i18n.ts`) supaya mudah disesuaikan atau ditambah bahasa lain.
- Nama variabel, fungsi, dan komentar kode: Bahasa Inggris.

## Keamanan
- Otorisasi SELALU diperiksa di server. Menyembunyikan tombol di UI bukan keamanan.
- Validasi semua input di server.
- Pesan error ke pengguna harus ramah dan tidak membocorkan detail internal.

## Kualitas UI
- Setiap layar harus punya: kondisi loading (skeleton), kosong (empty state), dan error (dengan tombol coba lagi).
- Setiap aksi pengguna harus memberi umpan balik (toast dengan opsi "Urungkan" untuk perpindahan/penghapusan atau perubahan visual).
- Aksi yang menghapus data wajib ada konfirmasi melalui ConfirmDialog.
- Semua elemen interaktif bisa dipakai dengan keyboard dan punya focus state yang jelas.
- Gunakan design token yang sudah ada (warna, radius, font). Jangan hardcode warna baru secara sembarangan.
