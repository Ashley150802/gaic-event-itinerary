// Live tally hook: prefers a WebSocket connection and automatically falls back
// to HTTP polling when the socket cannot connect (e.g. on serverless hosts).

import { useEffect, useRef, useState } from "react";
import { api, liveSocketUrl } from "../api";
import type { SurveyResults } from "../types";

export interface LiveTallyState {
  results: SurveyResults | null;
  connected: boolean;
  transport: "websocket" | "polling" | "connecting";
  refresh: () => void;
}

export function useLiveTally(surveyId: string | null, pollMs = 4000): LiveTallyState {
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState<"websocket" | "polling" | "connecting">("connecting");
  const versionRef = useRef<number>(-1);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!surveyId) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const apply = (next: SurveyResults | null) => {
      if (!next || cancelled) return;
      if (next.version >= versionRef.current) {
        versionRef.current = next.version;
        setResults(next);
      }
    };

    const poll = async () => {
      try {
        const r = await api.surveyResults(surveyId);
        apply(r);
      } catch {
        /* keep last known */
      }
    };
    refreshRef.current = poll;

    const startPolling = () => {
      if (pollTimer) return;
      setTransport("polling");
      poll();
      pollTimer = setInterval(poll, pollMs);
    };

    // Always fetch an initial snapshot.
    poll();

    try {
      socket = new WebSocket(liveSocketUrl(surveyId));
      socket.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        setTransport("websocket");
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === "results") apply(msg.results as SurveyResults);
        } catch {
          /* ignore malformed */
        }
      };
      socket.onerror = () => {
        setConnected(false);
        startPolling();
      };
      socket.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      cancelled = true;
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [surveyId, pollMs]);

  return { results, connected, transport, refresh: () => refreshRef.current() };
}
