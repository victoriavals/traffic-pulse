import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface ApiSettings {
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  isConnected: boolean;
  setIsConnected: (v: boolean) => void;
  deviceInfo: string;
  setDeviceInfo: (v: string) => void;
}

const ApiContext = createContext<ApiSettings | null>(null);

const API_BASE_URL_KEY = "traffic_api_base_url";

const getDefaultBaseUrl = (): string => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envBaseUrl && envBaseUrl.trim().length > 0) {
    return envBaseUrl.trim();
  }

  if (typeof window === "undefined") return "http://localhost:8000";

  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const host = window.location.hostname || "localhost";
  return `${protocol}://${host}:8000`;
};

const getInitialBaseUrl = (): string => {
  // Priority: env -> localStorage -> fallback host mapping
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envBaseUrl && envBaseUrl.trim().length > 0) {
    return envBaseUrl.trim();
  }

  if (typeof window === "undefined") return "http://localhost:8000";

  const saved = window.localStorage.getItem(API_BASE_URL_KEY);
  if (saved && saved.trim().length > 0) return saved;

  return getDefaultBaseUrl();
};

const getBaseUrlLabel = (url: string): string => {
  try {
    const hostname = new URL(url).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") return "localhost";
    if (hostname === "100.70.248.50") return "server-ip";
    return "custom";
  } catch {
    return "invalid";
  }
};

export const useApiSettings = () => {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApiSettings must be within ApiProvider");
  return ctx;
};

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const [baseUrl, setBaseUrl] = useState(getInitialBaseUrl);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(API_BASE_URL_KEY, baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    const label = getBaseUrlLabel(baseUrl);
    console.info(`[API_BASE_URL] active=${baseUrl} source=${label}`);
  }, [baseUrl]);

  return (
    <ApiContext.Provider value={{ baseUrl, setBaseUrl, isConnected, setIsConnected, deviceInfo, setDeviceInfo }}>
      {children}
    </ApiContext.Provider>
  );
};
