"use client";

import { useCompose } from "@/lib/compose-context";
import ProgressDrawer from "./progress-drawer";

export default function DrawerShell() {
  const { state, dispatch } = useCompose();

  if (!state.drawerOpen) return null;

  return (
    <ProgressDrawer
      jobId={state.activeJobId}
      contentType={state.type}
      topic={state.topic}
      platform={state.platform}
      onClose={() => dispatch({ kind: "CLOSE_DRAWER" })}
    />
  );
}
