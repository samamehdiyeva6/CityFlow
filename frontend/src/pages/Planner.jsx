import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { Search, MapPin, Clock, Info, Zap, AlertTriangle, Train, QrCode, SkipForward, CheckCircle2 } from 'lucide-react';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE_URL = "http://127.0.0.1:8000";
const BAKU_CENTER = [40.4093, 49.8671];
const DEFAULT_ZOOM = 12;
const ROUTE_COLORS = ['#111111', '#7c3aed', '#f97316'];
const CURRENT_LOCATION_OPTION = '__CURRENT_LOCATION__';

const getCurrentTimeHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const createDivIcon = (label, variant) =>
  L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:${variant === 'start' ? '#111111' : '#ef4444'};color:#fff;font-size:12px;font-weight:700;border:3px solid rgba(255,255,255,0.95);box-shadow:0 10px 24px rgba(15,23,42,0.18)">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const startIcon = createDivIcon('S', 'start');
const endIcon = createDivIcon('D', 'end');
const currentLocationIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:38px;height:38px;border-radius:9999px;background:rgba(37,99,235,0.18);border:1px solid rgba(37,99,235,0.25);"></div>
      <div style="position:absolute;width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid rgba(255,255,255,0.96);box-shadow:0 10px 24px rgba(37,99,235,0.28);"></div>
      <div style="position:absolute;top:-8px;right:-6px;width:18px;height:18px;border-radius:9999px;background:#111111;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">GPS</div>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const MapController = ({ actionToken, focusPoint, bounds }) => {
  const map = useMap();
  const actionType = actionToken.split('-').slice(0, 2).join('-');

  useEffect(() => {
    if (!actionType) return;

    if (actionType === 'zoom-in') {
      map.zoomIn();
    } else if (actionType === 'zoom-out') {
      map.zoomOut();
    } else if (actionType === 'focus' && focusPoint) {
      map.flyTo(focusPoint, Math.max(map.getZoom(), 13), { duration: 0.8 });
    }
  }, [actionType, actionToken, focusPoint, map]);

  useEffect(() => {
    if (!bounds?.length) return;
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [bounds, map]);

  return null;
};

const Planner = ({ signedInEmail, onProfileRefresh }) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [time, setTime] = useState(getCurrentTimeHHMM);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState({});
  const [traffic, setTraffic] = useState({ rush_hours: [] });
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [travelModeActive, setTravelModeActive] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState('');
  const [walletPoints, setWalletPoints] = useState(null);
  const [bakikartBalance, setBakikartBalance] = useState(null);
  const [pendingPeakDecision, setPendingPeakDecision] = useState(false);
  const [alternativeBusLabel, setAlternativeBusLabel] = useState('');
  const [paymentSteps, setPaymentSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentStepPaid, setCurrentStepPaid] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [lastQrCode, setLastQrCode] = useState('');
  const [qrImageDataUrl, setQrImageDataUrl] = useState('');
  const [journeyTimerSec, setJourneyTimerSec] = useState(0);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [journeyCompleted, setJourneyCompleted] = useState(false);
  const [selectedJourneyTime, setSelectedJourneyTime] = useState(getCurrentTimeHHMM);
  const [waitedForBonus, setWaitedForBonus] = useState(false);
  const [activeWaitSessionId, setActiveWaitSessionId] = useState(null);
  const [totalPaidAmount, setTotalPaidAmount] = useState(0);
  const [mapAction, setMapAction] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [nearestTransit, setNearestTransit] = useState(null);
  const [resolvedStops, setResolvedStops] = useState({ origin: null, destination: null });
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [currentLocationLabel, setCurrentLocationLabel] = useState('Current Location');
  const [trackingStatus, setTrackingStatus] = useState({ active: false, nearbyUsers: 0, densityScore: 0 });
  const [waitSuggestion, setWaitSuggestion] = useState(null);
  const [waitCountdown, setWaitCountdown] = useState(0);
  const [waitStarted, setWaitStarted] = useState(false);
  const [waitTargetAt, setWaitTargetAt] = useState(null);
  const [waitSkippedDemo, setWaitSkippedDemo] = useState(false);
  const watchIdRef = useRef(null);
  const trackingSessionIdRef = useRef(`trip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    fetchLocations();
    fetchTraffic();
    detectCurrentLocation();

    return () => {
      stopTripTracking(false);
    };
  }, []);

  useEffect(() => {
    fetchProfile();

    // Keep wallet/balance synced with DB while page stays open.
    const intervalId = window.setInterval(fetchProfile, 12000);
    const onFocus = () => fetchProfile();
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [signedInEmail]);

  useEffect(() => {
    if (!waitTargetAt) {
      setWaitCountdown(0);
      return undefined;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(waitTargetAt).getTime() - Date.now()) / 1000)
      );
      setWaitCountdown(remaining);
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [waitTargetAt]);

  useEffect(() => {
    if (!lastQrCode) {
      setQrImageDataUrl('');
      return;
    }

    QRCode.toDataURL(lastQrCode, {
      width: 192,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => setQrImageDataUrl(url))
      .catch(() => setQrImageDataUrl(''));
  }, [lastQrCode]);

  useEffect(() => {
    if (!journeyStarted || journeyCompleted || journeyTimerSec <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setJourneyTimerSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          setJourneyCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [journeyStarted, journeyCompleted, journeyTimerSec]);

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserLocation(coords);
        setUseCurrentLocation(true);
        const nearest = await fetchNearestTransit(coords);
        if (nearest?.nearest_bus_stop?.name || nearest?.nearest_metro_station?.name) {
          const label = nearest?.nearest_bus_stop?.name || nearest?.nearest_metro_station?.name;
          setCurrentLocationLabel(`Current Location (${label})`);
        } else {
          setCurrentLocationLabel(`Current Location (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`);
        }
        setStart(CURRENT_LOCATION_OPTION);
      },
      () => {
        setUserLocation(null);
        setUseCurrentLocation(false);
        setCurrentLocationLabel('Current Location');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const fetchNearestTransit = async (coords) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/locations/nearest`, {
        params: { lat: coords.lat, lon: coords.lon, limit: 3 }
      });
      setNearestTransit(res.data);
      return res.data;
    } catch (err) {
      console.error("Error fetching nearest transit", err);
      setNearestTransit(null);
      return null;
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/locations`);
      setLocations(res.data);
    } catch (err) {
      console.error("Error fetching locations", err);
    }
  };

  const fetchTraffic = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/traffic`);
      setTraffic(res.data || { rush_hours: [] });
    } catch (err) {
      setTraffic({ rush_hours: [] });
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/user/profile`, {
        params: signedInEmail ? { email: signedInEmail } : undefined,
      });
      setWalletPoints(res.data?.wallet?.points ?? null);
      setBakikartBalance(res.data?.wallet?.bakikart_balance ?? null);
    } catch {
      setWalletPoints(null);
      setBakikartBalance(null);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = { end, time };
      if (start && start !== CURRENT_LOCATION_OPTION) {
        params.start = start;
      } else if (useCurrentLocation && userLocation) {
        params.origin_lat = userLocation.lat;
        params.origin_lon = userLocation.lon;
      }

      const res = await axios.get(`${API_BASE_URL}/api/v1/routes/plan`, {
        params
      });
      setRoutes(res.data?.recommended_routes || []);
      setResolvedStops({
        origin: res.data?.origin || null,
        destination: res.data?.destination || null,
      });
      setSelectedRoute(null);
      setTravelModeActive(false);
      setPendingPeakDecision(false);
      setDecisionMessage('');
      setWaitSuggestion(null);
      setPaymentSteps([]);
      setCurrentStepIndex(0);
      setCurrentStepPaid(false);
      setPaymentMessage('');
      setLastQrCode('');
      setJourneyTimerSec(0);
      setJourneyStarted(false);
      setJourneyCompleted(false);
      setTotalPaidAmount(0);
      setWaitedForBonus(false);
      setWaitSkippedDemo(false);
      setActiveWaitSessionId(null);
      setSelectedJourneyTime(time);
      if (useCurrentLocation && userLocation && res.data?.origin?.name) {
        setCurrentLocationLabel(`Current Location (${res.data.origin.name})`);
      }
    } catch (err) {
      setError("Marşrut tapılmadı. Zəhmət olmasa başqa yer seçin.");
      setRoutes([]);
      setResolvedStops({ origin: null, destination: null });
    } finally {
      setLoading(false);
    }
  };

  const getRouteMeta = (route) => {
    const typeText = String(route.type || '').toLowerCase();
    const idText = String(route.id || '');
    if (typeText.includes('no walk') || typeText.trim() === 'walk') {
      return { mode: 'Walk', name: 'Walk', isMetro: false };
    }
    const isMetro = typeText.includes('metro') || idText.toLowerCase().includes('metro');

    if (isMetro) {
      const metroName = route.line_name || `${route.start} - ${route.end}`;
      return { mode: 'Metro', name: metroName, isMetro: true };
    }

    const busNumber = route.route_number || (/^\d+$/.test(idText) ? idText : 'N/A');
    return { mode: 'Avtobus', name: `No ${busNumber}`, isMetro: false };
  };

  const isRushHour = () => {
    const current = time || '08:30';
    const toMinutes = (v) => {
      const [h, m] = v.split(':').map(Number);
      return h * 60 + m;
    };
    const now = toMinutes(current);

    const windows = Array.isArray(traffic?.rush_hours) ? traffic.rush_hours : [];
    return windows.some((window) => {
      const parts = String(window).split('-');
      if (parts.length !== 2) return false;
      const startM = toMinutes(parts[0]);
      const endM = toMinutes(parts[1]);
      return now >= startM && now <= endM;
    });
  };

  const findAlternativeBus = (route) => {
    const selectedId = String(route?.id || '');
    const alternative = routes.find((r) => {
      const typeText = String(r?.type || '').toLowerCase();
      const idText = String(r?.id || '');
      const isMetro = typeText.includes('metro') || idText.toLowerCase().includes('metro');
      return !isMetro && idText !== selectedId;
    });

    if (!alternative) return '';
    const busNumber = alternative.route_number || alternative.id || 'N/A';
    return `No ${busNumber}`;
  };

  const submitJourneyDecision = async (route, waited) => {
    setDecisionLoading(true);
    try {
      const payloadStart = start === CURRENT_LOCATION_OPTION
        ? (resolvedStops.origin?.name || 'Current Location')
        : start;
      const payloadEnd = end || resolvedStops.destination?.name || 'Destination';

      const res = await axios.post(`${API_BASE_URL}/journey/decision`, {
        start: payloadStart,
        end: payloadEnd,
        route,
        selected_time: selectedJourneyTime,
        waited,
        wait_minutes: 15,
        wait_session_id: waited ? activeWaitSessionId : null,
        wait_skipped_demo: waited ? waitSkippedDemo : false,
        fare_paid: totalPaidAmount > 0,
        paid_amount_azn: totalPaidAmount,
      }, {
        params: signedInEmail ? { user_email: signedInEmail } : undefined,
      });

      setWalletPoints(res.data?.wallet_points ?? walletPoints);
      setBakikartBalance(res.data?.bakikart_balance ?? bakikartBalance);
      setDecisionMessage(res.data?.message || 'Səfər tamamlandı.');
      setTravelModeActive(false);
      setJourneyStarted(false);
      setJourneyCompleted(true);
      setPendingPeakDecision(false);
      setWaitSuggestion(null);
      setWaitStarted(false);
      setWaitTargetAt(null);
      setWaitSkippedDemo(false);
      stopTripTracking(true);
      fetchProfile();
      onProfileRefresh?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Qərar yaddaşa yazılmadı.';
      setDecisionMessage(msg);
      setPendingPeakDecision(false);
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleSelectRoute = async (route) => {
    if (travelModeActive) {
      return;
    }

    setSelectedRoute(route);
    setDecisionMessage('');

    if (isRushHour()) {
      const coords = userLocation || (
        resolvedStops.origin?.lat && resolvedStops.origin?.lon
          ? { lat: resolvedStops.origin.lat, lon: resolvedStops.origin.lon }
          : null
      );

      if (!coords) {
        detectCurrentLocation();
        setDecisionMessage('Pik saat gözləmə verifikasiyası üçün GPS lokasiya lazımdır. Bir neçə saniyə sonra yenidən seçin.');
        return;
      }

      try {
        const res = await axios.post(`${API_BASE_URL}/api/v1/waiting/suggest`, {
          route,
          start,
          end,
          selected_time: time,
          origin_lat: coords.lat,
          origin_lon: coords.lon,
        }, {
          params: signedInEmail ? { user_email: signedInEmail } : undefined,
        });
        setWaitSuggestion(res.data);
        setWaitStarted(false);
        setWaitTargetAt(null);
        setWaitCountdown(0);
        setWaitSkippedDemo(false);
        startTripTracking(route, time, 'WAITING', res.data.session_id);
      } catch (err) {
        console.error("Waiting suggestion failed", err);
      }

      setPendingPeakDecision(true);
      setTravelModeActive(false);
      setAlternativeBusLabel(findAlternativeBus(route));
      return;
    }

    initializeJourneyFlow(route, time, false, null);
  };

  const addMinutesToTime = (hhmm, plusMinutes) => {
    const [hh, mm] = String(hhmm || '08:30').split(':').map(Number);
    const total = (hh * 60 + mm + plusMinutes) % (24 * 60);
    const outH = String(Math.floor(total / 60)).padStart(2, '0');
    const outM = String(total % 60).padStart(2, '0');
    return `${outH}:${outM}`;
  };

  const deactivateTravelMode = () => {
    stopTripTracking(true);
    setTravelModeActive(false);
    setSelectedRoute(null);
    setPendingPeakDecision(false);
    setWaitSuggestion(null);
    setWaitStarted(false);
    setWaitTargetAt(null);
    setWaitCountdown(0);
    setWaitSkippedDemo(false);
    setPaymentSteps([]);
    setCurrentStepIndex(0);
    setCurrentStepPaid(false);
    setPaymentMessage('');
    setLastQrCode('');
    setJourneyStarted(false);
    setJourneyCompleted(false);
    setJourneyTimerSec(0);
    setTotalPaidAmount(0);
    setWaitedForBonus(false);
    setActiveWaitSessionId(null);
    setDecisionMessage('Səyahət modu deaktiv edildi. Yeni route seçə bilərsiniz.');
  };

  const initializeJourneyFlow = (route, effectiveTime, waitedFlag, waitSessionId) => {
    const segments = Array.isArray(route?.segments) ? route.segments : [];
    const transitSegments = segments.filter((seg) => {
      const mode = String(seg?.mode || '').toLowerCase();
      return mode !== 'walk' && mode !== 'no walk';
    });
    const routeMeta = getRouteMeta(route);
    const isMetroRoute = routeMeta.isMetro || String(route?.type || '').toLowerCase() === 'metro';

    const defaultStep = {
      mode: getRouteMeta(route).mode,
      from: route.start,
      to: route.end,
      eta: route.eta,
      cost: Number(route.cost || 0.6),
      route_number: route.route_number || route.id || 'AUTO',
      route_id: route.id,
    };

    const computedSteps = transitSegments.length
      ? transitSegments.map((seg, index) => ({
          mode: String(seg.mode || 'Transit'),
          from: seg.from || route.start,
          to: seg.to || route.end,
          eta: Number(seg.eta || 5),
          cost: Number(seg.cost || route.cost || 0.6),
          route_number: seg.route_id || route.route_number || `STEP-${index + 1}`,
          route_id: seg.route_id || route.id,
          requires_payment: true,
        }))
      : [defaultStep];

    // Metro route ümumi olaraq bir marşrut kimi hesablanır: stansiya dəyişsə də 1 dəfə ödəniş.
    if (isMetroRoute) {
      const totalEta = computedSteps.reduce((sum, step) => sum + Number(step.eta || 0), 0) || Number(route.eta || 1);
      const metroUnifiedStep = {
        mode: 'Metro',
        from: route.start,
        to: route.end,
        eta: totalEta,
        cost: Number(route.cost || computedSteps[0]?.cost || 0.6),
        route_number: route.route_number || 'METRO',
        route_id: route.id,
        requires_payment: true,
      };

      setPaymentSteps([metroUnifiedStep]);
      setCurrentStepIndex(0);
      setCurrentStepPaid(false);
      setPaymentMessage('Metro marşrutu üçün bir dəfə QR ödəniş edin.');
      setLastQrCode('');
      setJourneyStarted(false);
      setJourneyCompleted(false);
      setJourneyTimerSec(Math.max(60, Number(totalEta || 1) * 60));
      setTotalPaidAmount(0);
      setSelectedJourneyTime(effectiveTime);
      setWaitedForBonus(waitedFlag);
      setActiveWaitSessionId(waitSessionId);
      setTravelModeActive(true);
      setPendingPeakDecision(false);
      startTripTracking(route, effectiveTime, 'WAITING', trackingSessionIdRef.current);
      return;
    }

    // Metro daxilində ardıcıl seqmentlərdə yalnız ilk minişdə ödəniş tələb olunsun.
    let metroPaidInSession = false;
    const metroAwareSteps = computedSteps.map((step) => {
      const mode = String(step.mode || '').toLowerCase();
      const isMetroStep = mode.includes('metro');
      if (!isMetroStep) {
        metroPaidInSession = false;
        return { ...step, requires_payment: true };
      }
      if (!metroPaidInSession) {
        metroPaidInSession = true;
        return { ...step, requires_payment: true };
      }
      return { ...step, requires_payment: false, cost: 0 };
    });

    setPaymentSteps(metroAwareSteps);
    setCurrentStepIndex(0);
    setCurrentStepPaid(!metroAwareSteps[0]?.requires_payment);
    setPaymentMessage(
      metroAwareSteps[0]?.requires_payment
        ? 'QR ödəniş edin və trip başlasın.'
        : 'Bu metro seqmenti üçün əlavə ödəniş tələb olunmur.'
    );
    setLastQrCode('');
    setJourneyStarted(false);
    setJourneyCompleted(false);
    setJourneyTimerSec(Math.max(60, Number(metroAwareSteps[0]?.eta || route.eta || 1) * 60));
    setTotalPaidAmount(0);
    setSelectedJourneyTime(effectiveTime);
    setWaitedForBonus(waitedFlag);
    setActiveWaitSessionId(waitSessionId);
    setTravelModeActive(true);
    setPendingPeakDecision(false);
    startTripTracking(route, effectiveTime, 'WAITING', trackingSessionIdRef.current);
  };

  const startTripTracking = (route, selectedTime, tripStatus = 'ACTIVE', forcedSessionId = null) => {
    if (!navigator.geolocation) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      axios.post(`${API_BASE_URL}/api/v1/trips/stop`, {
        session_id: trackingSessionIdRef.current,
      }, {
        params: signedInEmail ? { user_email: signedInEmail } : undefined,
      }).catch((err) => console.error("Failed to rotate tracking session", err));
    }

    trackingSessionIdRef.current = forcedSessionId || `trip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setTrackingStatus({ active: true, nearbyUsers: 0, densityScore: 0 });

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserLocation(coords);
        setUseCurrentLocation(true);

        try {
          const res = await axios.post(`${API_BASE_URL}/api/v1/trips/track`, {
            session_id: trackingSessionIdRef.current,
            route_id: route?.id || null,
            route_number: route?.route_number || null,
            trip_status: tripStatus,
            start: route?.start || start,
            end: route?.end || end,
            lat: coords.lat,
            lon: coords.lon,
            accuracy_m: position.coords.accuracy ?? null,
            speed_mps: position.coords.speed ?? null,
            selected_time: selectedTime || time,
          }, {
            params: signedInEmail ? { user_email: signedInEmail } : undefined,
          });
          setTrackingStatus({
            active: true,
            nearbyUsers: res.data?.nearby_active_users ?? 0,
            densityScore: res.data?.inferred_density_score ?? 0,
          });
        } catch (trackErr) {
          console.error("Trip tracking failed", trackErr);
        }
      },
      (err) => {
        console.error("Trip tracking geolocation error", err);
        setTrackingStatus((prev) => ({ ...prev, active: false }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000,
      }
    );
  };

  const stopTripTracking = async (notifyBackend = true) => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (notifyBackend && trackingSessionIdRef.current) {
      try {
        await axios.post(`${API_BASE_URL}/api/v1/trips/stop`, {
          session_id: trackingSessionIdRef.current,
        }, {
          params: signedInEmail ? { user_email: signedInEmail } : undefined,
        });
      } catch (err) {
        console.error("Failed to stop trip tracking", err);
      }
    }

    setTrackingStatus({ active: false, nearbyUsers: 0, densityScore: 0 });
  };

  const generateQrCode = () => `QR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const currentStep = paymentSteps[currentStepIndex] || null;
  const hasNextStep = currentStepIndex < paymentSteps.length - 1;

  const payForCurrentStep = async () => {
    if (!selectedRoute || !currentStep) return;
    if (!currentStep.requires_payment) {
      setCurrentStepPaid(true);
      setPaymentMessage('Bu seqment metro daxili keçiddir, əlavə ödəniş tələb olunmur.');
      setJourneyStarted(true);
      setJourneyCompleted(false);
      setJourneyTimerSec(Math.max(60, Number(currentStep.eta || 1) * 60));
      return;
    }
    setPaymentLoading(true);
    setPaymentMessage('');

    const qrCode = generateQrCode();
    setLastQrCode(qrCode);
    setPaymentMessage('QR kod yaradıldı. Təsdiq üçün ödəniş yoxlanır...');
    const coords = userLocation || {
      lat: Number(resolvedStops.origin?.lat || BAKU_CENTER[0]),
      lon: Number(resolvedStops.origin?.lon || BAKU_CENTER[1]),
    };

    try {
      const payload = {
        session_id: trackingSessionIdRef.current,
        route_id: String(currentStep.route_id || selectedRoute.id || ''),
        route_number: String(currentStep.route_number || selectedRoute.route_number || ''),
        validator_stop: currentStep.from || selectedRoute.start,
        lat: Number(coords.lat),
        lon: Number(coords.lon),
        amount_azn: Number(currentStep.cost || selectedRoute.cost || 0.6),
        qr_code: qrCode,
      };

      const res = await axios.post(`${API_BASE_URL}/api/v1/payments/qr`, payload, {
        params: signedInEmail ? { user_email: signedInEmail } : undefined,
      });
      setCurrentStepPaid(true);
      setTotalPaidAmount((prev) => prev + Number(payload.amount_azn || 0));
      setBakikartBalance(res.data?.bakikart_balance ?? bakikartBalance);
      setJourneyStarted(true);
      setJourneyCompleted(false);
      setJourneyTimerSec(Math.max(60, Number(currentStep.eta || 1) * 60));
      startTripTracking(selectedRoute, selectedJourneyTime, 'ACTIVE', trackingSessionIdRef.current);
      setPaymentMessage(
        `QR payment confirmed for step ${currentStepIndex + 1}. ` +
        (hasNextStep ? 'Transfer üçün növbəti step bitəndə davam edin.' : 'Trip başladı və countdown aktivdir.')
      );
      fetchProfile();
      onProfileRefresh?.();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Ödəniş uğursuz oldu.';
      setPaymentMessage(msg);
    } finally {
      setPaymentLoading(false);
    }
  };

  const skipJourneyTimer = () => {
    setJourneyTimerSec(0);
    setJourneyCompleted(true);
    setJourneyStarted(false);
    setPaymentMessage('Bu step timer-i skip edildi.');
  };

  const proceedToNextStep = () => {
    if (!hasNextStep) return;
    const nextIndex = currentStepIndex + 1;
    const nextStep = paymentSteps[nextIndex];
    setCurrentStepIndex(nextIndex);
    setCurrentStepPaid(!nextStep?.requires_payment);
    setLastQrCode('');
    setJourneyStarted(false);
    setJourneyCompleted(false);
    setJourneyTimerSec(Math.max(60, Number(nextStep?.eta || 1) * 60));
    setPaymentMessage(
      nextStep?.requires_payment
        ? 'Növbəti step üçün QR ödəniş edin.'
        : 'Metrodan çıxmadığınız üçün bu stepdə əlavə ödəniş tələb olunmur.'
    );
  };

  const skipFirstStep = () => {
    if (currentStepIndex !== 0 || paymentSteps.length < 2) return;
    setCurrentStepIndex(1);
    setCurrentStepPaid(false);
    setJourneyStarted(false);
    setJourneyCompleted(false);
    setLastQrCode('');
    const nextStep = paymentSteps[1];
    setJourneyTimerSec(Math.max(60, Number(nextStep?.eta || 1) * 60));
    setPaymentMessage('İlk step skip edildi. İlk marşrutdan düşüb növbəti marşrut üçün gözləyirsiniz.');
  };

  const completeJourneyAndClaim = () => {
    submitJourneyDecision(selectedRoute, waitedForBonus);
  };

  const startWaitingCountdown = () => {
    const etaMinutes = Number(selectedRoute?.eta || 0);
    const waitSeconds = Math.max(30, Math.round((Number.isFinite(etaMinutes) && etaMinutes > 0 ? etaMinutes : 15) * 60));
    setWaitStarted(true);
    setWaitSkippedDemo(false);
    setWaitedForBonus(true);
    setWaitTargetAt(new Date(Date.now() + waitSeconds * 1000).toISOString());
    setWaitCountdown(waitSeconds);
    setPaymentMessage('Gözləmə countdown başladı. Vaxt bitəndən sonra bonuslu marşruta minə bilərsiniz.');
  };

  const startBonusJourneyAfterWait = () => {
    if (!waitSuggestion) return;
    setActiveWaitSessionId(waitSuggestion?.session_id || activeWaitSessionId);
    initializeJourneyFlow(selectedRoute, addMinutesToTime(time, 15), true, waitSuggestion?.session_id || null);
  };

  const skipWaitForDemo = () => {
    setWaitStarted(true);
    setWaitTargetAt(null);
    setWaitCountdown(0);
    setWaitSkippedDemo(true);
    setWaitedForBonus(true);
    setActiveWaitSessionId(waitSuggestion?.session_id || activeWaitSessionId);
    setPaymentMessage('Demo üçün gözləmə skip edildi. Bonus üçün gözlənilmiş kimi davam edəcəksiniz.');
  };

  const skipToEndDemo = async () => {
    if (!currentStepPaid) {
      setPaymentMessage('Əvvəlcə QR ödəniş təsdiqlənməlidir.');
      return;
    }
    setJourneyTimerSec(0);
    setJourneyCompleted(true);
    setJourneyStarted(false);
    await completeJourneyAndClaim();
  };

  const normalizePoint = (point) => (
    Array.isArray(point) && point.length === 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
      ? [Number(point[0]), Number(point[1])]
      : null
  );

  const visibleRoutes = routes.map((route, index) => {
    const path = Array.isArray(route?.path)
      ? route.path.map(normalizePoint).filter(Boolean)
      : [];

    return {
      ...route,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
      path,
      isSelected: selectedRoute ? route.id === selectedRoute.id : index === 0,
    };
  });

  const selectedMapRoute = visibleRoutes.find((route) => route.isSelected) || visibleRoutes[0] || null;
  const startPoint = selectedMapRoute?.path?.[0] || null;
  const endPoint = selectedMapRoute?.path?.[selectedMapRoute.path.length - 1] || null;
  const userLocationPoint = useCurrentLocation && userLocation
    ? [Number(userLocation.lat), Number(userLocation.lon)]
    : null;

  const mapBounds = useMemo(() => {
    const points = visibleRoutes.flatMap((route) => route.path);
    if (userLocationPoint) {
      points.push(userLocationPoint);
    }
    return points.length ? points : [BAKU_CENTER];
  }, [visibleRoutes, userLocationPoint]);

  const focusPoint = userLocationPoint || endPoint || startPoint || BAKU_CENTER;

  const triggerMapAction = (action) => {
    setMapAction(`${action}-${Date.now()}`);
  };

  const nearestBus = nearestTransit?.nearest_bus_stop;
  const nearestMetro = nearestTransit?.nearest_metro_station;
  const hasManualStart = start && start !== CURRENT_LOCATION_OPTION;
  const canSearch = !loading && end && (hasManualStart || (useCurrentLocation && userLocation));
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Sidebar - Form */}
      <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
             <MapPin size={20} /> Plan Journey
          </h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <div className="w-2 h-2 rounded-full border-2 border-gray-400" />
              </div>
              <select 
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (e.target.value && e.target.value !== CURRENT_LOCATION_OPTION) {
                    setUseCurrentLocation(false);
                  }
                }}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-black appearance-none"
              >
                <option value="">Start Location</option>
                {useCurrentLocation && (
                  <option value={CURRENT_LOCATION_OPTION}>{currentLocationLabel}</option>
                )}
                {Object.keys(locations).map(id => (
                  <option key={id} value={locations[id].name}>{locations[id].name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <MapPin size={16} className="text-red-500" />
              </div>
              <select 
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-black appearance-none"
              >
                <option value="">Destination</option>
                {Object.keys(locations).map(id => (
                  <option key={id} value={locations[id].name}>{locations[id].name}</option>
                ))}
              </select>
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-3">
                <span>Time Window</span>
                <span>{time}</span>
              </div>
              <input 
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl border-none text-sm focus:ring-2 focus:ring-black"
              />
            </div>

            <button 
              type="submit"
              disabled={!canSearch}
              className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {loading ? "Searching..." : "Find Best Routes"} <Search size={18} />
            </button>
          </form>

          <div className="mt-6 p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-3">
             <AlertTriangle size={20} className="text-orange-500 shrink-0" />
             <p className="text-[11px] text-orange-800 font-medium">
               <span className="font-bold">Peak Hour Warning</span><br />
               Metro lines M1 & M2 are currently at 95% capacity. AI suggests delaying departure by 15m for 40% less crowding.
             </p>
          </div>

          <div className="mt-4 space-y-3">
            <button
              onClick={() => {
                setStart(CURRENT_LOCATION_OPTION);
                detectCurrentLocation();
              }}
              type="button"
              className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Use Current Location
            </button>

            {(nearestBus || nearestMetro) && (
              <div className="space-y-3">
                {nearestBus && (
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nearest Bus Stop</p>
                    <p className="text-sm font-bold text-gray-900">{nearestBus.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{Math.round(nearestBus.distance_meters)} m away</p>
                    <p className="text-[11px] text-gray-600 mt-2">
                      Routes: {(nearestBus.available_routes || []).slice(0, 3).map((item) => item.line_id).join(', ') || 'No routes'}
                    </p>
                  </div>
                )}

                {nearestMetro && (
                  <div className="p-4 bg-white border border-gray-200 rounded-xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Nearest Metro</p>
                    <p className="text-sm font-bold text-gray-900">{nearestMetro.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{Math.round(nearestMetro.distance_meters)} m away</p>
                    <p className="text-[11px] text-gray-600 mt-2">
                      Access: {(nearestMetro.available_routes || []).slice(0, 2).map((item) => item.line_id).join(', ') || 'Metro access'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map View Area */}
      <div className="flex-1 bg-slate-200 relative">
         <MapContainer
            center={BAKU_CENTER}
            zoom={DEFAULT_ZOOM}
            zoomControl={false}
            attributionControl={false}
            className="absolute inset-0 z-0"
         >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <MapController
              actionToken={mapAction}
              focusPoint={focusPoint}
              bounds={mapBounds}
            />

            {visibleRoutes.map((route, index) => (
              route.path.length > 1 ? (
                <Polyline
                  key={`${route.id}-${index}`}
                  positions={route.path}
                  pathOptions={{
                    color: route.color,
                    weight: route.isSelected ? 6 : 4,
                    opacity: route.isSelected ? 0.95 : 0.55,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: route.isSelected ? undefined : '10 8',
                  }}
                >
                  <Popup>
                    <div className="text-xs font-medium">
                      <div>{route.start} → {route.end}</div>
                      <div>{route.eta} dəq, {route.route_number || route.line_name}</div>
                    </div>
                  </Popup>
                </Polyline>
              ) : null
            ))}

            {startPoint && (
              <Marker position={startPoint} icon={startIcon}>
                <Popup>{selectedMapRoute?.start || 'Start'}</Popup>
              </Marker>
            )}

            {userLocationPoint && (
              <>
                <Circle
                  center={userLocationPoint}
                  radius={120}
                  pathOptions={{
                    color: '#60a5fa',
                    weight: 1,
                    fillColor: '#93c5fd',
                    fillOpacity: 0.18,
                  }}
                />
                <Marker position={userLocationPoint} icon={currentLocationIcon}>
                  <Popup>
                    <div className="text-xs font-medium">
                      <div>Current Location</div>
                      <div>{userLocation.lat.toFixed(5)}, {userLocation.lon.toFixed(5)}</div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {endPoint && (
              <Marker position={endPoint} icon={endIcon}>
                <Popup>{selectedMapRoute?.end || 'Destination'}</Popup>
              </Marker>
            )}

            {!visibleRoutes.length && (
              <CircleMarker
                center={BAKU_CENTER}
                radius={8}
                pathOptions={{ color: '#111111', fillColor: '#111111', fillOpacity: 0.9 }}
              >
                <Popup>Baku city center</Popup>
              </CircleMarker>
            )}
         </MapContainer>
         
         {/* Map Overlays */}
         <div className="absolute top-6 left-6 z-[500] flex flex-col gap-2">
            <button onClick={() => triggerMapAction('zoom-in')} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center font-bold text-lg">+</button>
            <button onClick={() => triggerMapAction('zoom-out')} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center font-bold text-lg">-</button>
            <button onClick={() => triggerMapAction('focus')} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center mt-2"><MapPin size={20} /></button>
         </div>

         <div className="absolute top-6 right-6 z-[500] flex flex-col gap-2">
            <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3">
               <div className="w-3 h-1 bg-black rounded-full" />
               <span className="text-[10px] font-bold uppercase tracking-wider">AI Recommended Path</span>
            </div>
            {visibleRoutes.slice(1, 3).map((route, index) => (
              <div key={`${route.id}-legend`} className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 flex items-center gap-3">
                 <div className="w-3 h-1 rounded-full" style={{ backgroundColor: route.color || ROUTE_COLORS[index + 1] }} />
                 <span className="text-[10px] font-bold uppercase tracking-wider">
                   {route.line_name || route.route_number || route.type}
                 </span>
              </div>
            ))}
         </div>

         {/* Congestion Forecast Overlay */}
         <div className="absolute bottom-6 left-6 right-6 z-[500] h-32 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-4">
            <div className="flex justify-between items-center mb-2">
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">City-Wide Congestion Forecast</h4>
               <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase"><div className="w-2 h-2 rounded-full bg-black" /> Density %</div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase"><div className="w-2 h-2 rounded-full bg-green-500" /> Reward Multiplier</div>
               </div>
            </div>
            <div className="w-full h-16 bg-gray-100 rounded-lg flex items-end px-2 gap-1 overflow-hidden">
               {/* Simplified Forecast Graph */}
               {Array.from({ length: 24 }).map((_, i) => (
                 <div key={i} className="flex-1 bg-black/10 rounded-t-sm" style={{ height: `${Math.sin(i / 3) * 40 + 50}%` }} />
               ))}
            </div>
            <div className="flex justify-between mt-1 text-[8px] font-bold text-gray-400 px-1 uppercase tracking-widest">
               <span>08:15</span>
               <span>08:30</span>
               <span>08:45</span>
               <span>09:00</span>
               <span>09:15</span>
               <span>09:30</span>
               <span>09:45</span>
            </div>
         </div>
      </div>

      {/* Right Sidebar - Results */}
      <div className="w-[420px] bg-white border-l border-gray-200 flex flex-col h-full">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest">Optimal Routes</h3>
          <span className="text-xs text-gray-400 font-medium">{routes.length} paths found</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
          {walletPoints !== null && (
            <div className="p-3 rounded-xl bg-black text-white text-xs font-semibold">
              Wallet: {walletPoints} pts
              {bakikartBalance !== null ? ` • BakiKart: ${Number(bakikartBalance).toFixed(2)} AZN` : ''}
            </div>
          )}

          {travelModeActive && selectedRoute && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              <p className="text-xs font-bold uppercase mb-1">Səyahət Modu Aktivdir</p>
              <p className="text-sm">Seçilmiş marşrut: {selectedRoute.start} → {selectedRoute.end}</p>
              {currentStep && (
                <div className="mt-3 p-3 rounded-lg bg-white border border-emerald-200 text-xs text-emerald-900 space-y-2">
                  <p className="font-bold uppercase">Transfer Step {currentStepIndex + 1}/{paymentSteps.length}</p>
                  <p>{currentStep.mode} • {currentStep.from} → {currentStep.to}</p>
                  <p>Tarif: {Number(currentStep.cost || 0).toFixed(2)} AZN</p>
                  <p>ETA: {Math.ceil(journeyTimerSec / 60)} dəq</p>
                  <p className="text-[11px] font-bold text-emerald-700">
                    Countdown: {String(Math.floor(journeyTimerSec / 60)).padStart(2, '0')}:{String(journeyTimerSec % 60).padStart(2, '0')}
                  </p>
                  {!currentStep.requires_payment && (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      Metro daxilində olduğunuz üçün bu seqmentə görə yenidən ödəniş tələb olunmur.
                    </p>
                  )}

                  {!currentStepPaid && (
                    <button
                      disabled={paymentLoading}
                      onClick={payForCurrentStep}
                      className="w-full bg-black text-white px-3 py-2 rounded-lg text-[11px] font-bold disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <QrCode size={12} /> QR ilə ödə və tripi başlat
                    </button>
                  )}

                  {lastQrCode && (
                    <div className="rounded-lg bg-emerald-100 border border-emerald-200 px-3 py-2 text-[11px] font-semibold">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 bg-white border border-emerald-300 rounded p-1 shrink-0">
                          {qrImageDataUrl ? (
                            <img src={qrImageDataUrl} alt="Payment QR code" className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 rounded" />
                          )}
                        </div>
                        <div className="break-all">
                          <p className="font-bold">QR Code</p>
                          <p>{lastQrCode}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMessage && (
                    <div className="rounded-lg bg-emerald-100 border border-emerald-200 px-3 py-2 text-[11px] font-semibold">
                      {paymentMessage}
                    </div>
                  )}

                  {currentStepPaid && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={skipJourneyTimer}
                        className="bg-white border border-emerald-300 text-emerald-700 px-3 py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <SkipForward size={12} /> Skip Timer
                      </button>
                      <button
                        onClick={skipToEndDemo}
                        className="bg-black text-white px-3 py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Demo Skip to End
                      </button>
                    </div>
                  )}

                  {currentStepIndex === 0 && paymentSteps.length > 1 && (
                    <button
                      onClick={skipFirstStep}
                      className="w-full bg-orange-100 border border-orange-300 text-orange-700 px-3 py-2 rounded-lg text-[11px] font-bold"
                    >
                      Skip First Step (switch to next route)
                    </button>
                  )}

                  {journeyCompleted && hasNextStep && (
                    <button
                      onClick={proceedToNextStep}
                      className="w-full bg-black text-white px-3 py-2 rounded-lg text-[11px] font-bold"
                    >
                      Next Transfer Step
                    </button>
                  )}

                  {journeyCompleted && !hasNextStep && (
                    <button
                      disabled={decisionLoading}
                      onClick={completeJourneyAndClaim}
                      className="w-full bg-black text-white px-3 py-2 rounded-lg text-[11px] font-bold disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={12} /> Complete Journey & Claim Points
                    </button>
                  )}
                </div>
              )}
              {trackingStatus.active && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-white px-3 py-2 border border-emerald-200">
                    <span className="block font-bold text-emerald-600 uppercase">Nearby GPS</span>
                    <span className="text-emerald-900 font-semibold">{trackingStatus.nearbyUsers} users</span>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 border border-emerald-200">
                    <span className="block font-bold text-emerald-600 uppercase">Realtime Density</span>
                    <span className="text-emerald-900 font-semibold">{trackingStatus.densityScore}%</span>
                  </div>
                </div>
              )}
              <button
                onClick={deactivateTravelMode}
                className="mt-3 bg-white border border-emerald-300 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100"
              >
                Deaktiv et və route dəyiş
              </button>
            </div>
          )}

          {pendingPeakDecision && selectedRoute && (
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 space-y-3">
              <p className="text-xs font-bold uppercase">Pik saat tövsiyəsi</p>
              <p className="text-sm leading-relaxed">
                Hazırda pik saatdır. {waitSuggestion?.projected_density_score ?? selectedRoute.crowding}% səviyyəsinə düşməsi gözlənir. {alternativeBusLabel || 'alternativ avtobusa'} təxmini {Math.max(1, Math.ceil(Number(selectedRoute?.eta || 15)))} dəqiqə sonra minsəniz əlavə +{waitSuggestion?.bonus_points || 25} point qazanacaqsınız.
              </p>
              {waitSuggestion && waitStarted && (
                <div className="p-3 rounded-lg bg-white border border-orange-200 text-xs text-orange-900 font-semibold">
                  Countdown: {String(Math.floor(waitCountdown / 60)).padStart(2, '0')}:{String(waitCountdown % 60).padStart(2, '0')}
                </div>
              )}
              <div className="flex gap-2">
                {!waitStarted ? (
                  <>
                    <button
                      disabled={decisionLoading}
                      onClick={startWaitingCountdown}
                      className="bg-black text-white px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      Gözləyirəm (+point)
                    </button>
                    <button
                      disabled={decisionLoading}
                      onClick={() => {
                        setWaitSuggestion(null);
                        setWaitedForBonus(false);
                        setActiveWaitSessionId(null);
                        initializeJourneyFlow(selectedRoute, time, false, null);
                      }}
                      className="bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      İndi minirəm (0 point)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={decisionLoading || (!waitSkippedDemo && waitCountdown > 0)}
                      onClick={startBonusJourneyAfterWait}
                      className="bg-black text-white px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      Minirəm (+point)
                    </button>
                    <button
                      disabled={decisionLoading || waitSkippedDemo}
                      onClick={skipWaitForDemo}
                      className="bg-white text-orange-700 border border-orange-300 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      Wait skip (demo)
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {decisionMessage && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
              {decisionMessage}
            </div>
          )}

          {(resolvedStops.origin || resolvedStops.destination) && (
            <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resolved Stops</p>
              {resolvedStops.origin && (
                <p className="text-xs text-gray-700">
                  Start: <span className="font-semibold">{resolvedStops.origin.name}</span>
                  {resolvedStops.origin.distance_meters ? ` (${Math.round(resolvedStops.origin.distance_meters)} m)` : ''}
                </p>
              )}
              {resolvedStops.destination && (
                <p className="text-xs text-gray-700">
                  End: <span className="font-semibold">{resolvedStops.destination.name}</span>
                </p>
              )}
            </div>
          )}

          {error && <div className="text-red-500 text-sm p-4 bg-red-50 rounded-xl">{error}</div>}

          {!error && routes.length === 0 && !loading && (
            <div className="text-sm text-gray-500 p-4 bg-white rounded-xl border border-gray-100">
              Marşrut nəticələri burada görünəcək.
            </div>
          )}

          {routes.map((route, i) => {
            const meta = getRouteMeta(route);
            const isSelected = selectedRoute && route.id === selectedRoute.id;
            const isDisabledByTravelMode = travelModeActive && !isSelected;

            return (
              <div key={i} className={`p-5 rounded-2xl bg-white border-2 transition-all ${isDisabledByTravelMode ? 'opacity-45' : 'cursor-pointer'} ${isSelected ? 'border-emerald-500' : i === 0 ? 'border-black' : 'border-transparent hover:border-gray-200'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">{route.eta} <span className="text-sm font-medium text-gray-400">min</span></span>
                    {i === 0 && <span className="bg-gray-100 text-[10px] font-bold px-2 py-1 rounded-md uppercase">AI Recommended</span>}
                  </div>
                  <div className="flex gap-1">
                    {meta.isMetro ? (
                      <div className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><Train size={16} /></div>
                    ) : (
                      <div className="bg-orange-100 text-orange-600 p-1.5 rounded-lg"><Zap size={16} /></div>
                    )}
                  </div>
                </div>

                <div className="mb-3 text-xs font-semibold text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-400 uppercase mr-2">Növ:</span>{meta.mode}
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="text-gray-400 uppercase mr-2">Ad/Nömrə:</span>{meta.name}
                </div>

                {(route.access_stop || route.walking_minutes_total) && (
                  <div className="mb-3 text-[11px] font-medium text-gray-600 bg-blue-50 rounded-lg px-3 py-2">
                    {route.access_stop ? `Access stop: ${route.access_stop}` : 'Current-location access enabled'}
                    {route.walking_minutes_total ? ` • Walk ${route.walking_minutes_total} min` : ''}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Crowding</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${route.is_peak_hour ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${route.crowding}%` }} />
                      </div>
                      <span className="text-xs font-bold">{route.crowding}%</span>
                    </div>
                    <span className="text-[10px] font-semibold text-gray-500">{route.crowd_level || 'MEDIUM'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Confidence</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{route.confidence}%</span>
                    </div>
                    <span className="text-[10px] font-semibold text-gray-500">Hybrid model</span>
                  </div>
                </div>

                {route.density_prediction?.components && (
                  <div className="mb-4 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="rounded-lg bg-gray-50 px-2 py-2">
                      <span className="block font-bold text-gray-400 uppercase">Time</span>
                      <span className="font-semibold text-gray-700">{Math.round(route.density_prediction.components.time_based)}%</span>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2 py-2">
                      <span className="block font-bold text-gray-400 uppercase">History</span>
                      <span className="font-semibold text-gray-700">{Math.round(route.density_prediction.components.historical)}%</span>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2 py-2">
                      <span className="block font-bold text-gray-400 uppercase">Realtime</span>
                      <span className="font-semibold text-gray-700">{Math.round(route.density_prediction.components.realtime)}%</span>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-gray-50 rounded-xl flex gap-2 mb-4">
                  <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-600 italic leading-relaxed">{route.explanation}</p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    disabled={decisionLoading || isDisabledByTravelMode || (travelModeActive && !isSelected)}
                    onClick={() => handleSelectRoute(route)}
                    className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-40"
                  >
                    {isSelected ? 'Selected' : 'Select Route'}
                  </button>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                    <Clock size={14} /> <span>Wait 15m for +{route.bonus_points} pts</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Planner;
