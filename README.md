# Peta Lokasi Gerai Indomaret Indonesia

Aplikasi web sederhana untuk menampilkan lokasi gerai Indomaret di Indonesia menggunakan:

- HTML
- CSS
- JavaScript
- Leaflet.js
- Leaflet MarkerCluster
- PapaParse
- Data CSV

## Struktur Folder

```text
indomaret-web-map/
├── index.html
├── README.md
├── data/
│   └── indomaret_stores_clean.csv
└── assets/
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

## Fitur

1. Menampilkan titik lokasi gerai Indomaret pada peta.
2. Filter berdasarkan provinsi.
3. Filter berdasarkan kabupaten/kota.
4. Pencarian berdasarkan nama gerai, alamat, kabupaten/kota, dan provinsi.
5. Tabel data gerai.
6. Ranking 10 kabupaten/kota dengan jumlah gerai terbanyak.
7. Link menuju Google Maps.

## Cara Menjalankan

Jangan buka `index.html` langsung dengan double click, karena browser biasanya memblokir pembacaan file CSV lokal.

Gunakan salah satu cara berikut.

### Cara 1: Menggunakan Python

Buka terminal di folder proyek, lalu jalankan:

```bash
python -m http.server 8000
```

Buka browser:

```text
http://localhost:8000
```

### Cara 2: Menggunakan VS Code

1. Buka folder proyek di VS Code.
2. Install extension **Live Server**.
3. Klik kanan `index.html`.
4. Pilih **Open with Live Server**.

## Format Data CSV

File CSV berada di:

```text
data/indomaret_stores_clean.csv
```

Kolom utama:

| Kolom | Keterangan |
|---|---|
| id | ID baris data |
| nama_gerai | Nama gerai |
| tipe_lokasi | Tipe lokasi dari sumber data |
| alamat | Alamat lengkap |
| kab_kota | Kabupaten/kota dalam format Indonesia |
| tipe_wilayah | Kabupaten atau Kota |
| nama_kab_kota | Nama wilayah tanpa awalan Kabupaten/Kota |
| provinsi | Nama provinsi |
| latitude | Latitude numerik |
| longitude | Longitude numerik |
| google_maps | Link Google Maps |

## Validasi Data

Aplikasi sekarang menyaring data saat dimuat agar yang tampil hanya baris yang paling mungkin benar-benar gerai Indomaret.

Aturannya:

1. Nama harus mengandung kata `Indomaret`.
2. Nama yang diawali ATM, Bank, Kantor, Gudang, DC, Training, Warkop, atau bentuk korporat lain dibuang.
3. Entri yang masih ambigu, seperti format hybrid atau toko campuran, tetap disembunyikan dari peta dan dihitung sebagai data review.

Ringkasan jumlah data valid, review, dan invalid tampil di halaman aplikasi saat data selesai dimuat.

## Catatan

Aplikasi ini adalah versi sederhana tanpa backend dan tanpa database. Data dibaca langsung dari file CSV.
