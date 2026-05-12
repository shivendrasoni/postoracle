"use client";

import { useState } from "react";
import type { VaultFile } from "@/lib/types";
import type { SessionInfo } from "@/lib/detect-session";
import SessionPreview from "./session-preview";
import FileTree from "./file-tree";

interface PreviewToggleProps {
  sessionPath: string;
  session: SessionInfo;
  files: VaultFile[];
}

export default function PreviewToggle({
  sessionPath,
  session,
  files,
}: PreviewToggleProps) {
  const [showFiles, setShowFiles] = useState(false);

  if (showFiles) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setShowFiles(false)}
            className="text-[12px] text-accent hover:underline transition-colors"
          >
            ← Preview
          </button>
        </div>
        <FileTree files={files} />
      </div>
    );
  }

  return (
    <div>
      <SessionPreview sessionPath={sessionPath} session={session} />
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setShowFiles(true)}
          className="text-[12px] text-sub hover:text-content transition-colors"
        >
          View files
        </button>
      </div>
    </div>
  );
}
