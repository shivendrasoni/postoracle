import { NextResponse } from "next/server";
import { readVaultJson, vaultPathExists } from "@/lib/vault";
import { computeAnalytics } from "@/lib/analytics";
import type { RegistryEntry } from "@/lib/types";

export async function GET() {
  const exists = await vaultPathExists("content-registry.json");
  if (!exists) {
    return NextResponse.json({ stats: null, contentTypes: [], leaderboard: [], platforms: [], isSparse: true });
  }

  const entries = await readVaultJson<RegistryEntry[]>("content-registry.json");
  return NextResponse.json(computeAnalytics(entries));
}
