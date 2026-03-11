import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";
import { base } from "viem/chains";

dotenv.config();

// Custom stablecoin.xyz

const ENDPOINT_BASE = new URL("http://localhost:8080")
const ENDPOINT_SBC = new URL("/sbc-xyz/base-sbc", ENDPOINT_BASE);

const EVM_BUYER_PRIVATE_KEY = process.env.EVM_BUYER_PRIVATE_KEY as unknown as undefined | `0x${string}`;
if (!EVM_BUYER_PRIVATE_KEY) {
  throw new Error("EVM_BUYER_PRIVATE_KEY is required");
}
const account = privateKeyToAccount(EVM_BUYER_PRIVATE_KEY);
console.log("Buyer address", account.address);

import {createX402Client, SignTypedDataParams, viemSignerAdapter} from "@stablecoin.xyz/x402/evm";
import { EvmSigner } from "@stablecoin.xyz/x402/evm";

console.log("account", account.address);

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const client = createX402Client({
  // @ts-expect-error Incompatible types w/ viem
  signer: viemSignerAdapter(walletClient),
  network: "base",
});

export async function doFetch(facilitator: string, endpoint: string) {
  const start = Date.now();
  const response = await client.fetch(endpoint, {
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

await doFetch("SBC-XYZ", "https://bench-worker-fly.fly.dev/sbc-xyz/base-sbc")