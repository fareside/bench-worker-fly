// 1. FS proper x402
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import * as dotenv from "dotenv";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { createPublicClient, createWalletClient, defineChain, http, type Hex } from "viem";

dotenv.config();

const ENDPOINT_X402 = new URL("/fareside/radius-mainnet-sbc", "https://bench-worker-fly.fly.dev/");
const ENDPOINT_SBC = new URL("/sbc-xyz/radius-mainnet-sbc", "https://bench-worker-fly.fly.dev/");

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

// 2. Custom stablecoin.xyz
import {createX402Client, SignTypedDataParams, viemSignerAdapter} from "@stablecoin.xyz/x402/evm";
import { EvmSigner } from "@stablecoin.xyz/x402/evm";

console.log("account", account.address);

// const evmSigner: EvmSigner = {
//   address: account.address,
//   async signTypedData(params: SignTypedDataParams): Promise<Hex> {
//     console.log("signTypedData", params)
//     const result = await account.signTypedData(params as any)
//     return result
//   }
// };

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

const start = Date.now()
const res = await client.fetch(ENDPOINT_SBC.href)
const end = Date.now()

console.log(`Request took ${end - start}ms`)
const data = await res.json()
console.log("data", data)
// Payment metadata attached to the response
console.log("paymentResult", res.paymentResult)
// { success: true, txHash: '0x...', amountPaid: '1000000000000000', network: 'base' }
