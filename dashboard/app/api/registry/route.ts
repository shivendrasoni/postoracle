import { NextResponse } from "next/server";
import { readVaultJson, vaultPathExists } from "@/lib/vault";
import type { RegistryEntry } from "@/lib/types";

export async function GET() {
  const exists = await vaultPathExists("content-registry.json");
  if (!exists) {
    return NextResponse.json([]);
  }

  const entries = await readVaultJson<RegistryEntry[]>("content-registry.json");
  return NextResponse.json(entries);
}
