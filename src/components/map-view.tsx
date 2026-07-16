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
// LatLng instances used to be fully opaque (construct/pass only) — now we
// also read lat()/lng() off getBounds() results to report the viewport.
interface NaverLatLng {
  lat(): number;
  lng(): number;
}
interface NaverLatLngBounds {
  extend(latlng: NaverLatLng): void;
  getSW(): NaverLatLng;
  getNE(): NaverLatLng;
}
interface NaverMap {
  setCenter(latlng: NaverLatLng): void;
  fitBounds(bounds: NaverLatLngBounds): void;
  getBounds(): NaverLatLngBounds;
  destroy(): void;
}
interface NaverMarker {
  setMap(map: NaverMap | null): void;
}
interface NaverMapsNamespace {
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new (sw: NaverLatLng, ne: NaverLatLng) => NaverLatLngBounds;
  Map: new (
    el: HTMLElement,
    options: { center: NaverLatLng; zoom: number; zoomControl?: boolean },
  ) => NaverMap;
  Marker: new (options: {
    position: NaverLatLng;
    map?: NaverMap | null;
    title?: string;
    icon?: { content: string };
    zIndex?: number;
  }) => NaverMarker;
  Event: {
    addListener(target: NaverMarker | NaverMap, eventName: string, handler: () => void): void;
  };
}

// 네이버 지도 공식 마커 클러스터링 유틸(navermaps/marker-tools.js, Apache-2.0,
// public/vendor/MarkerClustering.js에 그대로 벤더링) — npm 패키지가 아니라
// naver.maps 네임스페이스가 이미 로드된 뒤 별도 <script>로 얹는 전역 클래스다.
// naver.maps.Util/OverlayView를 스크립트 최상단(정의 시점)에서 바로 참조하므로
// loadNaverMaps 완료 후에만 로드할 수 있다.
interface ClusterMarkerHandle {
  getElement(): HTMLElement;
}
interface MarkerClusteringInstance {
  setMap(map: NaverMap | null): void;
}
interface MarkerClusteringConstructor {
  new (options: {
    map: NaverMap;
    markers: NaverMarker[];
    disableClickZoom?: boolean;
    minClusterSize?: number;
    maxZoom?: number;
    gridSize?: number;
    icons?: { content: string }[];
    indexGenerator?: number[];
    stylingFunction?: (clusterMarker: ClusterMarkerHandle, count: number) => void;
  }): MarkerClusteringInstance;
}

declare global {
  interface Window {
    naver?: { maps: NaverMapsNamespace };
    MarkerClustering?: MarkerClusteringConstructor;
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

let clusteringLoader: Promise<void> | null = null;

const loadMarkerClustering = (): Promise<void> => {
  if (window.MarkerClustering) return Promise.resolve();
  if (clusteringLoader) return clusteringLoader;
  clusteringLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-marker-clustering]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("마커 클러스터링 스크립트를 불러오지 못했습니다.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.dataset.markerClustering = "true";
    script.src = "/vendor/MarkerClustering.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("마커 클러스터링 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return clusteringLoader;
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
        ? `<div style="padding:3px 8px;border:1px solid var(--color-border);border-radius:9999px;background:var(--color-surface);color:var(--color-foreground);font-size:11px;font-weight:700;line-height:1;white-space:nowrap;box-shadow:0 4px 12px oklch(0.25 0.02 60 / 0.14);">
      ${escapeHtml(label)}
    </div>`
        : ""
    }
    <div style="display:flex;align-items:center;justify-content:center;width:26px;height:34px;">
      <svg viewBox='0 0 24 32' width='26' height='34' xmlns='http://www.w3.org/2000/svg'>
        <path d='M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z' fill='${
          active ? "var(--color-primary)" : "var(--color-muted-foreground)"
        }'/>
        <circle cx='12' cy='12' r='4.5' fill='var(--color-surface)'/>
      </svg>
    </div>
  </div>`;

// 클러스터 개수는 stylingFunction이 매번 채워 넣으니 여기선 빈 자리만 마련한다.
const clusterIconHtml = `
  <div style="transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:var(--color-primary);color:var(--color-primary-foreground);font-size:12px;font-weight:800;border:2px solid var(--color-surface);box-shadow:0 4px 12px oklch(0.25 0.02 60 / 0.25);">
    <span data-cluster-count></span>
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
  onMarkerClick?: (jibunAddress: string) => void;
  onBackgroundClick?: () => void;
  onViewportChange?: (bounds: ViewportBounds) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markerRefs = useRef<NaverMarker[]>([]);
  const clustererRef = useRef<MarkerClusteringInstance | null>(null);
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

    if (!NAVER_CLIENT_ID) {
      setError("네이버 지도 API 키가 설정되지 않았습니다 (VITE_NAVER_MAP_CLIENT_ID).");
      return;
    }

    let disposed = false;
    loadNaverMaps(NAVER_CLIENT_ID)
      // 클러스터링 스크립트 로드 실패는 지도 자체를 막을 이유가 안 된다 —
      // 실패하면 그냥 개별 마커로 폴백한다(아래 마커 effect의 window.MarkerClustering
      // 가드 참고).
      .then(() => loadMarkerClustering().catch(() => undefined))
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
        maps.Event.addListener(mapRef.current, "click", () => onBackgroundClickRef.current?.());
        // "idle" fires once after pan/zoom settles (not on every drag frame like
        // "drag"/"zoom_changed" would) — this is a one-way report to the parent,
        // the map's own center/zoom must never be moved in reaction to it (see
        // positionsKey comment above for why: that would create a feedback loop).
        maps.Event.addListener(mapRef.current, "idle", () => {
          const bounds = mapRef.current?.getBounds();
          if (!bounds) return;
          const sw = bounds.getSW();
          const ne = bounds.getNE();
          onViewportChangeRef.current?.({
            south: sw.lat(),
            west: sw.lng(),
            north: ne.lat(),
            east: ne.lng(),
          });
        });
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
    // window.naver가 있어도 .maps는 비어 있을 수 있다(예: 배포 도메인이 Naver
    // Maps 콘솔의 Web Service URL 허용목록에 없어 SDK 초기화가 중간에 실패하는
    // 경우) — 이 effect는 최초 지도 생성 effect(.then/.catch로 감싸여 있음)와
    // 달리 안전망이 없어, 가드 없이 진행하면 "Cannot read properties of null
    // (reading 'LatLng')" 같은 uncaught 크래시로 바로 이어진다.
    if (!mapReady || !mapRef.current || !window.naver?.maps) return;
    const { maps } = window.naver;

    clustererRef.current?.setMap(null);
    clustererRef.current = null;
    markerRefs.current.forEach((marker) => marker.setMap(null));
    // 클러스터링이 마커의 map 배정을 스스로 관리한다(줌에 따라 뭉치거나
    // 풀어서 보여줌) — 여기서 map을 미리 지정하면 클러스터링과 이중으로
    // 제어권을 다투게 되니, 개별 마커는 map 없이 만들고 아래에서 클러스터링
    // 인스턴스에 한 번에 넘긴다.
    markerRefs.current = markers.map((m) => {
      const marker = new maps.Marker({
        position: new maps.LatLng(m.lat, m.lng),
        title: m.label,
        icon: { content: pinHtml(m.label, m.active) },
        zIndex: m.active ? 1000 : 100,
      });
      maps.Event.addListener(marker, "click", () => onMarkerClickRef.current?.(m.jibunAddress));
      return marker;
    });

    if (window.MarkerClustering && markerRefs.current.length > 0) {
      clustererRef.current = new window.MarkerClustering({
        map: mapRef.current!,
        markers: markerRefs.current,
        disableClickZoom: false,
        gridSize: 80,
        maxZoom: 19,
        icons: [{ content: clusterIconHtml }],
        // 아이콘이 한 종류뿐이라 인원수 구간별 아이콘 전환은 안 쓴다(빈
        // 배열이면 항상 icons[0]) — 개수 텍스트만 stylingFunction으로 채운다.
        indexGenerator: [],
        stylingFunction: (clusterMarker, count) => {
          const el = clusterMarker.getElement().querySelector<HTMLElement>("[data-cluster-count]");
          if (el) el.textContent = String(count);
        },
      });
    } else {
      // 클러스터링 스크립트가 아직(또는 끝내) 안 실려도 마커 자체는 보여야
      // 한다 — 개별 마커로 폴백.
      markerRefs.current.forEach((marker) => marker.setMap(mapRef.current));
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
        const bounds = new maps.LatLngBounds(
          new maps.LatLng(markers[0].lat, markers[0].lng),
          new maps.LatLng(markers[0].lat, markers[0].lng),
        );
        markers.forEach((m) => bounds.extend(new maps.LatLng(m.lat, m.lng)));
        mapRef.current!.fitBounds(bounds);
      }
    }

    return () => {
      clustererRef.current?.setMap(null);
      clustererRef.current = null;
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
