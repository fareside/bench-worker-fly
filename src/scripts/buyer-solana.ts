import * as dotenv from "dotenv";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm";

dotenv.config();

// Create a wallet client (using your private key)
const SOLANA_BUYER_PRIVATE_KEY = process.env.SOLANA_BUYER_PRIVATE_KEY as unknown as undefined | string;
if (!SOLANA_BUYER_PRIVATE_KEY) {
  throw new Error("SOLANA_BUYER_PRIVATE_KEY is required");
}
const signer = await createKeyPairSignerFromBytes(base58.decode(SOLANA_BUYER_PRIVATE_KEY));

console.log("address", signer.address);

// Wrap the fetch function with payment handling
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

export async function doFetch(facilitator: string, endpoint: string) {
  const start = Date.now();
  const response = await fetchWithPayment(endpoint, {
    method: "GET",
  });
  const json = await response.json();
  const end = Date.now();
  const elapsed = (json as {elapsed: number}).elapsed;
  console.log(`${facilitator}: facilitation`, elapsed);
  console.log(`${facilitator}: roundtrip`, end - start);
  return {
    facilitation: elapsed,
    roundtrip: end - start,
  }
}

await doFetch("PayAI", "https://bench-worker-fly.fly.dev/payai/solana-mainnet")
await doFetch("FareSide", "https://bench-worker-fly.fly.dev/fareside/solana-mainnet")
// await doFetch("Coinbase", "https://bench-worker-fly.fly.dev/coinbase/solana-mainnet")