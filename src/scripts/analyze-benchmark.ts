/**
 * Benchmark Analysis Script
 * 
 * Analyzes benchmark CSV data and provides statistical comparisons.
 * 
 * Usage: npx tsx src/scripts/analyze-benchmark.ts <csv-file>
 * Example: npx tsx src/scripts/analyze-benchmark.ts benchmark-pilot-2026-01-28.csv
 */

import * as fs from "fs";

interface BenchmarkRow {
  timestamp: string;
  facilitator: string;
  network: string;
  sampleNum: number;
  facilitationMs: number | null;
  roundtripMs: number | null;
  success: boolean;
  error: string;
}

function parseCSV(filePath: string): BenchmarkRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  const header = lines[0].split(",");
  
  return lines.slice(1).map(line => {
    const values = line.split(",");
    return {
      timestamp: values[0],
      facilitator: values[1],
      network: values[2],
      sampleNum: parseInt(values[3], 10),
      facilitationMs: values[4] ? parseInt(values[4], 10) : null,
      roundtripMs: values[5] ? parseInt(values[5], 10) : null,
      success: values[6] === "true",
      error: values[7] || "",
    };
  });
}

function calculateStats(values: number[]): {
  n: number;
  mean: number;
  std: number;
  median: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  cv: number;
  se: number;
  ci95Lower: number;
  ci95Upper: number;
} {
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: 0, std: 0, median: 0, min: 0, max: 0, q1: 0, q3: 0, iqr: 0, cv: 0, se: 0, ci95Lower: 0, ci95Upper: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];
  
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const cv = mean > 0 ? (std / mean) * 100 : 0;
  const se = std / Math.sqrt(n);
  const ci95Lower = mean - 1.96 * se;
  const ci95Upper = mean + 1.96 * se;
  
  return {
    n,
    mean,
    std,
    median,
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
    iqr,
    cv,
    se,
    ci95Lower,
    ci95Upper,
  };
}

function calculateRequiredSampleSize(std: number, minDetectableDiff: number): number {
  const zAlpha = 1.96; // 95% confidence
  const zBeta = 0.84;  // 80% power
  const n = 2 * Math.pow(zAlpha + zBeta, 2) * Math.pow(std, 2) / Math.pow(minDetectableDiff, 2);
  return Math.ceil(n);
}

// Welch's t-test for unequal variances
function welchTTest(group1: number[], group2: number[]): { t: number; df: number; pValue: number } {
  const n1 = group1.length;
  const n2 = group2.length;
  
  const mean1 = group1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = group2.reduce((a, b) => a + b, 0) / n2;
  
  const var1 = group1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (n1 - 1);
  const var2 = group2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (n2 - 1);
  
  const se = Math.sqrt(var1 / n1 + var2 / n2);
  const t = (mean1 - mean2) / se;
  
  // Welch-Satterthwaite degrees of freedom
  const df = Math.pow(var1 / n1 + var2 / n2, 2) / 
    (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));
  
  // Approximate p-value using normal distribution for large df
  const pValue = 2 * (1 - normalCDF(Math.abs(t)));
  
  return { t, df, pValue };
}

// Standard normal CDF approximation
function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

function analyzeData(filePath: string): void {
  console.log("=".repeat(70));
  console.log("BENCHMARK ANALYSIS");
  console.log("=".repeat(70));
  console.log(`File: ${filePath}`);
  
  const data = parseCSV(filePath);
  const successfulData = data.filter(r => r.success);
  
  console.log(`Total records: ${data.length}`);
  console.log(`Successful: ${successfulData.length}`);
  console.log(`Failed: ${data.length - successfulData.length}`);
  
  // Get unique facilitators
  const facilitators = [...new Set(successfulData.map(r => r.facilitator))];
  
  console.log("\n" + "=".repeat(70));
  console.log("DESCRIPTIVE STATISTICS");
  console.log("=".repeat(70));
  
  const facilitatorStats: Map<string, { facilitation: ReturnType<typeof calculateStats>; roundtrip: ReturnType<typeof calculateStats>; data: number[] }> = new Map();
  
  for (const facilitator of facilitators) {
    const facilitatorData = successfulData.filter(r => r.facilitator === facilitator);
    const facilitationTimes = facilitatorData.map(r => r.facilitationMs!);
    const roundtripTimes = facilitatorData.map(r => r.roundtripMs!);
    
    const facilitationStats = calculateStats(facilitationTimes);
    const roundtripStats = calculateStats(roundtripTimes);
    
    facilitatorStats.set(facilitator, { 
      facilitation: facilitationStats, 
      roundtrip: roundtripStats,
      data: facilitationTimes 
    });
    
    console.log(`\n${facilitator} (n=${facilitationStats.n}):`);
    console.log("  Facilitation Time (ms):");
    console.log(`    Mean ± SE:     ${facilitationStats.mean.toFixed(1)} ± ${facilitationStats.se.toFixed(1)}`);
    console.log(`    95% CI:        [${facilitationStats.ci95Lower.toFixed(1)}, ${facilitationStats.ci95Upper.toFixed(1)}]`);
    console.log(`    Median (IQR):  ${facilitationStats.median.toFixed(1)} (${facilitationStats.q1.toFixed(1)} - ${facilitationStats.q3.toFixed(1)})`);
    console.log(`    Range:         ${facilitationStats.min} - ${facilitationStats.max}`);
    console.log(`    Std Dev:       ${facilitationStats.std.toFixed(1)}`);
    console.log(`    CV:            ${facilitationStats.cv.toFixed(1)}%`);
    
    console.log("  Roundtrip Time (ms):");
    console.log(`    Mean ± SE:     ${roundtripStats.mean.toFixed(1)} ± ${roundtripStats.se.toFixed(1)}`);
    console.log(`    95% CI:        [${roundtripStats.ci95Lower.toFixed(1)}, ${roundtripStats.ci95Upper.toFixed(1)}]`);
    console.log(`    Median (IQR):  ${roundtripStats.median.toFixed(1)} (${roundtripStats.q1.toFixed(1)} - ${roundtripStats.q3.toFixed(1)})`);
  }
  
  // Pairwise comparisons
  if (facilitators.length >= 2) {
    console.log("\n" + "=".repeat(70));
    console.log("PAIRWISE COMPARISONS (Facilitation Time)");
    console.log("=".repeat(70));
    console.log("Using Welch's t-test (unequal variances assumed)");
    console.log("Significance level: α = 0.05");
    
    for (let i = 0; i < facilitators.length; i++) {
      for (let j = i + 1; j < facilitators.length; j++) {
        const f1 = facilitators[i];
        const f2 = facilitators[j];
        const data1 = facilitatorStats.get(f1)!.data;
        const data2 = facilitatorStats.get(f2)!.data;
        
        const { t, df, pValue } = welchTTest(data1, data2);
        const stats1 = facilitatorStats.get(f1)!.facilitation;
        const stats2 = facilitatorStats.get(f2)!.facilitation;
        const diff = stats1.mean - stats2.mean;
        
        console.log(`\n${f1} vs ${f2}:`);
        console.log(`  Mean difference: ${diff.toFixed(1)}ms (${f1}: ${stats1.mean.toFixed(1)}ms, ${f2}: ${stats2.mean.toFixed(1)}ms)`);
        console.log(`  t-statistic: ${t.toFixed(3)}`);
        console.log(`  Degrees of freedom: ${df.toFixed(1)}`);
        console.log(`  p-value: ${pValue.toFixed(4)}`);
        console.log(`  Significant: ${pValue < 0.05 ? "YES ✓" : "NO"}`);
        
        if (pValue < 0.05) {
          const faster = diff < 0 ? f1 : f2;
          const slower = diff < 0 ? f2 : f1;
          console.log(`  Conclusion: ${faster} is significantly faster than ${slower}`);
        } else {
          console.log(`  Conclusion: No significant difference detected`);
        }
      }
    }
  }
  
  // Sample size recommendations
  console.log("\n" + "=".repeat(70));
  console.log("SAMPLE SIZE RECOMMENDATIONS");
  console.log("=".repeat(70));
  
  // Calculate pooled standard deviation
  const allFacilitationTimes = successfulData.map(r => r.facilitationMs!);
  const pooledStats = calculateStats(allFacilitationTimes);
  
  console.log(`\nPooled statistics across all facilitators:`);
  console.log(`  Mean: ${pooledStats.mean.toFixed(1)}ms`);
  console.log(`  Std Dev: ${pooledStats.std.toFixed(1)}ms`);
  console.log(`  CV: ${pooledStats.cv.toFixed(1)}%`);
  
  console.log(`\nRequired samples per group to detect difference with 95% CI, 80% power:`);
  const differences = [25, 50, 75, 100, 150, 200];
  for (const diff of differences) {
    const n = calculateRequiredSampleSize(pooledStats.std, diff);
    const cost = n * facilitators.length * 0.10;
    console.log(`  ${diff}ms difference: ${n} samples/facilitator (total cost: $${cost.toFixed(2)})`);
  }
  
  // Ranking
  console.log("\n" + "=".repeat(70));
  console.log("RANKING (by mean facilitation time)");
  console.log("=".repeat(70));
  
  const rankings = facilitators
    .map(f => ({ facilitator: f, stats: facilitatorStats.get(f)!.facilitation }))
    .sort((a, b) => a.stats.mean - b.stats.mean);
  
  console.log("\nFastest to slowest:");
  rankings.forEach((r, i) => {
    const ci = `[${r.stats.ci95Lower.toFixed(0)}, ${r.stats.ci95Upper.toFixed(0)}]`;
    console.log(`  ${i + 1}. ${r.facilitator}: ${r.stats.mean.toFixed(1)}ms (95% CI: ${ci})`);
  });
  
  // Check for overlapping confidence intervals
  console.log("\nConfidence interval overlap analysis:");
  for (let i = 0; i < rankings.length - 1; i++) {
    const current = rankings[i];
    const next = rankings[i + 1];
    
    const overlap = current.stats.ci95Upper > next.stats.ci95Lower;
    if (overlap) {
      console.log(`  ${current.facilitator} and ${next.facilitator}: CIs OVERLAP - difference may not be practically significant`);
    } else {
      console.log(`  ${current.facilitator} and ${next.facilitator}: CIs DO NOT overlap - ${current.facilitator} is clearly faster`);
    }
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("ANALYSIS COMPLETE");
  console.log("=".repeat(70));
}

// Main
const csvFile = process.argv[2];
if (!csvFile) {
  console.error("Usage: npx tsx src/scripts/analyze-benchmark.ts <csv-file>");
  console.error("Example: npx tsx src/scripts/analyze-benchmark.ts benchmark-pilot-2026-01-28.csv");
  process.exit(1);
}

if (!fs.existsSync(csvFile)) {
  console.error(`File not found: ${csvFile}`);
  process.exit(1);
}

analyzeData(csvFile);
