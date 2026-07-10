import { useEffect, useRef } from "react";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  active?: boolean;
}

export function MapView({ markers }: { markers: MapMarker[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || typeof window === "undefined") return;
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !ref.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const center: [number, number] = markers.length
        ? [markers[0].lat, markers[0].lng]
        : [37.5665, 126.978];
      const map = L.map(ref.current, {
        center,
        zoom: 17,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      markers.forEach((m) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="transform:translate(-50%,-100%);display:flex;align-items:center;justify-content:center;width:26px;height:34px;">
            <svg viewBox='0 0 24 32' width='26' height='34' xmlns='http://www.w3.org/2000/svg'>
              <path d='M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z' fill='${
                m.active ? "#0f172a" : "#94a3b8"
              }'/>
              <circle cx='12' cy='12' r='4.5' fill='white'/>
            </svg>
          </div>`,
          iconSize: [26, 34],
        });
        L.marker([m.lat, m.lng], { icon }).addTo(map).bindTooltip(m.label);
      });

      mapRef.current = map;
    })();
    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [markers]);

  return <div ref={ref} className="h-[420px] w-full lg:h-[640px]" />;
}
