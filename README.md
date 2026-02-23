# 🚦 Traffic Pulse — Vehicle Traffic Detection Dashboard

> Frontend dashboard untuk sistem deteksi dan penghitungan kendaraan lalu lintas berbasis **YOLOv11**, dibangun sebagai bagian dari **Projek Sarjana Muda (PSM)**.

## Tech Stack

| Teknologi | Peran |
|---|---|
| **React 18** + **TypeScript** | UI framework + type safety |
| **Vite 5** | Build tool & dev server |
| **TailwindCSS 3** | Utility-first styling |
| **shadcn/ui** + **Radix UI** | Accessible component library |
| **Recharts** | Data visualization (bar charts) |
| **React Router v6** | Client-side routing |
| **TanStack Query** | Server state management |

## Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 📊 **Dashboard** | Overview statistik, server info, activity log |
| 🖼️ **Deteksi Gambar** | Upload gambar → deteksi kendaraan (JSON/Annotated) |
| 🎬 **Proses Video** | Upload video → hitung kendaraan + bar chart + annotated video |
| 📡 **Live Monitoring** | Real-time RTSP stream via WebSocket + live counter |

### Kelas Kendaraan yang Dideteksi

- 🚛 Big Vehicle (Truk, Bus)
- 🚗 Car (Mobil)
- 🚶 Pedestrian (Pejalan Kaki)
- 🏍️ Two Wheeler (Motor, Sepeda)

## Setup & Development

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Backend API** running di `http://localhost:8000` (FastAPI + YOLOv11)

### Installation

```bash
# Clone repository
git clone <YOUR_GIT_URL>
cd traffic-pulse

# Install dependencies
npm install

# Start development server (port 8080)
npm run dev
```

### Available Scripts

| Script | Deskripsi |
|---|---|
| `npm run dev` | Start dev server (port 8080) |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |

## Konfigurasi API

Default API base URL: `http://localhost:8000`

Bisa diubah melalui **Settings** (ikon ⚙️ di top bar) atau langsung di kode `src/contexts/ApiContext.tsx`.

### Required Backend Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/` | Health check + device info |
| `POST` | `/image/detect` | Deteksi objek dari gambar (JSON) |
| `POST` | `/image/annotate` | Deteksi + return gambar annotated |
| `POST` | `/video/detect` | Hitung kendaraan dari video (JSON) |
| `POST` | `/video/annotate` | Hitung + return video annotated |
| `POST` | `/rtsp/detect` | Snapshot dari RTSP stream |
| `WS` | `/rtsp/stream` | Real-time RTSP streaming |

## Struktur Project

```
src/
├── pages/          # Halaman utama (Dashboard, DeteksiGambar, ProsesVideo, LiveMonitoring)
├── components/     # Layout components + 49 shadcn/ui components
├── contexts/       # React Context (API settings)
├── hooks/          # Custom hooks (toast, mobile detection)
├── lib/            # Utilities (activity log, cn helper)
└── test/           # Test files
```

## Deployment

```bash
# Build for production
npm run build

# Output di folder dist/
```

Build output siap di-deploy ke platform hosting statis seperti **Vercel**, **Netlify**, atau **GitHub Pages**.

## License

© 2026 PSM — Traffic Pulse v1.0.0
