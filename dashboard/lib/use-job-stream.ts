"use client";

import { useEffect, useRef, useReducer, useCallback } from "react";

export type JobStage = {
  name: string;
  status: "pending" | "running" | "complete" | "failed";
  elapsed?: number;
};

export type JobStreamEvent =
  | { type: "stage"; stage: string; status: "running" | "complete" | "failed"; elapsed?: number }
  | { type: "thought"; text: string }
  | { type: "tool"; tool: string; args: Record<string, unknown> }
  | { type: "preview"; url: string }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "done"; sessionDir: string };

interface JobStreamState {
  connected: boolean;
  stages: JobStage[];
  thoughts: string[];
  previews: string[];
  error: string | null;
  done: boolean;
  sessionDir: string | null;
}

type StreamAction =
  | { kind: "CONNECTED" }
  | { kind: "DISCONNECTED" }
  | { kind: "EVENT"; event: JobStreamEvent }
  | { kind: "RESET" };

const INITIAL: JobStreamState = {
  connected: false,
  stages: [],
  thoughts: [],
  previews: [],
  error: null,
  done: false,
  sessionDir: null,
};

function streamReducer(state: JobStreamState, action: StreamAction): JobStreamState {
  switch (action.kind) {
    case "CONNECTED":
      return { ...state, connected: true };
    case "DISCONNECTED":
      return { ...state, connected: false };
    case "RESET":
      return { ...INITIAL };
    case "EVENT": {
      const ev = action.event;
      switch (ev.type) {
        case "stage": {
          const existing = state.stages.findIndex((s) => s.name === ev.stage);
          const updated = [...state.stages];
          if (existing >= 0) {
            updated[existing] = { name: ev.stage, status: ev.status, elapsed: ev.elapsed };
          } else {
            updated.push({ name: ev.stage, status: ev.status, elapsed: ev.elapsed });
          }
          return { ...state, stages: updated };
        }
        case "thought":
          return { ...state, thoughts: [...state.thoughts, ev.text] };
        case "preview":
          return { ...state, previews: [...state.previews, ev.url] };
        case "error":
          return { ...state, error: ev.message };
        case "done":
          return { ...state, done: true, sessionDir: ev.sessionDir };
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

const AGENT_SERVICE_WS = "ws://localhost:4000/ws";

export function useJobStream(jobId: string | null) {
  const [state, dispatch] = useReducer(streamReducer, INITIAL);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!jobId) return;

    dispatch({ kind: "RESET" });

    const ws = new WebSocket(`${AGENT_SERVICE_WS}?jobId=${jobId}`);
    wsRef.current = ws;

    ws.onopen = () => dispatch({ kind: "CONNECTED" });
    ws.onclose = () => dispatch({ kind: "DISCONNECTED" });
    ws.onerror = () => dispatch({ kind: "DISCONNECTED" });

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as JobStreamEvent;
        dispatch({ kind: "EVENT", event });
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [jobId]);

  const sendRefine = useCallback(
    async (message: string) => {
      if (!jobId) return;
      await fetch(`http://localhost:4000/api/jobs/${jobId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    },
    [jobId]
  );

  return { ...state, sendRefine };
}
