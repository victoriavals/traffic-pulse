import { createContext, useContext, useState, type ReactNode } from "react";

export type ModelSize = "SMALL" | "MEDIUM";

interface DetectionConfig {
  confidence: number;
  setConfidence: (v: number) => void;
  iou: number;
  setIou: (v: number) => void;
  modelSize: ModelSize;
  setModelSize: (v: ModelSize) => void;
  lineStartX: number;
  setLineStartX: (v: number) => void;
  lineStartY: number;
  setLineStartY: (v: number) => void;
  lineEndX: number;
  setLineEndX: (v: number) => void;
  lineEndY: number;
  setLineEndY: (v: number) => void;
}

const DetectionConfigContext = createContext<DetectionConfig | null>(null);

export function DetectionConfigProvider({ children }: { children: ReactNode }) {
  const [confidence, setConfidence] = useState(0.45);
  const [iou, setIou] = useState(0.5);
  const [modelSize, setModelSize] = useState<ModelSize>("SMALL");
  const [lineStartX, setLineStartX] = useState(0.0);
  const [lineStartY, setLineStartY] = useState(0.15);
  const [lineEndX, setLineEndX] = useState(1.0);
  const [lineEndY, setLineEndY] = useState(0.65);

  return (
    <DetectionConfigContext.Provider
      value={{
        confidence, setConfidence,
        iou, setIou,
        modelSize, setModelSize,
        lineStartX, setLineStartX,
        lineStartY, setLineStartY,
        lineEndX, setLineEndX,
        lineEndY, setLineEndY,
      }}
    >
      {children}
    </DetectionConfigContext.Provider>
  );
}

export function useDetectionConfig() {
  const ctx = useContext(DetectionConfigContext);
  if (!ctx) throw new Error("useDetectionConfig must be used within DetectionConfigProvider");
  return ctx;
}
