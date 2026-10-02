'use client';

/**
 * PlantationMap — Leaflet map for site pin placement.
 * Dynamically imported (no SSR) to avoid "window is not defined" in Next.js.
 * Falls back to OSM tiles when NEXT_PUBLIC_ARCGIS_API_KEY is not set.
 */

import { useEffect, useRef } from 'react';

interface PlantationMapProps {
  latitude?: number | null;
  longitude?: number | null;
  /** Called when user clicks or drags pin to a new position */
  onLocationPicked?: (lat: number, lng: number) => void;
  /** Read-only mode (no draggable pin) */
  readOnly?: boolean;
  /** Height class. Defaults to 'h-72'. */
  heightClass?: string;
}

export default function PlantationMap({
  latitude,
  longitude,
  onLocationPicked,
  readOnly = false,
  heightClass = 'h-72',
}: PlantationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Dynamic import of Leaflet (avoid SSR issues)
    import('leaflet').then((L) => {
      // Fix default icon paths for Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Initialise map only once
      if (!mapRef.current) {
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        const initialLat = latitude ?? 20.5937;
        const initialLng = longitude ?? 78.9629;
        const initialZoom = latitude ? 17 : 5;

        const map = L.map(containerRef.current!, {
          zoomControl: true,
          scrollWheelZoom: !readOnly,
          doubleClickZoom: !readOnly,
        }).setView([initialLat, initialLng], initialZoom);

        if (mapboxToken) {
          // Mapbox Satellite Streets — sharp global imagery with road/place labels
          L.tileLayer(
            `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
            {
              attribution: '© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
              tileSize: 512,
              zoomOffset: -1,
              maxZoom: 22,
            },
          ).addTo(map);
        } else {
          // OSM fallback
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(map);
          // Banner: no satellite key
          const InfoControl = L.Control.extend({
            onAdd: () => {
              const div = L.DomUtil.create('div');
              div.innerHTML =
                '<div style="background:rgba(0,0,0,0.65);color:#e2e8f0;font-size:11px;padding:4px 8px;border-radius:6px;">' +
                '🗺️ Set NEXT_PUBLIC_MAPBOX_TOKEN for satellite view</div>';
              return div;
            },
          });
          new InfoControl({ position: 'bottomleft' }).addTo(map);
        }

        mapRef.current = map;

        if (latitude && longitude) {
          const icon = L.divIcon({
            className: '',
            html: '<div style="width:20px;height:20px;border-radius:50%;background:#0bd5b0;border:3px solid #fff;box-shadow:0 0 0 2px #0bd5b0,0 2px 8px rgba(0,0,0,0.4);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          const marker = L.marker([latitude, longitude], { draggable: !readOnly, icon });
          if (!readOnly && onLocationPicked) {
            marker.on('dragend', (e: any) => {
              const { lat, lng } = e.target.getLatLng();
              onLocationPicked(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
            });
          }
          marker.addTo(map);
          markerRef.current = marker;
        }

        if (!readOnly && onLocationPicked) {
          map.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            const roundLat = Number(lat.toFixed(6));
            const roundLng = Number(lng.toFixed(6));
            onLocationPicked(roundLat, roundLng);
            if (markerRef.current) {
              markerRef.current.setLatLng([roundLat, roundLng]);
            } else {
              const icon = L.divIcon({
                className: '',
                html: '<div style="width:20px;height:20px;border-radius:50%;background:#0bd5b0;border:3px solid #fff;box-shadow:0 0 0 2px #0bd5b0,0 2px 8px rgba(0,0,0,0.4);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              });
              const m = L.marker([roundLat, roundLng], { draggable: true, icon });
              m.on('dragend', (ev: any) => {
                const pos = ev.target.getLatLng();
                onLocationPicked(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
              });
              m.addTo(map);
              markerRef.current = m;
            }
          });
        }
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng props change externally
  useEffect(() => {
    if (!mapRef.current || latitude == null || longitude == null) return;
    import('leaflet').then((L) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 13));
      } else if (mapRef.current) {
        const icon = L.divIcon({
          className: '',
          html: '<div style="width:20px;height:20px;border-radius:50%;background:#0bd5b0;border:3px solid #fff;box-shadow:0 0 0 2px #0bd5b0,0 2px 8px rgba(0,0,0,0.4);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        const marker = L.marker([latitude, longitude], { draggable: !readOnly, icon });
        marker.addTo(mapRef.current);
        markerRef.current = marker;
        mapRef.current.setView([latitude, longitude], 13);
      }
    });
  }, [latitude, longitude, readOnly]);

  return <div ref={containerRef} className={`w-full ${heightClass} rounded-xl overflow-hidden`} />;
}
