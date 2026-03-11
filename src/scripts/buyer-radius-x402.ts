// 1. FS proper x402
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import * as dotenv from "dotenv";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";

dotenv.config();

const ENDPOINT_X402 = new URL("/fareside/radius-mainnet-sbc", "https://bench-worker-fly.fly.dev/");

const EVM_BUYER_PRIVATE_KEY = process.env.EVM_BUYER_PRIVATE_KEY as unknown as undefined | `0x${string}`;
if (!EVM_BUYER_PRIVATE_KEY) {
  throw new Error("EVM_BUYER_PRIVATE_KEY is required");
}
const account = privateKeyToAccount(EVM_BUYER_PRIVATE_KEY);
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
console.log("Buyer address", account.address);

// Wrap the fetch function with payment handling
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:723", // Radius Mainnet
      client: new ExactEvmScheme(toClientEvmSigner(account, radiusMainnetPublicClient)),
    },
  ],
});

const response = await fetchWithPayment(ENDPOINT_X402.href, {
  method: "GET",
});
console.log("response", await response.text());