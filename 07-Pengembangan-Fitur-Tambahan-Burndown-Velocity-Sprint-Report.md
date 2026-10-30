# Zura: Dokumentasi Fitur Laporan

Burndown, Velocity, dan Sprint Report (versi Lite) | Versi 1.0 | 29 Oktober 2026

## 1. Ringkasan

Fitur Laporan membantu tim menjawab tiga pertanyaan yang berbeda:

| Laporan | Pertanyaan yang dijawab | Kapan dipakai | Pengguna utama |
| --- | --- | --- | --- |
| **Burndown** | Apakah sprint ini on track? | Selama sprint berjalan (harian) | Tim, Scrum Master |
| **Velocity** | Berapa kapasitas tim per sprint? | Saat sprint planning | PM, Tim |
| **Sprint Report** | Apa yang selesai dan apa yang tidak? | Saat sprint ditutup dan retrospektif | Tim, Stakeholder |

Versi Lite sengaja membatasi cakupan: tiga laporan ini sudah cukup untuk memberi transparansi, prediktabilitas, dan bahan evaluasi. Laporan lanjutan (Cumulative Flow, Control Chart, Epic Burndown) berada di luar cakupan.

## 2. Istilah Penting

| Istilah | Arti |
| --- | --- |
| **Story Points** | Estimasi relatif beban kerja sebuah tiket (skala 1, 2, 3, 5, 8, 13) |
| **Committed** | Total point tiket yang ada di sprint **saat sprint dimulai** |
| **Completed** | Total point tiket berkategori DONE **saat sprint ditutup** |
| **Remaining** | Scope dikurangi Done pada suatu hari |
| **Scope** | Total point seluruh tiket yang ada di sprint pada suatu hari |
| **Scope Creep** | Pekerjaan yang ditambahkan setelah sprint dimulai |
| **Carry-over** | Tiket belum selesai yang dipindahkan ke sprint berikutnya atau backlog |
| **Kategori status** | `TO_DO`, `IN_PROGRESS`, `DONE`. Dipakai oleh semua perhitungan, bukan nama kolom |

## 3. Prinsip Desain (Best Practice)

1. **Satu sumber kebenaran: kategori status.** Selesai berarti `status.category === "DONE"`. Nama kolom boleh berubah tanpa merusak laporan.
2. **Hitung dari riwayat, bukan dari kondisi sekarang.** Burndown dibangun dengan memutar ulang (replay) event, sehingga akurat terhadap tiket yang dibuka kembali dan scope creep.
3. **Bekukan data saat sprint ditutup.** Angka laporan sprint lama tidak boleh berubah meski tiketnya diedit kemudian.
4. **Jangan hitung dua kali.** Epic dan Subtask tidak ikut dihitung. Hanya Story, Task, dan Bug.
5. **Satu patokan waktu.** Batas "akhir hari" memakai Asia/Jakarta (UTC+7).
6. **Transparan terhadap data yang kurang.** Jika ada tiket tanpa point, tampilkan peringatan, bukan angka yang menyesatkan.
7. **Velocity untuk perencanaan, bukan penilaian.** Jangan dipakai membandingkan individu atau antar tim.
8. **Semua laporan bisa dibaca Viewer.** Klien dan stakeholder perlu melihat progres tanpa bertanya.

## 4. Fondasi Data

### 4.1 Pencatatan event (IssueEvent)

Setiap perubahan yang memengaruhi laporan dicatat sebagai event terstruktur, di dalam transaksi database yang sama dengan perubahan datanya.

| Tipe event | Dicatat saat | Data tambahan |
| --- | --- | --- |
| `ADDED_TO_SPRINT` | Tiket masuk sprint | point, kategori saat itu |
| `REMOVED_FROM_SPRINT` | Tiket keluar sprint |  |
| `POINTS_CHANGED` | Story point berubah | point baru |
| `STATUS_CHANGED` | **Kategori** status berubah | kategori lama dan baru |

Pindah antar kolom dengan kategori yang sama (misalnya In Progress ke In Review) **tidak** dicatat sebagai STATUS\_CHANGED untuk laporan.

### 4.2 Snapshot sprint

| Field | Diisi saat | Fungsi |
| --- | --- | --- |
| `startedAt` | Start Sprint | Batas penentuan committed |
| `committedPoints`, `committedIssues` | Start Sprint | Rencana awal sprint |
| `completedPoints`, `completedIssues` | Complete Sprint | Hasil akhir yang dibekukan |
| `retroNotes` (opsional) | Setelah sprint ditutup | Catatan retrospektif |

### 4.3 Hasil per tiket saat sprint ditutup (SprintIssueResult)

Saat Complete Sprint, tulis satu baris per tiket agar Sprint Report permanen.

| Field | Isi |
| --- | --- |
| `sprintId`, `issueId` | Relasi |
| `pointsAtClose` | Point tiket saat sprint ditutup |
| `outcome` | `COMPLETED`, `CARRIED_OVER`, `RETURNED_TO_BACKLOG` |
| `targetSprintId` | Sprint tujuan jika carry-over |
| `addedMidSprint` | true jika masuk setelah sprint dimulai |

## 5. Burndown Chart

### 5.1 Tujuan

Menunjukkan sisa pekerjaan dari hari ke hari dibandingkan garis ideal, sehingga tim tahu lebih awal jika sprint berisiko gagal.

### 5.2 Elemen tampilan

| Elemen | Gaya | Arti |
| --- | --- | --- |
| **Ideal** | Garis lurus putus-putus abu-abu | Penurunan merata dari committed ke 0 di hari terakhir |
| **Remaining** | Garis biru tebal, berhenti di hari ini | Sisa pekerjaan aktual |
| **Scope** | Garis tipis oranye (stepAfter) | Total pekerjaan di sprint, naik jika ada tambahan |
| **Hari ini** | Garis vertikal | Pembatas masa lalu dan masa depan |

Kartu ringkasan di atas chart: **Committed, Completed, Remaining, Scope Added**.

Kontrol: pilih sprint (default sprint aktif), toggle **Story Points / Jumlah Issue**.

### 5.3 Rumus

```
scope(hari)     = total point tiket yang berada di sprint pada akhir hari itu
done(hari)      = total point tiket berkategori DONE pada akhir hari itu
remaining(hari) = scope(hari) - done(hari)
ideal(hari ke-i) = committed x (1 - i / (jumlahHari - 1))
```

Perhitungan dilakukan oleh fungsi murni `computeBurndown(events, sprint, metric)` sehingga mudah diuji unit.

### 5.4 Cara membaca grafik

| Pola | Kemungkinan arti | Tindakan yang disarankan |
| --- | --- | --- |
| Remaining datar lalu turun tajam di akhir | Tiket besar, pekerjaan menumpuk di akhir | Pecah tiket jadi lebih kecil |
| Remaining di atas Ideal terus-menerus | Komitmen terlalu besar atau ada hambatan | Diskusikan scope di daily |
| Remaining jauh di bawah Ideal | Komitmen terlalu kecil | Tambah pekerjaan, perhatikan kapasitas |
| Garis Scope naik | Scope creep | Evaluasi alur permintaan tambahan |
| Remaining naik tiba-tiba | Tiket dibuka kembali atau point dinaikkan | Telusuri lewat activity log |

### 5.5 Kasus tepi

- **Tiket tanpa point**: tidak terhitung di mode points. Tampilkan peringatan "N tiket belum diestimasi" dan sediakan mode Jumlah Issue.
- **Tiket dibuka kembali**: remaining naik lagi (otomatis benar karena replay).
- **Tiket dikeluarkan dari sprint**: scope turun.
- **Hari belum terjadi**: nilai remaining kosong (garis berhenti), bukan nol.
- **Sprint belum punya event**: tampilkan empty state yang informatif.
- **Akhir pekan**: versi Lite menampilkan garis ideal linear. Opsi lanjutan: ideal datar di Sabtu dan Minggu.

## 6. Velocity Chart

### 6.1 Tujuan

Menunjukkan berapa point yang rata-rata benar-benar selesai per sprint, sebagai dasar menentukan muatan sprint berikutnya.

### 6.2 Elemen tampilan

- Bar ganda per sprint: **Committed** (abu-abu) dan **Completed** (biru)
- Garis **rata-rata velocity**
- Kartu: **Rata-rata velocity** dan **Rekomendasi kapasitas sprint berikutnya**
- Default 6 sprint CLOSED terakhir, maksimal 12

### 6.3 Aturan

| Aturan | Penjelasan |
| --- | --- |
| Sumber data | Snapshot `committedPoints` dan `completedPoints`, tanpa replay |
| Yang dihitung | Hanya sprint berstatus CLOSED |
| Carry-over | Tiket tidak selesai **tidak** dihitung sebagai completed di sprint lama |
| Rekomendasi kapasitas | Rata-rata completed dari 3 sprint terakhir |
| Data kurang | Jika kurang dari 3 sprint, tampilkan "Data belum cukup untuk rekomendasi" |

### 6.4 Cara memakai

Saat sprint planning, jangan masukkan point melebihi rekomendasi kapasitas tanpa alasan jelas. Jika completed jauh di bawah committed berulang kali, tim sedang overcommit.

### 6.5 Kasus tepi

- Belum ada sprint selesai: "Belum ada sprint yang selesai. Velocity muncul setelah sprint pertama ditutup."
- Sprint dengan committed 0: tampilkan batang kosong dan jangan hitung persentase.
- Perubahan panjang sprint: velocity tetap per sprint, bukan per hari.

## 7. Sprint Report

### 7.1 Tujuan

Ringkasan resmi sebuah sprint yang sudah ditutup: bahan retrospektif dan laporan ke stakeholder.

### 7.2 Struktur halaman

1. **Header**: nama sprint, tanggal, goal, status (Selesai).
2. **Kartu metrik**: Committed, Completed, **Completion %** (completed / committed), Scope Added, Carried Over.
3. **Mini burndown** sprint tersebut (hanya baca).
4. **Tabel Completed**: key, judul, tipe, assignee, point.
5. **Tabel Not Completed**: key, judul, assignee, point, **tujuan** (Sprint X atau Backlog).
6. **Tabel Added During Sprint**: tiket yang masuk setelah sprint dimulai (ditandai).
7. **Catatan Retrospektif** (opsional): tiga kolom teks singkat *Berjalan baik / Perlu diperbaiki / Aksi*.

### 7.3 Aturan

- Data diambil dari `SprintIssueResult`, bukan dari kondisi tiket sekarang, sehingga laporan tidak berubah.
- Sprint aktif boleh membuka laporan berjalan (preview), diberi label "Sprint belum selesai".
- Completion % memakai point. Jika committed 0, tampilkan strip (-).
- Export CSV (opsional) untuk dua tabel utama.

### 7.4 Alur Complete Sprint

1. Admin klik **Complete Sprint**.
2. Modal menampilkan jumlah Done dan belum Done.
3. Admin memilih tujuan tiket belum selesai: sprint berikutnya atau backlog.
4. Sistem, dalam satu transaksi: isi `completedPoints` dan `completedIssues`, tulis `SprintIssueResult`, lakukan rollover, ubah status sprint menjadi CLOSED.
5. Pengguna diarahkan ke Sprint Report sprint tersebut.

Urutan langkah 4 penting: snapshot harus diambil **sebelum** rollover.

## 8. Navigasi dan Hak Akses

Menu **Reports** di sidebar, tiga tab: **Burndown, Velocity, Sprint Report**. Tautan pintas juga muncul di header sprint aktif (Burndown) dan setelah Complete Sprint (Sprint Report).

| Aksi | Admin | Member | Viewer |
| --- | --- | --- | --- |
| Melihat ketiga laporan | Ya | Ya | Ya |
| Mengisi catatan retrospektif | Ya | Ya | Tidak |
| Start / Complete Sprint | Ya | Tidak | Tidak |
| Export CSV | Ya | Ya | Ya |

## 9. Kontrak API

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/projects/:projectId/sprints/:sprintId/burndown?metric=points\|issues` | Data harian, ringkasan, jumlah tiket belum diestimasi |
| GET | `/api/projects/:projectId/reports/velocity?sprints=6` | Daftar sprint, rata-rata, rekomendasi kapasitas |
| GET | `/api/projects/:projectId/sprints/:sprintId/report` | Metrik, tabel completed, not completed, added |
| PATCH | `/api/projects/:projectId/sprints/:sprintId/retro` | Simpan catatan retrospektif |

Contoh respons burndown (ringkas):

```json
{
  "sprint": { "id": "...", "name": "Sprint 1" },
  "unestimated": 2,
  "summary": { "committed": 21, "completed": 13, "remaining": 8, "scopeAdded": 3 },
  "days": [
    { "date": "2026-11-01", "ideal": 21, "remaining": 21, "scope": 21, "done": 0 },
    { "date": "2026-11-02", "ideal": 18, "remaining": 19, "scope": 24, "done": 5 }
  ]
}
```

Semua endpoint memakai middleware RBAC yang sudah ada dan memvalidasi bahwa sprint milik project tersebut.

## 10. Keadaan Kosong dan Pesan Pengguna

| Situasi | Pesan |
| --- | --- |
| Tidak ada sprint aktif | "Belum ada sprint aktif. Mulai sprint untuk melihat burndown." |
| Sprint tanpa tiket | "Sprint ini belum berisi tiket." |
| Tiket tanpa point | "3 tiket belum diestimasi dan tidak ikut terhitung." |
| Belum ada sprint selesai | "Velocity muncul setelah sprint pertama ditutup." |
| Data kurang dari 3 sprint | "Data belum cukup untuk rekomendasi kapasitas." |

## 11. Panduan Singkat untuk Pengguna

**Sebelum sprint**: pastikan semua tiket punya point. Cek Velocity untuk menentukan muatan.

**Selama sprint**: buka Burndown saat daily. Jika Remaining di atas Ideal, bahas hambatannya. Jika Scope naik, sepakati apa yang digeser keluar.

**Akhir sprint**: Complete Sprint, buka Sprint Report, isi catatan retrospektif, dan tetapkan satu aksi perbaikan untuk sprint berikutnya.

## 12. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Memindahkan tiket ke kategori DONE menurunkan Remaining pada hari itu.
- [ ] Membuka kembali tiket DONE menaikkan Remaining.
- [ ] Menambah tiket setelah sprint dimulai menaikkan garis Scope dan kartu Scope Added.
- [ ] Mengganti nama kolom tidak mengubah hasil laporan.
- [ ] Epic dan Subtask tidak memengaruhi angka.
- [ ] Velocity memakai data beku, tidak berubah saat tiket lama diedit.
- [ ] Sprint Report tidak berubah setelah sprint ditutup.
- [ ] Viewer dapat membaca, tidak dapat mengubah.
- [ ] Semua empty state di bagian 10 tampil dengan benar.
- [ ] `computeBurndown` lulus unit test: sprint normal, scope creep, tiket dibuka kembali, point berubah, tiket keluar sprint, metrik issues, sprint tanpa event.

## 13. Rencana Pengerjaan

| Fase | Pekerjaan | Hasil |
| --- | --- | --- |
| 0 | Tabel IssueEvent, field snapshot, pencatatan event, backfill sprint aktif | Fondasi data |
| 1 | `computeBurndown`, endpoint, chart, kartu ringkasan | Burndown |
| 2 | Endpoint dan chart Velocity | Perencanaan kapasitas |
| 3 | `SprintIssueResult`, alur Complete Sprint, halaman Sprint Report | Sprint Report |
| 4 | Seed data historis (4-5 sprint tertutup, 1 sprint aktif) | Demo portofolio |
| 5 | Opsional: export CSV, ideal line akhir pekan, filter assignee | Nilai tambah |

## 14. Di Luar Cakupan Versi Lite

Cumulative Flow Diagram, Control Chart, Epic dan Release Burndown, laporan lintas proyek, prediksi otomatis tanggal selesai, serta dashboard yang dapat dikustomisasi.
