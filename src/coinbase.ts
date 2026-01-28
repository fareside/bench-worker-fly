import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { facilitator } from "@coinbase/x402";

const facilitatorClient = new HTTPFacilitatorClient(facilitator);

const resourceServer = new x402ResourceServer(
    facilitatorClient
  )
    .register("eip155:84532", new ExactEvmScheme())
    .register("eip155:8453", new ExactEvmScheme())
    .register("eip155:80002", new ExactEvmScheme())
    .register("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", new ExactSvmScheme())
    .register(
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      new ExactSvmScheme(),
    );

const solanaMainnet = () =>
  paymentMiddleware(
    {
      "GET /coinbase/solana-mainnet": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            payTo: "A9BXtyL9yJsmFkgQoPgdJEDuwuQRdPpGJRpyZffTTf7Z",
          },
        ],
        description: "Access to premium content",
      },
    },
    resourceServer
  );

const solanaDevnet = () =>
  paymentMiddleware(
    {
      "GET /coinbase/solana-devnet": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            payTo: "A9BXtyL9yJsmFkgQoPgdJEDuwuQRdPpGJRpyZffTTf7Z",
          },
        ],
        description: "Access to premium content",
      },
    },
    resourceServer,
  );

const base = () =>
  paymentMiddleware(
    {
      "GET /coinbase/base": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.10",
            network: "eip155:8453",
            payTo: "0xfa3F54AE9C4287CA09a486dfaFaCe7d1d4095d93",
          },
        ],
        description: "Access to premium content",
      },
    },
    resourceServer,
  );

export { base, solanaMainnet, solanaDevnet };