# 📸 Aplikasi Bingkai Foto & Video

Aplikasi web yang memungkinkan pengguna untuk mengambil foto atau video dari kamera dan menambahkan bingkai yang indah. Dibuat dengan HTML, CSS, dan JavaScript murni tanpa dependensi eksternal.

## ✨ Fitur Utama

### 📷 Capture Media
- **Ambil Foto**: Capture foto langsung dari kamera web
- **Rekam Video**: Rekam video dengan kualitas HD
- **Upload File**: Upload foto/video dari perangkat

### 🖼️ Bingkai Otomatis
- **Bingkai PNG**: Menggunakan file `bingkai.png` sebagai overlay
- **Format Reels**: Output otomatis dalam format 1080x1920 (portrait)
- **Scaling Pintar**: Konten otomatis disesuaikan dengan aspect ratio reels
- **Kualitas Tinggi**: Hasil output dengan resolusi HD

### 💾 Download & Export
- **Download Foto**: Simpan foto dengan bingkai dalam format PNG
- **Preview Real-time**: Lihat hasil sebelum download
- **Nama File Otomatis**: Generate nama file dengan timestamp

## 🚀 Cara Menggunakan

### 1. Buka Aplikasi
```bash
# Buka file index.html di browser
open index.html
```

### 2. Mulai Kamera
- Klik tombol **"Mulai Kamera"**
- Izinkan akses kamera ketika browser meminta
- Kamera akan menampilkan preview real-time

### 3. Ambil Foto
- Klik **"Ambil Foto"** untuk capture
- Foto akan otomatis ditambahkan bingkai
- Klik **"Download Hasil"** untuk menyimpan

### 4. Rekam Video
- Klik **"Mulai Video"** untuk mulai merekam
- Klik **"Stop Video"** untuk menghentikan
- Video akan ditampilkan dengan kontrol player

### 5. Upload File
- Klik **"Pilih Foto/Video"**
- Pilih file dari perangkat
- File akan diproses otomatis dengan bingkai

## 🛠️ Teknologi yang Digunakan

- **HTML5**: Struktur aplikasi dan elemen media
- **CSS3**: Styling modern dengan gradient dan animasi
- **JavaScript ES6+**: Logika aplikasi dengan class-based architecture
- **Web APIs**:
  - `getUserMedia()`: Akses kamera
  - `MediaRecorder`: Rekam video
  - `Canvas API`: Manipulasi gambar
  - `File API`: Upload file

## 📁 Struktur File

```
bingkai-foto/
├── index.html          # Aplikasi utama
├── styles.css          # Styling terpisah
├── video-processor.js  # Library video processing
├── demo.html           # Halaman demo
├── test-reels.html     # Test format reels
├── bingkai.png         # File bingkai (749KB)
├── package.json        # Package configuration
└── README.md           # Dokumentasi ini
```

## 🎨 Fitur UI/UX

### Design Modern
- **Gradient Background**: Warna ungu-biru yang menarik
- **Card Layout**: Interface yang clean dan terorganisir
- **Responsive Design**: Bekerja di desktop dan mobile
- **Smooth Animations**: Transisi dan hover effects

### User Experience
- **Status Messages**: Feedback real-time untuk setiap aksi
- **Button States**: Disabled/enabled sesuai konteks
- **Loading Indicators**: Visual feedback saat memproses
- **Error Handling**: Pesan error yang informatif

## 🔧 Konfigurasi

### Kualitas Video
```javascript
video: {
    width: { ideal: 1280 },    // 720p
    height: { ideal: 720 },
    facingMode: 'user'         // Kamera depan
}
```

### Format Output
- **Foto**: PNG dengan resolusi 1080x1920 (Reels format)
- **Video**: WebM dengan resolusi 1080x1920 (Reels format)
- **Bingkai**: PNG transparan yang menyesuaikan ukuran output

## 🌐 Browser Support

### Fully Supported
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+

### Requirements
- HTTPS connection (untuk akses kamera)
- WebRTC support
- Canvas API support

## 🚨 Troubleshooting

### Kamera Tidak Bisa Diakses
1. Pastikan browser mendukung `getUserMedia`
2. Izinkan akses kamera di pengaturan browser
3. Gunakan HTTPS atau localhost

### Bingkai Tidak Muncul
1. Pastikan file `bingkai.png` ada di folder yang sama
2. Periksa console browser untuk error
3. Pastikan file bingkai adalah PNG yang valid

### Format Reels Tidak Benar
1. Buka browser developer tools (F12)
2. Lihat console log untuk dimensi canvas
3. Pastikan output menunjukkan 1080x1920
4. Test dengan `test-reels.html` untuk verifikasi

### Download Tidak Berfungsi
1. Pastikan ada foto/video yang diproses
2. Periksa pengaturan download browser
3. Pastikan ada ruang penyimpanan yang cukup
4. Cek console log untuk error download

## 🔮 Pengembangan Selanjutnya

### Fitur yang Direncanakan
- [ ] Multiple bingkai pilihan
- [ ] Edit foto (crop, filter, brightness)
- [ ] Video dengan bingkai overlay
- [ ] Share ke social media
- [ ] Gallery hasil foto
- [ ] Custom bingkai upload

### Optimisasi
- [ ] Lazy loading untuk bingkai
- [ ] Image compression
- [ ] Progressive Web App (PWA)
- [ ] Offline support

## 📝 Lisensi

Aplikasi ini dibuat untuk tujuan edukasi dan penggunaan pribadi. Silakan modifikasi sesuai kebutuhan.

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan buat issue atau pull request untuk:
- Bug fixes
- Fitur baru
- Dokumentasi
- UI/UX improvements

---

**Dibuat dengan ❤️ menggunakan HTML, CSS, dan JavaScript**
# hanum-riduwan-wedding
