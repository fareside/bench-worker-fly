import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import {createX402Client, viemSignerAdapter} from "@stablecoin.xyz/x402/evm";

dotenv.config();

// Custom stablecoin.xyz

const N = 2; // Enough to trip the facilitator.

const ENDPOINT_SBC = "https://bench-worker-fly.fly.dev/sbc-xyz/radius-mainnet-sbc";

const RADIUS_HTTP = "https://rpc.radiustech.xyz/"
const radius = defineChain({
  id: 723,
  name: "Radius",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RADIUS_HTTP] },
  },
});
const radiusMainnetPublicClient = createPublicClient({
  chain: radius,
  transport: http(),
});

const EVM_PRIVATE_KEYS = process.env.EVM_PRIVATE_KEYS as unknown as undefined | string;
if (!EVM_PRIVATE_KEYS) {
  throw new Error("EVM_PRIVATE_KEYS is required");
}

const clients = EVM_PRIVATE_KEYS.split(",").map(pk => {
  const account = privateKeyToAccount(pk as `0x${string}`);
  console.log("Buyer address", account.address);

  const walletClient = createWalletClient({
    account,
    chain: radius,
    transport: http(RADIUS_HTTP),
  });

  const client = createX402Client({
    // @ts-expect-error Incompatible types w/ viem
    signer: viemSignerAdapter(walletClient),
    network: "radius",
    rpcUrl: RADIUS_HTTP,
  });

  return { account, client };
});

export async function doFetch(client: ReturnType<typeof createX402Client>, endpoint: string) {
  const start = Date.now();
  const response = await client.fetch(endpoint, {
    method: "GET",
  });
  if (response.status !== 200) {
    const text = await response.text();
    console.log("Error Received: ", text);
    return {
      facilitation: 0,
      roundtrip: 0,
    }
  }
  const json = await response.json();
  const end = Date.now();
  const elapsed = (json as {elapsed: number}).elapsed;
  return {
    facilitation: elapsed,
    roundtrip: end - start,
  }
}

const promises = clients.slice(0, N).map(async ({ account, client }) => {
  console.log("Fetching with address", account.address);
  return doFetch(client, ENDPOINT_SBC);
});

const p2 = await Promise.all(promises);
p2.forEach(p => {
  console.log(p);
});
