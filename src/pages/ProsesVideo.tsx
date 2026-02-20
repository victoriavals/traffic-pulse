import { Film, Upload } from "lucide-react";

const ProsesVideo = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Proses Video</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload video untuk mendeteksi dan menghitung kendaraan
        </p>
      </div>

      <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/60">
        <div className="rounded-2xl bg-secondary/10 p-4 mb-4">
          <Upload className="h-8 w-8 text-secondary" />
        </div>
        <h3 className="font-semibold mb-1">Upload Video</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Seret video ke sini atau klik untuk memilih file. Format yang didukung: MP4, AVI, MOV.
        </p>
      </div>
    </div>
  );
};

export default ProsesVideo;
