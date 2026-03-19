# clardex-sdk

SDK for swapping and providing liquidity on Clardex pools.

## Install

```bash
npm i clardex-sdk
```

## Usage (openContractCall)

```ts
import { openContractCall } from "@stacks/connect";
import {
  buildSwapCall,
  executeSwap,
  buildAddLiquidityCall,
  buildRemoveLiquidityCall,
} from "clardex-sdk";
import { AnchorMode, PostConditionMode } from "@stacks/transactions";

const swap = buildSwapCall({
  pool: { address: "SP...", name: "dex-pool-v5" },
  tokenX: { type: "sip10", contract: "SP...token-x" },
  tokenY: { type: "sip10", contract: "SP...token-y" },
  amountIn: 10,
  minOut: 9.5,
  recipient: "SP...user",
  deadline: 123456,
  direction: "x-to-y",
});

await openContractCall({
  ...swap,
  network,
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
});

// or use the helper
await executeSwap(openContractCall, {
  pool: { address: "SP...", name: "dex-pool-v5" },
  tokenX: { type: "sip10", contract: "SP...token-x" },
  tokenY: { type: "sip10", contract: "SP...token-y" },
  amountIn: 10,
  minOut: 9.5,
  recipient: "SP...user",
  deadline: 123456,
  direction: "x-to-y",
}, {
  network,
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
});
```

## Read-only helpers

```ts
import { createNetwork, STACKS_MAINNET } from "@stacks/network";
import { fetchQuoteXForY, fetchPoolState } from "clardex-sdk";

const network = createNetwork({
  ...STACKS_MAINNET,
  client: { baseUrl: "https://api.hiro.so" },
});

const pool = { address: "SP...", name: "dex-pool-v5" };
const sender = "SP...user";

const quote = await fetchQuoteXForY(network, pool, 1, sender);
const state = await fetchPoolState(network, pool, sender);
```

## Token metadata

```ts
import { fetchTokenInfo, validateSip10Token } from "clardex-sdk";

const info = await fetchTokenInfo("SP...token-x::token-x", { network: "mainnet" });
const validation = await validateSip10Token("SP...token-x::token-x", {
  network: "mainnet",
});
```

## API

- `buildSwapCall(params)`
- `executeSwap(openContractCall, params, options)`
- `buildAddLiquidityCall(params)`
- `buildRemoveLiquidityCall(params)`
- `buildQuoteXForYCall(pool, amountIn, decimals?)`
- `buildQuoteYForXCall(pool, amountIn, decimals?)`
- `buildGetReservesCall(pool)`
- `buildGetTotalSupplyCall(pool)`
- `fetchQuoteXForY(network, pool, amountIn, senderAddress, decimals?)`
- `fetchQuoteYForX(network, pool, amountIn, senderAddress, decimals?)`
- `fetchPoolState(network, pool, senderAddress, decimals?)`
- `fetchTokenInfo(id, opts?)`
- `fetchTokenMetadata(contractPrincipal, opts?)`
- `validateSip10Token(id, opts?)`
- `parseTokenId(id)`
- `getMetadataBaseUrl(opts?)`
- `buildTokenMetadataUrl(contractPrincipal, opts?)`

## License
MIT
