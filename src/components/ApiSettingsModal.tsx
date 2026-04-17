import { useState } from "react";
import { useApiSettings } from "@/contexts/ApiContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiSettingsModal({ open, onOpenChange }: Props) {
  const { baseUrl, setBaseUrl } = useApiSettings();
  const [url, setUrl] = useState(baseUrl);

  const handleSave = () => {
    setBaseUrl(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pengaturan API</DialogTitle>
          <DialogDescription>
            Atur Base URL untuk API deteksi kendaraan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="api-url">API Base URL</Label>
            <Input
              id="api-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3219"
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            Simpan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
