import { LayoutDashboard, Car, Activity, Gauge } from "lucide-react";

const stats = [
  { label: "Total Kendaraan Terdeteksi", value: "—", icon: Car },
  { label: "Sesi Deteksi", value: "—", icon: Activity },
  { label: "Akurasi Rata-rata", value: "—", icon: Gauge },
  { label: "Model Aktif", value: "YOLOv8", icon: LayoutDashboard },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ringkasan sistem deteksi kendaraan
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card rounded-xl p-5 transition-transform duration-200 hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">Selamat Datang</h2>
        <p className="text-sm text-muted-foreground">
          Gunakan menu di sebelah kiri untuk memulai deteksi kendaraan melalui gambar, video, atau live stream RTSP.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
