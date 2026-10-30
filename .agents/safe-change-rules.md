# Safe Change Rules (Aturan Perubahan Aman)

Aturan kerja wajib yang harus dipatuhi oleh asisten AI / developer dalam mengelola dan mengembangkan repositori ini:

1. **Jangan ubah fitur, skema database, atau rute di luar yang diminta.**
   - Fokus hanya pada lingkup tugas yang secara eksplisit diminta oleh user.
   - Dilarang melakukan refactoring spekulatif atau mengubah perilaku kode yang sudah berjalan stabil.

2. **Sebelum mengubah kode, tampilkan RENCANA (file apa, alasannya) dan tunggu persetujuan saya.**
   - Sajikan rencana kerja secara jelas: daftar file yang akan diubah, rincian perubahannya, serta alasan teknisnya.
   - Tunggu konfirmasi/persetujuan user sebelum melakukan modifikasi berkas.

3. **Lakukan perubahan kecil satu per satu.**
   - Eksekusi perubahan secara terisolasi dan bertahap, bukan perubahan massal sekaligus.

4. **Setelah tiap langkah, jalankan seluruh tes. Jika ada yang gagal, berhenti dan laporkan. Jangan memperbaiki dengan mengubah atau melemahkan tes.**
   - Jalankan `npm run test` di backend setelah setiap perubahan.
   - Jika terjadi kegagalan tes (*test failure*), segera berhenti dan laporkan hasilnya kepada user.
   - Perbaiki implementasi kodenya, BUKAN memodifikasi, menghapus, atau melonggarkan ekspektasi pengujian.

5. **Jangan hapus tes yang sudah ada.**
   - Pertahankan seluruh rangkaian tes pengujian yang sudah ada (*regression safety net*).

6. **Jangan sentuh atau menampilkan isi `.env`. Jangan commit rahasia.**
   - Jaga kerahasiaan kredensial dan file lingkungan (`.env`, `.env.*`). Dilarang mencetak rahasia ke terminal/chat atau memasukkannya ke git commit.

7. **Tes hanya boleh berjalan di database `jira_clone_test`.**
   - Pastikan lingkungan pengujian selalu terisolasi dan tidak menyentuh database operasional (`jira_clone`).

8. **Ikuti standar yang ada: `requirePermission()`, Zod `.strict()`, i18n Bahasa Indonesia.**
   - Otorisasi backend wajib menerapkan `requirePermission()` dengan prinsip deny-by-default.
   - Skema validasi Zod wajib menggunakan `.strict()` untuk mencegah *mass assignment*.
   - Antarmuka pengguna wajib menggunakan kamus terpusat Bahasa Indonesia di `frontend/src/lib/i18n.ts`.

9. **Di akhir tiap tugas, beri ringkasan: file yang diubah, hasil tes, dan hal yang perlu saya cek manual.**
   - Berikan rekapitulasi transparan di akhir setiap pengerjaan tugas:
     - Daftar file yang telah diubah/dibuat.
     - Hasil eksekusi tes otomatis (jumlah tes dan status kelulusan).
     - Panduan/langkah pengujian manual yang perlu diverifikasi langsung oleh user di browser atau sistem.
