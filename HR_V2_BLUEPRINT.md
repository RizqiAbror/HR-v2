# BLUEPRINT ARSITEKTUR HR SYSTEM V2 (KALAPA)

## 1. Konteks Proyek
*   **Tujuan**: Migrasi dari HR v1 (Internal) ke HR v2 (B2B / Multi-Tenant).
*   **Target Pengguna Utama**: HR Admin (Bu Yola) dan Manajemen Internal Kalapa.
*   **Sistem Sifatnya 1 Arah**: Karyawan Klien/Agent tidak melakukan *login* ke sistem ini. Segala penginputan data (Cuti, Gaji) dilakukan oleh HR Admin secara semi-manual (Input Form atau Import Excel).

## 2. Struktur Database Utama (Prisma)
*   **`Agent`**: Master data perusahaan klien (PDG, DANA, dll).
*   **`Employee`**: Master data karyawan (Memiliki *foreign key* `agentId`). Terdapat validasi ketat NIK (`PROJ_YY_MM_XXX`), `jointDate`, dan `endDate` (Resign).
*   **`LeaveQuota`**: Master jatah cuti karyawan per tahun. (Dihitung prorate berdasarkan `jointDate`).
*   **`LeaveRequest` & `LeaveRequestDetail`**: Transaksi pengajuan cuti. Menggunakan konsep *Master-Detail* sehingga satu nomor pengajuan bisa memuat banyak tanggal yang tidak berurutan.

## 3. Fitur Utama yang Sudah Selesai
1.  **Otomasi Kuota Tahunan**: Script khusus berjalan tiap pergantian tahun untuk menambah kuota cuti. (Aman dari *bug* karena mengecek `endDate` / karyawan *resign*).
2.  **Audit Trail Finansial**: Sistem akan merekam jejak (Log Data Lama vs Data Baru) khusus jika ada perubahan *Status PKWT*, *Gaji Pokok*, *Tunjangan*, dan BPJS.
3.  **Upload File (Multer)**: Sistem mendukung pengunggahan bukti Surat Sakit (untuk Cuti Sakit) dan Kontrak (PKWT).
4.  **Autentikasi Aman**: Sistem *Login* dengan Enkripsi `bcrypt` dan *Middleware* berbasis sesi (Session). Tersedia hak akses spesifik untuk *Superadmin* dan *HR Admin*.

## 4. Next Step (Tugas Selanjutnya)
*   **Modul Cuti**: Merombak tampilan `/views/cuti/form.ejs` menjadi *Form Input Admin*. HR Admin harus bisa memilih/mencari NIK karyawan yang akan diinputkan cutinya (karena karyawan tidak *login* sendiri).
*   **Modul Gaji (Payroll)**: Mulai merancang tabel struktur gaji (Gaji Pokok + Tunjangan - Potongan PPh21/BPJS), membuat fungsi *Generate* PDF Slip Gaji, dan *Broadcast Email* Slip Gaji ke karyawan.
