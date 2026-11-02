# Ruang Kita

Planner pribadi untuk **lamaran dan dua skenario pernikahan: di rumah dan di gedung**, dengan checklist, anggaran, tamu, rundown, paket, dan catatan masing-masing. Skenario rumah memakai rencana yang sudah ada: **Silver · In home**, target **300 orang**. Skenario gedung juga memiliki target awal **300 orang**, dengan paket dan biaya yang belum dipilih. Rencana lamaran dimulai dengan 10 saran tugas, sedangkan tanggal, target tamu, anggaran, dan paketnya belum ditentukan. Data rencana dan katalog disimpan dalam JSON yang dapat diedit.

## Menjalankan

Gunakan Node.js 24 atau lebih baru.

```sh
git clone https://github.com/hoggir/wedding-planner.git
cd wedding-planner
npm install --include=dev
npm run build
npm start
```

Buka **http://localhost:4310**. Untuk pengembangan dengan pembaruan tampilan langsung, gunakan `npm run dev`.

Repositori menyertakan rencana yang sudah diedit di **`data/wedding.json`**, **`data/wedding-gedung.json`**, dan **`data/lamaran.json`**. Saat file rencana belum ada, server menyalin rencana contoh dari **`data/examples/`**; file yang sudah ada tetap dipertahankan. Ketiga JSON rencana ikut dilacak Git, sedangkan backup dan file unggahan tetap dikecualikan. Karena repositori publik, isi JSON rencana dapat dibaca publik. Referensi lampiran tetap tersimpan dalam JSON, tetapi file unggahan hanya tersedia pada perangkat asal.

## Dipakai berdua

Jalankan satu server untuk kedua perangkat:

```sh
HOST=0.0.0.0 npm start
```

Buka `http://<IP-komputer-server>:4310` dari perangkat lain di Wi-Fi yang sama. Komputer server harus tetap hidup. Semua perubahan masuk ke JSON pada komputer tersebut; browser memeriksa pembaruan setiap 10 detik. Penyimpanan dari revisi lama ditolak agar edit pasangan tidak tertimpa.

Versi ini cocok untuk komputer sendiri atau jaringan rumah. Belum ada login atau hosting internet; jangan membuka port server langsung ke internet karena daftar tamu dan catatan akan dapat diakses oleh orang yang memiliki akses jaringan.

## Mengedit data

Pilih rencana melalui dropdown **Pilih rencana** di bagian atas sidebar. Di ponsel, buka menu terlebih dahulu. Tautan langsung: [Pernikahan di rumah](http://localhost:4310/#overview), [Pernikahan di gedung](http://localhost:4310/#gedung/overview), dan [Lamaran](http://localhost:4310/#lamaran/overview). Halaman lain mengikuti rencana yang dipilih.

Tombol **Di rumah / Di gedung** di atas halaman pernikahan berpindah skenario sambil mempertahankan halaman saat ini. Misalnya, berpindah dari anggaran rumah langsung ke anggaran gedung untuk membandingkan kebutuhan.

File skenario rumah: **`data/wedding.json`**. File skenario gedung: **`data/wedding-gedung.json`**. File rencana lamaran: **`data/lamaran.json`**. Perubahan pada satu rencana tidak mengubah rencana lain. Fitur impor dan ekspor berlaku untuk rencana yang sedang dibuka; file dari skenario lain ditolak agar tidak tertukar.

- `eventType`: `engagement` untuk lamaran. File pernikahan lama tanpa field ini tetap dikenali sebagai pernikahan. File JSON dari jenis acara yang berbeda ditolak saat diimpor agar tidak tertukar.
- `scenario`: `hall` untuk skenario gedung, dengan `eventType: "wedding"`. Skenario rumah memakai `home` atau tidak memiliki field ini agar file lama tetap kompatibel. Pertahankan identitas skenario saat mengedit JSON.
- `event`: detail acara pada file lamaran. File pernikahan lama memakai `wedding`; struktur di dalamnya sama: nama pasangan, tanggal (`YYYY-MM-DD` atau string kosong), lokasi, target tamu, dan batas anggaran. Nilai `budgetTarget: 0` dan `guestTarget: 0` berarti belum ditentukan.
- `package`: nama, vendor, harga, dan kelompok rincian paket.
- `packagePaid`: jumlah pembayaran paket yang sudah dilakukan.
- `expenses`: biaya tambahan; subtotal = `quantity × unitPrice`, dan `paid` adalah total pembayaran yang sudah dilakukan. Harga menggunakan rupiah penuh, tanpa titik atau koma.
- `tasks`: checklist, kategori, penanggung jawab, target tanggal, prioritas (`high`, `normal`, `low`), dan `done`.
- `guests`: nama undangan, pihak keluarga, jumlah orang, telepon, catatan, dan status (`pending`, `confirmed`, `declined`). **300 orang berbeda dengan 300 undangan**.
- `timeline`: kegiatan dengan waktu `HH:mm`, penanggung jawab, dan catatan.
- `notes`: judul, isi, dan penulis catatan.

Setiap baris dalam array wajib memiliki `id` yang unik. Pertahankan `schemaVersion: 1`. Perubahan langsung pada file dibaca saat refresh/pemeriksaan berkala. Simpan JSON yang valid; lebih aman mengedit lewat menu **Pengaturan & data → Editor JSON** karena website memvalidasi data sebelum mengganti file.

**Unduh JSON** membuat salinan rencana yang sedang dibuka, dengan nama file yang mencantumkan `pernikahan-rumah`, `pernikahan-gedung`, atau `lamaran`. Hasil edit salinan perlu diimpor kembali. Server mencadangkan 20 versi sebelumnya per rencana ke `data/backups/wedding/`, `data/backups/wedding-gedung/`, dan `data/backups/lamaran/` pada setiap penyimpanan melalui website. Backup pernikahan lama di `data/backups/` tetap tersedia. Pengeditan manual file di luar website tidak membuat backup otomatis. Untuk rollback, hentikan server, salin backup ke file rencana yang sesuai, lalu jalankan lagi.

API lama `GET/PUT /api/plan` tetap digunakan untuk skenario rumah. Gedung menggunakan `GET/PUT /api/plan?event=wedding&scenario=hall`, sedangkan lamaran memakai `GET/PUT /api/plan?event=engagement`. Masing-masing memiliki revisi sendiri untuk pemeriksaan konflik edit.

## Lampiran anggaran

Di menu **Anggaran**, klik **Tambah lampiran** atau **Kelola** pada paket utama maupun biaya tambahan. Satu kebutuhan dapat memiliki beberapa dokumen, gambar, dan tautan sekaligus. Tautan yang masih diketik juga ikut ditambahkan saat menekan **Simpan perubahan**.

Format unggahan: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, TXT, CSV, JPG/JPEG, PNG, WEBP, dan GIF. Batasnya **10 MB per file** dan **20 lampiran per kebutuhan**. Gambar memiliki pratinjau; dokumen dapat diunduh. Tautan harus berupa alamat HTTP/HTTPS lengkap.

Referensi lampiran tersimpan sebagai array `attachments` pada `package` atau setiap baris `expenses`. Data lama yang belum memiliki field ini tetap dapat dibuka. Contoh tautan:

```json
{
  "id": "penawaran-vendor",
  "kind": "link",
  "name": "Penawaran katering",
  "url": "https://example.com/penawaran"
}
```

File asli dan metadata unggahannya tersimpan di **`data/uploads/`**, bukan di dalam JSON. **Unduh JSON tidak menyertakan file asli**; saat memindahkan server atau membuat backup lengkap, salin seluruh folder **`data/`**, termasuk ketiga file rencana, katalog paket, dan folder unggahan. Referensi lampiran tetap melekat pada item anggaran masing-masing.

Penghapusan lampiran melepas referensinya dari item anggaran. File asli tetap disimpan agar backup JSON sebelumnya masih dapat digunakan. Unggahan baru juga baru terhubung ke anggaran setelah menekan **Simpan perubahan**.

## Pilihan paket & vendor

Buka **Paket & vendor**, pilih kategori dan paket untuk melihat fasilitasnya di bawah. Pilihan di dropdown adalah pratinjau. Klik **Gunakan paket ini** untuk menyimpan pilihan serta memperbarui harga dan ringkasan anggaran. Satu paket utama digunakan dalam satu rencana.

Katalog tersedia di **`data/packages.json`**, berisi 24 pilihan: 22 paket dari halaman 3–24 brosur Nikah Murah Karanganyar, serta 2 paket dekorasi Niscala Decoration dari flyer pengguna. File ini dibaca server saat halaman katalog dibuka, sehingga perubahan JSON tersedia setelah halaman dimuat ulang. Setiap paket memiliki `id`, `name`, `vendor`, `category`, `price`, `sourcePage`, `groups` (kelompok fasilitas), `notes`, `variants`, serta informasi kapasitas dan katering jika tercantum. Harga menggunakan rupiah penuh. Salin struktur paket yang ada jika menambahkan pilihan baru, dan gunakan `id` unik.

Kategori **Lamaran** memuat Niscala Kain Drapery (**Rp600.000**), Niscala Decor Papan Plywood (**Rp850.000**), dan paket Engagement Nikah Murah Karanganyar. Dua pilihan Niscala berasal dari satu vendor yang sama. Ongkir belum termasuk; rias, dokumentasi, dan katering tidak tercantum dalam flyer Niscala.

Kontak vendor dapat dicatat pada field `contacts` di setiap paket dalam `data/packages.json`. Contoh Niscala:

```json
{
  "whatsapp": "085925827004",
  "instagram": "https://www.instagram.com/niscala_decoration?dlrf=cGpremR6bWFkNDQ2"
}
```

Nomor WhatsApp ditampilkan sesuai JSON dan dikonversi ke format internasional pada tautan `wa.me` (awalan `0` menjadi `62`). Tombol kontak tampil pada vendor yang memiliki kontak. Instagram menggunakan tautan yang dicatat dalam JSON.

Di **Anggaran**, form tambah/edit biaya dan edit paket menyediakan **Nama vendor**, **WhatsApp vendor**, **Instagram vendor**, **Tautan vendor**, serta **Deskripsi / varian / catatan**. Kontak tampil sebagai tautan pada baris kebutuhan. Data ini tersimpan pada `vendor`, `contacts` (`whatsapp`, `instagram`, `link`), dan `note` di `package` atau setiap baris `expenses`. Deskripsi menerima beberapa baris, maksimal 2.000 karakter; semua kolom kontak opsional. Tautan harus menggunakan HTTP/HTTPS.

Daftar anggaran dapat dicari melalui nama kebutuhan, vendor, kategori, atau catatan, serta difilter menurut kategori dan status pembayaran. Total di bagian bawah mengikuti hasil filter; tiga kartu ringkasan tetap menghitung seluruh rencana. Klik **nama kebutuhan** untuk membuka **Detail anggaran** yang berisi nominal, catatan lengkap, kontak vendor, checklist, dan seluruh lampiran. Dari rincian pembayaran juga dapat dibuka detail kebutuhan masing-masing. Tombol **Edit anggaran** membuka form dengan bagian **Kebutuhan & biaya**, **Vendor & kontak**, serta checklist, disertai ringkasan nominal yang berubah saat diketik. Membuka atau memfilter daftar tidak mengubah JSON rencana.

Kartu **Pembayaran tercatat** membuka rincian pembayaran seluruh kebutuhan, termasuk paket dan biaya tambahan. Kartu **Sisa estimasi pembayaran** membuka kebutuhan yang belum lunas beserta subtotal, pembayaran, dan sisanya. Ikon pensil pada rincian membuka form item yang dipilih. Pembayaran dicatat sebagai total per kebutuhan, bukan riwayat transaksi. Daftar anggaran menampilkan kategori dan status pembayaran; pada ponsel, angka disusun per item tanpa menggeser tabel ke samping.

Semua kolom nominal (harga satuan, pembayaran biaya, harga paket, pembayaran paket, dan batas anggaran) otomatis menampilkan titik pemisah ribuan saat diketik, misalnya `1500000` menjadi `1.500.000`. Angka bertitik atau berawalan `Rp` juga dapat ditempel. Nilai JSON tetap berupa angka rupiah bulat, dan batas nominal serta pembayaran tetap divalidasi.

Untuk menghubungkan anggaran ke checklist, klik **Hubungkan checklist** pada kebutuhan atau edit paket/biaya. Tersedia dua opsi: **Pilih checklist yang ada** (maksimal satu tugas; pilih Tanpa checklist untuk melepas hubungan) dan **Buat checklist baru** (judul, kategori, penanggung jawab, target tanggal, prioritas). Checklist baru dan anggaran disimpan bersamaan dalam satu perubahan JSON; membatalkan form atau penyimpanan yang gagal tidak membuat tugas baru. Satu tugas boleh dipakai oleh beberapa biaya, tetapi setiap biaya hanya memiliki satu checklist terkait. Hubungan disimpan sebagai `taskIds` berisi nol atau satu ID di `package` atau baris `expenses`, dan hanya merujuk tugas dalam rencana yang sama. Pada daftar anggaran, tugas dapat dibuka, diselesaikan, atau dibuka kembali; pada Checklist, tombol anggaran terkait membuka biaya yang sesuai. Menandai tugas selesai tidak mengubah pembayaran. Menghapus tugas melepas hubungannya dari seluruh anggaran, sementara mengganti paket mempertahankan hubungan yang telah dipilih. Data lama tanpa `taskIds` tetap diterima.

Setiap tugas menyediakan kolom opsional **Jawaban / kesimpulan** untuk mencatat hasil diskusi atau keputusan akhir, termasuk tugas baru dari anggaran. Isinya disimpan pada `tasks[].conclusion`, maksimal 2.000 karakter dan mendukung beberapa baris. Cuplikannya tampil pada checklist serta anggaran terkait; buka tugas untuk membaca atau mengedit isi lengkap. Kesimpulan tetap tersimpan ketika tugas ditandai selesai atau dibuka kembali. Data lama tanpa `conclusion` tetap diterima.

Gunakan tombol **panah naik/turun** pada tiap tugas untuk mengatur urutan checklist. Urutan langsung tersimpan sebagai urutan array `tasks` dalam JSON masing-masing rencana. Saat daftar difilter, tombol menukar posisi tugas yang terlihat dan mempertahankan posisi tugas yang tersembunyi. **Langkah berikutnya** di Ringkasan menampilkan lima tugas belum selesai pertama sesuai urutan checklist; prioritas ditampilkan sebagai penanda tanpa mengubah urutan pilihan kalian.

Kontak paket mengikuti vendor yang diterapkan dari katalog. Paket lama yang belum menyimpan `contacts` mengambil kontak dari entri katalog yang sama; menyimpan edit paket mencatat kontak tersebut ke JSON rencana. Edit kontak dan deskripsi paket dari anggaran juga terlihat pada paket aktif di **Paket & vendor**. Catatan pribadi tetap disimpan ketika mengganti pilihan paket, sedangkan kontak mengikuti vendor baru.

Paket Niscala memakai `source` tersendiri dengan `kind: "image"`, `url`, `title`, dan `notes`, sehingga tautan sumber dan catatan mengikuti vendor yang dipilih. Flyer asli disalin ke **`public/vendors/`** dan ikut dimasukkan ke build. Sertakan folder ini jika memindahkan source project. Paket yang tidak memiliki `source` tersendiri menggunakan sumber brosur utama.

Varian harga eksplisit tersedia untuk Madaniyah tanpa akad dan MCC Senin–Kamis. Brosur tidak menjelaskan fasilitas khusus varian tanpa akad, sehingga website menampilkan fasilitas paket dasar dengan catatan konfirmasi. Ketidaksesuaian jumlah katering pada Gedung Wanita dan nama venue pada MCC juga ditandai sesuai isi brosur.

Paket yang diterapkan disalin ke `package` dalam file acara yang sedang dibuka, beserta `catalogId` dan `variantId`. Rencana lamaran membuka kategori **Lamaran** dengan pilihan paket Engagement; paket ini baru masuk anggaran setelah diterapkan. Pembayaran dan lampiran yang sudah tercatat dipertahankan. Pemilihan paket yang lebih murah daripada pembayaran tercatat ditolak sampai nilainya diperiksa. Biaya tambahan tidak dihapus otomatis; website mengingatkan jika paket sudah mencakup katering sementara biaya katering tambahan masih dicatat.

Skenario rumah membuka kategori **Di rumah**, dan skenario gedung membuka **Dengan venue**. Kategori lain tetap dapat dipilih. Dropdown paket dan varian diurutkan dari harga termurah ke termahal.

Jika katalog sudah kalian ubah, sertakan **`data/packages.json`** saat membuat backup atau memindahkan server. Perubahan katalog tidak menimpa harga dan fasilitas paket yang sudah tersimpan dalam rencana.

## Dasar estimasi

Sumber awal: [brosur Nikah Murah Karanganyar](https://drive.google.com/file/d/1m5O5Q-7PKeZ3nptVrEoHnK5DPVJQfsEC/view), halaman 7 dan 25.

- Silver: **Rp18.500.000**, sesuai harga promo di brosur, belum dikonfirmasi ke vendor.
- Katering: simulasi **330 porsi × Rp20.000 = Rp6.600.000**. 330 porsi berasal dari 300 tamu ditambah cadangan 10%; harga Rp20.000 adalah harga mulai yang tertulis di brosur. Menu, porsi keluarga/kru, dan harga final perlu disepakati.
- Total awal **Rp25.100.000** hanya mencakup dua kebutuhan di atas. Katering tidak tercantum dalam rincian paket Silver.
- WO, kursi/meja tamu, undangan, souvenir, mahar, seserahan, administrasi, dan kebutuhan tambahan lain belum dianggarkan.
- Nama, tanggal, daftar tamu, rundown, pembayaran, dan batas anggaran tidak diisi dengan data rekaan. Checklist berisi saran persiapan yang dapat diedit.

## Verifikasi

```sh
npm test
npm run build
npm run test:e2e
./node_modules/.bin/prettier --check .
```

Pengujian browser memakai Chrome yang terpasang. E2E berjalan di port 4311 dengan file JSON sementara dari `test/fixtures.mjs`, sehingga tidak mengubah data planner utama dan tidak bergantung pada edit harian kalian.

Stack: React, Vite, Node.js, native CSS, Manrope, dan Phosphor Icons. Tidak memerlukan database.
