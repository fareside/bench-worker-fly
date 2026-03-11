/**
 * Benchmark Radius Pilot Script - Radius Mainnet, comparing two x402 client implementations
 *
 * Compares elapsed time for requests on Radius Mainnet via:
 * - /fareside/radius-mainnet-sbc  → @x402 packages (wrapFetchWithPaymentFromConfig)
 * - /sbc-xyz/radius-mainnet-sbc   → @stablecoin.xyz/x402 packages (createX402Client)
 *
 * Runs 10 samples per client to estimate variance.
 *
 * Supports two modes:
 * - sequential: Back-to-back calls
 * - concurrent: Parallel calls (all at same time, default)
 *
 * Usage:
 *   npx tsx src/scripts/benchmark-radius-pilot.ts [mode]
 *   npx tsx src/scripts/benchmark-radius-pilot.ts sequential
 *   npx tsx src/scripts/benchmark-radius-pilot.ts concurrent  (default)
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createX402Client, viemSignerAdapter } from "@stablecoin.xyz/x402/evm";

dotenv.config();

// Configuration
const PILOT_SAMPLES = 10;
const DELAY_BETWEEN_ROUNDS_MS = 3000; // 3 seconds between rounds
const DELAY_BETWEEN_SEQUENTIAL_MS = 500; // 0.5 seconds between sequential calls
const BASE_URL = "https://bench-worker-fly.fly.dev";
const MODE = (process.argv[2] || "concurrent") as "sequential" | "concurrent";

const RADIUS_HTTP = "https://rpc.radiustech.xyz/";
const radius = defineChain({
  id: 723,
  name: "Radius",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RADIUS_HTTP] },
  },
});

// CSV header
const CSV_HEADER = "timestamp,client,network,endpoint,sample_num,facilitation_ms,roundtrip_ms,success,error\n";

interface BenchmarkResult {
  timestamp: string;
  client: string;
  network: string;
  endpoint: string;
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

// Setup @x402 client (wrapFetchWithPaymentFromConfig)
const radiusMainnetPublicClient = createPublicClient({
  chain: radius,
  transport: http(RADIUS_HTTP),
});
const fetchWithPaymentX402 = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:723", // Radius Mainnet
      client: new ExactEvmScheme(toClientEvmSigner(account, radiusMainnetPublicClient)),
    },
  ],
});

// Setup @stablecoin.xyz/x402 client
const walletClient = createWalletClient({
  account,
  chain: radius,
  transport: http(RADIUS_HTTP),
});
const sbcClient = createX402Client({
  // @ts-expect-error Incompatible types w/ viem
  signer: viemSignerAdapter(walletClient),
  network: "radius",
  rpcUrl: RADIUS_HTTP,
});

// Endpoint definitions
const ENDPOINTS = [
  {
    client: "x402",
    network: "radius-mainnet",
    path: "/fareside/radius-mainnet-sbc",
    doFetch: async (url: string) => fetchWithPaymentX402(url, { method: "GET" }),
  },
  {
    client: "sbc-xyz",
    network: "radius-mainnet",
    path: "/sbc-xyz/radius-mainnet-sbc",
    doFetch: async (url: string) => sbcClient.fetch(url),
  },
];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function doFetch(endpoint: typeof ENDPOINTS[0], sampleNum: number): Promise<BenchmarkResult> {
  const timestamp = new Date().toISOString();
  const url = `${BASE_URL}${endpoint.path}`;

  try {
    const start = Date.now();
    const response = await endpoint.doFetch(url);
    const json = await response.json() as { elapsed: number };
    const end = Date.now();

    return {
      timestamp,
      client: endpoint.client,
      network: endpoint.network,
      endpoint: endpoint.path,
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
      client: endpoint.client,
      network: endpoint.network,
      endpoint: endpoint.path,
      sampleNum,
      facilitationMs: null,
      roundtripMs: null,
      success: false,
      error: errorMsg.replace(/,/g, ";"), // Escape commas for CSV
    };
  }
}

function resultToCsvRow(result: BenchmarkResult): string {
  return [
    result.timestamp,
    result.client,
    result.network,
    result.endpoint,
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
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const n = 2 * Math.pow(zAlpha + zBeta, 2) * Math.pow(std, 2) / Math.pow(minDetectableDiff, 2);
  return Math.ceil(n);
}

async function runPilot(): Promise<void> {
  const modeLabel = MODE === "concurrent" ? "CONCURRENT" : "SEQUENTIAL";
  const outputFile = `benchmark-radius-pilot-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  const results: BenchmarkResult[] = [];

  console.log("=".repeat(60));
  console.log(`BENCHMARK RADIUS PILOT STUDY - Radius Mainnet (${modeLabel} MODE)`);
  console.log("=".repeat(60));
  console.log(`Samples per client: ${PILOT_SAMPLES}`);
  console.log(`Total requests: ${PILOT_SAMPLES * ENDPOINTS.length}`);
  console.log(`Output file: ${outputFile}`);
  console.log(`Mode: ${MODE === "concurrent" ? "All clients tested in PARALLEL per round" : "Back-to-back SEQUENTIAL calls"}`);
  console.log(`Clients:`);
  for (const e of ENDPOINTS) {
    console.log(`  ${e.client}: ${e.path}`);
  }
  console.log("=".repeat(60));
  console.log("");

  // Initialize CSV file
  fs.writeFileSync(outputFile, CSV_HEADER);

  // Execute benchmark
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
        console.log(`  Calling ${endpoint.client} (${endpoint.path})...`);
        const result = await doFetch(endpoint, sample);
        roundResults.push(result);

        if (i < ENDPOINTS.length - 1) {
          await sleep(DELAY_BETWEEN_SEQUENTIAL_MS);
        }
      }
    }

    // Log results for this round
    for (const result of roundResults) {
      if (result.success) {
        console.log(`  ${result.client}: facilitation=${result.facilitationMs}ms, roundtrip=${result.roundtripMs}ms`);
      } else {
        console.log(`  ${result.client}: ERROR - ${result.error}`);
      }

      results.push(result);
      fs.appendFileSync(outputFile, resultToCsvRow(result));
    }

    if (sample < PILOT_SAMPLES) {
      console.log(`  Waiting ${DELAY_BETWEEN_ROUNDS_MS}ms before next round...`);
      await sleep(DELAY_BETWEEN_ROUNDS_MS);
    }
  }

  // Calculate and display statistics
  console.log("\n" + "=".repeat(60));
  console.log("PILOT RESULTS SUMMARY");
  console.log("=".repeat(60));

  for (const endpoint of ENDPOINTS) {
    const clientResults = results.filter(r => r.client === endpoint.client && r.success);

    if (clientResults.length === 0) {
      console.log(`\n${endpoint.client}: No successful samples`);
      continue;
    }

    const facilitationTimes = clientResults.map(r => r.facilitationMs!);
    const roundtripTimes = clientResults.map(r => r.roundtripMs!);

    const facilitationStats = calculateStats(facilitationTimes);
    const roundtripStats = calculateStats(roundtripTimes);

    console.log(`\n${endpoint.client} via ${endpoint.path} (${clientResults.length} successful samples):`);
    console.log(`  Facilitation: mean=${facilitationStats.mean.toFixed(1)}ms, std=${facilitationStats.std.toFixed(1)}ms, CV=${facilitationStats.cv.toFixed(1)}%`);
    console.log(`  Roundtrip:    mean=${roundtripStats.mean.toFixed(1)}ms, std=${roundtripStats.std.toFixed(1)}ms, CV=${roundtripStats.cv.toFixed(1)}%`);
  }

  // Calculate recommended sample size
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
    console.log(`  ${diff}ms difference: ${n} samples per client`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Pilot data saved to: ${outputFile}`);
  console.log("=".repeat(60));
}

// Run the pilot
runPilot().catch(console.error);
