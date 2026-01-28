import { Context, Hono, MiddlewareHandler } from "hono";
import * as fareside from './fareside.js'
import * as coinbase from "./coinbase.js";
import * as payai from "./payai.js";

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
