import { Context, Hono, MiddlewareHandler } from "hono";
import * as fareside from './fareside.js'
import * as coinbase from "./coinbase.js";
import * as payai from "./payai.js";
import httpMocks from 'node-mocks-http'
import { x402Middleware } from "@stablecoin.xyz/x402/middleware/express";

const ROOT_APP = new Hono();

async function handler(c: Context, middleware: () => MiddlewareHandler) {
  const start = new Date().valueOf();
  const result = await middleware()(c, async () => {
    // Do Nothing
  });
  const end = new Date().valueOf();
  const time = end - start;
  if (result) {
    return result;
  }
  return c.json({
    elapsed: time,
  });
}

ROOT_APP.get("/fareside/solana-mainnet", async (c) => {
  return handler(c, fareside.solanaMainnet);
});

ROOT_APP.get("/fareside/base", async (c) => {
  return handler(c, fareside.base);
});

ROOT_APP.get("/fareside/base-sepolia", async (c) => {
  return handler(c, fareside.baseSepolia);
});

ROOT_APP.get("/fareside/radius-testnet", async (c) => {
  return handler(c, fareside.radiusTestnet);
})

ROOT_APP.get("/fareside/radius-mainnet-sbc", async (c) => {
  return handler(c, fareside.radiusMainnetSBC);
})

const mw = x402Middleware({ payTo: "0xfa3F54AE9C4287CA09a486dfaFaCe7d1d4095d93", amount: "1", network: "radius" })
ROOT_APP.get("/sbc-xyz/radius-mainnet-sbc", async (c) => {
  // @ts-expect-error
  const headers = Object.fromEntries(c.req.raw.headers.entries());
  const req = httpMocks.createRequest({
    headers,
    url: c.req.url,
  })
  const res = httpMocks.createResponse()
  const start = new Date().valueOf();
  await new Promise<void>(async (resolve, reject) => {
    await mw(req, res, () => {
      resolve()
    })
    resolve()
  })
  const elapsed = Date.now() - start;
  const resHeaders = res._getHeaders();
  for (const [key, value] of Object.entries(resHeaders)) {
    c.header(key, value as string)
  }
  c.status(res._getStatusCode())
  let resJSON: any;
  try {
    resJSON = res._getJSONData();
  } catch (e) {
    resJSON = null
  }
  if (resJSON) {
    return c.json(resJSON)
  }
  return c.json({"elapsed": elapsed})
})

ROOT_APP.get("/payai/solana-mainnet", async (c) => {
  return handler(c, payai.solanaMainnet);
});

ROOT_APP.get("/payai/base", async (c) => {
  return handler(c, payai.base);
});

ROOT_APP.get("/coinbase/solana-mainnet", async (c) => {
  return handler(c, coinbase.solanaMainnet);
});

ROOT_APP.get("/coinbase/base", async (c) => {
  return handler(c, coinbase.base);
});

ROOT_APP.get("/", async (c) => {
  return c.json({
    message: "Hello World",
  });
});

const port = process.env.PORT || 8080;

export default {
  port,
  fetch: ROOT_APP.fetch,
};
