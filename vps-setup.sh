#!/bin/bash
# ============================================================
# vps-setup.sh — Inisialisasi VPS untuk Traffic Pulse Frontend
# ============================================================
#
# DESKRIPSI:
#   Script ini menyiapkan VPS Ubuntu baru untuk melayani
#   frontend Traffic Pulse via Nginx. Cukup dijalankan SEKALI
#   saat pertama kali menyiapkan VPS.
#
# PRASYARAT:
#   - VPS dengan Ubuntu 22.04 LTS
#   - Akses SSH sebagai root atau user dengan sudo
#   - Port 80 sudah dibuka di firewall/security group VPS
#
# CARA MENJALANKAN:
#   1. Upload script ini ke VPS (dari laptop, Git Bash):
#        scp traffic-pulse/vps-setup.sh root@IP_VPS:~/
#   2. SSH ke VPS lalu jalankan:
#        bash vps-setup.sh
#
# SETELAH SELESAI:
#   Jalankan deploy-frontend.sh dari laptop untuk upload
#   hasil build frontend ke VPS ini.
# ============================================================

set -e  # Hentikan jika ada perintah yang gagal

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Traffic Pulse — VPS Setup              ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── Langkah 1: Update sistem ───────────────────────────────
echo ">>> [1/5] Update paket sistem..."
sudo apt update -y && sudo apt upgrade -y
echo "    ✓ Sistem sudah up-to-date"
echo ""

# ─── Langkah 2: Install Nginx ───────────────────────────────
echo ">>> [2/5] Install Nginx..."
sudo apt install -y nginx curl
sudo systemctl enable nginx
sudo systemctl start nginx
echo "    ✓ Nginx terinstall dan berjalan"
echo ""

# ─── Langkah 3: Buat folder web ─────────────────────────────
echo ">>> [3/5] Membuat folder untuk file frontend..."
sudo mkdir -p /var/www/traffic-pulse
# Beri hak akses ke user saat ini agar rsync dari laptop bisa menulis
sudo chown -R "$USER":"$USER" /var/www/traffic-pulse
echo "    ✓ Folder /var/www/traffic-pulse siap"
echo ""

# ─── Langkah 4: Konfigurasi Nginx ───────────────────────────
echo ">>> [4/5] Mengatur konfigurasi Nginx..."
sudo tee /etc/nginx/sites-available/traffic-pulse > /dev/null <<'NGINX_CONF'
# ============================================================
# Nginx config untuk Traffic Pulse (React SPA)
# ============================================================
server {
    listen 80;
    server_name _;          # Terima semua hostname / IP

    root /var/www/traffic-pulse;
    index index.html;

    # ── React Router: semua path diarahkan ke index.html ──
    # Tanpa ini, refresh halaman selain "/" akan 404.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── Cache agresif untuk static assets ──
    # File JS/CSS/gambar di-cache browser selama 30 hari.
    # Vite otomatis menambah hash di nama file, jadi cache
    # lama tidak akan menimpa versi baru.
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # ── Jangan cache index.html ──
    # Agar browser selalu dapat versi terbaru setelah deploy.
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # ── Kompresi Gzip ──
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml;

    # ── Security headers dasar ──
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
NGINX_CONF

# Aktifkan config baru, nonaktifkan default
sudo ln -sf /etc/nginx/sites-available/traffic-pulse /etc/nginx/sites-enabled/traffic-pulse
sudo rm -f /etc/nginx/sites-enabled/default

# Validasi config sebelum reload
sudo nginx -t
sudo systemctl reload nginx
echo "    ✓ Nginx dikonfigurasi dan direload"
echo ""

# ─── Langkah 5: Tampilkan informasi ─────────────────────────
echo ">>> [5/5] Mengambil IP publik VPS..."
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s api.ipify.org 2>/dev/null || echo "tidak-terdeteksi")
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Setup VPS selesai!                                 ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║   IP VPS         : $PUBLIC_IP"
echo "║   Folder web     : /var/www/traffic-pulse            ║"
echo "║   Nginx config   : /etc/nginx/sites-available/       ║"
echo "║                    traffic-pulse                     ║"
echo "║                                                      ║"
echo "║   LANGKAH SELANJUTNYA (dari laptop):                 ║"
echo "║   1. Pastikan backend berjalan & tunnel aktif        ║"
echo "║   2. Isi variabel di traffic-pulse/deploy-frontend.sh║"
echo "║   3. Jalankan: bash traffic-pulse/deploy-frontend.sh ║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
