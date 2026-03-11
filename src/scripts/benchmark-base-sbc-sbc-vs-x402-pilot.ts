/**
 * Benchmark Pilot Script - Base Network: SBC-XYZ client vs x402 client
 *
 * Runs 10 samples per client to compare:
 *   - SBC-XYZ:   @stablecoin.xyz/x402 client  â /sbc-xyz/base-sbc
 *   - FareSide:  @x402/fetch client            â /fareside/base-sbc
 *
 * Supports two modes:
 * - sequential: Back-to-back calls
 * - concurrent: Parallel calls (all at same time)
 *
 * Usage:
 *   npx tsx src/scripts/benchmark-base-sbc-sbc-vs-x402-pilot.ts [mode]
 *   npx tsx src/scripts/benchmark-base-sbc-sbc-vs-x402-pilot.ts sequential
 *   npx tsx src/scripts/benchmark-base-sbc-sbc-vs-x402-pilot.ts concurrent  (default)
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import { privateKeyToAccount } from "viem/accounts";

// x402 (FareSide)
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";

// stablecoin.xyz (SBC-XYZ)
import { createX402Client, viemSignerAdapter } from "@stablecoin.xyz/x402/evm";

dotenv.config();

// Configuration
const PILOT_SAMPLES = 10;
const DELAY_BETWEEN_ROUNDS_MS = 3000;
const DELAY_BETWEEN_SEQUENTIAL_MS = 500;
const BASE_URL = "https://bench-worker-fly.fly.dev";
const MODE = (process.argv[2] || "concurrent") as "sequential" | "concurrent";

// Endpoint definitions
const ENDPOINTS = [
  { facilitator: "SBC-XYZ", network: "base", path: "/sbc-xyz/base-sbc" },
  { facilitator: "FareSide", network: "base", path: "/fareside/base-sbc" },
];

const CSV_HEADER = "timestamp,facilitator,network,sample_num,facilitation_ms,roundtrip_ms,success,error\n";

interface BenchmarkResult {
  timestamp: string;
  facilitator: string;
  network: string;
  sampleNum: number;
  facilitationMs: number | null;
  roundtripMs: number | null;
  success: boolean;
  error: string;
}

// Setup wallet
const EVM_BUYER_PRIVATE_KEY = process.env.EVM_BUYER_PRIVATE_KEY as unknown as undefined | `0x${string}`;
if (!EVM_BUYER_PRIVATE_KEY) {
  throw new Error("EVM_BUYER_PRIVATE_KEY is required");
}
const account = privateKeyToAccount(EVM_BUYER_PRIVATE_KEY);
console.log("Buyer address:", account.address);

// FareSide client (@x402/fetch)
const basePublicClient = createPublicClient({ chain: base, transport: http() });
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453", // Base
      client: new ExactEvmScheme(toClientEvmSigner(account, basePublicClient)),
    },
  ],
});

// SBC-XYZ client (@stablecoin.xyz/x402)
const walletClient = createWalletClient({ account, chain: base, transport: http() });
// @ts-expect-error Incompatible types w/ viem
const sbcClient = createX402Client({ signer: viemSignerAdapter(walletClient), network: "base" });

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function doFetch(endpoint: typeof ENDPOINTS[0], sampleNum: number): Promise<BenchmarkResult> {
  const timestamp = new Date().toISOString();
  const url = `${BASE_URL}${endpoint.path}`;

  try {
    const start = Date.now();
    let response: Response;
    if (endpoint.facilitator === "SBC-XYZ") {
      response = await sbcClient.fetch(url, { method: "GET" });
    } else {
      response = await fetchWithPayment(url, { method: "GET" });
    }
    const json = await response.json() as { elapsed: number };
    const end = Date.now();

    return {
      timestamp,
      facilitator: endpoint.facilitator,
      network: endpoint.network,
      sampleNum,
      facilitationMs: json.elapsed,
      roundtripMs: end - start,
      success: true,
      error: "",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      timestamp,
      facilitator: endpoint.facilitator,
      network: endpoint.network,
      sampleNum,
      facilitationMs: null,
      roundtripMs: null,
      success: false,
      error: errorMsg.replace(/,/g, ";"),
    };
  }
}

function resultToCsvRow(result: BenchmarkResult): string {
  return [
    result.timestamp,
    result.facilitator,
    result.network,
    result.sampleNum,
    result.facilitationMs ?? "",
    result.roundtripMs ?? "",
    result.success,
    result.error,
  ].join(",") + "\n";
}

function calculateStats(values: number[]): { mean: number; std: number; cv: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0, cv: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
  const std = Math.sqrt(variance);
  const cv = (std / mean) * 100;
  return { mean, std, cv };
}

function calculateRequiredSampleSize(std: number, minDetectableDiff: number = 50): number {
  // n = 2 * ((z_Î±/2 + z_Î²)Â² * ÏÂ²) / Î´Â²
  // z_Î±/2 = 1.96 for 95% confidence, z_Î² = 0.84 for 80% power
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const n = 2 * Math.pow(zAlpha + zBeta, 2) * Math.pow(std, 2) / Math.pow(minDetectableDiff, 2);
  return Math.ceil(n);
}

async function runPilot(): Promise<void> {
  const modeLabel = MODE === "concurrent" ? "CONCURRENT" : "SEQUENTIAL";
  const outputFile = `benchmark-base-sbc-sbc-vs-x402-pilot-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  const results: BenchmarkResult[] = [];

  console.log("=".repeat(60));
  console.log(`BENCHMARK PILOT - Base SBC: SBC-XYZ vs FareSide (${modeLabel})`);
  console.log("=".repeat(60));
  console.log(`Samples per client: ${PILOT_SAMPLES}`);
  console.log(`Total requests: ${PILOT_SAMPLES * ENDPOINTS.length}`);
  console.log(`Output file: ${outputFile}`);
  console.log(`Mode: ${MODE === "concurrent" ? "All clients tested in PARALLEL per round" : "Back-to-back SEQUENTIAL calls"}`);
  console.log("=".repeat(60));

  fs.writeFileSync(outputFile, CSV_HEADER);

  for (let sample = 1; sample <= PILOT_SAMPLES; sample++) {
    const roundResults: BenchmarkResult[] = [];

    if (MODE === "concurrent") {
      console.log(`\n[Round ${sample}/${PILOT_SAMPLES}] Testing all clients in parallel...`);
      const roundPromises = ENDPOINTS.map(endpoint => doFetch(endpoint, sample));
      roundResults.push(...await Promise.all(roundPromises));
    } else {
      console.log(`\n[Round ${sample}/${PILOT_SAMPLES}] Testing clients sequentially...`);
      for (let i = 0; i < ENDPOINTS.length; i++) {
        const endpoint = ENDPOINTS[i];
        console.log(`  Calling ${endpoint.facilitator}...`);
        const result = await doFetch(endpoint, sample);
        roundResults.push(result);
        if (i < ENDPOINTS.length - 1) {
          await sleep(DELAY_BETWEEN_SEQUENTIAL_MS);
        }
      }
    }

    for (const result of roundResults) {
      if (result.success) {
        console.log(`  ${result.facilitator}: facilitation=${result.facilitationMs}ms, roundtrip=${result.roundtripMs}ms`);
      } else {
        console.log(`  ${result.facilitator}: ERROR - ${result.error}`);
      }
      results.push(result);
      fs.appendFileSync(outputFile, resultToCsvRow(result));
    }

    if (sample < PILOT_SAMPLES) {
      console.log(`  Waiting ${DELAY_BETWEEN_ROUNDS_MS}ms before next round...`);
      await sleep(DELAY_BETWEEN_ROUNDS_MS);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("PILOT RESULTS SUMMARY");
  console.log("=".repeat(60));

  for (const endpoint of ENDPOINTS) {
    const facilitatorResults = results.filter(r => r.facilitator === endpoint.facilitator && r.success);

    if (facilitatorResults.length === 0) {
      console.log(`\n${endpoint.facilitator}: No successful samples`);
      continue;
    }

    const facilitationTimes = facilitatorResults.map(r => r.facilitationMs!);
    const roundtripTimes = facilitatorResults.map(r => r.roundtripMs!);
    const facilitationStats = calculateStats(facilitationTimes);
    const roundtripStats = calculateStats(roundtripTimes);

    console.log(`\n${endpoint.facilitator} (${facilitatorResults.length} successful samples):`);
    console.log(`  Facilitation: mean=${facilitationStats.mean.toFixed(1)}ms, std=${facilitationStats.std.toFixed(1)}ms, CV=${facilitationStats.cv.toFixed(1)}%`);
    console.log(`  Roundtrip:    mean=${roundtripStats.mean.toFixed(1)}ms, std=${roundtripStats.std.toFixed(1)}ms, CV=${roundtripStats.cv.toFixed(1)}%`);
  }

  const allSuccessful = results.filter(r => r.success);
  const allFacilitationTimes = allSuccessful.map(r => r.facilitationMs!);
  const pooledStats = calculateStats(allFacilitationTimes);

  console.log("\n" + "=".repeat(60));
  console.log("SAMPLE SIZE RECOMMENDATIONS");
  console.log("=".repeat(60));
  console.log(`\nPooled standard deviation: ${pooledStats.std.toFixed(1)}ms`);
  console.log(`Pooled CV: ${pooledStats.cv.toFixed(1)}%`);

  const sampleSizes = [
    { diff: 25, n: calculateRequiredSampleSize(pooledStats.std, 25) },
    { diff: 50, n: calculateRequiredSampleSize(pooledStats.std, 50) },
    { diff: 100, n: calculateRequiredSampleSize(pooledStats.std, 100) },
  ];

  console.log("\nTo detect a difference of X ms with 95% confidence and 80% power:");
  for (const { diff, n } of sampleSizes) {
    const cost = n * ENDPOINTS.length * 0.10;
    console.log(`  ${diff}ms difference: ${n} samples per client (cost: $${cost.toFixed(2)})`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Pilot data saved to: ${outputFile}`);
  console.log("=".repeat(60));
}

runPilot().catch(console.error);
