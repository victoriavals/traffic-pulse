

# Halaman Proses Video

Membuat konten lengkap untuk halaman Proses Video dengan fitur upload video, konfigurasi deteksi dan counting line, serta tampilan hasil dalam mode JSON dan video anotasi.

## Ringkasan

Halaman ini akan menggantikan placeholder `ProsesVideo.tsx` saat ini dengan halaman fungsional penuh yang terdiri dari 2 section utama: Upload/Konfigurasi (atas) dan Hasil (bawah). User dapat mengupload video, mengatur parameter deteksi dan posisi garis penghitung, lalu memproses video melalui 2 endpoint API.

## Fitur Utama

1. **Upload Video** -- Drag-and-drop zone untuk file MP4, AVI, MOV, MKV dengan info file (nama, ukuran)
2. **Panel Konfigurasi** -- Slider confidence/IoU, toggle model size, dan 4 input untuk counting line dengan visualisasi real-time
3. **Tombol Aksi** -- "Hitung Kendaraan (JSON)" dan "Generate Video Anotasi"
4. **Hasil JSON** -- Summary cards per kelas kendaraan, bar chart distribusi (Recharts), info video, dan tabel konfigurasi
5. **Hasil Video** -- HTML5 video player dengan info dari response headers dan tombol download
6. **Loading/Error** -- Spinner dengan estimasi waktu, error alert

## Detail Teknis

### File yang diubah

**`src/pages/ProsesVideo.tsx`** -- Tulis ulang lengkap:

- State management: `file`, `confidence` (0.45), `iou` (0.5), `modelSize`, `lineStart{X,Y}`, `lineEnd{X,Y}`, `loading`, `error`, `resultMode`, `jsonResult`, `videoUrl`, response header values
- Drag-and-drop handler identik pola di `DeteksiGambar.tsx` tapi untuk tipe `video/*`
- Counting line visualisasi: elemen SVG kecil (aspect-ratio 16:9) yang menggambar garis dari titik start ke end, update real-time
- API calls:
  - `POST /video/detect?confidence=...&iou=...&model_size=...&line_start_x=...&line_start_y=...&line_end_x=...&line_end_y=...` dengan `multipart/form-data` field `"file"` -- response JSON
  - `POST /video/annotate` dengan parameter sama -- response MP4 blob
- Hasil JSON: 5 summary cards (4 kelas + total), bar chart via `recharts` (BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer), card info video (resolusi, FPS, frames, durasi, waktu proses), card konfigurasi inference
- Hasil video: `<video>` player dengan controls, info dari headers `X-Total-Count`, `X-Frames-Processed`, `X-Processing-Time`, tombol download
- Activity log integration via `addActivityLog`
- Update `localStorage` `last-detection-counts` saat hasil JSON diterima

### Komponen dan library yang digunakan

- `recharts` (sudah terinstall) untuk bar chart distribusi kendaraan
- `Button`, `Slider`, `Input` dari komponen UI yang ada
- `Tooltip` dari Radix untuk tooltip pada counting line
- Lucide icons: `Upload`, `Film`, `BarChart3`, `Truck`, `Car`, `PersonStanding`, `Bike`, `Loader2`, `Download`, `AlertCircle`, `SlidersHorizontal`, `Play`, `Copy`, `X`, `Info`
- Pattern glassmorphism (`glass-card`) dan animasi (`animate-fade-in-up`) yang konsisten dengan halaman lain

### Tipe data response

```text
VideoDetectResponse {
  success: boolean
  message: string
  counts: { big_vehicle, car, pedestrian, two_wheeler, total }
  video_info: { resolution, fps, total_frames, duration_seconds, processing_time_seconds }
  inference_config: { model, device, image_size, line_start, line_end }
}
```

### Layout struktur

```text
+--------------------------------------------------+
| Header: "Proses Video" + deskripsi               |
+--------------------------------------------------+
| Upload Zone (drag & drop video)                  |
| [nama file, ukuran, warning text]                |
+--------------------------------------------------+
| Konfigurasi (grid 2 kolom)                       |
| [A: Confidence, IoU, Model] [B: Counting Line    |
|                               inputs + SVG viz]  |
+--------------------------------------------------+
| [Hitung Kendaraan (JSON)]  [Generate Video]      |
+--------------------------------------------------+
| Loading state / Error alert                      |
+--------------------------------------------------+
| Hasil JSON:                                      |
|  - 5 Summary Cards                               |
|  - Bar Chart distribusi                          |
|  - Info Video card                               |
|  - Inference Config card                         |
| ATAU                                             |
| Hasil Video:                                     |
|  - Video player                                  |
|  - Header info cards                             |
|  - Download button                               |
+--------------------------------------------------+
```

