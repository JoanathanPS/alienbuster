import { useState, useCallback } from "react";

interface GeoState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    latitude: null, longitude: null, loading: false, error: null, permissionDenied: false,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported", permissionDenied: true }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          loading: false, error: null, permissionDenied: false,
        });
      },
      (err) => {
        setState({
          latitude: null, longitude: null, loading: false,
          error: err.message,
          permissionDenied: err.code === err.PERMISSION_DENIED,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const setManual = useCallback((lat: number, lng: number) => {
    setState({ latitude: lat, longitude: lng, loading: false, error: null, permissionDenied: false });
  }, []);

  return { ...state, requestLocation, setManual };
}
