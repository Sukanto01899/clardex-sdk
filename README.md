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
  buildSwapPostConditions,
  executeSwap,
  executeAddLiquidity,
  executeRemoveLiquidity,
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
  // Safety: cap what the sender can spend
  postConditions: buildSwapPostConditions({
    senderAddress: "SP...user",
    tokenIn: { type: "sip10", contract: "SP...token-x", asset: "token-x" },
    amountIn: 10,
    decimalsIn: 1_000_000,
  }),
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

await executeAddLiquidity(openContractCall, {
  pool: { address: "SP...", name: "dex-pool-v5" },
  tokenX: { type: "stx" },
  tokenY: { type: "sip10", contract: "SP...token-y" },
  amountX: 5,
  amountY: 100,
  minShares: 0,
  initializing: true,
}, {
  network,
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
});

await executeRemoveLiquidity(openContractCall, {
  pool: { address: "SP...", name: "dex-pool-v5" },
  tokenX: { type: "sip10", contract: "SP...token-x" },
  tokenY: { type: "sip10", contract: "SP...token-y" },
  shares: 10,
  minX: 0,
  minY: 0,
}, {
  network,
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
});
```

## Read-only helpers

```ts
import { createNetwork, STACKS_MAINNET } from "@stacks/network";
import { fetchQuoteXForY, fetchQuoteDetailed, fetchPoolState } from "clardex-sdk";

const network = createNetwork({
  ...STACKS_MAINNET,
  client: { baseUrl: "https://api.hiro.so" },
});

const pool = { address: "SP...", name: "dex-pool-v5" };
const sender = "SP...user";

const quote = await fetchQuoteXForY(network, pool, 1, sender);

const detailed = await fetchQuoteDetailed(network, {
  pool,
  amountIn: "1.0",
  senderAddress: sender,
  direction: "x-to-y",
  decimalsIn: 1_000_000,
  decimalsOut: 1_000_000,
  slippagePercent: 0.5,
});

// "Exact out" quoting (find the minimum input needed for a desired output)
// Note: requires a max input cap.
// const exactOut = await fetchQuoteExactOut(network, {
//   pool,
//   senderAddress: sender,
//   direction: "x-to-y",
//   desiredOut: "10",
//   maxAmountIn: "20",
//   decimalsIn: 1_000_000,
//   decimalsOut: 1_000_000,
// });
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
- `buildSwapPostConditions(params)`
- `executeSwap(openContractCall, params, options)`
- `executeAddLiquidity(openContractCall, params, options)`
- `executeRemoveLiquidity(openContractCall, params, options)`
- `buildAddLiquidityCall(params)`
- `buildAddLiquidityPostConditions(params)`
- `buildRemoveLiquidityCall(params)`
- `buildQuoteXForYCall(pool, amountIn, decimals?)`
- `buildQuoteYForXCall(pool, amountIn, decimals?)`
- `buildQuoteCall(pool, amountIn, direction, decimals?)`
- `buildQuoteCallFromMicro(pool, amountInMicro, direction)`
- `buildGetReservesCall(pool)`
- `buildGetTotalSupplyCall(pool)`
- `calculateMinOutMicro(expectedOutMicro, slippagePercent)`
- `fetchQuoteXForY(network, pool, amountIn, senderAddress, decimals?)`
- `fetchQuoteYForX(network, pool, amountIn, senderAddress, decimals?)`
- `fetchQuoteMicro(network, params)`
- `fetchQuoteMicroFromAmountInMicro(network, params)`
- `fetchQuote(network, params)`
- `fetchQuoteDetailed(network, params)`
- `findMinAmountInMicroForExactOut(opts)`
- `fetchQuoteExactOut(network, params)`
- `fetchPoolState(network, pool, senderAddress, decimals?)`
- `fetchPoolSnapshot(network, pool, senderAddress, decimals?)`
- `watchPoolSnapshot(network, pool, senderAddress, onSnapshot, opts?)`
- `fetchTokenInfo(id, opts?)`
- `fetchTokenMetadata(contractPrincipal, opts?)`
- `validateSip10Token(id, opts?)`
- `buildTokenInfoCacheKey(id, opts?)`
- `cacheTokenInfo(info, opts?)`
- `getCachedTokenInfo(id, opts?)`
- `getTokenMetadataCacheSize()`
- `clearTokenMetadataCache()`
- `parseTokenId(id)`
- `parseTokenIdStrict(id)`
- `buildTokenId(contractPrincipal, asset)`
- `isValidTokenId(id)`
- `parseContractPrincipal(contractPrincipal)`
- `buildContractPrincipal(address, name)`
- `isValidContractPrincipal(contractPrincipal)`
- `getMetadataBaseUrl(opts?)`
- `buildTokenMetadataUrl(contractPrincipal, opts?)`
- `toMicroAmount(amount, decimals)`
- `fromMicroAmount(amountMicro, decimals)`
- `estimatePriceImpactPercent(amountIn, reserveIn)`
- `suggestSlippagePercent(priceImpactPercent, opts?)`
- `suggestSplitCount(priceImpactPercent, targetImpactPercent?)`
- `calculateMinOut(expectedOut, slippagePercent)`
- `buildHiroTxUrl(txid, network?)`
- `buildHiroAddressUrl(address, network?)`
- `buildHiroContractUrl(contractPrincipal, network?)`
- `normalizePoolReserves(value, decimals?)`
- `normalizePoolTotalShares(value)`
- `normalizePoolState(reservesValue, totalSupplyValue, decimals?)`

## License
MIT
