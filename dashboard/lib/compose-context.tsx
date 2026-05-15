"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";

export type ContentType =
  | "reel"
  | "carousel"
  | "post"
  | "angle"
  | "script"
  | "analyse"
  | "repurpose"
  | "import-template"
  | "add-platform";
export type Platform = "instagram" | "linkedin" | "x";
export type SlideCount = 5 | 6;

export interface ComposeState {
  type: ContentType;
  topic: string;
  platform: Platform;
  slides: SlideCount;
  avatarId?: string;
  voiceId?: string;
  attachments: string[];
  activeJobId: string | null;
  drawerOpen: boolean;
}

type ComposeAction =
  | { kind: "SET_TYPE"; type: ContentType }
  | { kind: "SET_TOPIC"; topic: string }
  | { kind: "SET_PLATFORM"; platform: Platform }
  | { kind: "SET_SLIDES"; slides: SlideCount }
  | { kind: "SET_AVATAR"; avatarId: string }
  | { kind: "SET_VOICE"; voiceId: string }
  | { kind: "ADD_ATTACHMENT"; url: string }
  | { kind: "REMOVE_ATTACHMENT"; index: number }
  | { kind: "START_JOB"; jobId: string }
  | { kind: "CLOSE_DRAWER" }
  | { kind: "RESET" };

const INITIAL_STATE: ComposeState = {
  type: "reel",
  topic: "",
  platform: "instagram",
  slides: 5,
  attachments: [],
  activeJobId: null,
  drawerOpen: false,
};

function composeReducer(state: ComposeState, action: ComposeAction): ComposeState {
  switch (action.kind) {
    case "SET_TYPE":
      return { ...state, type: action.type };
    case "SET_TOPIC":
      return { ...state, topic: action.topic };
    case "SET_PLATFORM":
      return { ...state, platform: action.platform };
    case "SET_SLIDES":
      return { ...state, slides: action.slides };
    case "SET_AVATAR":
      return { ...state, avatarId: action.avatarId };
    case "SET_VOICE":
      return { ...state, voiceId: action.voiceId };
    case "ADD_ATTACHMENT":
      return { ...state, attachments: [...state.attachments, action.url] };
    case "REMOVE_ATTACHMENT":
      return {
        ...state,
        attachments: state.attachments.filter((_, i) => i !== action.index),
      };
    case "START_JOB":
      return { ...state, activeJobId: action.jobId, drawerOpen: true };
    case "CLOSE_DRAWER":
      return { ...state, drawerOpen: false, activeJobId: null };
    case "RESET":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

interface ComposeContextValue {
  state: ComposeState;
  dispatch: React.Dispatch<ComposeAction>;
  reset: () => void;
}

const ComposeContext = createContext<ComposeContextValue | null>(null);

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(composeReducer, INITIAL_STATE);
  const reset = useCallback(() => dispatch({ kind: "RESET" }), []);

  return (
    <ComposeContext.Provider value={{ state, dispatch, reset }}>
      {children}
    </ComposeContext.Provider>
  );
}

export function useCompose(): ComposeContextValue {
  const ctx = useContext(ComposeContext);
  if (!ctx) {
    throw new Error("useCompose must be used within a ComposeProvider");
  }
  return ctx;
}
