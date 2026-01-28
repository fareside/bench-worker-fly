/**
 * Benchmark Pilot Script - Solana Mainnet
 *
 * Runs 10 samples per facilitator to estimate variance and determine
 * the required sample size for the main benchmark study.
 *
 * FareSide and PayAI are tested (Coinbase excluded - not working for Solana)
 *
 * Supports two modes:
 * - sequential: Back-to-back calls (FareSide then PayAI)
 * - concurrent: Parallel calls (both at same time)
 *
 * Cost: 10 samples × 2 facilitators × $0.01 = $0.20
 *
 * Usage:
 *   npx tsx src/scripts/benchmark-solana-pilot.ts [mode]
 *   npx tsx src/scripts/benchmark-solana-pilot.ts sequential
 *   npx tsx src/scripts/benchmark-solana-pilot.ts concurrent  (default)
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm";

dotenv.config();

// Configuration
const PILOT_SAMPLES = 10;
const DELAY_BETWEEN_ROUNDS_MS = 3000; // 3 seconds between rounds
const DELAY_BETWEEN_SEQUENTIAL_MS = 500; // 0.5 seconds between sequential calls
const BASE_URL = "https://bench-worker-fly.fly.dev";
const MODE = (process.argv[2] || "concurrent") as "sequential" | "concurrent";

// Facilitator endpoints for Solana mainnet (no Coinbase - doesn't work)
const ENDPOINTS = [
  { facilitator: "FareSide", network: "solana-mainnet", path: "/fareside/solana-mainnet" },
  { facilitator: "PayAI", network: "solana-mainnet", path: "/payai/solana-mainnet" },
];

// CSV header
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
const SOLANA_BUYER_PRIVATE_KEY = process.env.SOLANA_BUYER_PRIVATE_KEY as unknown as undefined | string;
if (!SOLANA_BUYER_PRIVATE_KEY) {
  throw new Error("SOLANA_BUYER_PRIVATE_KEY is required");
}
const signer = await createKeyPairSignerFromBytes(base58.decode(SOLANA_BUYER_PRIVATE_KEY));
console.log("Buyer address:", signer.address);

// Wrap fetch with payment handling
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", // Solana Mainnet
      client: new ExactSvmScheme(signer, {
        rpcUrl: process.env.SOLANA_RPC_URL,
      }),
    },
  ],
});

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function doFetch(endpoint: typeof ENDPOINTS[0], sampleNum: number): Promise<BenchmarkResult> {
  const timestamp = new Date().toISOString();
  const url = `${BASE_URL}${endpoint.path}`;
  
  try {
    const start = Date.now();
    const response = await fetchWithPayment(url, { method: "GET" });
    const json = await response.json() as { elapsed?: number };
    const end = Date.now();
    const roundtrip = end - start;
    
    // Handle case where elapsed might be undefined (use roundtrip as fallback)
    const facilitation = json.elapsed ?? null;
    
    return {
      timestamp,
      facilitator: endpoint.facilitator,
      network: endpoint.network,
      sampleNum,
      facilitationMs: facilitation,
      roundtripMs: roundtrip,
      success: true,
      error: facilitation === null ? "elapsed field missing in response" : "",
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
      error: errorMsg.replace(/,/g, ";"), // Escape commas for CSV
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
  const cv = (std / mean) * 100; // Coefficient of variation as percentage
  
  return { mean, std, cv };
}

function calculateRequiredSampleSize(std: number, minDetectableDiff: number = 50): number {
  // Using formula: n = 2 * ((z_α/2 + z_β)² * σ²) / δ²
  // z_α/2 = 1.96 for 95% confidence
  // z_β = 0.84 for 80% power
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const n = 2 * Math.pow(zAlpha + zBeta, 2) * Math.pow(std, 2) / Math.pow(minDetectableDiff, 2);
  return Math.ceil(n);
}

async function runPilot(): Promise<void> {
  const modeLabel = MODE === "concurrent" ? "CONCURRENT" : "SEQUENTIAL";
  const outputFile = `benchmark-solana-pilot-${MODE}-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  const results: BenchmarkResult[] = [];
  
  console.log("=".repeat(60));
  console.log(`BENCHMARK PILOT STUDY - Solana Mainnet (${modeLabel} MODE)`);
  console.log("=".repeat(60));
  console.log(`Facilitators: FareSide, PayAI (Coinbase excluded)`);
  console.log(`Samples per facilitator: ${PILOT_SAMPLES}`);
  console.log(`Total requests: ${PILOT_SAMPLES * ENDPOINTS.length}`);
  console.log(`Estimated cost: $${(PILOT_SAMPLES * ENDPOINTS.length * 0.01).toFixed(2)}`);
  console.log(`Output file: ${outputFile}`);
  console.log(`Mode: ${MODE === "concurrent" ? "All facilitators tested in PARALLEL per round" : "Back-to-back SEQUENTIAL calls"}`);
  console.log("=".repeat(60));
  console.log("");
  
  // Initialize CSV file
  fs.writeFileSync(outputFile, CSV_HEADER);
  
  // Execute benchmark
  for (let sample = 1; sample <= PILOT_SAMPLES; sample++) {
    const roundResults: BenchmarkResult[] = [];
    
    if (MODE === "concurrent") {
      console.log(`\n[Round ${sample}/${PILOT_SAMPLES}] Testing all facilitators in parallel...`);
      
      // Fire all requests simultaneously
      const roundPromises = ENDPOINTS.map(endpoint => doFetch(endpoint, sample));
      roundResults.push(...await Promise.all(roundPromises));
    } else {
      console.log(`\n[Round ${sample}/${PILOT_SAMPLES}] Testing facilitators sequentially...`);
      
      // Execute back-to-back
      for (let i = 0; i < ENDPOINTS.length; i++) {
        const endpoint = ENDPOINTS[i];
        console.log(`  Calling ${endpoint.facilitator}...`);
        const result = await doFetch(endpoint, sample);
        roundResults.push(result);
        
        // Delay between sequential calls (except for last one)
        if (i < ENDPOINTS.length - 1) {
          await sleep(DELAY_BETWEEN_SEQUENTIAL_MS);
        }
      }
    }
    
    // Log results for this round
    for (const result of roundResults) {
      if (result.success) {
        const facilitationStr = result.facilitationMs !== null ? `${result.facilitationMs}ms` : "N/A";
        console.log(`  ${result.facilitator}: facilitation=${facilitationStr}, roundtrip=${result.roundtripMs}ms`);
      } else {
        console.log(`  ${result.facilitator}: ERROR - ${result.error}`);
      }
      
      results.push(result);
      fs.appendFileSync(outputFile, resultToCsvRow(result));
    }
    
    // Delay before next round (except for last one)
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
    const facilitatorResults = results.filter(
      r => r.facilitator === endpoint.facilitator && r.success
    );
    
    if (facilitatorResults.length === 0) {
      console.log(`\n${endpoint.facilitator}: No successful samples`);
      continue;
    }
    
    // Filter out null facilitation times
    const facilitationTimes = facilitatorResults
      .map(r => r.facilitationMs)
      .filter((t): t is number => t !== null);
    const roundtripTimes = facilitatorResults
      .map(r => r.roundtripMs)
      .filter((t): t is number => t !== null);
    
    const facilitationStats = calculateStats(facilitationTimes);
    const roundtripStats = calculateStats(roundtripTimes);
    
    const facilitationCount = facilitationTimes.length;
    const totalCount = facilitatorResults.length;
    
    console.log(`\n${endpoint.facilitator} (${totalCount} successful, ${facilitationCount} with facilitation data):`);
    if (facilitationCount > 0) {
      console.log(`  Facilitation: mean=${facilitationStats.mean.toFixed(1)}ms, std=${facilitationStats.std.toFixed(1)}ms, CV=${facilitationStats.cv.toFixed(1)}%`);
    } else {
      console.log(`  Facilitation: N/A (no elapsed data returned)`);
    }
    console.log(`  Roundtrip:    mean=${roundtripStats.mean.toFixed(1)}ms, std=${roundtripStats.std.toFixed(1)}ms, CV=${roundtripStats.cv.toFixed(1)}%`);
  }
  
  // Calculate recommended sample size
  const allSuccessful = results.filter(r => r.success);
  const allFacilitationTimes = allSuccessful
    .map(r => r.facilitationMs)
    .filter((t): t is number => t !== null);
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
    const cost = n * ENDPOINTS.length * 0.01;
    console.log(`  ${diff}ms difference: ${n} samples per facilitator (cost: $${cost.toFixed(2)})`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log(`Pilot data saved to: ${outputFile}`);
  console.log("=".repeat(60));
}

// Run the pilot
runPilot().catch(console.error);
