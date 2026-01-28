/**
 * Benchmark Main Script - Base Network
 *
 * Runs the main benchmark study with a configurable number of samples.
 * All 3 facilitators are tested (FareSide, PayAI, Coinbase)
 *
 * Supports two modes:
 * - sequential: Back-to-back calls (FareSide then PayAI then Coinbase)
 * - concurrent: Parallel calls (all at same time)
 *
 * Usage:
 *   npx tsx src/scripts/benchmark-main.ts [samples] [mode]
 *   npx tsx src/scripts/benchmark-main.ts 50 concurrent  (default)
 *   npx tsx src/scripts/benchmark-main.ts 50 sequential
 *
 * Default: 50 samples per facilitator, concurrent mode
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

dotenv.config();

// Configuration
const SAMPLES_PER_FACILITATOR = parseInt(process.argv[2] || "50", 10);
const MODE = (process.argv[3] || "concurrent") as "sequential" | "concurrent";
const DELAY_BETWEEN_ROUNDS_MS = 3000; // 3 seconds between rounds
const DELAY_BETWEEN_SEQUENTIAL_MS = 500; // 0.5 seconds between sequential calls
const BASE_URL = "https://bench-worker-fly.fly.dev";

// Facilitator endpoints for Base network
const ENDPOINTS = [
  { facilitator: "FareSide", network: "base", path: "/fareside/base" },
  { facilitator: "PayAI", network: "base", path: "/payai/base" },
  { facilitator: "Coinbase", network: "base", path: "/coinbase/base" },
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
const EVM_BUYER_PRIVATE_KEY = process.env.EVM_BUYER_PRIVATE_KEY as unknown as undefined | `0x${string}`;
if (!EVM_BUYER_PRIVATE_KEY) {
  throw new Error("EVM_BUYER_PRIVATE_KEY is required");
}
const account = privateKeyToAccount(EVM_BUYER_PRIVATE_KEY);
console.log("Buyer address:", account.address);

// Wrap fetch with payment handling
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453", // Base
      client: new ExactEvmScheme(account),
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

function calculateStats(values: number[]): { mean: number; std: number; median: number; min: number; max: number; cv: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0, median: 0, min: 0, max: 0, cv: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];
  const cv = mean > 0 ? (std / mean) * 100 : 0;
  
  return { mean, std, median, min: sorted[0], max: sorted[n - 1], cv };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

async function runBenchmark(): Promise<void> {
  const modeLabel = MODE === "concurrent" ? "CONCURRENT" : "SEQUENTIAL";
  const totalRequests = SAMPLES_PER_FACILITATOR * ENDPOINTS.length;
  const estimatedCost = totalRequests * 0.10;
  // Estimate duration based on mode
  const estimatedDuration = MODE === "concurrent"
    ? SAMPLES_PER_FACILITATOR * (DELAY_BETWEEN_ROUNDS_MS + 5000)
    : SAMPLES_PER_FACILITATOR * (DELAY_BETWEEN_ROUNDS_MS + (ENDPOINTS.length * 5000) + ((ENDPOINTS.length - 1) * DELAY_BETWEEN_SEQUENTIAL_MS));
  
  const outputFile = `benchmark-main-${MODE}-n${SAMPLES_PER_FACILITATOR}-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  const results: BenchmarkResult[] = [];
  
  console.log("=".repeat(60));
  console.log(`BENCHMARK MAIN STUDY - Base Network (${modeLabel} MODE)`);
  console.log("=".repeat(60));
  console.log(`Samples per facilitator: ${SAMPLES_PER_FACILITATOR}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Estimated cost: $${estimatedCost.toFixed(2)}`);
  console.log(`Estimated duration: ${formatDuration(estimatedDuration)}`);
  console.log(`Output file: ${outputFile}`);
  console.log(`Mode: ${MODE === "concurrent" ? "All facilitators tested in PARALLEL per round" : "Back-to-back SEQUENTIAL calls"}`);
  console.log("=".repeat(60));
  console.log("");
  
  // Confirm before proceeding
  console.log("Starting in 5 seconds... (Ctrl+C to cancel)");
  await sleep(5000);
  
  // Initialize CSV file
  fs.writeFileSync(outputFile, CSV_HEADER);
  
  const startTime = Date.now();
  
  // Execute benchmark
  for (let sample = 1; sample <= SAMPLES_PER_FACILITATOR; sample++) {
    const elapsed = Date.now() - startTime;
    const remaining = sample > 1 ? ((SAMPLES_PER_FACILITATOR - sample + 1) / (sample - 1)) * elapsed : estimatedDuration;
    const roundResults: BenchmarkResult[] = [];
    
    if (MODE === "concurrent") {
      console.log(`\n[Round ${sample}/${SAMPLES_PER_FACILITATOR}] (ETA: ${formatDuration(remaining)}) Testing all facilitators in parallel...`);
      
      // Fire all requests simultaneously
      const roundPromises = ENDPOINTS.map(endpoint => doFetch(endpoint, sample));
      roundResults.push(...await Promise.all(roundPromises));
    } else {
      console.log(`\n[Round ${sample}/${SAMPLES_PER_FACILITATOR}] (ETA: ${formatDuration(remaining)}) Testing facilitators sequentially...`);
      
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
      if (result.success && result.facilitationMs) {
        console.log(`  ${result.facilitator}: facilitation=${result.facilitationMs}ms, roundtrip=${result.roundtripMs}ms`);
      } else {
        console.log(`  ${result.facilitator}: ERROR - ${result.error}`);
      }
      
      results.push(result);
      fs.appendFileSync(outputFile, resultToCsvRow(result));
    }
    
    // Delay before next round (except for last one)
    if (sample < SAMPLES_PER_FACILITATOR) {
      await sleep(DELAY_BETWEEN_ROUNDS_MS);
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Calculate and display statistics
  console.log("\n" + "=".repeat(60));
  console.log("BENCHMARK RESULTS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total duration: ${formatDuration(totalDuration)}`);
  console.log(`Successful requests: ${results.filter(r => r.success).length}/${results.length}`);
  
  for (const endpoint of ENDPOINTS) {
    const facilitatorResults = results.filter(
      r => r.facilitator === endpoint.facilitator && r.success
    );
    
    if (facilitatorResults.length === 0) {
      console.log(`\n${endpoint.facilitator}: No successful samples`);
      continue;
    }
    
    const facilitationTimes = facilitatorResults.map(r => r.facilitationMs!);
    const roundtripTimes = facilitatorResults.map(r => r.roundtripMs!);
    
    const facilitationStats = calculateStats(facilitationTimes);
    const roundtripStats = calculateStats(roundtripTimes);
    
    console.log(`\n${endpoint.facilitator} (${facilitatorResults.length} successful samples):`);
    console.log(`  Facilitation Time:`);
    console.log(`    Mean:   ${facilitationStats.mean.toFixed(1)}ms`);
    console.log(`    Median: ${facilitationStats.median.toFixed(1)}ms`);
    console.log(`    Std:    ${facilitationStats.std.toFixed(1)}ms`);
    console.log(`    Range:  ${facilitationStats.min}ms - ${facilitationStats.max}ms`);
    console.log(`    CV:     ${facilitationStats.cv.toFixed(1)}%`);
    console.log(`  Roundtrip Time:`);
    console.log(`    Mean:   ${roundtripStats.mean.toFixed(1)}ms`);
    console.log(`    Median: ${roundtripStats.median.toFixed(1)}ms`);
    console.log(`    Std:    ${roundtripStats.std.toFixed(1)}ms`);
    console.log(`    Range:  ${roundtripStats.min}ms - ${roundtripStats.max}ms`);
  }
  
  // Quick comparison
  console.log("\n" + "=".repeat(60));
  console.log("QUICK COMPARISON (Facilitation Time)");
  console.log("=".repeat(60));
  
  const summaries = ENDPOINTS.map(endpoint => {
    const facilitatorResults = results.filter(
      r => r.facilitator === endpoint.facilitator && r.success
    );
    const times = facilitatorResults.map(r => r.facilitationMs!);
    const stats = calculateStats(times);
    return { facilitator: endpoint.facilitator, ...stats };
  }).sort((a, b) => a.mean - b.mean);
  
  console.log("\nRanked by mean facilitation time (fastest first):");
  summaries.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.facilitator}: ${s.mean.toFixed(1)}ms (±${s.std.toFixed(1)}ms)`);
  });
  
  console.log("\n" + "=".repeat(60));
  console.log(`Full data saved to: ${outputFile}`);
  console.log("Run analysis: npm run bench:analyze " + outputFile);
  console.log("=".repeat(60));
}

// Run the benchmark
runBenchmark().catch(console.error);
