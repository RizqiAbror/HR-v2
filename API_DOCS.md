# HR System v2 - API Documentation

Dokumen ini berisi daftar seluruh endpoint API yang tersedia di HR System v2 beserta panduan cara menggunakannya.

> **PENTING UNTUK DEVELOPER:** Setiap kali ada pembuatan API baru atau perubahan pada API yang sudah ada (struktur *request*/*response*), dokumen ini **WAJIB** di-update secara berkala. Hal ini sangat krusial untuk menjaga referensi dokumentasi agar tetap selaras dengan *source code*.

---

## 🛠 Cara Mengetes API (Testing)

Anda dapat mengetes semua endpoint API yang ada di aplikasi ini dengan bantuan *tools* REST Client seperti **Postman**, **Insomnia**, atau ekstensi VS Code seperti **Thunder Client**.

**Langkah-langkah Umum via Postman:**
1. Pastikan server Express Anda sedang berjalan (di terminal ketik `npm run dev`). Secara *default*, aplikasi berjalan di URL `http://localhost:3000`.
2. Buka aplikasi **Postman**, lalu buat *Request* baru (tanda **+** di tab atas).
3. Di sebelah kiri URL bar, pilih metode HTTP (misal: `GET`, `POST`, `PATCH`, dll) sesuai endpoint yang ingin dituju.
4. Masukkan URL lengkap (contoh: `http://localhost:3000/api/cuti/sisa?nik=KTP_25_01_001`).
5. **Khusus request POST atau PATCH**:
   - Di bawah URL bar, klik tab **Body**.
   - Pilih opsi **raw**.
   - Di kanan tulisan *raw*, klik dropdown *Text* dan ubah menjadi **JSON**.
   - Ketik/paste format JSON yang dibutuhkan ke dalam kotak yang tersedia (lihat referensi API di bawah).
6. Klik tombol biru **Send**.
7. Lihat *response* (hasil kembalian) yang dikirim oleh server di kotak bawah layar.

---

## 📁 1. Modul Cuti (`/api/cuti`)

### 1.1 Cek Sisa Cuti Karyawan
- **Endpoint:** `GET /api/cuti/sisa`
- **Deskripsi:** Digunakan untuk mengambil data sisa kuota cuti seorang karyawan di tahun yang relevan.
- **Query Params:**
  - `nik` (String, Wajib) - Nomor Induk Karyawan yang dicari.
  - `tahun` (Number, Opsional) - Tahun berlakunya cuti (jika tidak diisi, otomatis menggunakan tahun saat ini).
- **Contoh Request:**
  `GET http://localhost:3000/api/cuti/sisa?nik=KTP_25_01_001&tahun=2025`
- **Contoh Response Berhasil (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "nik": "KTP_25_01_001",
      "nama_karyawan": "Budi Santoso",
      "tahun": 2025,
      "jumlah_cuti": 12,
      "cuti_terpakai": 0,
      "sisa_cuti": 12
    }
  }
  ```

### 1.2 Riwayat Pengajuan Cuti
- **Endpoint:** `GET /api/cuti/riwayat/:nik`
- **Deskripsi:** Mendapatkan daftar riwayat transaksi pengajuan cuti yang pernah dilakukan karyawan.
- **Path Params:** `nik` (String, Wajib)
- **Contoh Request:**
  `GET http://localhost:3000/api/cuti/riwayat/KTP_25_01_001`
- **Contoh Response Berhasil (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "requestNo": "LV-2025-4921",
        "nik": "KTP_25_01_001",
        "quotaId": 1,
        "tanggalMulai": "2025-05-02T00:00:00.000Z",
        "tanggalAkhir": "2025-05-05T00:00:00.000Z",
        "jumlahHari": 2,
        "alasan": "Acara keluarga",
        "status": "PENDING_ATASAN",
        "quota": {
          "tahun": 2025
        }
      }
    ]
  }
  ```

### 1.3 Pengajuan Cuti Baru (Submit)
- **Endpoint:** `POST /api/cuti/submit`
- **Deskripsi:** Karyawan melakukan pengajuan cuti. Sistem akan melakukan validasi hari libur nasional, akhir pekan, dan kecukupan saldo cuti.
- **Body Parameter (JSON):**
  ```json
  {
    "nik": "KTP_25_01_001",
    "tanggalMulai": "2025-05-02",
    "tanggalAkhir": "2025-05-05",
    "alasan": "Cuti tahunan untuk liburan keluarga"
  }
  ```
- **Contoh Response Berhasil (200 OK):**
  ```json
  {
    "success": true,
    "message": "Pengajuan cuti berhasil disubmit",
    "data": {
      "id": 1,
      "requestNo": "LV-2025-8832",
      "nik": "KTP_25_01_001",
      "quotaId": 1,
      "tanggalMulai": "2025-05-02T00:00:00.000Z",
      "tanggalAkhir": "2025-05-05T00:00:00.000Z",
      "jumlahHari": 2,
      "alasan": "Cuti tahunan untuk liburan keluarga",
      "status": "PENDING_ATASAN"
    }
  }
  ```

### 1.4 Persetujuan Cuti (Approve / Reject)
- **Endpoint:** `PATCH /api/cuti/approve/:id`
- **Deskripsi:** Fitur untuk Atasan (Level 1) dan HR (Level 2) guna memberikan persetujuan atau penolakan pengajuan cuti. **Penting:** Saldo kuota `cutiTerpakai` hanya akan terpotong secara final di database ketika Role HR memberikan aksi "APPROVE".
- **Path Params:** `id` (Number, Wajib) - ID transaksi `leave_request`.
- **Body Parameter (JSON):**
  ```json
  {
    "action": "APPROVE", 
    "role": "ATASAN", 
    "approvedBy": "KTP_25_01_001", 
    "catatan": "Pekerjaan silakan di-handover ke rekan sebelum cuti."
  }
  ```
  *(Catatan: Nilai `action` hanya bisa `APPROVE` atau `REJECT`. Nilai `role` hanya bisa `ATASAN` atau `HR`)*
- **Contoh Response Berhasil (200 OK):**
  ```json
  {
    "success": true,
    "message": "Status berhasil diupdate",
    "data": {
      "id": 1,
      "status": "PENDING_HR",
      "approvedByAtasan": "KTP_25_01_001",
      "approvedAtAtasan": "2025-05-01T14:40:00.000Z",
      "catatanAtasan": "Pekerjaan silakan di-handover ke rekan sebelum cuti."
    }
  }
  ```

### 1.5 Pembatalan Cuti Karyawan (Cancel)
- **Endpoint:** `PATCH /api/cuti/cancel/:id`
- **Deskripsi:** Pembatalan pengajuan cuti secara mandiri oleh karyawan. Sistem akan memvalidasi agar pembatalan HANYA diizinkan jika status masih `PENDING_ATASAN`. Jika sudah diproses, cuti tidak bisa dibatalkan dari sisi karyawan.
- **Path Params:** `id` (Number, Wajib) - ID transaksi `leave_request`.
- **Contoh Request:**
  `PATCH http://localhost:3000/api/cuti/cancel/1`
- **Contoh Response Berhasil (200 OK):**
  ```json
  {
    "success": true,
    "message": "Pengajuan cuti berhasil dibatalkan"
  }
  ```

---
*(Catatan Developer: Jika ada tambahan tabel/modul seperti Karyawan, Gaji, dll., dokumentasikan format API di bawah garis ini)*
