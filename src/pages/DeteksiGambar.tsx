import { Image, Upload } from "lucide-react";

const DeteksiGambar = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deteksi Gambar</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload gambar untuk mendeteksi dan menghitung kendaraan
        </p>
      </div>

      <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/60">
        <div className="rounded-2xl bg-primary/10 p-4 mb-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold mb-1">Upload Gambar</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Seret gambar ke sini atau klik untuk memilih file. Format yang didukung: JPG, PNG, WEBP.
        </p>
      </div>
    </div>
  );
};

export default DeteksiGambar;
