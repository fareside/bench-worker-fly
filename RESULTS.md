# Benchmark Analysis Results

**Analysis Date:** 2026-01-28
**Total Samples:** 270 Base + 180 Solana = 450 transactions
**Sample Size per Round:** 30 samples per facilitator

---

## Executive Summary

**FareSide shows the fastest response times** across all benchmarks on both Base and Solana networks. FareSide demonstrates 2.5-3x faster performance on Base and 1.5-1.9x faster on Solana compared to competitors.

### ⚠️ Important Context

**These results should be interpreted with caution:**

- **FareSide** is currently in early/beta stage with minimal production load
- **PayAI and Coinbase** are operating in full production mode with significant real-world traffic
- Performance under load can differ from low-traffic conditions
- This benchmark represents a **snapshot of current state**, not a prediction of production performance

---

## Base Network Results

### Facilitators Tested
- **FareSide**
- **Coinbase**
- **PayAI**

### Performance Summary (Facilitation Time in ms)

| Round | FareSide | Coinbase | PayAI |
|-------|----------|----------|-------|
| Round 0 | 661 ± 24 | 1774 ± 243 | 2131 ± 110 |
| Round 1 | 709 ± 44 | 2024 ± 303 | 2247 ± 106 |
| Round 2 | 708 ± 42 | 1600 ± 202 | 2318 ± 244 |
| **Average** | **~693** | **~1799** | **~2232** |

### Detailed Statistics

#### Round 0
```
FareSide (n=30):
  Mean ± SE:     661.1 ± 23.9ms
  95% CI:        [614.3, 707.9]
  Median (IQR):  635.5 (581.0 - 688.0)
  Range:         514 - 1003
  CV:            19.8%

PayAI (n=30):
  Mean ± SE:     2131.0 ± 110.1ms
  95% CI:        [1915.1, 2346.8]
  Median (IQR):  2105.5 (1540.0 - 2559.0)
  Range:         1438 - 3337
  CV:            28.3%

Coinbase (n=30):
  Mean ± SE:     1773.9 ± 242.6ms
  95% CI:        [1298.3, 2249.5]
  Median (IQR):  1325.5 (1255.0 - 1476.0)
  Range:         1131 - 5722
  CV:            74.9%
```

#### Round 1
```
FareSide (n=30):
  Mean ± SE:     708.7 ± 44.2ms
  95% CI:        [622.1, 795.3]
  Median (IQR):  624.5 (576.0 - 684.0)
  Range:         447 - 1616
  CV:            34.1%

PayAI (n=30):
  Mean ± SE:     2246.9 ± 106.2ms
  95% CI:        [2038.7, 2455.1]
  Median (IQR):  2149.0 (1631.0 - 2704.0)
  Range:         1522 - 3573
  CV:            25.9%

Coinbase (n=30):
  Mean ± SE:     2024.4 ± 303.2ms
  95% CI:        [1430.2, 2618.6]
  Median (IQR):  1249.5 (1186.0 - 1603.0)
  Range:         975 - 5743
  CV:            82.0%
```

#### Round 2
```
FareSide (n=30):
  Mean ± SE:     708.0 ± 41.6ms
  95% CI:        [626.5, 789.5]
  Median (IQR):  652.0 (578.0 - 729.0)
  Range:         516 - 1654
  CV:            32.2%

PayAI (n=30):
  Mean ± SE:     2318.4 ± 244.1ms
  95% CI:        [1839.9, 2796.9]
  Median (IQR):  1963.0 (1652.0 - 2480.0)
  Range:         1503 - 8838
  CV:            57.7%

Coinbase (n=30):
  Mean ± SE:     1600.4 ± 201.8ms
  95% CI:        [1205.0, 1995.9]
  Median (IQR):  1292.0 (1197.0 - 1419.0)
  Range:         1087 - 5642
  CV:            69.0%
```

### Statistical Significance (Base Network)

Using Welch's t-test (α = 0.05):

| Comparison | Round 0 | Round 1 | Round 2 |
|------------|---------|---------|---------|
| FareSide vs PayAI | **p < 0.0001** ✓ | **p < 0.0001** ✓ | **p < 0.0001** ✓ |
| FareSide vs Coinbase | **p < 0.0001** ✓ | **p < 0.0001** ✓ | **p < 0.0001** ✓ |
| PayAI vs Coinbase | p = 0.18 (NS) | p = 0.49 (NS) | **p = 0.02** ✓ |

---

## Solana Network Results

### Facilitators Tested
- **FareSide**
- **PayAI**

*(Note: Coinbase does not support Solana)*

### Performance Summary (Facilitation Time in ms)

| Round | FareSide | PayAI |
|-------|----------|-------|
| Round 0 | 1010 ± 169 | 1503 ± 45 |
| Round 1 | 825 ± 120 | 1559 ± 52 |
| Round 2 | 1085 ± 167 | 1527 ± 63 |
| **Average** | **~973** | **~1530** |

### Detailed Statistics

#### Round 0
```
FareSide (n=30):
  Mean ± SE:     1010.2 ± 168.7ms
  95% CI:        [679.7, 1340.8]
  Median (IQR):  612.0 (482.0 - 1088.0)
  Range:         312 - 4058
  CV:            91.4%

PayAI (n=30):
  Mean ± SE:     1502.9 ± 44.7ms
  95% CI:        [1415.3, 1590.5]
  Median (IQR):  1439.5 (1389.0 - 1516.0)
  Range:         1325 - 2692
  CV:            16.3%
```

#### Round 1
```
FareSide (n=30):
  Mean ± SE:     825.2 ± 120.2ms
  95% CI:        [589.7, 1060.7]
  Median (IQR):  598.0 (500.0 - 821.0)
  Range:         164 - 3601
  CV:            79.8%

PayAI (n=30):
  Mean ± SE:     1559.4 ± 51.7ms
  95% CI:        [1458.1, 1660.6]
  Median (IQR):  1461.5 (1405.0 - 1538.0)
  Range:         1369 - 2550
  CV:            18.2%
```

#### Round 2
```
FareSide (n=30):
  Mean ± SE:     1085.2 ± 167.3ms
  95% CI:        [757.2, 1413.1]
  Median (IQR):  680.5 (504.0 - 1481.0)
  Range:         402 - 4065
  CV:            84.4%

PayAI (n=30):
  Mean ± SE:     1527.2 ± 62.5ms
  95% CI:        [1404.7, 1649.7]
  Median (IQR):  1409.0 (1353.0 - 1504.0)
  Range:         1315 - 2537
  CV:            22.4%
```

### Statistical Significance (Solana Network)

Using Welch's t-test (α = 0.05):

| Comparison | Round 0 | Round 1 | Round 2 |
|------------|---------|---------|---------|
| FareSide vs PayAI | **p = 0.005** ✓ | **p < 0.0001** ✓ | **p = 0.013** ✓ |

---

## Overall Ranking

### By Mean Facilitation Time

| Rank | Facilitator | Base Network | Solana Network |
|------|-------------|--------------|----------------|
| 🥇 1st | **FareSide** | ~693ms | ~973ms |
| 🥈 2nd | **Coinbase** | ~1799ms | N/A |
| 🥉 3rd | **PayAI** | ~2232ms | ~1530ms |

### Performance Multipliers

| Network | FareSide vs PayAI | FareSide vs Coinbase |
|---------|-------------------|----------------------|
| Base | **3.2x faster** | **2.6x faster** |
| Solana | **1.6x faster** | N/A |

---

## Consistency Analysis

| Facilitator | Network | CV Range | Assessment |
|-------------|---------|----------|------------|
| FareSide | Base | 19-34% | ✅ Most consistent |
| FareSide | Solana | 79-91% | ⚠️ High variance (occasional spikes) |
| PayAI | Base | 26-58% | ⚠️ Moderate variance |
| PayAI | Solana | 16-22% | ✅ Very consistent |
| Coinbase | Base | 69-82% | ⚠️ High variance (~5600ms spikes) |

### Notes on Variance

- **FareSide on Solana**: High CV is due to occasional spikes (up to 4000ms), but median performance (~600ms) is excellent
- **Coinbase on Base**: Experiences periodic ~5600ms spikes, likely due to rate limiting or backend processing
- **PayAI**: Most consistent performer but consistently slower

## Conclusions

1. **FareSide shows the fastest response times** on both networks with statistically significant advantages
2. **On Base network**, FareSide is approximately **2.5-3x faster** than competitors
3. **On Solana network**, FareSide is approximately **1.5-1.9x faster** than PayAI
4. **Coinbase and PayAI show no significant difference** on Base network (except marginally in Round 2)
5. **FareSide has the best median performance** despite occasional latency spikes on Solana
6. **All 450 transactions completed successfully** (100% success rate across all facilitators)

## Methodology

- **Test Type**: Concurrent benchmark with 30 samples per facilitator per round
- **Statistical Test**: Welch's t-test for unequal variances
- **Significance Level**: α = 0.05
- **Metrics**: Facilitation time (API response time) and roundtrip time (total transaction time)
- **Analysis Script**: [`src/scripts/analyze-benchmark.ts`](src/scripts/analyze-benchmark.ts)
