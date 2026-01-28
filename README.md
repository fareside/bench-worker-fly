# Bench Worker - x402 Payment Facilitator Benchmark

A benchmarking server and client for comparing payment settlement times across different x402 facilitators:

- **FareSide** (`https://fareside.com/`)
- **PayAI** (`https://payai.network`)
- **Coinbase** (official x402 facilitator)

## 🚀 Deployment on Fly.io

This server is designed to be deployed on [Fly.io](https://fly.io).

### Prerequisites

1. Install the Fly CLI: `brew install flyctl` (macOS) or see [Fly.io docs](https://fly.io/docs/hands-on/install-flyctl/)
2. Login: `fly auth login`

### Deploy

```bash
# First time deployment
fly launch

# Subsequent deployments
fly deploy
```

The server will be available at `https://bench-worker-fly.fly.dev` (or your custom domain).

## ⚙️ Environment Variables

### Server (for Fly.io deployment)

| Variable                        | Description                     | Required  |
|---------------------------------|---------------------------------|-----------|
| `FARESIDE_FACILITATOR_ENDPOINT` | Custom FareSide facilitator URL | Mandatory |

Set secrets on Fly.io:
```bash
fly secrets set FARESIDE_FACILITATOR_ENDPOINT=https://your-custom-endpoint.com
```

### Client (for running benchmarks)

| Variable | Description | Required |
|----------|-------------|----------|
| `EVM_BUYER_PRIVATE_KEY` | Private key for the EVM buyer wallet (hex format) | **Yes** (for Base) |
| `SOLANA_BUYER_PRIVATE_KEY` | Private key for the Solana buyer wallet (base58 format) | **Yes** (for Solana) |
| `SOLANA_RPC_URL` | Solana RPC endpoint URL | Optional |

## 📊 Benchmarking

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```env
   # For Base (EVM) benchmarks
   EVM_BUYER_PRIVATE_KEY=0x...
   
   # For Solana benchmarks
   SOLANA_BUYER_PRIVATE_KEY=...  # base58 format
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # optional
   ```

### Running Benchmarks

All benchmarks test facilitators **in parallel** for fair comparison under identical network conditions.

### Base Network (EVM)

Tests: FareSide, PayAI, Coinbase

#### 1. Pilot Study

```bash
npm run bench:pilot
```

**Cost**: ~$3.00 (30 requests × $0.10)

#### 2. Main Benchmark

```bash
npm run bench:main 30   # 30 samples (~$9.00)
npm run bench:main 50   # 50 samples (~$15.00)
```

### Solana Mainnet

Tests: FareSide, PayAI (Coinbase not supported on Solana)

#### 1. Pilot Study

```bash
npm run bench:solana:pilot
```

**Cost**: ~$0.20 (20 requests × $0.01)

#### 2. Main Benchmark

```bash
npm run bench:solana:main 30   # 30 samples (~$0.60)
npm run bench:solana:main 50   # 50 samples (~$1.00)
```

### Analyze Results

Analyze any CSV output with statistical tests:

```bash
npm run bench:analyze benchmark-pilot-*.csv
npm run bench:analyze benchmark-solana-pilot-*.csv
npm run bench:analyze benchmark-main-n30-*.csv
```

### Sample Size Guidelines

Based on pilot variance (CV = Coefficient of Variation):

| CV | Variance Level | Recommended Samples |
|----|----------------|---------------------|
| < 20% | Low | 30-50 |
| 20-50% | Medium | 50-100 |
| > 50% | High | 100+ |

## 📈 Output Format

Benchmarks output CSV files with the following columns:

```csv
timestamp,facilitator,network,sample_num,facilitation_ms,roundtrip_ms,success,error
```

| Column | Description |
|--------|-------------|
| `timestamp` | ISO 8601 timestamp when request was initiated |
| `facilitator` | FareSide, PayAI, or Coinbase |
| `network` | base (EVM network) |
| `sample_num` | Sample number within the benchmark run |
| `facilitation_ms` | Server-side facilitation time (payment settlement) |
| `roundtrip_ms` | Total client roundtrip time including network latency |
| `success` | Whether the request succeeded |
| `error` | Error message if failed |

## 🔬 Statistical Analysis

The analysis script provides:

- **Descriptive Statistics**: Mean, median, standard deviation, 95% confidence intervals
- **Pairwise Comparisons**: Welch's t-test for comparing facilitators
- **Sample Size Recommendations**: Based on observed variance
- **Ranking**: Facilitators ranked by mean facilitation time

### Example Output

```
RANKING (by mean facilitation time)
============================================================

Fastest to slowest:
  1. FareSide: 613.5ms (95% CI: [550.2, 676.8])
  2. Coinbase: 1682.8ms (95% CI: [800.1, 2565.5])
  3. PayAI: 2455.6ms (95% CI: [2151.6, 2759.6])
```

## 🏗️ Architecture

### Server Endpoints

| Endpoint | Facilitator | Network | Price |
|----------|-------------|---------|-------|
| `/fareside/base` | FareSide | Base (EVM) | $0.10 |
| `/payai/base` | PayAI | Base (EVM) | $0.10 |
| `/coinbase/base` | Coinbase | Base (EVM) | $0.10 |
| `/fareside/solana-mainnet` | FareSide | Solana | $0.01 |
| `/payai/solana-mainnet` | PayAI | Solana | $0.01 |
| `/coinbase/solana-mainnet` | Coinbase | Solana | $0.01 |

### Metrics

Each endpoint returns:

```json
{
  "elapsed": 234  // Server-side facilitation time in ms
}
```

The benchmark client also measures total roundtrip time including network latency.

## 📁 Project Structure

```
bench-worker-fly/
├── src/
│   ├── index.ts          # Main server with all endpoints
│   ├── fareside.ts       # FareSide facilitator config
│   ├── payai.ts          # PayAI facilitator config
│   ├── coinbase.ts       # Coinbase facilitator config
│   └── scripts/
│       ├── benchmark-pilot.ts         # Base network pilot study
│       ├── benchmark-main.ts          # Base network main benchmark
│       ├── benchmark-solana-pilot.ts  # Solana pilot study
│       ├── benchmark-solana-main.ts   # Solana main benchmark
│       ├── analyze-benchmark.ts       # Statistical analysis
│       ├── buyer-base.ts              # Base network buyer client
│       └── buyer-solana.ts            # Solana buyer client
├── plans/
│   └── benchmark-plan.md # Detailed methodology
├── fly.toml              # Fly.io configuration
├── Dockerfile            # Container configuration
└── package.json
```

## 🔧 Development

```bash
# Run locally
npm run dev

# Build
npm run build
```

## 📜 License

ISC
