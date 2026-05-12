import { NextResponse } from "next/server";
import { readVaultFile, vaultPathExists } from "@/lib/vault";
import yaml from "js-yaml";

export async function GET() {
  const exists = await vaultPathExists("brand/templates/active.yaml");
  if (!exists) {
    return NextResponse.json(null, { status: 404 });
  }
  try {
    const raw = await readVaultFile("brand/templates/active.yaml");
    const parsed = yaml.load(raw);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
