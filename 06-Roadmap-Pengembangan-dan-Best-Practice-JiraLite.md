# 06 – Roadmap Pengembangan dan Best Practice JiraLite

Dokumen ini adalah hasil telaah atas **file 05 (RBAC Dinamis + Telaah Atlassian)**. Isinya:

1. Ringkasan posisi proyek saat ini
2. **Celah dan risiko** yang ditemukan di rancangan 05 (perbaiki sebelum coding)
3. **Apa yang bisa dikembangkan**, dikelompokkan dan diprioritaskan
4. **Best practice** per area (keamanan, data, API, UI, tes, operasional)
5. Izin baru untuk setiap fitur baru
6. Roadmap bertahap dan kriteria selesai
7. Template prompt untuk tahap berikutnya

---

## 1. Posisi Proyek Saat Ini

| Area | Status |
|---|---|
| Stack | Express 4, Prisma 5, Zod, PostgreSQL, front-end dengan i18n Bahasa Indonesia, Playwright untuk E2E |
| Fitur inti | Login, project, board (drag & drop), work item, komentar |
| Keamanan | D1 (izin statis `permissions.ts`) sudah selesai |
| Direncanakan | D2-A/B/C (RBAC dinamis), E (notifikasi), G (sprint), H (label dan subtask) |
| Dari referensi Atlassian | Starred/Recent, List view, Saved views, Follow |

**Penilaian umum:** rancangan 05 sudah matang dan mengikuti prinsip yang benar (izin diberikan ke peran, hanya *allow*, dicek dari database, server sebagai penegak, ada audit). Yang perlu dilakukan adalah **menambal beberapa celah kecil** (bagian 2), lalu **menambah fitur di sekitar RBAC** (bagian 3).

---

## 2. Celah dan Risiko di Rancangan 05

Ini temuan yang sebaiknya diputuskan **sebelum** menjalankan Prompt D2-A. Urut berdasarkan tingkat risiko.

### 2.1 Risiko tinggi

| # | Temuan | Mengapa penting | Saran perbaikan |
|---|---|---|---|
| 1 | **Eskalasi lewat `member.manage`.** Admin project boleh mengubah peran anggota, tetapi dokumen tidak membatasi peran apa yang boleh ia berikan. Ia bisa mengangkat dirinya atau orang lain ke peran yang lebih kuat dari miliknya | Pelanggaran prinsip "tidak bisa menaikkan hak" yang ditulis sendiri di bagian 8 | Aturan: pemberi peran hanya boleh memberi peran yang **izinnya adalah subset dari izin miliknya**. Tes khusus untuk ini |
| 2 | **Super Admin pertama ditentukan "pengguna terlama".** Otomatis, tanpa konfirmasi | Jika data lama berisi akun uji yang lebih tua, akun itu menjadi Super Admin | Tentukan lewat variabel lingkungan (`BOOTSTRAP_SUPER_ADMIN_EMAIL`) atau skrip CLI satu kali, dan tampilkan hasilnya di laporan migrasi |
| 3 | **Cache izin** hanya disebut "boleh asal dibersihkan". Tidak ada mekanisme pembersihan yang konkret, terutama jika server berjalan lebih dari satu instance | Izin yang dicabut bisa tetap berlaku sampai cache kedaluwarsa | Mulai **tanpa cache**. Jika perlu, pakai `permissionVersion` (angka di tabel) yang dinaikkan setiap perubahan, dan cache dikunci dengan versi itu |
| 4 | **Dua Super Admin menyimpan matriks bersamaan** (last-write-wins) | Perubahan satu orang bisa menimpa perubahan orang lain tanpa sadar | Tambah `version` atau `updatedAt` di `PermissionScheme`. `PUT .../grants` wajib menyertakan versi, dan server menolak dengan **409 Conflict** jika sudah berubah |
| 5 | **Pengguna yang dinonaktifkan masih memegang JWT** | Dokumen hanya menyebut "tolak jika tidak aktif" di `can()`, padahal tidak semua route tentu memakai `can()` | Middleware autentikasi sendiri harus memeriksa `isActive` dari database dan menolak, **sebelum** sampai ke izin. Tambah tes: nonaktifkan pengguna lalu panggil endpoint apa pun |

### 2.2 Risiko sedang

| # | Temuan | Saran |
|---|---|---|
| 6 | **Inkonsistensi contoh peran "QA".** Tertulis "Member + `issue.delete.any` dicabut", padahal Member bawaan memang tidak punya `issue.delete.any` | Ubah deskripsi menjadi mis. "Member + `issue.delete.own` dicabut" atau "Member + `report.view` + `attachment.delete.any`", sehingga contoh benar-benar berbeda dari Member |
| 7 | **`project.delete` "dibatasi hanya untuk lead"** ditulis sebagai catatan, bukan aturan | Jadikan aturan eksplisit di `can()`: izin ini mensyaratkan `project.leadId === userId` **atau** `global.project.delete_any`. Beri tes |
| 8 | **Ketergantungan izin: otomatis atau tolak?** Bagian 4.3 bilang UI mencentang otomatis, D2-B bilang server "mencabut atau menolak". Dua perilaku berbeda | Putuskan satu: server **menolak simpan (422)** dengan daftar izin yang kurang. UI yang melakukan centang otomatis. Server tidak diam-diam mengubah data |
| 9 | **Cakupan (`scope`) tidak dijaga di database.** `GlobalRolePermission` bisa saja menyimpan izin ber-scope `PROJECT` dan sebaliknya | Validasi di kode saat menyimpan, plus tes yang memeriksa seluruh isi tabel grant |
| 10 | **`projectRoleId` nullable selamanya** | Setelah backfill dan masa transisi, jadikan `NOT NULL` lewat migrasi terpisah, sekalian menghapus kolom `role` lama |
| 11 | **Pengguna dengan `global.project.view_all` bukan anggota**: apa yang boleh ia lakukan? Dokumen tidak menjelaskan | Tetapkan: hanya **baca** (setara `project.browse` + `report.view`), kecuali ia juga Super Admin. Jangan biarkan jatuh ke "tanpa peran project" yang ambigu |
| 12 | **404 vs 403** bisa membocorkan keberadaan project lewat perbedaan waktu respons atau pesan | Samakan bentuk dan pesan respons 404, dan jangan sertakan nama project di pesan error |
| 13 | **Audit log bisa diubah/dihapus** lewat kode lain | Perlakukan sebagai *append-only*: tidak ada endpoint update/delete, dan tes yang memastikannya |

### 2.3 Catatan kecil

- Tambahkan **indeks** pada `PermissionSchemeGrant(schemeId, projectRoleId)` dan `ProjectMember(userId, projectId)`. Query `can()` berjalan di setiap permintaan.
- `Permission` dengan `onDelete: Cascade`: jika sebuah izin dihapus dari kode, semua grant-nya ikut hilang diam-diam. Catat ke log saat sinkronisasi katalog menghapus izin.
- "Pengguna Terbatas" (tanpa izin global) belum menjelaskan apakah ia boleh melihat daftar pengguna untuk fitur mention atau assign. Putuskan dan dokumentasikan.
- Permission Helper menampilkan peran dan skema orang lain. Batasi ke `global.admin.access` (sudah) dan **catat setiap pemakaiannya** di audit.

---

## 3. Apa yang Bisa Dikembangkan

Prioritas: **P0** = wajib sebelum fitur lain, **P1** = nilai tinggi, **P2** = bagus, **P3** = nanti.
Upaya: **S** (≤1 hari), **M** (2–4 hari), **L** (1–2 minggu).

### 3.1 Fondasi RBAC (D2-A, D2-B, D2-C)

| Item | Prioritas | Upaya | Catatan |
|---|:---:|:---:|---|
| Tambal 5 temuan risiko tinggi (bagian 2.1) ke dalam prompt D2 | P0 | S | Lakukan sebelum D2-A |
| Model data, seed, mesin `can()`, tes emas | P0 | L | Sesuai D2-A |
| API administrasi dan pengaman | P0 | L | Sesuai D2-B |
| UI Administrasi dan editor matriks | P0 | L | Sesuai D2-C |
| Permission Helper | P1 | S | Sangat membantu saat debugging "kenapa saya tidak bisa?" |
| Halaman **"Izin saya"** untuk pengguna biasa | P2 | S | Pengguna melihat peran dan izinnya sendiri, mengurangi pertanyaan ke admin |
| Ekspor/impor skema izin (JSON) | P3 | M | Memindahkan konfigurasi antar lingkungan (dev → produksi) |

### 3.2 Fitur dari referensi Atlassian

| Fitur | Prioritas | Upaya | Izin baru | Catatan |
|---|:---:|:---:|---|---|
| **List view** (tabel work item) | P1 | M | memakai `project.browse` | Kolom: Key, Judul, Status, Prioritas, Assignee, Tenggat, Diperbarui. Pemilih kolom, pengurutan, penghitung hasil |
| **Saved views / filter tersimpan** | P1 | M | `filter.create`, `filter.share` | Pribadi dulu, berbagi ke project kemudian |
| **Follow / Watcher** | P1 | S | `watcher.manage` (sudah ada) | Mengikuti diri sendiri tidak butuh izin khusus selain `project.browse` |
| **Starred** (project dan work item) | P2 | S | tidak perlu | Data pribadi pengguna |
| **Recent** (terakhir dibuka) | P2 | S | tidak perlu | Simpan maksimal ±20 per pengguna, hapus yang lama |
| Progres epic (anak selesai/total) | P2 | S | tidak perlu | Hitung di server, jangan di klien |
| Tanggal tenggat merah jika lewat | P2 | S | tidak perlu | Hanya presentasi |
| Waktu relatif ("3 minggu lalu") dengan tooltip tanggal penuh | P2 | S | tidak perlu | Gunakan `Intl.RelativeTimeFormat` |
| Kustomisasi sidebar | P3 | M | tidak perlu | Setelah semua yang di atas stabil |
| Teams / grup | P3 | L | `global.team.manage` | Lihat bagian 3.3 |

### 3.3 Peningkatan RBAC lanjutan (setelah D2 stabil)

| Fitur | Prioritas | Upaya | Penjelasan |
|---|:---:|:---:|---|
| **Grup / Teams** sebagai penerima izin | P2 | L | Saat ini "satu orang satu peran per project". Jika daftar anggota makin besar, tambah grup yang bisa diberi peran. Wajib menentukan aturan jika orang punya peran langsung **dan** lewat grup (usul: ambil gabungan izin, tetap hanya *allow*) |
| **Keamanan level work item** (issue security) | P3 | L | Work item tertentu hanya dilihat peran tertentu. Kompleks dan mudah bocor di pencarian, laporan, dan notifikasi |
| **Akses berbatas waktu** | P3 | M | Peran sementara (mis. auditor 7 hari), kedaluwarsa otomatis dan tercatat di audit |
| **Permintaan akses** | P3 | M | Pengguna meminta peran, admin menyetujui dari antarmuka |
| **Tinjauan akses berkala** | P3 | M | Laporan "siapa punya akses apa", ekspor CSV, untuk keperluan audit internal |

### 3.4 Keamanan akun dan sesi (belum ada di dokumen 05)

| Fitur | Prioritas | Upaya | Catatan |
|---|:---:|:---:|---|
| Kebijakan kata sandi dan batas percobaan login | P0 | S | Hash `argon2` atau `bcrypt` dengan cost memadai; kunci sementara setelah N gagal |
| **Daftar sesi aktif dan cabut sesi** | P1 | M | Perlu tabel sesi atau `tokenVersion` di `User`. Menaikkan `tokenVersion` mencabut semua token lama |
| Refresh token berotasi, access token pendek | P1 | M | Jika saat ini memakai satu JWT panjang, ini peningkatan keamanan terbesar |
| 2FA (TOTP) | P2 | M | Wajibkan untuk Super Admin |
| Personal Access Token (API) | P2 | M | Token punya izin ≤ izin pemiliknya, dapat dicabut, hanya ditampilkan sekali |
| SSO (OIDC) | P3 | L | Hanya jika dipakai banyak orang di organisasi |

### 3.5 Fitur produk di sekitar peta jalan 03/04

| Fitur | Prioritas | Upaya | Catatan |
|---|:---:|:---:|---|
| Notifikasi dalam aplikasi (E) | P1 | L | Gunakan watcher sebagai dasar penerima. Hormati izin: jangan kirim notifikasi dari project yang tidak lagi bisa dibuka penerimanya |
| Sprint (G) | P1 | L | Izin `sprint.*` sudah ada di katalog |
| Label dan subtask (H) | P1 | M | `label.manage` sudah ada |
| **Pencarian dan filter lanjutan** (sintaks sederhana ala JQL) | P2 | L | Mis. `status = "Done" AND assignee = me`. Parser harus **parametris**, jangan menggabungkan string ke SQL |
| Aksi massal (bulk) | P2 | M | Pindah status, tetapkan assignee, tambah label. Izin dicek **per item**, bukan sekali untuk semuanya |
| Impor/ekspor CSV | P2 | M | Impor butuh pratinjau dan validasi baris demi baris |
| Soft delete + Tempat sampah | P2 | M | Work item terhapus bisa dipulihkan 30 hari. Menutup risiko "salah hapus" yang disebut di bagian 2 dokumen 05 |
| Webhook keluar | P3 | M | Tanda tangan HMAC, percobaan ulang, log pengiriman |
| Laporan: burndown, velocity, cumulative flow | P3 | L | Setelah sprint stabil |
| Otomasi sederhana (jika X maka Y) | P3 | L | Hindari sebelum notifikasi dan audit matang |

---

## 4. Best Practice

### 4.1 Keamanan

1. **Server adalah satu-satunya penegak.** UI hanya kenyamanan. Setiap fitur baru diuji **lewat API langsung**, bukan hanya klik di antarmuka.
2. **Satu pintu izin.** Semua route lewat `requirePermission(...)`. Tambahkan **lint rule** atau tes yang gagal jika ada string `role === "ADMIN"` atau `role ===` di folder route.
3. **Deny by default.** Route baru tanpa `requirePermission` harus gagal. Cara praktis: buat tes yang memindai semua route terdaftar dan memastikan masing-masing punya deklarasi izin (atau ditandai `public` secara eksplisit).
4. **Pemeriksaan kepemilikan di server, bukan dari body.** `reporterId`, `authorId`, `uploaderId` diambil dari database, tidak pernah dari input klien.
5. **Cegah IDOR.** Setiap query yang mengambil objek lewat id harus ikut menyaring berdasarkan project yang boleh diakses pemanggil. Contoh buruk: `findUnique({ where: { id } })` lalu baru cek izin. Lebih baik: ambil objek, ambil `projectId`-nya, lalu cek izin pada project itu.
6. **Validasi semua input dengan Zod** (body, query, params) dan **tolak field tak dikenal** (`.strict()`).
7. **Jangan percaya `mass assignment`.** Jangan `prisma.update({ data: req.body })`. Pilih field secara eksplisit.
8. **Header keamanan** dengan `helmet`, CORS dengan daftar asal eksplisit, cookie `HttpOnly` + `Secure` + `SameSite` bila token disimpan di cookie, dan perlindungan CSRF jika memakai cookie.
9. **Rate limit berlapis**: login (ketat), endpoint administrasi (ketat), API umum (longgar), Permission Helper.
10. **Rahasia** hanya di `.env`, tidak pernah di log, tidak pernah di commit. Tambah pemindai rahasia (mis. `gitleaks`) ke pre-commit.
11. **Unggahan lampiran**: batasi ukuran dan tipe berdasarkan isi (magic bytes), bukan hanya ekstensi; simpan di luar folder publik; nama file diacak; unduh lewat endpoint yang mengecek izin.
12. **Sanitasi tampilan** komentar dan deskripsi (XSS). Jika mendukung Markdown, render dengan sanitizer yang ketat.
13. **Log tanpa data sensitif**: jangan mencatat kata sandi, token, isi `.env`.

### 4.2 Model data dan migrasi

1. **Migrasi selalu maju (forward-only) dan bisa diulang.** Jangan pernah `migrate reset` di basis data yang berisi data nyata. Pakai `migrate deploy` untuk produksi.
2. **Pola *expand → backfill → contract*** untuk perubahan skema: tambah kolom baru (expand), isi data (backfill), baru hapus kolom lama (contract) di migrasi terpisah. Ini sudah Anda rencanakan untuk `ProjectMember.role`, jadikan standar.
3. **Seed idempoten** dengan `upsert`, aman dijalankan berulang.
4. **Backup sebelum migrasi** dan **uji pemulihan** sekali-sekali. Backup yang tidak pernah diuji belum bisa disebut backup.
5. **Constraint di database**, bukan hanya di kode: `@unique`, `@@id` gabungan, `onDelete` yang disengaja, `NOT NULL` jika memang wajib.
6. **Indeks** untuk kolom yang sering dipakai filter/join. Periksa dengan `EXPLAIN` sebelum menambah.
7. **Transaksi** (`prisma.$transaction`) untuk operasi yang mengubah beberapa tabel, terutama simpan matriks izin + tulis audit: keduanya berhasil atau keduanya gagal.
8. **Audit log**: simpan `actorId`, `action`, `targetType`, `targetId`, `before`, `after` (JSON), `ip`, `createdAt`. Append-only. Pertimbangkan masa retensi.
9. **Konkurensi**: gunakan `version`/`updatedAt` untuk *optimistic locking* pada data yang diedit banyak orang (matriks izin, work item).

### 4.3 API

1. **Bentuk error konsisten**: `{ error: { code, message, details? } }`. `code` stabil (mis. `PERMISSION_DENIED`, `DEPENDENCY_MISSING`) agar UI bisa menampilkan pesan lokal.
2. **Kode status yang tepat**: 401 belum login, 403 tidak berizin, 404 tidak ada/bukan anggota, 409 konflik versi, 422 validasi domain gagal, 429 kena rate limit.
3. **Paginasi cursor** untuk daftar yang bisa besar (audit, work item). Batasi `limit` maksimum di server.
4. **Idempotensi** untuk operasi yang rawan klik ganda (buat work item, kirim undangan): dukung header `Idempotency-Key` bila perlu.
5. **Versi API** (`/api/v1/...`) sebelum ada klien lain (token API, webhook) yang bergantung padanya.
6. **Dokumentasi OpenAPI** yang dihasilkan dari skema Zod (mis. `zod-to-openapi`) agar dokumentasi tidak melenceng dari kode.
7. **Satu sumber kebenaran katalog izin** (satu file). Dari file itu dihasilkan: sinkronisasi tabel, tipe TypeScript (`PermissionKey`), dan label i18n. Kunci izin yang salah ketik menjadi **error kompilasi**, bukan bug runtime.

### 4.4 Antarmuka

1. **Elemen tak diizinkan dinonaktifkan dengan tooltip alasan**, tidak hilang tanpa penjelasan (sudah di rancangan, pertahankan).
2. **Tiga state di setiap layar**: loading (skeleton), kosong (dengan ajakan tindakan), error (dengan tombol coba lagi).
3. **Optimistic update** untuk drag & drop kartu, dengan **rollback otomatis** dan toast jika server menolak (403/409).
4. **Konfirmasi untuk aksi merusak**, dengan ringkasan dampak ("akan menghapus 12 komentar dan 3 lampiran").
5. **Editor matriks**: simpan perubahan sebagai *draft* di klien, tampilkan diff sebelum simpan, dan peringatkan jika pengguna menutup halaman dengan perubahan yang belum disimpan.
6. **Aksesibilitas**: label pada setiap checkbox matriks (`aria-label="Member: Mengedit work item"`), navigasi keyboard (panah/spasi), fokus terlihat, kontras warna memadai, drag & drop punya alternatif keyboard (menu "Pindah ke…").
7. **i18n**: semua teks lewat dictionary, termasuk label izin dan pesan error dari `code`. Jangan menampilkan pesan mentah dari server.
8. **Performa**: virtualisasi untuk tabel panjang (list view, audit), *debounce* pada pencarian, `React Query`/SWR untuk cache sisi klien dengan invalidasi yang jelas.
9. **Muat ulang izin** saat peran berubah: polling ringan atau SSE/WebSocket untuk event `permissions.changed`.

### 4.5 Pengujian

1. **Piramida tes**: banyak unit (mesin `can()`), cukup integrasi API (Supertest + `jira_clone_test`), sedikit tapi bermakna E2E (Playwright).
2. **Tes berbasis tabel** untuk matriks izin: satu tabel data × satu fungsi tes, mudah dibaca dan mudah ditambah barisnya.
3. **Tes emas** tetap dipertahankan setelah D2 sebagai *regression guard* untuk skema "Default".
4. **Tes negatif lebih penting dari positif** untuk RBAC: coba lakukan hal terlarang lewat API langsung, antar project, dan dengan akun yang baru dicabut.
5. **Tes keamanan otomatis di CI**: `npm audit`, pemindai rahasia, dan tes "semua route punya deklarasi izin" (bagian 4.1 poin 3).
6. **Pengaman nama database**: tes menolak jalan jika nama DB tidak berakhiran `_test` (sudah ada di prompt, pertahankan).
7. **Data uji dibuat lewat factory**, bukan fixture besar yang saling bergantung.

### 4.6 Operasional dan alur kerja pengembangan

1. **Satu tahap = satu cabang = satu PR kecil** dengan checklist bagian 15 di dokumen 05.
2. **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`) agar riwayat mudah dibaca.
3. **CI minimal**: lint → type-check → tes unit/integrasi → build. E2E bisa dijadwalkan atau dijalankan pada PR besar.
4. **Pre-commit hook** (`husky` + `lint-staged`): format, lint, dan pemindai rahasia.
5. **Log terstruktur** (JSON) dengan `requestId`, dan sertakan `requestId` di respons error agar mudah dilacak.
6. **Health check** (`/healthz`) dan **penanganan shutdown** yang rapi.
7. **Konfigurasi lingkungan divalidasi saat start** (Zod pada `process.env`): server menolak jalan jika konfigurasi wajib hilang.
8. **Dokumentasikan keputusan** dalam catatan singkat (ADR): "kenapa tanpa cache izin", "kenapa hanya allow". Berguna saat Anda lupa alasannya enam bulan lagi.
9. **Prinsip untuk agen AI (Antigravity)**: batasi tugas per prompt, wajib laporan "apa yang diuji dan belum", dan **tinjau Implementation Plan sebelum menyetujui**, terutama untuk apa pun yang menyentuh migrasi atau perintah penghapusan.

---

## 5. Izin Baru yang Perlu Ditambahkan ke Katalog

Sesuai aturan emas dokumen 05: fitur baru yang menambah aksi **wajib** menambah kunci izin, memakai `requirePermission`, dan menambah baris di matriks.

| Fitur | Kunci izin usulan | Scope | Default Viewer | Default Member | Default Admin |
|---|---|---|:---:|:---:|:---:|
| Filter tersimpan pribadi | *(tidak perlu, data pribadi)* | – | – | – | – |
| Membagikan filter ke project | `filter.share` | PROJECT | | ✅ | ✅ |
| Mengelola filter milik orang lain | `filter.manage` | PROJECT | | | ✅ |
| Memulihkan dari tempat sampah | `issue.restore` | PROJECT | | | ✅ |
| Menghapus permanen | `issue.purge` | PROJECT | | | ✅ |
| Aksi massal | `issue.bulk` | PROJECT | | ✅ | ✅ |
| Impor CSV | `issue.import` | PROJECT | | | ✅ |
| Ekspor CSV | `issue.export` | PROJECT | ✅ | ✅ | ✅ |
| Mengelola webhook | `webhook.manage` | PROJECT | | | ✅ |
| Mengelola token API milik sendiri | `global.token.create` | GLOBAL | – | – | – |
| Mengelola grup/team | `global.team.manage` | GLOBAL | – | – | – |
| Meninjau laporan akses | `global.access.review` | GLOBAL | – | – | – |

> Starred, Recent, dan Follow-untuk-diri-sendiri sengaja **tanpa izin khusus** karena hanya mengubah data pribadi, tetapi tetap mensyaratkan `project.browse` pada objek yang di-star/follow.

**Aturan penting untuk fitur yang melintasi banyak objek** (bulk, ekspor, pencarian, notifikasi, laporan): izin dicek **per objek atau per project**. Hasil yang berisi objek dari project yang tidak boleh diakses harus disaring, bukan ditolak seluruhnya dan bukan dibiarkan lolos.

---

## 6. Roadmap Bertahap

### Fase 0 – Persiapan (1–2 hari)
- [ ] Revisi dokumen 05 dan prompt D2-A/B sesuai temuan bagian 2.1 dan 2.2
- [ ] Pastikan D1 sudah di-commit dan lolos tes; buat cabang baru
- [ ] Backup basis data
- [ ] Tambah tes "semua route punya deklarasi izin" ke D1 (jaring pengaman untuk semua fase berikutnya)

### Fase 1 – RBAC Dinamis (D2-A → D2-B → D2-C)
- **Selesai jika:** tes emas lulus, semua pengaman teruji lewat API, skenario "Reporter" berhasil dari UI dan API, perubahan izin berlaku seketika.

### Fase 2 – Pengerasan keamanan akun (setelah RBAC)
- Kebijakan kata sandi, batas percobaan login
- Refresh token + pencabutan sesi (`tokenVersion`)
- 2FA untuk Super Admin
- **Selesai jika:** menonaktifkan pengguna atau mencabut sesi langsung menolak semua permintaannya.

### Fase 3 – Pengalaman kerja harian (dari referensi Atlassian)
Urutan: **Follow/Watcher → List view → Saved views → Starred/Recent → progres epic + tenggat merah + waktu relatif**
- **Selesai jika:** pengguna bisa membuat tampilan daftar dengan kolom pilihan, menyimpannya, dan membukanya lagi; semua tampilan menghormati izin.

### Fase 4 – Kolaborasi (E, G, H dari peta jalan lama)
Urutan: **Notifikasi → Label & subtask → Sprint**
- **Selesai jika:** notifikasi hanya dikirim ke penerima yang masih berhak melihat objeknya.

### Fase 5 – Produktivitas
Pencarian lanjutan, aksi massal, soft delete + tempat sampah, impor/ekspor CSV.

### Fase 6 – Ekosistem (jika dibutuhkan)
Token API, webhook, laporan sprint, grup/team, SSO, otomasi.

---

## 7. Template Prompt untuk Tahap Berikutnya

Gunakan kerangka ini untuk setiap fitur baru agar hasil agen konsisten. Mode **Planning**, jalankan berurutan.

### 7.1 Kerangka umum

~~~text
Tambahkan fitur: <NAMA FITUR>. Ikuti stack yang SUDAH ada (Express 4, Prisma 5, Zod, komponen dan design token yang ada, dictionary i18n Bahasa Indonesia). Jangan upgrade library. Jangan menjalankan migrate reset atau perintah yang menghapus data. Jangan menampilkan isi .env.

LANGKAH AWAL
- Baca katalog izin, middleware requirePermission, dan tes yang ada. Catat pola yang dipakai.
- Cek status migrasi. Jika ada drift atau Prisma meminta reset, BERHENTI dan tanyakan dulu.

TUJUAN
<satu paragraf: apa yang bisa dilakukan pengguna setelah fitur ini ada>

DATA
<model baru atau perubahan; wajib lewat migrasi aman, pola expand -> backfill -> contract; sebutkan indeks dan constraint>

IZIN
<kunci izin baru; tambahkan ke katalog (satu sumber kebenaran), ke skema "Default" sesuai tabel, dan ke matriks UI. Semua route memakai requirePermission. Izin dicek per objek/project.>

API
<endpoint, validasi Zod .strict(), bentuk error { error: { code, message } }, paginasi cursor bila daftar, rate limit bila sensitif>

ANTARMUKA
<layar; wajib state loading/kosong/error; useCan/<Can>; tooltip alasan untuk elemen nonaktif; aksesibilitas keyboard; semua teks lewat i18n>

TES (database jira_clone_test)
- Unit dan integrasi, termasuk tes NEGATIF lewat API langsung: tanpa izin (403), bukan anggota (404), antar project, akun nonaktif.
- Tes bahwa semua route baru punya deklarasi izin.
- E2E satu skenario utama.

KRITERIA SELESAI
<daftar yang bisa dicek>
Laporkan apa yang diuji dan apa yang belum.
~~~

### 7.2 Contoh terisi: List view

~~~text
Tambahkan fitur: LIST VIEW (tampilan tabel work item) per project. Ikuti stack yang SUDAH ada. Jangan menjalankan perintah yang menghapus data.

TUJUAN
Pengguna dengan project.browse bisa membuka tab "Daftar" di project dan melihat work item dalam tabel: Key, Judul, Status (lozenge), Prioritas, Assignee, Tenggat (merah bila lewat dan belum selesai), Diperbarui (waktu relatif dengan tooltip tanggal penuh).

DATA
Tidak ada tabel baru. Tambah indeks (projectId, updatedAt) dan (projectId, statusId) bila belum ada. Simpan pilihan kolom dan urutan per pengguna di tabel UserPreference (userId, key, valueJson), migrasi aman.

IZIN
Memakai project.browse. Tidak ada kunci izin baru.

API
GET /api/projects/:key/issues?cursor=&limit=&sort=&q=&status=&assignee=&priority=
- limit maksimum 100, paginasi cursor, sort hanya dari daftar kolom yang diizinkan (whitelist), pencarian parametris.
- Respons memuat total hasil.

ANTARMUKA
Pencarian + chip filter (Status, Assignee, Prioritas), penghitung "N work item", pengurutan, pemilih kolom, virtualisasi baris, klik baris membuka detail. State loading (skeleton), kosong, error. Navigasi keyboard.

TES
- Pengguna bukan anggota mendapat 404; anggota Viewer boleh baca.
- Parameter sort/filter tidak valid ditolak (422); percobaan injeksi lewat q aman.
- E2E: filter, urutkan, ubah kolom, muat ulang halaman dan pilihan tetap.

KRITERIA SELESAI
List view dan board menampilkan data yang sama; pilihan kolom tersimpan per pengguna; semua tes lulus. Laporkan apa yang diuji dan apa yang belum.
~~~

---

## 8. Definition of Done (berlaku untuk setiap fitur)

- [ ] Kunci izin sudah ada di katalog dan matriks (atau alasan tidak perlu izin sudah ditulis)
- [ ] Semua route memakai `requirePermission` (diverifikasi tes pemindai route)
- [ ] Aksi terlarang dicoba **lewat API langsung**, termasuk antar project dan akun nonaktif
- [ ] Input divalidasi Zod `.strict()`, tidak ada mass assignment
- [ ] Perubahan data penting masuk AuditLog dengan sebelum/sesudah
- [ ] Layar punya state loading, kosong, error; teks lewat i18n; bisa dipakai keyboard
- [ ] Migrasi aman, backup dibuat, seed idempoten
- [ ] Semua tes lulus di `jira_clone_test`
- [ ] `.env` tidak ikut commit (`git status`), pemindai rahasia bersih
- [ ] Commit kecil dengan pesan jelas, lalu push

---

## 9. Ringkasan Satu Halaman

1. **Tambal dulu rancangan 05** (eskalasi lewat `member.manage`, bootstrap Super Admin, cache izin, konflik simpan matriks, JWT pengguna nonaktif).
2. **Kerjakan D2-A → D2-B → D2-C** dengan tes emas dan tes negatif lewat API.
3. **Keraskan keamanan akun** (sesi, refresh token, 2FA Super Admin).
4. **Tambah fitur harian ala Atlassian**: Follow, List view, Saved views, Starred/Recent.
5. **Lanjut ke notifikasi, label/subtask, sprint**, lalu produktivitas (pencarian, bulk, tempat sampah, CSV).
6. **Setiap fitur baru** membawa izin, tes negatif, audit, dan state UI lengkap. Itulah yang menjaga RBAC tidak pernah tertinggal dari fitur.
