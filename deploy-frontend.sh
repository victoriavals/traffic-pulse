#!/bin/bash
# ============================================================
# deploy-frontend.sh — Build & Deploy Frontend ke VPS
# ============================================================
#
# DESKRIPSI:
#   Script ini melakukan build production frontend React dan
#   mengupload hasilnya ke VPS via rsync (SSH). Jalankan dari
#   laptop setiap kali ada perubahan kode frontend atau saat
#   URL backend berubah.
#
# PRASYARAT DI LAPTOP:
#   - Node.js >= 18 & npm >= 9 (untuk build)
#   - Git Bash atau WSL (agar perintah bash & rsync tersedia)
#   - rsync: bawaan WSL, atau install via Git Bash extras
#   - Akses SSH ke VPS sudah dikonfigurasi (lihat bagian SSH di bawah)
#
# PRASYARAT DI VPS:
#   - vps-setup.sh sudah dijalankan sebelumnya
#
# CARA MENJALANKAN (dari folder root project):
#   bash traffic-pulse/deploy-frontend.sh
#
# CARA SETUP SSH AGAR TIDAK PERLU PASSWORD:
#   1. Generate SSH key (jika belum ada):
#        ssh-keygen -t ed25519 -C "deploy-traffic-pulse"
#   2. Salin public key ke VPS:
#        ssh-copy-id root@IP_VPS_ANDA
#   3. Test: ssh root@IP_VPS_ANDA — seharusnya langsung masuk
# ============================================================


# ============================================================
# KONFIGURASI — Ubah bagian ini sesuai setup Anda
# ============================================================

# IP atau domain VPS tempat frontend di-host
VPS_IP="ISI_IP_VPS_ANDA"
# Contoh: VPS_IP="103.12.34.56"
# Contoh: VPS_IP="traffic.example.com"

# Username SSH di VPS (biasanya root, atau user lain dengan sudo)
VPS_USER="root"

# URL publik backend (laptop yang diekspos ke internet).
# Dapatkan URL ini dari output expose-backend.bat (Cloudflare Tunnel).
# Format Cloudflare Tunnel : https://xxxx.trycloudflare.com
# Format IP publik langsung: http://IP_PUBLIK_LAPTOP:3219
BACKEND_PUBLIC_URL="ISI_URL_BACKEND_PUBLIK"
# Contoh: BACKEND_PUBLIC_URL="https://abc123.trycloudflare.com"
# Contoh: BACKEND_PUBLIC_URL="http://203.0.113.10:3219"

# ============================================================
# KONFIGURASI LANJUTAN (umumnya tidak perlu diubah)
# ============================================================

# Folder frontend = folder tempat script ini berada (traffic-pulse/)
FRONTEND_DIR="$(cd "$(dirname "$0")" && pwd)"

# Path tujuan di VPS (harus sama dengan root di nginx config)
DEPLOY_PATH="/var/www/traffic-pulse"

# ============================================================
# VALIDASI — Jangan ubah di bawah ini
# ============================================================

set -e  # Hentikan jika ada perintah yang gagal

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Traffic Pulse — Deploy Frontend ke VPS             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Validasi: variabel wajib harus sudah diisi
if [[ "$VPS_IP" == "ISI_IP_VPS_ANDA" ]]; then
    echo "ERROR: VPS_IP belum diisi. Edit variabel di bagian KONFIGURASI."
    exit 1
fi
if [[ "$BACKEND_PUBLIC_URL" == "ISI_URL_BACKEND_PUBLIK" ]]; then
    echo "ERROR: BACKEND_PUBLIC_URL belum diisi. Edit variabel di bagian KONFIGURASI."
    exit 1
fi

echo "  VPS Target    : $VPS_USER@$VPS_IP"
echo "  Backend URL   : $BACKEND_PUBLIC_URL"
echo "  Frontend dir  : $FRONTEND_DIR"
echo ""

# ─── Langkah 1: Tulis .env.production ───────────────────────
echo ">>> [1/5] Menulis .env.production..."
cat > "$FRONTEND_DIR/.env.production" <<EOF
# File ini di-generate otomatis oleh deploy-frontend.sh
# Jangan edit manual — ubah variabel BACKEND_PUBLIC_URL di script deploy
VITE_API_BASE_URL=$BACKEND_PUBLIC_URL
EOF
echo "    ✓ .env.production ditulis: VITE_API_BASE_URL=$BACKEND_PUBLIC_URL"
echo ""

# ─── Langkah 2: Install dependencies ────────────────────────
echo ">>> [2/5] Memastikan dependencies terinstall..."
cd "$FRONTEND_DIR"
npm install --silent
echo "    ✓ Dependencies siap"
echo ""

# ─── Langkah 3: Build production ────────────────────────────
echo ">>> [3/5] Build production bundle..."
npm run build
echo "    ✓ Build selesai. Output: dist/"
echo ""

# ─── Langkah 4: Upload ke VPS via rsync ─────────────────────
echo ">>> [4/5] Upload ke VPS ($VPS_USER@$VPS_IP:$DEPLOY_PATH/)..."
# --delete   : hapus file lama yang tidak ada di build baru
# --compress : kompres saat transfer untuk menghemat bandwidth
# --archive  : pertahankan permission, timestamp, dll.
rsync \
    --archive \
    --compress \
    --delete \
    --progress \
    "$FRONTEND_DIR/dist/" \
    "$VPS_USER@$VPS_IP:$DEPLOY_PATH/"
echo "    ✓ Upload selesai"
echo ""

# ─── Langkah 5: Reload Nginx di VPS ─────────────────────────
echo ">>> [5/5] Reload Nginx di VPS..."
ssh "$VPS_USER@$VPS_IP" "sudo systemctl reload nginx"
echo "    ✓ Nginx direload"
echo ""

# ─── Ringkasan ───────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Deploy selesai!                                    ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║   Frontend  : http://$VPS_IP"
echo "║   Backend   : $BACKEND_PUBLIC_URL"
echo "║   API Docs  : $BACKEND_PUBLIC_URL/docs"
echo "║                                                      ║"
echo "║   Buka frontend di browser untuk memverifikasi.      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
