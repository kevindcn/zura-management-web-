# 🚀 Zura — Agile Project Management (JiraLite)

<p align="center">
  <img src="frontend/src/components/photo/zura-logo.svg" alt="Zura Logo" width="120" height="120" />
</p>

<p align="center">
  <strong>Platform Manajemen Proyek Kolaboratif Berbasis Agile (Scrum & Kanban) yang Cepat, Aman, dan Modern.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Vitest-91%20Passed-4CAF50?logo=vitest&logoColor=white" alt="Vitest Tests" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
</p>

---

## 📖 Daftar Isi

1. [Tentang Zura](#-tentang-zura)
2. [Fitur Utama](#-fitur-utama)
   - [Papan Kanban & Alur Kerja](#1-papan-kanban--alur-kerja)
   - [Backlog & Siklus Hidup Sprint](#2-backlog--siklus-hidup-sprint)
   - [Laporan Agile & Metrik Sprint](#3-laporan-agile--metrik-sprint)
   - [Work Item & Hierarki Subtask](#4-work-item--hierarki-subtask)
   - [Keamanan & Matriks RBAC](#5-keamanan--matriks-rbac)
   - [Notifikasi & Jejak Audit](#6-notifikasi--jejak-audit)
   - [Desain & Antarmuka Cerdas](#7-desain--antarmuka-cerdas)
3. [Arsitektur & Stack Teknologi](#-arsitektur--stack-teknologi)
4. [Skema Basis Data (Entity Relationship)](#-skema-basis-data-entity-relationship)
5. [Katalog Endpoint REST API](#-katalog-endpoint-rest-api)
6. [Panduan Instalasi & Menjalankan Project](#-panduan-instalasi--menjalankan-project)
   - [Prasyarat Sistem](#prasyarat-sistem)
   - [Langkah Setup Backend](#langkah-setup-backend)
   - [Langkah Setup Frontend](#langkah-setup-frontend)
7. [Pengujian Otomatis (Automated Testing)](#-pengujian-otomatis-automated-testing)
8. [Akun Demo Bawaan](#-akun-demo-bawaan)
9. [Struktur Direktori Repositori](#-struktur-direktori-repositori)
10. [Standar Kualitas & Definition of Done](#-standar-kualitas--definition-of-done)

---

## 🌟 Tentang Zura

**Zura** (sebelumnya dirujuk sebagai JiraLite) adalah platform manajemen proyek modern yang dirancang untuk memberikan pengalaman setara **Atlassian Jira**, namun dengan arsitektur yang jauh lebih ringan, waktu respon sub-detik, sistem keamanan ketat, serta kemudahan penggunaan bagi tim rekayasa perangkat lunak.

Zura memadukan metodologi **Scrum** (sprint planning, estimation, burndown, velocity, retrospective) dan **Kanban** (visual flow, fractional indexing, WIP limits, column folding), serta dilengkapi sistem otorisasi berlapis berbasis peran (**RBAC**).

---

## ✨ Fitur Utama

### 1. Papan Kanban & Alur Kerja
- **Drag-and-Drop Halus**: Menggunakan mesin `@dnd-kit` dengan sensor pointer dan batas toleransi gerak 5px (membedakan klik kartu vs drag).
- **Pengurutan Pecahan (Fractional Indexing)**: Menggunakan kalkulasi `position = (prev + next) / 2` tanpa perlu me-reorder seluruh tabel basis data.
- **WIP (Work In Progress) Limit**: Pengaturan batas maksimum kartu per-kolom untuk mendeteksi dan mencegah hambatan kerja (*bottleneck*).
- **Ciutkan & Bentangkan Kolom**: Kolom dapat diciutkan menjadi bilah vertikal ramping dengan tombol expander interaktif (`↔`) saat hover.
- **Proteksi Role Viewer**: Tombol opsi titik tiga (`...`) pada kolom dinonaktifkan (`disabled` & `cursor-not-allowed`) khusus bagi pengguna dengan peran Viewer untuk mencegah mutasi kolom tanpa izin.
- **Optimistic UI & Undo Toast**: Perubahan status langsung tercermin seketika di layar dengan kemampuan membatalkan perpindahan via tombol *Undo* pada Toast notifikasi.

### 2. Backlog & Siklus Hidup Sprint
- **Manajemen Multi-Sprint**: Mengelola sprint dalam tiga fase status: `FUTURE` (Perencanaan), `ACTIVE` (Sedang Berjalan), dan `CLOSED` (Selesai).
- **Mulai Sprint (Start Sprint Modal)**: Penentuan nama sprint, durasi (1, 2, 3, 4 minggu atau custom), target tanggal, dan goal sprint.
- **Selesaikan Sprint Atomik (Complete Sprint)**: Transaksi ACID database yang membekukan snapshot committed/completed story points, mencatat hasil akhir kartu (`COMPLETED`, `CARRIED_OVER`, `RETURNED_TO_BACKLOG`), dan memindahkan kartu sisa ke sprint berikutnya atau Backlog pool.
- **Estimasi Story Points**: Dukungan skala estimasi Fibonacci (1, 2, 3, 5, 8, 13) untuk mengukur kapasitas tim.

### 3. Laporan Agile & Metrik Sprint
Halaman **Reports** terintegrasi penuh untuk menjawab 3 kebutuhan evaluasi utama tim:
- **Grafik Burndown Interaktif (SVG)**:
  - Dibangun dengan *pure calculation function* `computeBurndown` yang memutar ulang (*replay*) riwayat `IssueEvent`.
  - Akurat terhadap *scope creep* (tiket yang masuk di tengah jalan), tiket yang dibuka kembali (*reopened*), dan perubahan point.
  - Penentuan batas akhir hari berbasis zona waktu **Asia/Jakarta (UTC+7)**.
  - Pilihan metrik dinamis: **Story Points** atau **Issue Count**.
  - Garis pemandu *Ideal Burndown* vs *Actual Remaining* dengan kursor hover interaktif.
- **Grafik Velocity Tim**:
  - Visualisasi SVG *dual-bar chart* membandingkan point **Committed** vs **Completed** hingga 6 sprint terakhir.
  - Garis rata-rata velocity tim untuk membantu Product Owner merencanakan kapasitas sprint mendatang.
- **Sprint Report & Ekspor CSV**:
  - Tiga tabel audit status kartu: *Isu Selesai*, *Isu Belum Selesai (Carry-over)*, dan *Isu Dikeluarkan dari Sprint*.
  - Indikator peringatan untuk tiket yang belum memiliki estimasi point.
  - **Tombol Ekspor CSV**: Mengunduh seluruh rincian sprint report ke format file spreadsheet sekali klik.
- **Catatan Retrospektif Sprint**:
  - Kolom kolaboratif 3-bagian: *What went well*, *What could be improved*, dan *Action items* yang tersimpan permanen di basis data.

### 4. Work Item & Hierarki Subtask
- **5 Tipe Isu Standar**: `EPIC`, `STORY`, `TASK`, `BUG`, dan `SUBTASK`.
- **Hierarki Subtask**: Komponen `SubtaskChecklist.tsx` dengan progress bar otomatis (misal: "3 dari 5 selesai"), toggle checkbox cepat, dan inline quick-creation.
- **Popover Kalender Pintar**: Pemilih tanggal (*Start Date* & *Due Date*) dengan arah bukaan cerdas ke atas (*upward popover*) agar tidak terpotong tepi bawah layar.
- **Label Kustom & Palet Warna Hex**: Manajemen label proyek terpusat dengan 8 pilihan warna standar Jira.
- **Rich Text Editor**: Formatter teks lengkap (Heading, Bold, Italic, Strikethrough, Unordered/Ordered List, Blockquote, Inline Code, Code Block, Link, Text Color, dan Image Modal).
- **Pengikut Kartu (Issue Watcher)**: Fitur "Ikuti / Watch" agar anggota menerima notifikasi otomatis tanpa harus menjadi penanggung jawab (*Assignee*).

### 5. Keamanan & Matriks RBAC
- **Prinsip Deny-by-Default**: Akses ditolak kecuali jika didefinisikan secara eksplisit di [permissions.ts](file:///d:/webiste/jira_clone/backend/src/lib/permissions.ts).
- **Matriks Peran**:
  - `ADMIN`: Kontrol penuh proyek, kelola anggota, hapus kartu apa pun, konfigurasi alur kerja, dan manajemen sprint.
  - `MEMBER`: Buat dan edit kartu, ubah status, kelola label, buat sprint, hapus kartu/komentar miliknya sendiri.
  - `VIEWER`: Akses hanya-baca (*read-only*) untuk melihat papan, backlog, detail kartu, komentar, dan laporan. Seluruh tombol aksi mutasi di-block.
- **Pencegahan Kebocoran Proyek (404 Isolation)**: Non-anggota yang mencoba mengakses proyek privat akan menerima respons `404 Not Found` (bukan 403), sehingga mencegah *project enumeration attacks*.
- **Kekebalan Lead & Last Admin Lock**: Project Lead tidak dapat diturunkan perannya atau dikeluarkan, dan Admin terakhir dalam proyek tidak dapat dihapus.
- **Rate Limiting & Zod Strict**: Pembatasan laju request pada endpoint sensitif serta validasi input ketat `.strict()` untuk mencegah *mass assignment*.

### 6. Notifikasi & Jejak Audit
- **Notifikasi Database Persisten**: Dicuat otomatis saat pengguna di-assign ke kartu, dimention, atau saat kartu yang diikutinya dikomentari.
- **Polling Otomatis**: Pembaruan status notifikasi berkala dengan filter tab *Semua* / *Belum Dibaca*.
- **Riwayat Aktivitas Penuh (Activity Log)**: Pencatatan otomatis setiap perubahan status, assignee, judul, komentar, dan sprint dengan stempel waktu real-time.

### 7. Desain & Antarmuka Cerdas
- **Tema Ganda (Light & Jira Dark Mode)**: Palet warna resmi Jira Atlassian (`#0052CC`, `#172B4D`, `#091E42`, dll).
- **Lokalisasi Penuh Bahasa Indonesia**: Seluruh label navigasi, dialog modal, pesan validasi, dan bantuan diterjemahkan secara konsisten di [i18n.ts](file:///d:/webiste/jira_clone/frontend/src/lib/i18n.ts).
- **Logo Vektor Murni (SVG)**: Logo Zura bersolusi tinggi dan berbobot ringan di [zura-logo.svg](file:///d:/webiste/jira_clone/frontend/src/components/photo/zura-logo.svg).
- **Pencarian Cepat & Filter Tersimpan (Saved Views)**: Cari isu berdasarkan teks, filter "Item Saya Saja", filter Assignee, dan simpan preset filter favorit ke database.

---

## 🛠️ Arsitektur & Stack Teknologi

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Klien                         │
│   React 18 (SPA) + Vite 6 + TypeScript + Tailwind CSS 3.4  │
│        Zustand (State) + DnD Kit + Lucide Icons + i18n      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST API (JSON)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Zura Backend Server                      │
│            Node.js + Express.js 4 + TypeScript              │
│  - Middleware: Auth JWT, RBAC requirePermission, RateLimit  │
│  - Engine: computeBurndown(), IssueEvents, Activity Logger  │
│  - Validasi: Zod Runtime Strict Schemas                     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma Client ORM
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Basis Data Relasional ACID                  │
│                      PostgreSQL 16                          │
│   13 Tabel Relasional: User, Project, Issue, Sprint, dll.   │
└─────────────────────────────────────────────────────────────┘
```

| Komponen | Teknologi | Deskripsi |
|---|---|---|
| **Frontend Framework** | React 18 (`^18.3.1`) | Single Page Application modular dengan komponen reusable |
| **Bundler & Build Tool** | Vite 6 (`^6.0.3`) | Kompilasi instan dan Hot Module Replacement (HMR) sub-detik |
| **Styling Engine** | Tailwind CSS (`^3.4.16`) | Desain kustom berpedoman pada Atlassian Design System |
| **State Management** | Zustand (`^5.0.2`) | Store terpisah: `auth.ts`, `project.ts`, `toast.ts`, `notifications.ts` |
| **Drag & Drop** | `@dnd-kit` Core & Sortable | Sensor pointer akurat dengan animasi drag kartu & reorder kolom |
| **Backend Runtime** | Node.js + Express (`^4.21.2`) | RESTful API server modular dengan arsitektur controller/route |
| **Database ORM** | Prisma ORM (`^5.22.0`) | Pemetaan objek relasional deklaratif dengan type-safe PrismaClient |
| **Mesin Basis Data** | PostgreSQL 16 | RDBMS relasional dengan transaksi ACID dan composite index |
| **Validasi Skema** | Zod (`^3.24.1`) | Validasi runtime ketat pada body, params, dan query string |
| **Keamanan Kredensial** | `jsonwebtoken` + `bcryptjs` | Token JWT stateless dan hashing password salt 10 rounds |
| **Automated Testing** | Vitest (`^5.0.5`) + Supertest | Runner pengujian otomatis dengan isolasi database pengujian |

---

## 🗄️ Skema Basis Data (Entity Relationship)

Berikut adalah diagram relasi entitas dari 13 model database pada [schema.prisma](file:///d:/webiste/jira_clone/backend/prisma/schema.prisma):

```mermaid
erDiagram
    User ||--o{ Project : "leads"
    User ||--o{ ProjectMember : "joins"
    User ||--o{ Issue : "assigned / reported"
    User ||--o{ Comment : "writes"
    User ||--o{ Activity : "triggers"
    User ||--o{ Notification : "receives"
    User ||--o{ SavedView : "owns"
    User ||--o{ IssueWatcher : "watches"

    Project ||--o{ ProjectMember : "has"
    Project ||--o{ Status : "defines"
    Project ||--o{ Issue : "contains"
    Project ||--o{ Sprint : "plans"
    Project ||--o{ Label : "categorizes"
    Project ||--o{ SavedView : "scopes"

    Status ||--o{ Issue : "groups"

    Issue ||--o{ Comment : "has"
    Issue ||--o{ Activity : "records"
    Issue ||--o{ IssueWatcher : "tracked_by"
    Issue ||--o{ IssueEvent : "emits"
    Issue ||--o{ SprintIssueResult : "results"
    Issue ||--o{ Issue : "parent_of_subtask"

    Sprint ||--o{ Issue : "contains"
    Sprint ||--o{ IssueEvent : "tracks"
    Sprint ||--o{ SprintIssueResult : "freezes"
```

---

## 📡 Katalog Endpoint REST API

### Autentikasi (`/api/auth`)
| Metode | Endpoint | Proteksi | Keterangan |
|---|---|---|---|
| `POST` | `/api/auth/register` | Publik | Registrasi akun pengguna baru |
| `POST` | `/api/auth/login` | Publik | Login dengan email dan password |
| `POST` | `/api/auth/demo-login` | Publik | Akses instan akun Admin demo |
| `GET` | `/api/auth/me` | Bearer JWT | Mengambil profil pengguna yang sedang login |

### Manajemen Proyek (`/api/projects`)
| Metode | Endpoint | Proteksi | Keterangan |
|---|---|---|---|
| `GET` | `/api/projects` | Bearer JWT | Daftar seluruh proyek yang diikuti |
| `POST` | `/api/projects` | Bearer JWT | Membuat proyek baru (pembuat otomatis jadi Lead & Admin) |
| `GET` | `/api/projects/:key` | `project:view` | Mengambil detail proyek, status, dan anggota |
| `PATCH` | `/api/projects/:key` | `project:settings` | Mengubah nama dan deskripsi proyek |
| `DELETE` | `/api/projects/:key` | `project:delete` | Menghapus proyek beserta seluruh asetnya |
| `POST` | `/api/projects/:key/members` | `member:manage` | Menambahkan anggota ke proyek |
| `PATCH` | `/api/projects/:key/members/:userId` | `member:manage` | Mengubah role anggota (Lead/Last Admin lock) |
| `DELETE` | `/api/projects/:key/members/:userId` | `member:manage` | Mengeluarkan anggota dari proyek |

### Alur Kerja & Kolom Kanban (`/api/projects/:key/statuses`)
| Metode | Endpoint | Proteksi | Keterangan |
|---|---|---|---|
| `POST` | `/api/projects/:key/statuses` | `issue:create` | Menambah kolom status baru di papan |
| `PATCH` | `/api/projects/:key/statuses/:statusId` | `issue:create` | Mengubah nama atau kategori status kolom |
| `DELETE` | `/api/projects/:key/statuses/:statusId` | `issue:create` | Menghapus kolom status yang kosong |
| `PUT` | `/api/projects/:key/statuses/reorder` | `issue:create` | Mengatur ulang urutan posisi kolom papan |

### Work Items & Subtasks (`/api`)
| Metode | Endpoint | Proteksi | Keterangan |
|---|---|---|---|
| `GET` | `/api/projects/:key/issues` | `issue:view` | Daftar kartu isu dengan opsi filter dan paginasi |
| `POST` | `/api/projects/:key/issues` | `issue:create` | Membuat kartu work item baru |
| `GET` | `/api/issues/:key` | `issue:view` | Mengambil detail lengkap satu kartu |
| `PATCH` | `/api/issues/:key` | `issue:edit` | Memperbarui atribut kartu (judul, points, status, dll.) |
| `PATCH` | `/api/issues/:key/move` | `issue:move` | Memindahkan status kolom dan posisi vertikal kartu |
| `DELETE` | `/api/issues/:key` | `issue:delete:own/any` | Menghapus kartu isu |
| `POST` | `/api/issues/:key/subtasks` | `issue:create` | Membuat subtask baru di bawah kartu induk |
| `POST` | `/api/issues/:key/watchers` | `issue:view` | Mengikuti atau berhenti mengikuti kartu |

### Sprint & Laporan Agile (`/api`)
| Metode | Endpoint | Proteksi | Keterangan |
|---|---|---|---|
| `GET` | `/api/projects/:key/sprints` | `sprint:view` | Mengambil daftar sprint aktif, mendatang, dan selesai |
| `POST` | `/api/projects/:key/sprints` | `sprint:manage` | Membuat sprint baru |
| `PATCH` | `/api/sprints/:id` | `sprint:manage` | Memperbarui nama, tanggal, tujuan, atau mulai sprint |
| `POST` | `/api/projects/:key/sprints/:id/complete` | `sprint:manage` | Menyelesaikan sprint dengan snapshot & rollover atomik |
| `GET` | `/api/projects/:key/sprints/:id/burndown` | `sprint:view` | Data koordinat Burndown Chart (points/issues) |
| `GET` | `/api/projects/:key/reports/velocity` | `project:view` | Data riwayat Velocity tim 6 sprint terakhir |
| `GET` | `/api/projects/:key/sprints/:id/report` | `sprint:view` | Data Sprint Report lengkap (3 tabel hasil) |
| `PATCH` | `/api/projects/:key/sprints/:id/retro` | `sprint:manage` | Menyimpan catatan retrospektif sprint |

### Komentar, Label & Notifikasi (`/api`)
| Metode | Endpoint | Proteksi | Keterangan |
|---|---|---|---|
| `POST` | `/api/issues/:key/comments` | `comment:create` | Menambahkan komentar pada kartu |
| `DELETE` | `/api/comments/:id` | `comment:delete:own/any` | Menghapus komentar |
| `GET` | `/api/projects/:key/labels` | `issue:view` | Daftar label dalam proyek |
| `POST` | `/api/projects/:key/labels` | `label:manage` | Membuat label kustom baru |
| `GET` | `/api/notifications` | Bearer JWT | Mengambil daftar notifikasi pengguna |
| `POST` | `/api/notifications/mark-all-read` | Bearer JWT | Menandai seluruh notifikasi telah dibaca |

---

## 🚀 Panduan Instalasi & Menjalankan Project

### Prasyarat Sistem
Pastikan perangkat Anda telah terinstal:
- **Node.js**: Versi `18.x` atau `20.x` LTS
- **npm**: Versi `9.x` atau lebih baru
- **PostgreSQL**: Versi `14+` atau `16` berjalan di port default `5432`

---

### Langkah Setup Backend

1. **Buka direktori backend**:
   ```bash
   cd backend
   ```

2. **Instal dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi file `.env`**:
   Buat atau pastikan file `.env` di dalam folder `backend/` memiliki konfigurasi berikut:
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jira_clone?schema=public"
   JWT_SECRET="zura_super_secret_jwt_key_2026_production_grade"
   CORS_ORIGIN="http://localhost:5173"
   ```

4. **Sinkronkan skema database & generate Prisma client**:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Isi database dengan data awal (Seeding)**:
   ```bash
   npm run prisma:seed
   ```
   *Perintah ini akan membuat akun demo, proyek contoh `JIRA`, sprint aktif, sprint riwayat dengan data burndown, serta kartu-kartu siap pakai.*

6. **Jalankan server backend**:
   ```bash
   npm run dev
   ```
   Server backend akan aktif di: **`http://localhost:5000`**

---

### Langkah Setup Frontend

1. **Buka direktori frontend**:
   ```bash
   cd ../frontend
   ```

2. **Instal dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan server pengembangan Vite**:
   ```bash
   npm run dev
   ```
   Aplikasi frontend akan aktif di: **`http://localhost:5173`**

4. **Akses Aplikasi**:
   Buka peramban Anda di [http://localhost:5173](http://localhost:5173).

---

## 🧪 Pengujian Otomatis (Automated Testing)

Zura menerapkan pengujian integrasi otomatis yang ketat menggunakan **Vitest** dan **Supertest**. Seluruh pengujian berjalan pada database terisolasi (`jira_clone_test`) agar tidak merusak data pengembangan.

### Menjalankan Seluruh Test Suite:
```bash
cd backend
npm run test
```

### Hasil Verifikasi Audit Pengujian:
```text
 ✓ tests/security.test.ts (25 tests)
 ✓ tests/p1-features.test.ts (11 tests)
 ✓ tests/notifications.test.ts (8 tests)
 ✓ tests/labels-subtasks.test.ts (7 tests)
 ✓ tests/reports.test.ts (9 tests)
 ✓ tests/sprints.test.ts (8 tests)
 ✓ tests/burndown.test.ts (7 tests)
 ✓ tests/permissions.test.ts (12 tests)
 ✓ tests/routes-security.test.ts (3 tests)
 ✓ tests/safety.test.ts (1 test)

 Test Files  10 passed (10)
      Tests  91 passed (91)
   Duration  ~27s
   Pass Rate 100%
```

---

## 👥 Akun Demo Bawaan

Anda dapat langsung masuk ke aplikasi menggunakan tombol **Quick Demo Login** di halaman login, atau menggunakan salah satu akun terdaftar berikut:

| Peran Proyek | Nama Pengguna | Alamat Email | Kata Sandi | Hak Akses Utama |
|---|---|---|---|---|
| **ADMIN** | Admin User | `admin@zura.local` | `password123` | Otoritas penuh, kelola anggota, sprint, hapus kartu apa pun |
| **MEMBER** | Sarah Member | `sarah@zura.local` | `password123` | Buat/edit kartu, buat sprint, hapus kartu miliknya |
| **VIEWER** | Budi Viewer | `budi@zura.local` | `password123` | Akses baca saja (menu kolom & tombol mutasi ter-block) |

---

## 📂 Struktur Direktori Repositori

```text
jira_clone/
├── 01-JIRA-CLONE-BLUEPRINT.md            # Cetak biru arsitektur awal
├── 06-Roadmap-Pengembangan-dan-Best-Practice-JiraLite.md # Roadmap fitur P0-P3
├── 07-Pengembangan-Fitur-Tambahan-Burndown-Velocity-Sprint-Report.md # Spesifikasi laporan
├── README.md                             # Dokumentasi komprehensif repositori ini
├── docs/
│   ├── AUDIT.md                          # Laporan audit teknis dan status keandalan sistem
│   └── PANDUAN_WORKFLOW_USER.md          # Panduan alur kerja pengguna (Scrum & Kanban)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma                 # Definisi 13 model database Prisma
│   │   └── seed.ts                       # Seeding data pengguna, proyek, dan sprint
│   ├── src/
│   │   ├── lib/
│   │   │   ├── burndown.ts               # Pure calculation engine untuk Burndown chart
│   │   │   ├── issueEvents.ts            # Pencatatan event audit laporan sprint
│   │   │   ├── permissions.ts            # Matriks RBAC & validasi anti-eskalasi
│   │   │   ├── notifications.ts          # Generator notifikasi persisten
│   │   │   └── jwt.ts                    # Utilitas token autentikasi
│   │   ├── middleware/
│   │   │   ├── auth.ts                   # Ekstraktor & verifikator Bearer token
│   │   │   ├── permission.ts             # Middleware requirePermission & isolasi 404
│   │   │   ├── rateLimiter.ts            # Pembatas laju request in-memory
│   │   │   └── error.ts                  # Global error handling terpusat
│   │   ├── routes/
│   │   │   ├── auth.ts                   # Rute registrasi & sesi login
│   │   │   ├── projects.ts               # Rute proyek, anggota, status kolom
│   │   │   ├── issues.ts                 # Rute kartu isu, pergerakan DnD, subtask
│   │   │   ├── sprints.ts                # Rute siklus sprint, burndown, velocity, report
│   │   │   ├── comments.ts               # Rute komentar kartu
│   │   │   ├── labels.ts                 # Rute label kustom proyek
│   │   │   └── notifications.ts          # Rute polling notifikasi pengguna
│   │   ├── app.ts                        # Konfigurasi aplikasi Express
│   │   └── index.ts                      # Entry point backend server (port 5000)
│   └── tests/                            # 10 file pengujian integrasi & unit (91 skenario)
└── frontend/
    ├── src/
    │   ├── components/                   # Komponen UI modular
    │   │   ├── KanbanBoard.tsx           # Papan alur kerja kanban
    │   │   ├── KanbanColumn.tsx          # Kolom kanban dengan proteksi viewer
    │   │   ├── IssueCard.tsx             # Kartu draggable pada kanban
    │   │   ├── IssueDetailModal.tsx      # Modal detail kartu, komentar & riwayat
    │   │   ├── CompleteSprintModal.tsx   # Modal penutupan sprint atomik
    │   │   ├── ZuraLogo.tsx              # Komponen logo identitas brand Zura
    │   │   └── photo/zura-logo.svg       # Vektor logo SVG asli resolusi tinggi
    │   ├── pages/
    │   │   ├── AuthPage.tsx              # Halaman login, register, dan quick demo
    │   │   ├── BoardPage.tsx             # Halaman utama papan kanban
    │   │   ├── BacklogPage.tsx           # Halaman backlog dan perencanaan sprint
    │   │   ├── ReportsPage.tsx           # Halaman laporan Burndown, Velocity & Sprint Report
    │   │   ├── ListPage.tsx              # Halaman tabel work item dengan paginasi
    │   │   └── ProjectSettingsPage.tsx   # Halaman pengaturan proyek & manajemen anggota
    │   ├── lib/
    │   │   ├── api.ts                    # Client fetch API tersentralisasi
    │   │   ├── permissions.ts            # Hook usePermission & evaluasi peran klien
    │   │   └── i18n.ts                   # Kamus lokalisasi Bahasa Indonesia
    │   ├── store/                        # Global state management berbasis Zustand
    │   ├── types/                        # Definisi tipe data TypeScript terpadu
    │   ├── App.tsx                       # Root view selector & global layout
    │   └── main.tsx                      # Entry point React
    ├── tailwind.config.js                # Konfigurasi warna Jira Design System
    └── vite.config.ts                    # Konfigurasi bundler Vite & proxy backend
```

---

## 🎯 Standar Kualitas & Definition of Done

Setiap kontribusi kode atau penambahan fitur di repositori Zura wajib memenuhi tolok ukur kualitas berikut:

- [x] **Zero Build Errors**: Kompilasi TypeScript (`tsc`) dan bundling Vite wajib bebas dari segala peringatan atau error tipe data.
- [x] **Full Test Integrity**: Semua 91 pengujian Vitest wajib berstatus lulus (`passed`) sebelum kode digabungkan.
- [x] **Deny-by-Default RBAC**: Setiap endpoint baru wajib menerapkan middleware otorisasi `requirePermission()`.
- [x] **Database Isolation**: Pengujian hanya boleh mengakses basis data pengujian `jira_clone_test`.
- [x] **Data Integrity via Transactions**: Mutasi majemuk (seperti penutupan sprint dan pembuatan isu baru) wajib dieksekusi di dalam transaksi Prisma atomik.
- [x] **Consistent Indonesian Localization**: Seluruh antarmuka pengguna wajib menggunakan kosakata baku yang konsisten pada kamus `frontend/src/lib/i18n.ts`.

---

<p align="center">
  Dikelola dengan ❤️ oleh Tim Pengembang Zura Management.
</p>
