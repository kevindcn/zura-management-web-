# Aturan & Standar Metrik Agile Zura (AGILE-RULES)

> **Status Dokumen**: Diimplementasikan dan diverifikasi oleh 133 tes.  
> Dokumen ini mendefinisikan perilaku dan standar metrik Agile yang berlaku di Zura.

---

## 1. Prinsip Utama: Single Source of Truth (SSOT)

1. **Satu Logika Terpadu (Single Engine)**:
   Burndown Chart dan Sprint Report (Live Preview maupun Closed) menggunakan satu fungsi kalkulasi inti yang sama (`computeAgileSprintMetrics`) untuk mengklasifikasikan tiket dan menghitung poin dari riwayat event. Velocity Report membaca langsung kolom beku `Sprint` (`committedPoints` dan `completedPoints`), yang sebelumnya telah dihitung oleh mesin yang sama saat `executeCompleteSprint()` dijalankan (bukan memanggil mesin kalkulasi secara langsung).
2. **Ketahanan Baseline Dinamis (Dynamic Baseline)**:
   Untuk sprint yang sedang aktif (`ACTIVE`), nilai komitmen tidak boleh bergantung secara rapuh pada snapshot instan saat tombol *Start Sprint* ditekan. Nilai komitmen dihitung secara dinamis dari riwayat event (`IssueEvent`) berbasis aturan hari mulai WIB.
3. **Integritas Immutability & Batasan Pembekuan Data**:
   Setelah sprint ditutup (`CLOSED`), hanya metrik `committedPoints`, `committedIssues`, `completedPoints`, dan `completedIssues` yang dibekukan secara permanen pada kolom model `Sprint`. Metrik `scopeAdded` dan `removed` untuk sprint `CLOSED` tetap dihitung dinamis dari riwayat `IssueEvent` menggunakan mesin yang sama.  
   **Batasan**: Bila sebuah tiket yang pernah berada di sprint dihapus secara permanen (*cascade deletion*), seluruh baris `IssueEvent` tiket tersebut musnah, sehingga nilai `scopeAdded` atau `removed` pada sprint `CLOSED` dapat ikut berubah akibat hilangnya event historis tersebut. Untuk sprint `CLOSED` warisan yang memiliki `committedPoints` bernilai `null` atau `0`, penanganan dilakukan lewat skrip migrasi terpisah (lihat Bagian 7).

---

## 2. Definisi Hari Mulai & Batas Kalender WIB

1. **Penentuan Hari Mulai**:
   - Hari mulai sprint ditentukan dari tanggal kalender zona waktu Indonesia Barat (**Asia/Jakarta / WIB**, UTC+7).
   - Urutan penentuan:
     1. Gunakan tanggal kalender WIB dari `sprint.startedAt` jika ada.
     2. Cadangan pertama: gunakan tanggal kalender WIB dari `sprint.startDate` jika ada.
     3. Cadangan kedua (HANYA untuk sprint ACTIVE dan CLOSED): gunakan tanggal kalender WIB dari `sprint.createdAt`.
   - **Sprint FUTURE**: Tidak memiliki baseline komitmen (`committedPoints = 0`, `committedIssues = 0`). Baseline baru dihitung saat sprint beralih ke ACTIVE.
2. **Skenario Perubahan Tanggal Mulai (`startDate`)**:
   - Jika `startedAt` sudah ada (sprint sudah pernah dimulai): Mengubah `startDate` tidak mengubah baseline komitmen; perubahan ini hanya mempengaruhi rentang tampilan tanggal kalender pada grafik/laporan.
   - Jika `startedAt` bernilai `null`: Baseline komitmen akan mengikuti `startDate` yang baru.
3. **Batas Akhir Hari Mulai**:
   - Batas akhir hari mulai adalah tepat pukul **23:59:59.999 WIB** pada tanggal hari mulai tersebut.
4. **Definisi "Per Hari"**:
   - Seluruh perhitungan bertahap menggunakan batas **hari kalender WIB** (pukul 00:00:00.000 s.d. 23:59:59.999 WIB).

### 2.1 Perbedaan yang Disengaja dari Jira (Intentional Jira Divergence)
Pada Jira standar, *committed baseline* dikunci secara instan pada detik tombol *Start Sprint* ditekan. Di Zura, terdapat perbedaan yang disengaja:
- **Komitmen Ditetapkan pada Akhir Hari Mulai WIB (23:59:59.999 WIB)**, bukan saat penekanan tombol Start.
- **Rasional**:
  1. Mengakomodasi alur kerja tim di mana sprint diaktifkan di awal hari kerja (misal pukul 09:00 WIB), namun sesi perencanaan detail atau pengisian estimasi story points masih berlanjut hingga sore/malam hari yang sama.
  2. Mencegah tiket yang baru diisi estimasi beberapa menit/jam setelah sprint dibuka terhitung secara keliru sebagai penambahan lingkup (*scopeAdded*).
  3. Menyaring mutasi perantara akibat antarmuka pengguna yang menyimpan nilai per ketikan tanpa debounce sebelum batas akhir hari pertama.

---

## 3. Definisi Metrik Eksplisit

### 3.1 Tiket yang Memenuhi Syarat (Eligible Issues)
Metrik sprint hanya memperhitungkan tiket dengan tipe kerja utama yang terdaftar dalam `ELIGIBLE_REPORT_TYPES`:
- `STORY`
- `TASK`
- `BUG`

*(Verifikasi Kode: Didefinisikan di `backend/src/lib/issueEvents.ts` baris 1-5, dan diterapkan pada filter query di `backend/src/routes/sprints.ts` baris 119, 552, 800, 943, serta gate event recording di `backend/src/routes/issues.ts` baris 344, 632, 663, 701, 925).*

**Perlakuan EPIC dan SUBTASK saat ini:**
- `EPIC`: Dikecualikan sepenuhnya dari metrik sprint dan tidak dicatat event sprintnya.
- `SUBTASK`: Dikecualikan dari metrik sprint agar poin estimasi tidak terhitung ganda dengan parent story/task.

### 3.2 Keanggotaan Sprint & Committed Baseline
1. **Committed (`committed`)**:
   - Komitmen ditentukan murni oleh **KEANGGOTAAN SPRINT pada detik 23:59:59.999 WIB hari mulai**.
   - Setiap tiket eligible (`STORY`, `TASK`, `BUG`) yang berada di dalam sprint pada detik 23:59:59.999 WIB hari mulai diklasifikasikan sebagai **COMMITTED**, dengan nilai poin tepat pada detik tersebut.
   - Aturan keanggotaan pada batas waktu tersebut:
     - Tiket yang masuk lalu keluar dari sprint sebelum/pada batas akhir hari mulai: **Bukan committed** (bersih = 0).
     - Tiket yang masuk, keluar, lalu masuk kembali sebelum/pada batas akhir hari mulai: **Committed** jika pada detik batas tersebut statusnya berada di dalam sprint.
     - Event perubahan poin perantara sebelum batas 23:59:59.999 WIB (misal `1` -> `19`) tidak dihitung terpisah; poin committed adalah nilai terakhir pada batas detik tersebut.

### 3.3 Metrik Perubahan Lingkup, Penyelesaian, dan Sisa Kerja
2. **Scope Added (`scopeAdded`)**:
   - Penambahan lingkup setelah batas 23:59:59.999 WIB hari mulai:
     a. Tiket eligible yang baru dimasukkan ke sprint setelah hari mulai (WIB).
     b. Kenaikan poin bersih pada tiket yang sudah ada setelah hari mulai.
   - *Contoh Angka Tiket Committed Tanpa Poin*:
     Jika Tiket A berada di sprint saat hari mulai dengan poin kosong/null (terhitung committed 0 pt), lalu pada hari ke-3 diberi 5 pt, maka baseline committed sprint tidak berubah, dan `scopeAdded` bertambah sebesar **+5 pt** pada hari ke-3 tersebut.
3. **Removed (`removed`)**:
   - Pengurangan lingkup setelah batas 23:59:59.999 WIB hari mulai:
     a. Tiket yang dikeluarkan dari sprint (dipindah ke sprint lain, dikembalikan ke backlog, atau dihapus) setelah hari mulai.
     b. Penurunan poin bersih pada tiket setelah hari mulai (misal re-estimasi dari 8 pt menjadi 5 pt terhitung `removed` 3 pt).
4. **Completed (`completed`)**:
   - Poin dari tiket berstatus kategori `DONE` pada saat evaluasi (atau saat penutupan untuk sprint CLOSED).
   - **Aturan Keanggotaan**: `completed` **HANYA menghitung tiket yang masih berada di dalam sprint saat evaluasi**. Tiket DONE yang telah dikeluarkan dari sprint dicatat sebagai `removed`, bukan `completed`, agar poin tidak terpotong dua kali.
   - Tiket DONE yang dibuka kembali (reopened) ke status non-DONE otomatis keluar dari `completed` dan kembali menjadi `remaining`.
5. **Remaining (`remaining`)**:
   - Sisa beban kerja sprint:
     `remaining = committed + scopeAdded - removed - completed`
6. **Perpindahan Tiket Antar Sprint**:
   - Dipindah dari Sprint A ke Sprint B setelah hari mulai:
     - Di Sprint A: Terhitung `removed`.
     - Di Sprint B: Terhitung `committed` jika masuk pada hari mulai Sprint B (WIB), atau `scopeAdded` jika masuk setelah hari mulai Sprint B. Tidak boleh ada duplikasi perhitungan.
7. **Tiket Dikeluarkan Lalu Dimasukkan Lagi pada Hari yang Sama atau Berbeda**:
   - **Aturan Mutasi Bersih per Tiket per Hari**:
     Mutasi bersih per tiket per hari kalender WIB dihitung sebagai:  
     `Poin di sprint pada akhir hari WIB - Poin di sprint pada awal hari WIB` (tiket di luar sprint bernilai 0).
     - Jika hasil bersih bernilai positif (> 0), dihitung sebagai `scopeAdded`.
     - Jika hasil bersih bernilai negatif (< 0), dihitung sebagai `removed`.
     - *Contoh 1 (Sama)*: Keluar 5 pt, masuk lagi 5 pt pada hari WIB yang sama: `5 - 5 = 0` (tidak ada perubahan scopeAdded maupun removed).
     - *Contoh 2 (Kenaikan)*: Keluar 5 pt, masuk lagi 8 pt pada hari WIB yang sama: `8 - 5 = +3` (`scopeAdded` bertambah 3 pt).
     - *Contoh 3 (Hari Berbeda)*: Tiket 5 pt keluar pada hari ke-2, lalu masuk kembali pada hari ke-4:  
       Pada hari ke-2: `0 - 5 = -5` (`removed` 5 pt).  
       Pada hari ke-4: `5 - 0 = +5` (`scopeAdded` 5 pt).

### 3.4 Batas Evaluasi Sprint CLOSED
1. **Penentuan Batas Evaluasi Waktu**:
   Batas evaluasi event untuk sprint berstatus `CLOSED` adalah:  
   `evalCutoffTs = max(closedAt, akhir hari mulai WIB)`
2. **Penyaringan Event Pasca-Penutupan**:
   Seluruh event yang tercatat setelah `evalCutoffTs` diabaikan secara ketat dalam perhitungan burndown dan report. Modifikasi atau penambahan tiket setelah sprint ditutup tidak akan mempengaruhi metrik sprint historis (*immutability*).
3. **Prioritas Tanggal Selesai**:
   Pada penentuan rentang tanggal sprint di mesin perhitungan (`burndown.ts`), `closedAt` didahulukan atas `endDate` jika sprint berstatus `CLOSED`.
4. **Aturan Anti-Anomali**:
   Sprint tidak boleh 'ditutup sebelum dimulai' dalam perhitungan (apabila `closedAt` bertanggal sebelum hari mulai, akhir hari mulai tetap menjadi batas evaluasi minimum).

### 3.5 Perilaku Penutupan Sprint (Complete Sprint)
Ketika sprint diselesaikan (`executeCompleteSprint` di `backend/src/routes/sprints.ts`):
1. **Pembekuan Metrik ke Kolom Sprint**:
   Sebelum transaksi penutupan selesai, metrik dihitung melalui SSOT engine (`computeAgileSprintMetrics`), lalu nilai `committedPoints`, `committedIssues`, `completedPoints`, dan `completedIssues` dibekukan langsung ke kolom tabel `Sprint`.
2. **Pencatatan Event Rollover (Cap Waktu `closeTime + 1 detik`)**:
   Tiket yang belum selesai (`incompleteAll`) dialihkan ke backlog atau target sprint. Event `REMOVED_FROM_SPRINT` (pada sprint yang ditutup) dan `ADDED_TO_SPRINT` (pada target sprint) dicatat dengan cap waktu `closeTime + 1000 ms` (1 detik setelah `closedAt`). Hal ini menjamin tiket yang belum selesai di akhir sprint dihitung sebagai *carried over / not completed*, dan **TIDAK dihitung keliru sebagai `removed`** di sprint yang ditutup.
3. **Klasifikasi `addedMidSprint`**:
   Penentuan `addedMidSprint` pada model `SprintIssueResult` menggunakan batas kalender **23:59:59.999 WIB hari mulai** (`isIssueAddedMidSprint`), bukan ambang batas arbitrer buffer 60 detik.

### 3.6 Kontrak Nama Field Antar-Endpoint
Sistem memberlakukan kontrak penamaan field yang ketat untuk menghindari ambiguitas antarmuka pengguna:
- **Endpoint `/api/projects/:key/sprints/:id/burndown`**:
  - `summary.removed`: angka akumulasi pengurangan lingkup (bernilai poin jika `metric=points`, bernilai jumlah tiket jika `metric=issues`).
- **Endpoint `/api/projects/:key/sprints/:id/report`**:
  - `summary.removedPoints`: total poin tiket yang dikeluarkan dari sprint setelah batas hari mulai WIB.
  - `summary.removedIssues`: total jumlah tiket yang dikeluarkan dari sprint setelah batas hari mulai WIB.
  - Di akar respons JSON: `removedFromSprintIssues`: daftar objek tiket yang dikeluarkan dari sprint setelah hari mulai (berisi `id`, `key`, `title`, `type`, `priority`, `storyPoints` saat keluar, `status`, `assignee`).
  - **PENTING**: **Tanpa alias `summary.removed`** di `/report`. Endpoint `/report` membedakan metrik secara eksplisit dengan suffix `Points` dan `Issues`.

### 3.7 Perlakuan Tiket Tanpa Poin (Unestimated Issues)
1. **Dalam Mode Poin (`metric = "points"`)**:
   - Tiket tanpa poin (nilai `null` atau kosong) dihitung sebagai `0` poin dalam perhitungan komitmen dan sisa kerja.
   - Tiket ini memicu indikator peringatan pada UI (*"X issues unestimated"*).
2. **Dalam Mode Jumlah Tiket (`metric = "issues"`)**:
   - Setiap tiket eligible dihitung bernilai tepat `1` unit kerja.

---

## 4. Persamaan Invarian Metrik (Mathematical Invariants)

Sistem wajib memenuhi lima invarian matematika ini secara konsisten:

1. **Invarian Neraca Poin Universal**:
   `committed + scopeAdded - removed = completed + remaining`
2. **Invarian Committed (Burndown vs Sprint Report)**:
   `Burndown.summary.committed === SprintReport.summary.committedPoints`
3. **Invarian Scope Added (Burndown vs Sprint Report)**:
   `Burndown.summary.scopeAdded === SprintReport.summary.scopeAddedPoints`
4. **Invarian Sisa Kerja Sprint ACTIVE (Burndown Remaining vs Sprint Report Carried Over)**:
   `Burndown.summary.remaining === SprintReport.summary.carriedOverPoints`  
   *(Khusus berlaku pada evaluasi sprint berstatus ACTIVE di waktu yang sama)*
5. **Invarian Komitmen Pasca Penutupan (Velocity vs Sprint Report CLOSED)**:
   `Velocity.sprint.committedPoints === SprintReport.summary.committedPoints`  
   *(Berlaku untuk sprint CLOSED yang sama)*

---

## 5. Verifikasi Kode & Bukti Teknis Database

Berdasarkan audit basis kode:

1. **`executeCompleteSprint()` membekukan seluruh metrik penutupan**:
   - **Status**: **TERVERIFIKASI & DIIMPLEMENTASIKAN**.
   - **Berkas**: `backend/src/routes/sprints.ts` baris 52–225 (`executeCompleteSprint`), khusus baris 206–215 pada `tx.sprint.update`.
   - **Bukti**: Objek `tx.sprint.update` saat penutupan memperbarui `state`, `closedAt`, `committedPoints`, `committedIssues`, `completedPoints`, dan `completedIssues` berdasarkan hasil perhitungan `computeAgileSprintMetrics()`.
2. **Nama field di model `SprintIssueResult`**:
   - **Status**: **TERVERIFIKASI**.
   - **Berkas Prisma**: `backend/prisma/schema.prisma` baris 170–186.
   - **Berkas Route**: `backend/src/routes/sprints.ts` baris 137–167 (`tx.sprintIssueResult.upsert`).
   - **Rincian Field**: `pointsAtClose` (baris 176), `outcome` (baris 177: `COMPLETED`, `CARRIED_OVER`, `RETURNED_TO_BACKLOG`), `addedMidSprint` (baris 180).
3. **Penghapusan Tiket Permanen (Cascade Deletion)**:
   - **Status**: **TERVERIFIKASI**.
   - **Berkas Prisma**: `backend/prisma/schema.prisma` baris 156 (`issue Issue @relation(fields: [issueId], references: [id], onDelete: Cascade)`).
   - **Berkas Route**: `backend/src/routes/issues.ts` baris 998–1000 (`DELETE /api/issues/:key`).
   - **Bukti & Batasan**: Saat tiket dihapus dari database, PostgreSQL menjalankan CASCADE deletion yang secara permanen menghapus seluruh baris `IssueEvent` terkait tiket tersebut. Tidak ada event `REMOVED_FROM_SPRINT` yang tersisa, sehingga riwayat tiket tersebut hilang dari perhitungan event stream.

---

## 6. Contoh Kasus Riil: Sprint MOP-1 (Target Konsistensi)

### Kronologi Kasus MOP
- **Sprint Dimulai**: 31 Oktober 2026 pukul 13:39:04 WIB (`06:39:04.122Z UTC`).
- **Tiket Terdaftar saat Start**: `MOP-1` (Task) dan `MOP-2` (Story). Keduanya masuk dengan poin awal belum diisi (`points: null`).
- **Aktivitas Hari Mulai (31 Oktober 2026 WIB)**:
  - Pukul 13:39:29 WIB: `MOP-2` diisi 19 pt (terjadi event perantara 1 pt -> 19 pt).
  - Pukul 13:40:55 WIB: `MOP-1` diisi 20 pt (terjadi event perantara 2 pt -> 20 pt).
  - Kedua pengisian selesai sebelum batas akhir 23:59:59.999 WIB hari mulai.

### Hasil Metrik Target yang Benar:
| Metrik | Burndown Chart | Sprint Report (Live) | Sprint Report (Setelah Closed) | Velocity Report |
| :--- | :---: | :---: | :---: | :---: |
| **Committed Points** | **39** | **39** | **39** | **39** |
| **Committed Issues** | **2** | **2** | **2** | **2** |
| **Scope Added Points** | **0** | **0** | **0** | - |
| **Scope Added Issues** | **0** | **0** | **0** | - |
| **Remaining / Carried Over** | **39** *(jika belum Done)* | **39** *(jika belum Done)* | **39** *(jika belum Done)* | - |

---

## 7. Keterbatasan yang Diketahui (Known Limitations)

1. **Sprint Lama dengan `startedAt` Null**:
   Sprint warisan yang dibuat sebelum pencatatan `startedAt` diterapkan menggunakan fallback ke tanggal kalender WIB dari `startDate`. Jika `startDate` juga null, mengikuti aturan cadangan `createdAt` (Bagian 2.1).
2. **Waktu Pembuatan Event `ADDED_TO_SPRINT` saat Start Sprint**:
   Ketika tombol Start Sprint ditekan, backend membuat event `ADDED_TO_SPRINT` serentak dengan `createdAt` diset identik dengan `startedAt`. Waktu ini mencerminkan saat sprint diaktifkan, bukan saat pertama kali tiket diseret di backlog.
3. **Penanganan Sprint `CLOSED` Warisan (Skrip Migrasi Terpisah)**:
   Sprint `CLOSED` lama yang memiliki `committedPoints` bernilai `0` atau `null` dan memiliki riwayat event `ADDED_TO_SPRINT` akan dihitung ulang lewat **skrip migrasi terpisah (belum dibuat)**.
   - **Ketentuan Migrasi**:
     1. Hanya mengisi kolom `committedPoints` dan `committedIssues` pada baris sprint (tidak memodifikasi `SprintIssueResult` atau status tiket).
     2. Wajib mendukung opsi simulasi (*dry-run*) sebelum mutasi database dijalankan.
     3. Pencadangan (*backup*) basis data wajib dilakukan sebelum eksekusi migrasi.
     4. Sprint tanpa riwayat event dibiarkan apa adanya (tetap `0`/`null`).
   - **Batasan**: Tiket yang telah dihapus permanen dari sistem kehilangan rekaman event-nya akibat aturan *cascade deletion* di database, sehingga nilai komitmen historis tiket tersebut tidak dapat dipulihkan.
4. **Input Tanpa Debounce di Antarmuka Pengguna (UI)**:
   Input field Story Points di modal detail tiket saat ini memicu request API pada setiap ketikan (`onChange`) tanpa debounce, menghasilkan event mutasi perantara di database. Aturan kalkulasi SSOT menyaring event perantara ini dengan mengambil nilai poin pada batas akhir hari WIB, sedangkan penambahan debounce pada UI dicatat sebagai perbaikan terpisah.
5. **Dampak Penghapusan Permanen Tiket**:
   Karena relasi database menggunakan `onDelete: Cascade`, menghapus tiket dari sistem akan memusnahkan seluruh event `IssueEvent` tiket tersebut secara permanen. Hal ini akan menyebabkan riwayat komitmen masa lalu ikut berkurang jika tiket dihapus alih-alih dipindahkan.
6. **Logika Auto-Backfill pada Complete Sprint**:
   Bila sebuah sprint aktif tidak memiliki event sama sekali (`events.length === 0`) saat ditutup dan memiliki tiket terdaftar, `executeCompleteSprint()` secara otomatis membuat event `ADDED_TO_SPRINT` awal berbasis status dan poin saat ini dengan cap waktu `startedAt || createdAt` agar metrik komitmen dan penyelesaian dapat dihitung.
   > [!NOTE]
   > **KEPUTUSAN: DISETUJUI**.  
   > Perilaku auto-backfill ini disetujui untuk mendukung sprint warisan tanpa event agar tidak gagal saat ditutup. Event hasil backfill adalah rekonstruksi dari status saat ini, bukan riwayat asli. Komitmen yang dihasilkan bersifat perkiraan.
7. **Fixture Tanggal Tetap pada `reports.test.ts`**:
   Berkas pengujian `backend/tests/reports.test.ts` menggunakan fixture dengan tanggal tetap 12 November 2026 (di masa depan relatif terhadap waktu saat kode dikembangkan). Mesin SSOT menangani kondisi ini melalui deteksi tanggal event maksimum (`todayJakarta = referenceTodayJakarta || max(latestEventDateStr, currentWallClockJakarta)`), serta aturan batas evaluasi minimum akhir hari mulai agar sprint tidak dianggap 'ditutup sebelum dimulai'.
