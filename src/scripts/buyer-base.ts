import * as dotenv from "dotenv";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

dotenv.config();

// Create a wallet client (using your private key)
const EVM_BUYER_PRIVATE_KEY = process.env.EVM_BUYER_PRIVATE_KEY as unknown as undefined | `0x${string}`;
if (!EVM_BUYER_PRIVATE_KEY) {
  throw new Error("EVM_BUYER_PRIVATE_KEY is required");
}
const account = privateKeyToAccount(EVM_BUYER_PRIVATE_KEY);

console.log("address", account.address);

// Wrap the fetch function with payment handling
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453", // Base
      client: new ExactEvmScheme(account),
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

await doFetch("FareSide", "https://bench-worker-fly.fly.dev/fareside/base")
await doFetch("PayAI", "https://bench-worker-fly.fly.dev/payai/base")
await doFetch("Coinbase", "https://bench-worker-fly.fly.dev/coinbase/base")