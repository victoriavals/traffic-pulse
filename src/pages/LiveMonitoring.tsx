import { Radio } from "lucide-react";

const LiveMonitoring = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Monitoring</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pantau lalu lintas secara real-time melalui stream RTSP
        </p>
      </div>

      <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div className="rounded-2xl bg-destructive/10 p-4 mb-4">
          <Radio className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="font-semibold mb-1">Belum Ada Stream Aktif</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Masukkan URL RTSP untuk memulai monitoring lalu lintas secara langsung.
        </p>
      </div>
    </div>
  );
};

export default LiveMonitoring;
