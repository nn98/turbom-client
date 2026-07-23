import { useEffect, useRef, useState } from "react";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  active?: boolean;
}

// Minimal ambient types for the slice of the Kakao Maps JS SDK this file
// uses. No official npm type package is installed — the SDK itself is
// loaded at runtime via a <script> tag (see loadKakaoMaps below), not npm.
interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
  getSouthWest(): KakaoLatLng;
  getNorthEast(): KakaoLatLng;
}
interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
  setBounds(bounds: KakaoLatLngBounds): void;
  getBounds(): KakaoLatLngBounds;
  getLevel(): number;
  setLevel(level: number, options?: { animate?: { duration: number } }): void;
}
interface KakaoMarker {
  setMap(map: KakaoMap | null): void;
}
interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
}
interface KakaoCluster {
  getBounds(): KakaoLatLngBounds;
}
interface KakaoMarkerClustererInstance {
  clear(): void;
}
interface KakaoMapsNamespace {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  Map: new (el: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  MarkerImage: new (
    src: string,
    size: unknown,
    options?: { offset?: unknown },
  ) => unknown;
  Marker: new (options: {
    position: KakaoLatLng;
    image?: unknown;
    zIndex?: number;
  }) => KakaoMarker;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: string;
    zIndex?: number;
  }) => KakaoCustomOverlay;
  MarkerClusterer: new (options: {
    map: KakaoMap;
    markers: KakaoMarker[];
    gridSize?: number;
    averageCenter?: boolean;
    minLevel?: number;
    disableClickZoom?: boolean;
    styles?: Record<string, string | number>[];
  }) => KakaoMarkerClustererInstance;
  event: {
    addListener(
      target: KakaoMarker | KakaoMap | KakaoMarkerClustererInstance,
      eventName: string,
      handler: (arg?: unknown) => void,
    ): void;
  };
  load(callback: () => void): void;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsNamespace };
  }
}

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY;

// Script is loaded once and cached across MapView mounts/remounts.
let kakaoMapsLoader: Promise<void> | null = null;

const loadKakaoMaps = (jsKey: string): Promise<void> => {
  if (kakaoMapsLoader) return kakaoMapsLoader;
  kakaoMapsLoader = new Promise((resolve, reject) => {
    // autoload=false: the SDK script only defines kakao.maps.load, it doesn't
    // initialize the namespace itself — we must call it explicitly once the
    // script tag has executed.
    const onScriptReady = () => window.kakao!.maps.load(() => resolve());
    const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-maps]");
    if (existing) {
      if (window.kakao) onScriptReady();
      else {
        existing.addEventListener("load", onScriptReady);
        existing.addEventListener("error", () =>
          reject(new Error("카카오 지도 스크립트를 불러오지 못했습니다.")),
        );
      }
      return;
    }
    const script = document.createElement("script");
    script.dataset.kakaoMaps = "true";
    // libraries=clusterer: pulls in kakao.maps.MarkerClusterer, no separate
    // vendored script needed (unlike the old Naver setup).
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(jsKey)}&autoload=false&libraries=clusterer`;
    script.async = true;
    script.onload = onScriptReady;
    script.onerror = () => reject(new Error("카카오 지도 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return kakaoMapsLoader;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// ponytail: a data-URI <img> renders in an isolated image context, so
// var(--color-*) inside it never resolves against the page's :root — bake
// the current computed color in instead. Re-read each time markers change,
// not on a live theme toggle mid-session; fine since remounts/nav re-run this.
const resolveColor = (varName: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
};

const pinDataUrl = (active: boolean) => {
  const fill = active ? resolveColor("--color-primary", "#2563eb") : resolveColor("--color-muted-foreground", "#94a3b8");
  const surface = resolveColor("--color-surface", "#ffffff");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 32' width='26' height='34'><path d='M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z' fill='${fill}'/><circle cx='12' cy='12' r='4.5' fill='${surface}'/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// Sits above the marker pin (34px tall + 6px gap) as a separate real-DOM
// overlay, so it can keep using var(--color-*) directly like before.
const labelHtml = (label: string) => `
  <div style="transform:translate(-50%,calc(-100% - 40px));padding:3px 8px;border:1px solid var(--color-border);border-radius:9999px;background:var(--color-surface);color:var(--color-foreground);font-size:11px;font-weight:700;line-height:1;white-space:nowrap;box-shadow:0 4px 12px oklch(0.25 0.02 60 / 0.14);">
    ${escapeHtml(label)}
  </div>`;

export interface ViewportBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function MapView({
  markers,
  onMarkerClick,
  onBackgroundClick,
  onViewportChange,
  className = "h-[420px] w-full lg:h-[640px]",
}: {
  markers: MapMarker[];
  // pnu(마커 id)를 넘긴다 — jibunAddress 문자열이 아니다. 서로 다른 pnu가
  // 같은 jibunAddress 텍스트를 공유하는 실사례가 있어(2026-07-18 실측: 금토동
  // 534-8, 산/일반 지번이 "산" 표기 없이 동일 텍스트로 내려오는 백엔드 이슈)
  // jibunAddress로는 어떤 마커를 눌렀는지 구분할 수 없다.
  onMarkerClick?: (pnu: string) => void;
  onBackgroundClick?: () => void;
  onViewportChange?: (bounds: ViewportBounds) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerRefs = useRef<KakaoMarker[]>([]);
  const labelOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const clustererRef = useRef<KakaoMarkerClustererInstance | null>(null);
  // 마커 좌표 "집합"이 실제로 바뀔 때만 지도를 재센터/재맞춤한다 — 그러지
  // 않으면 마커를 고르거나(active만 바뀜) 검색 순서가 달라져도(같은 후보들)
  // 매번 화면이 움직여서, 어떤 클릭은 화면이 안 움직이고 어떤 클릭은 움직이는
  // 것처럼 보이는 비일관성이 생긴다.
  const lastPositionsKeyRef = useRef<string | null>(null);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const onViewportChangeRef = useRef(onViewportChange);
  const initialCenterRef = useRef<{ lat: number; lng: number } | null>(
    markers.length ? { lat: markers[0].lat, lng: markers[0].lng } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    onBackgroundClickRef.current = onBackgroundClick;
  }, [onBackgroundClick]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    if (!ref.current || typeof window === "undefined") return;

    if (!KAKAO_JS_KEY) {
      setError("카카오 지도 API 키가 설정되지 않았습니다 (VITE_KAKAO_MAP_JS_KEY).");
      return;
    }

    let disposed = false;
    loadKakaoMaps(KAKAO_JS_KEY)
      .then(() => {
        if (disposed || !ref.current || !window.kakao) return;
        setError(null);
        if (mapRef.current) return;
        const { maps } = window.kakao;
        const initialCenter = initialCenterRef.current;
        const center = initialCenter
          ? new maps.LatLng(initialCenter.lat, initialCenter.lng)
          : new maps.LatLng(37.5665, 126.978);
        // ponytail: Kakao's "level" runs opposite to Naver's "zoom" (higher =
        // further out); 3 is a by-eye match for the old zoom:17 building view.
        mapRef.current = new maps.Map(ref.current, { center, level: 3 });
        maps.event.addListener(mapRef.current, "click", () => onBackgroundClickRef.current?.());
        // "idle" fires once after pan/zoom settles (not on every drag frame) —
        // this is a one-way report to the parent, the map's own center/zoom
        // must never be moved in reaction to it (see positionsKey comment
        // above for why: that would create a feedback loop).
        maps.event.addListener(mapRef.current, "idle", () => {
          const bounds = mapRef.current?.getBounds();
          if (!bounds) return;
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          onViewportChangeRef.current?.({
            south: sw.getLat(),
            west: sw.getLng(),
            north: ne.getLat(),
            east: ne.getLng(),
          });
        });
        setMapReady(true);
      })
      .catch((e: unknown) => {
        if (!disposed) setError(e instanceof Error ? e.message : "지도를 불러오지 못했습니다.");
      });

    return () => {
      disposed = true;
      // Kakao Map has no destroy() — dropping the ref and letting the
      // container div unmount is the documented cleanup.
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao?.maps) return;
    const { maps } = window.kakao;

    clustererRef.current?.clear();
    clustererRef.current = null;
    labelOverlayRef.current?.setMap(null);
    labelOverlayRef.current = null;
    markerRefs.current.forEach((marker) => marker.setMap(null));

    const activePinUrl = pinDataUrl(true);
    const inactivePinUrl = pinDataUrl(false);
    markerRefs.current = markers.map((m) => {
      const image = new maps.MarkerImage(m.active ? activePinUrl : inactivePinUrl, new maps.Size(26, 34), {
        offset: new maps.Point(13, 34),
      });
      const marker = new maps.Marker({
        position: new maps.LatLng(m.lat, m.lng),
        image,
        zIndex: m.active ? 1000 : 100,
      });
      maps.event.addListener(marker, "click", () => onMarkerClickRef.current?.(m.id));
      return marker;
    });

    const active = markers.find((m) => m.active);
    if (active) {
      labelOverlayRef.current = new maps.CustomOverlay({
        position: new maps.LatLng(active.lat, active.lng),
        content: labelHtml(active.label),
        zIndex: 1001,
      });
      labelOverlayRef.current.setMap(mapRef.current);
    }

    if (markerRefs.current.length > 0) {
      clustererRef.current = new maps.MarkerClusterer({
        map: mapRef.current,
        markers: markerRefs.current,
        gridSize: 80,
        averageCenter: true,
        // 기본 클러스터 클릭 동작은 gridSize 기준으로 "한 번에 완전히 풀리는"
        // 레벨로 즉시(비-애니메이션) 점프한다 — 넓게 퍼진 클러스터일수록 여러
        // 레벨을 한 번에 건너뛰어 "컷" 전환처럼 보이고, 좌표가 완전히 같은
        // 마커들(같은 건물 다른 층 등)은 어떤 레벨에서도 안 풀려서 그 자리에서
        // 멈춘 것처럼 보인다. 대신 클릭된 클러스터의 실제 멤버 bounds로
        // fitBounds하듯 한 번에 딱 맞는 레벨/중심으로 이동시킨다.
        disableClickZoom: true,
        styles: [
          {
            width: "34px",
            height: "34px",
            background: "var(--color-primary)",
            color: "var(--color-primary-foreground)",
            borderRadius: "9999px",
            border: "2px solid var(--color-surface)",
            textAlign: "center",
            lineHeight: "34px",
            fontSize: "12px",
            fontWeight: "800",
          },
        ],
      });
      maps.event.addListener(clustererRef.current, "clusterclick", (cluster: unknown) => {
        const map = mapRef.current;
        if (!map) return;
        // ponytail: fitBounds-in-one-click (via setBounds) turned out
        // unreliable — for a tight cluster it can pick a level no deeper
        // than the current one (stuck). A single step toward the cluster's
        // own center, mirroring native scroll-wheel zoom, is simpler and
        // never gets stuck — it just costs an extra click for a very
        // spread-out cluster, which is expected zoom UX.
        // Recenter is instant (setCenter), not panTo — panTo animates too,
        // and racing it against the animated setLevel below made the level
        // change win and the map zoom in on the *old* center instead.
        const bounds = (cluster as KakaoCluster).getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        map.setCenter(
          new maps.LatLng((sw.getLat() + ne.getLat()) / 2, (sw.getLng() + ne.getLng()) / 2),
        );
        map.setLevel(Math.max(1, map.getLevel() - 1), { animate: { duration: 300 } });
      });
    }

    const positionsKey = markers
      .map((m) => `${m.lat},${m.lng}`)
      .sort()
      .join("|");
    if (positionsKey !== lastPositionsKeyRef.current) {
      lastPositionsKeyRef.current = positionsKey;
      if (markers.length === 1) {
        mapRef.current!.setCenter(new maps.LatLng(markers[0].lat, markers[0].lng));
      } else if (markers.length > 1) {
        const bounds = new maps.LatLngBounds();
        markers.forEach((m) => bounds.extend(new maps.LatLng(m.lat, m.lng)));
        mapRef.current!.setBounds(bounds);
      }
    }

    return () => {
      clustererRef.current?.clear();
      clustererRef.current = null;
      labelOverlayRef.current?.setMap(null);
      labelOverlayRef.current = null;
      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current = [];
    };
  }, [mapReady, markers]);

  if (error) {
    return (
      <div
        className={
          "flex flex-col items-center justify-center gap-1 bg-secondary/30 px-6 text-center " +
          className
        }
      >
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return <div ref={ref} className={className} />;
}
