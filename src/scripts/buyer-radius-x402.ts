// 1. FS proper x402
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import * as dotenv from "dotenv";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";

dotenv.config();

const N = undefined;
const ENDPOINT_X402 = new URL("/fareside/radius-mainnet-sbc", "https://bench-worker-fly.fly.dev/");

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
const fetchWithPayment = EVM_PRIVATE_KEYS.split(",").map(pk => {
  const account = privateKeyToAccount(pk as `0x${string}`);
  console.log("Buyer address", account.address);
  const f = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: "eip155:723", // Radius Mainnet
        client: new ExactEvmScheme(toClientEvmSigner(account, radiusMainnetPublicClient)),
      },
    ],
  });
  return async (...args: Parameters<typeof f>) => {
    console.log("Fetching with address", account.address);
    const r = await f(...args)
    console.log("Fetching with address", account.address, r.status, r.statusText);
    const paymentResponse = r.headers.get('payment-response')
    if (paymentResponse) {
      const r = Buffer.from(paymentResponse, 'base64').toString('utf-8')
      const j = JSON.parse(r)
      console.log("Payment response", j);
    }
    return r
  }
});

export async function doFetch(fetchWithPayment: typeof fetch, endpoint: string) {
  const start = Date.now();
  const response = await fetchWithPayment(endpoint, {
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
  // console.log(`${facilitator}: facilitation`, elapsed);
  // console.log(`${facilitator}: roundtrip`, end - start);
  return {
    facilitation: elapsed,
    roundtrip: end - start,
  }
}


const promises = fetchWithPayment.slice(0, N).map(async f => {
  return doFetch(f, ENDPOINT_X402.href)
})
const p2 = await Promise.all(promises)
p2.forEach(p => {
  console.log(p);
})