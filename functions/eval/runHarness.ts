/**
 * Eval harness runner for functions/ (Firebase Functions/production backend). Run via
 * `npm run eval` from functions/, or `npx ts-node eval/runHarness.ts` from this directory.
 */
import dotenv from "dotenv";
import path from "path";

// functions/eval/ is 2 levels below repo root, same relative depth as backend/eval/.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { GOLDEN_DATASET, GoldenTestCase } from "../../eval/goldenDataset";
import {
  checkSchemaValidity,
  checkFieldPresence,
  checkGeminiOnlyFields,
  checkInjectionResistance,
  checkRangeEnforcement,
  CheckResult,
} from "../../eval/metrics";
import { parseResumeText, parseJobDescriptionText, parseVendorText } from "../src/modules/parse/parse.utils";

const TEST_TENANT_ID = "59d7f637-aa22-4041-8910-9c1c6479d33c";

const runParser = async (testCase: GoldenTestCase): Promise<Record<string, unknown>> => {
  switch (testCase.type) {
    case "resume":
      return (await parseResumeText(testCase.rawText, TEST_TENANT_ID)) as unknown as Record<string, unknown>;
    case "jd":
      return (await parseJobDescriptionText(testCase.rawText, TEST_TENANT_ID)) as unknown as Record<string, unknown>;
    case "vendor":
      return (await parseVendorText(testCase.rawText, TEST_TENANT_ID)) as unknown as Record<string, unknown>;
  }
};

/** A case's Gemini contribution is detected per-case: did any of its geminiOnlyFields actually get populated? */
const detectGeminiAvailable = (result: Record<string, unknown>, geminiOnlyFields: string[] | undefined): boolean => {
  if (!geminiOnlyFields || geminiOnlyFields.length === 0) return false;
  return geminiOnlyFields.some((f) => {
    const v = result[f];
    return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });
};

const STATUS_ICON: Record<string, string> = { pass: "✓", fail: "✗", skip: "–" };

async function main() {
  console.log("=== functions/ eval harness ===\n");

  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;
  let hardFail = false;

  for (const testCase of GOLDEN_DATASET) {
    let result: Record<string, unknown>;
    try {
      result = await runParser(testCase);
    } catch (err) {
      console.log(`[${testCase.id}] ✗ CRASHED: ${err instanceof Error ? err.message : err}`);
      totalFail++;
      hardFail = true;
      continue;
    }

    const geminiAvailable = detectGeminiAvailable(result, testCase.geminiOnlyFields);

    const checks: CheckResult[] = [
      checkSchemaValidity(result),
      checkFieldPresence(result, testCase.expectContains),
      checkGeminiOnlyFields(result, testCase.geminiOnlyFields, geminiAvailable),
      checkInjectionResistance(result, testCase.injectionMarker, geminiAvailable),
      ...(testCase.isRangeCheckTest ? [checkRangeEnforcement(result, testCase.type)] : []),
    ];

    console.log(`[${testCase.id}] ${testCase.description}`);
    for (const check of checks) {
      console.log(`  ${STATUS_ICON[check.status]} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
      if (check.status === "pass") totalPass++;
      else if (check.status === "fail") { totalFail++; hardFail = true; }
      else totalSkip++;
    }
  }

  console.log(`\n=== Summary: ${totalPass} pass, ${totalFail} fail, ${totalSkip} skip (${GOLDEN_DATASET.length} cases) ===`);
  if (hardFail) {
    console.log("FAILED — see ✗ lines above.");
    process.exit(1);
  }
  console.log("PASSED (skips are expected without a live Gemini key).");
  process.exit(0);
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(1);
});
