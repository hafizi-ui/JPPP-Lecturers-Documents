# Panduan Pasang: JPPP Lecturer's Documents (GitHub Pages)

Link laman: https://hafizi-ui.github.io/JPPP-Lecturers-Documents/

Portal ini terbahagi kepada dua bahagian:

| Bahagian | Tempat | Isi |
|---|---|---|
| **Laman web** (apa yang orang nampak) | GitHub Pages, percuma | `index.html`, `verify.html`, fail `.js` dan `style.css` |
| **Pangkalan data & fail** | Google Sheets + Drive Tuan, percuma | `Code.gs`, `appsscript.json` |

Portal boleh dicuba **sekarang juga dalam Mod Demo**. Cukup lakukan Bahagian A; Bahagian B menyambungkan data sebenar.

---

## Bahagian A: Terbitkan laman di GitHub (±10 minit)

1. Daftar/log masuk di https://github.com.
2. Klik **+** (atas kanan), pilih **New repository**.
   - Repository name: `portal-jabatan`
   - Pilih **Public**. GitHub Pages percuma memerlukan repo awam. Tiada data sulit dalam kod; data sebenar kekal dalam Google Drive Tuan.
   - Klik **Create repository**.
3. Dalam repo baharu, klik **uploading an existing file**.
4. Buka zip `Portal_GitHub.zip`, kemudian **seret semua isi folder `github-portal`**: `index.html`, `verify.html`, folder `assets` dan folder `backend`. Klik **Commit changes**.
   - Pastikan `index.html` berada di **tingkat paling atas** repo, bukan di dalam folder lain.
5. Pergi ke **Settings, Pages** (menu kiri).
   - Source: **Deploy from a branch**
   - Branch: **main** dan folder **/ (root)**, kemudian klik **Save**
6. Tunggu 1–2 minit dan muat semula. Link akan keluar, contohnya:
   `https://NAMA-ANDA.github.io/portal-jabatan/`

Buka link itu. Portal berjalan dalam **Mod Demo**; klik "Ketua Jabatan" atau "Pensyarah" untuk mencuba.

---

## Bahagian B: Sambung pangkalan data sebenar (±20 minit)

### B1. Google Sheet + Apps Script
1. Buka https://sheets.new dan namakan fail **Portal Tandatangan Jabatan**.
2. Pilih **Extensions, Apps Script**.
3. Padam isi `Code.gs`, kemudian tampal isi `Code.gs`.
4. Di baris atas `Code.gs`, tukar `SITE_URL` (sudah diset kepada https://hafizi-ui.github.io/JPPP-Lecturers-Documents/).
5. Klik gear **Project Settings** dan tandakan **Show "appsscript.json"**. Buka `appsscript.json`, padam isinya dan tampal isi `appsscript.json`. Simpan (Ctrl+S).

### B2. Jalankan setup
1. Pilih fungsi **setup**, kemudian klik **▶ Run**, **Review permissions** dan **Allow**.
   - Jika muncul "Google hasn't verified this app", klik **Advanced** dan **Go to … (unsafe)**. Ini normal untuk skrip sendiri.
2. Buka **Execution log**. Di situ tertulis **kata laluan sementara** akaun KJ Tuan. **Salin** kata laluan ini.

### B3. Deploy sebagai API
1. Pilih **Deploy, New deployment**, klik gear dan pilih **Web app**.
2. Tetapan:
   - Execute as: **Me**
   - Who has access: **Anyone**
3. Klik **Deploy** dan salin **Web app URL** (berakhir dengan `/exec`).

> **Jika pilihan "Anyone" tiada:** admin Google Workspace KPTM mungkin menyekatnya. Ada dua pilihan:
> (a) minta IT benarkan, atau
> (b) buat Sheet + Apps Script ini menggunakan akaun **Gmail peribadi** (langkah sama).
> Log masuk portal tetap guna emel @kptm.edu.my, kerana akaun portal diurus sendiri dalam Sheet.

### B4. Sambungkan laman ke API
1. Di GitHub, buka fail `config.js` dan klik ikon pensel (**Edit**).
2. Tampal URL tadi:
   ```js
   API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
   ```
3. Klik **Commit changes**. Tunggu 1 minit dan muat semula portal. Kotak "Mod Demo" akan hilang.

### B5. Log masuk pertama
1. Log masuk dengan emel Tuan dan kata laluan sementara (dari B2). Tuan akan diminta tukar kata laluan.
2. Pergi ke **Tetapan**:
   - **Tandatangan**: muat naik `tandatangan_sahaja.png`.
   - **Cop / blok nama** (pilihan): `tandatangan_dengan_nama.png`.
   - **Pensyarah**: tampal senarai (Nama, emel, No Staf) dan klik **Tambah**. **Setiap pensyarah terima emel** dengan kata laluan sementara masing-masing.

---

## Ujian 5 minit sebelum umum
1. Tambah diri sendiri sebagai pensyarah menggunakan emel kedua, atau minta seorang rakan.
2. Pensyarah hantar Quiz PDF. Tuan lihat tandatangan terletak di ruang *Verified by*.
3. Uji **Kembalikan**, kemudian **Hantar semula**, kemudian **Tandatangan**.
4. Pensyarah muat turun PDF dan imbas kod QR. Halaman **"Dokumen SAH"** sepatutnya keluar.

## Kemas kini selepas ini
- **Tukar rupa/teks laman:** edit fail di GitHub dan Commit. Laman dikemas kini dalam 1 minit.
- **Tukar `Code.gs`:** pilih **Deploy, Manage deployments**, klik ✏️, pilih **Version: New version** dan **Deploy**. URL kekal sama.

## Tempoh muat turun & pemadaman fail (7 hari)
- Selepas KJ menandatangani, pensyarah ada **7 hari** untuk muat turun PDF. Emel dan portal memaparkan tarikh akhir serta amaran supaya pensyarah menyimpan salinan sendiri.
- Selepas tempoh tamat, **semua fail dokumen itu dipadam KEKAL dari Drive Tuan** (fail asal, PDF, dan PDF bertandatangan; tidak masuk Trash). Pemadaman dijalankan setiap jam secara automatik.
- Dokumen yang **Ditolak** juga dipadam 7 hari selepas ditolak. Versi lama dokumen yang dihantar semula dipadam serta-merta.
- Yang **kekal** dalam Sheet hanyalah rekod (no. rujukan, tajuk, tarikh, hash SHA-256). Oleh itu **kod QR masih boleh disemak** dan pensyarah masih boleh buktikan salinan mereka asli.
- Sebelum tempoh tamat, KJ boleh klik **Lanjutkan 7 hari** jika pensyarah minta masa tambahan. Selepas fail dipadam, ia tidak boleh dipulihkan; pensyarah perlu hantar semula.
- Untuk tukar tempoh, ubah `DOWNLOAD_HOURS: 168` dalam `Code.gs` (jam; 168 = 7 hari) **dan** `DOWNLOAD_DAYS: 7` dalam `config.js`, kemudian deploy versi baharu.

## Keselamatan
- Kata laluan disimpan dalam bentuk **hash** (bukan teks asal). Akaun dikunci 15 minit selepas 5 cubaan salah. Sesi tamat selepas 6 jam.
- Jika pensyarah terlupa kata laluan, pergi ke **Tetapan, Pensyarah** dan klik **Set semula**. Kata laluan baharu dihantar ke emel pensyarah.
- Jika Tuan sendiri terlupa kata laluan: di Apps Script, jalankan fungsi `resetKataLaluanSaya` dan lihat Execution log.
- **Jangan kongsi** folder Drive `Private` (tandatangan Tuan) dan jangan letak gambar tandatangan dalam GitHub.
- Semua tindakan direkodkan dalam tab **AuditLog**.
- Aktifkan 2-Step Verification pada akaun Google yang memiliki Sheet.
