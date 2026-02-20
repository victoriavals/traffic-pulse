import { createContext, useContext, useState, ReactNode } from "react";

interface ApiSettings {
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  isConnected: boolean;
  setIsConnected: (v: boolean) => void;
  deviceInfo: string;
  setDeviceInfo: (v: string) => void;
}

const ApiContext = createContext<ApiSettings | null>(null);

export const useApiSettings = () => {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApiSettings must be within ApiProvider");
  return ctx;
};

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const [baseUrl, setBaseUrl] = useState("http://localhost:8000");
  const [isConnected, setIsConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState("");

  return (
    <ApiContext.Provider value={{ baseUrl, setBaseUrl, isConnected, setIsConnected, deviceInfo, setDeviceInfo }}>
      {children}
    </ApiContext.Provider>
  );
};
