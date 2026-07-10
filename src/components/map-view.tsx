import { useEffect, useRef, useState } from "react";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  jibunAddress: string;
  active?: boolean;
}

// Minimal ambient types for the slice of the Naver Maps JS SDK this file
// uses. No official npm type package is installed — the SDK itself is
// loaded at runtime via a <script> tag (see loadNaverMaps below), not npm.
// LatLng/Marker instances are opaque to us — we only ever construct and
// pass them through, never read properties off them.
type NaverLatLng = object;
interface NaverMap {
  setCenter(latlng: NaverLatLng): void;
  destroy(): void;
}
interface NaverMarker {
  setMap(map: NaverMap | null): void;
}
interface NaverMapsNamespace {
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  Map: new (
    el: HTMLElement,
    options: { center: NaverLatLng; zoom: number; zoomControl?: boolean },
  ) => NaverMap;
  Marker: new (options: {
    position: NaverLatLng;
    map: NaverMap;
    title?: string;
    icon?: { content: string };
    zIndex?: number;
  }) => NaverMarker;
  Event: {
    addListener(target: NaverMarker, eventName: string, handler: () => void): void;
  };
}

declare global {
  interface Window {
    naver?: { maps: NaverMapsNamespace };
  }
}

const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID;

// Script is loaded once and cached across MapView mounts/remounts.
let naverMapsLoader: Promise<void> | null = null;

const loadNaverMaps = (clientId: string): Promise<void> => {
  if (window.naver?.maps) return Promise.resolve();
  if (naverMapsLoader) return naverMapsLoader;
  naverMapsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-naver-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.dataset.naverMaps = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return naverMapsLoader;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const pinHtml = (label: string, active?: boolean) => `
  <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:6px;">
    ${
      active
        ? `<div style="padding:3px 8px;border:1px solid rgba(15,23,42,0.08);border-radius:9999px;background:rgba(255,255,255,0.98);color:#0f172a;font-size:11px;font-weight:700;line-height:1;white-space:nowrap;box-shadow:0 4px 12px rgba(15,23,42,0.12);">
      ${escapeHtml(label)}
    </div>`
        : ""
    }
    <div style="display:flex;align-items:center;justify-content:center;width:26px;height:34px;">
      <svg viewBox='0 0 24 32' width='26' height='34' xmlns='http://www.w3.org/2000/svg'>
        <path d='M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z' fill='${
          active ? "#dc2626" : "#94a3b8"
        }'/>
        <circle cx='12' cy='12' r='4.5' fill='white'/>
      </svg>
    </div>
  </div>`;

export function MapView({
  markers,
  onMarkerClick,
}: {
  markers: MapMarker[];
  onMarkerClick?: (jibunAddress: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markerRefs = useRef<NaverMarker[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const initialCenterRef = useRef<{ lat: number; lng: number } | null>(
    markers.length ? { lat: markers[0].lat, lng: markers[0].lng } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    if (!ref.current || typeof window === "undefined") return;

    if (!NAVER_CLIENT_ID) {
      setError("네이버 지도 API 키가 설정되지 않았습니다 (VITE_NAVER_MAP_CLIENT_ID).");
      return;
    }

    let disposed = false;
    loadNaverMaps(NAVER_CLIENT_ID)
      .then(() => {
        if (disposed || !ref.current || !window.naver) return;
        setError(null);
        if (mapRef.current) return;
        const { maps } = window.naver;
        const initialCenter = initialCenterRef.current;
        const center = initialCenter
          ? new maps.LatLng(initialCenter.lat, initialCenter.lng)
          : new maps.LatLng(37.5665, 126.978);
        mapRef.current = new maps.Map(ref.current, { center, zoom: 17, zoomControl: true });
        setMapReady(true);
      })
      .catch((e: unknown) => {
        if (!disposed) setError(e instanceof Error ? e.message : "지도를 불러오지 못했습니다.");
      });

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.naver) return;
    const { maps } = window.naver;

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = markers.map((m) => {
      const marker = new maps.Marker({
        position: new maps.LatLng(m.lat, m.lng),
        map: mapRef.current!,
        title: m.label,
        icon: { content: pinHtml(m.label, m.active) },
        zIndex: m.active ? 1000 : 100,
      });
      maps.Event.addListener(marker, "click", () => onMarkerClickRef.current?.(m.jibunAddress));
      return marker;
    });

    return () => {
      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current = [];
    };
  }, [mapReady, markers]);

  if (error) {
    return (
      <div className="flex h-[420px] w-full flex-col items-center justify-center gap-1 bg-secondary/30 px-6 text-center lg:h-[640px]">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return <div ref={ref} className="h-[420px] w-full lg:h-[640px]" />;
}
