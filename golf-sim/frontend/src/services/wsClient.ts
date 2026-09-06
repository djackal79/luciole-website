import { useShotStore } from '../store/shotStore';
import type { WebSocketEnvelope } from '../types/contract';

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;

export function initWebSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  const setStatus = useShotStore.getState().setWsStatus;
  const handleEvent = useShotStore.getState().handleWsEvent;

  setStatus('connecting');

  // Connect via port 8000 or proxy
  const wsUrl = `ws://${window.location.hostname}:8000/ws/shots`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log(`[GolfSim WS] Connected to ${wsUrl}`);
      setStatus('connected');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const parsed: WebSocketEnvelope = JSON.parse(event.data);
        handleEvent(parsed);
      } catch (err) {
        console.warn('[GolfSim WS] Parse error:', err);
      }
    };

    socket.onerror = () => {
      setStatus('disconnected');
    };

    socket.onclose = () => {
      setStatus('disconnected');
      socket = null;
      if (!reconnectTimer) {
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          initWebSocket();
        }, 3000);
      }
    };
  } catch {
    setStatus('disconnected');
    if (!reconnectTimer) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        initWebSocket();
      }, 3000);
    }
  }
}
