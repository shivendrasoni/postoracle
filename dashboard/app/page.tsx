import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { readVaultJson, vaultPathExists } from "@/lib/vault";
import type { RegistryEntry } from "@/lib/types";
import ComposeHome from "@/components/compose/compose-home";

export const dynamic = "force-dynamic";

function hasAnthropicKey(): boolean {
  const envPath = resolve(process.cwd(), "..", ".env");
  if (!existsSync(envPath)) return false;
  return /^ANTHROPIC_API_KEY=.+/m.test(readFileSync(envPath, "utf-8"));
}

export default async function Home() {
  const exists = await vaultPathExists("content-registry.json");
  const entries: RegistryEntry[] = exists
    ? await readVaultJson<RegistryEntry[]>("content-registry.json")
    : [];

  return <ComposeHome entries={entries} agentReady={hasAnthropicKey()} />;
}
