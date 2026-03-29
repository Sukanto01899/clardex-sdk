import {
  buildAddLiquidityCall,
  buildRemoveLiquidityCall,
  buildSwapCall,
  buildQuoteXForYCall,
  buildQuoteYForXCall,
  buildQuoteCall,
  buildGetReservesCall,
  buildGetTotalSupplyCall,
  buildPoolSnapshotCalls,
  parseTokenId,
  buildTokenMetadataUrl,
  getMetadataBaseUrl,
  getApiBaseUrl,
  estimatePriceImpactPercent,
  suggestSlippagePercent,
  suggestSplitCount,
  calculateMinOut,
  calculateMinOutMicro,
  buildHiroTxUrl,
  buildHiroAddressUrl,
  buildHiroContractUrl,
  toMicroAmount,
  fromMicroAmount,
  parseContractPrincipal,
  buildContractPrincipal,
  isValidContractPrincipal,
  parseTokenIdStrict,
  buildTokenId,
  isValidTokenId,
  buildTokenInfoCacheKey,
  cacheTokenInfo,
  clearTokenMetadataCache,
  getCachedTokenInfo,
  getTokenMetadataCacheSize,
  normalizePoolReserves,
  normalizePoolState,
} from "../src/index";
import { cvToValue } from "@stacks/transactions";

const unwrapUint = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.floor(value));
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value === "object" && "value" in value) {
    return unwrapUint((value as { value?: unknown }).value);
  }
  return 0n;
};

describe("clardex-sdk builders", () => {
  const pool = { address: "SP000000000000000000002Q6VF78", name: "dex-pool-v5" };
  const sipToken = { type: "sip10" as const, contract: "SP000000000000000000002Q6VF78.token-x" };
  const stxToken = { type: "stx" as const };

  it("builds swap call", () => {
    const call = buildSwapCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      amountIn: 1,
      minOut: 0.9,
      recipient: "SP000000000000000000002Q6VF78",
      deadline: 123,
      direction: "x-to-y",
    });
    expect(call.functionName).toBe("swap-x-for-y");
    expect(call.functionArgs).toHaveLength(6);
  });

  it("builds swap call with per-token decimals", () => {
    const call = buildSwapCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      amountIn: 1,
      minOut: 2,
      recipient: "SP000000000000000000002Q6VF78",
      deadline: 123,
      direction: "x-to-y",
      decimalsIn: 1_000_000,
      decimalsOut: 100_000_000,
    });
    const amountIn = unwrapUint(cvToValue(call.functionArgs[2] as never));
    const minOut = unwrapUint(cvToValue(call.functionArgs[3] as never));
    expect(amountIn).toBe(1_000_000n);
    expect(minOut).toBe(200_000_000n);
  });

  it("builds swap call with string amounts", () => {
    const call = buildSwapCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      amountIn: "1.25",
      minOut: "0.5",
      recipient: "SP000000000000000000002Q6VF78",
      deadline: 123,
      direction: "x-to-y",
      decimalsIn: 1_000_000,
      decimalsOut: 1_000_000,
    });
    const amountIn = unwrapUint(cvToValue(call.functionArgs[2] as never));
    const minOut = unwrapUint(cvToValue(call.functionArgs[3] as never));
    expect(amountIn).toBe(1_250_000n);
    expect(minOut).toBe(500_000n);
  });

  it("builds add liquidity init call", () => {
    const call = buildAddLiquidityCall({
      pool,
      tokenX: stxToken,
      tokenY: sipToken,
      amountX: 1,
      amountY: 2,
      minShares: 0,
      initializing: true,
    });
    expect(call.functionName).toBe("initialize-pool");
    expect(call.functionArgs).toHaveLength(6);
  });

  it("builds add liquidity call", () => {
    const call = buildAddLiquidityCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      amountX: 1,
      amountY: 2,
      minShares: 0,
      initializing: false,
    });
    expect(call.functionName).toBe("add-liquidity");
    expect(call.functionArgs).toHaveLength(5);
  });

  it("builds add liquidity call with per-token decimals", () => {
    const call = buildAddLiquidityCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      amountX: 1,
      amountY: 2,
      minShares: 0,
      initializing: false,
      decimalsX: 1_000_000,
      decimalsY: 100_000_000,
    });
    const amountX = unwrapUint(cvToValue(call.functionArgs[2] as never));
    const amountY = unwrapUint(cvToValue(call.functionArgs[3] as never));
    expect(amountX).toBe(1_000_000n);
    expect(amountY).toBe(200_000_000n);
  });

  it("builds remove liquidity call with string mins", () => {
    const call = buildRemoveLiquidityCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      shares: 10,
      minX: "1.5",
      minY: "2",
      decimalsX: 1_000_000,
      decimalsY: 1_000_000,
    });
    const minX = unwrapUint(cvToValue(call.functionArgs[3] as never));
    const minY = unwrapUint(cvToValue(call.functionArgs[4] as never));
    expect(minX).toBe(1_500_000n);
    expect(minY).toBe(2_000_000n);
  });

  it("builds remove liquidity call", () => {
    const call = buildRemoveLiquidityCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      shares: 10,
      minX: 0,
      minY: 0,
    });
    expect(call.functionName).toBe("remove-liquidity");
    expect(call.functionArgs).toHaveLength(5);
  });

  it("builds remove liquidity call with per-token decimals", () => {
    const call = buildRemoveLiquidityCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      shares: 10,
      minX: 1,
      minY: 2,
      decimalsX: 1_000_000,
      decimalsY: 100_000_000,
    });
    const minX = unwrapUint(cvToValue(call.functionArgs[3] as never));
    const minY = unwrapUint(cvToValue(call.functionArgs[4] as never));
    expect(minX).toBe(1_000_000n);
    expect(minY).toBe(200_000_000n);
  });

  it("builds quote calls", () => {
    const qx = buildQuoteXForYCall(pool, 1);
    const qy = buildQuoteYForXCall(pool, 1);
    const qa = buildQuoteCall(pool, 1, "x-to-y");
    const qb = buildQuoteCall(pool, 1, "y-to-x");
    expect(qx.functionName).toBe("quote-x-for-y");
    expect(qy.functionName).toBe("quote-y-for-x");
    expect(qa.functionName).toBe("quote-x-for-y");
    expect(qb.functionName).toBe("quote-y-for-x");
  });

  it("builds pool info calls", () => {
    const reserves = buildGetReservesCall(pool);
    const supply = buildGetTotalSupplyCall(pool);
    expect(reserves.functionName).toBe("get-reserves");
    expect(supply.functionName).toBe("get-total-supply");
  });

  it("builds pool snapshot calls", () => {
    const snapshot = buildPoolSnapshotCalls(pool);
    expect(snapshot.reserves.functionName).toBe("get-reserves");
    expect(snapshot.totalSupply.functionName).toBe("get-total-supply");
  });

  it("swap args are clarity values", () => {
    const call = buildSwapCall({
      pool,
      tokenX: sipToken,
      tokenY: sipToken,
      amountIn: 1,
      minOut: 0.9,
      recipient: "SP000000000000000000002Q6VF78",
      deadline: 123,
      direction: "x-to-y",
    });
    const values = call.functionArgs.map((arg) => cvToValue(arg as never));
    expect(values.length).toBe(6);
  });

  it("parses token ids", () => {
    const parsed = parseTokenId("SP000000000000000000002Q6VF78.token-x::token-x");
    expect(parsed.contract).toBe("SP000000000000000000002Q6VF78.token-x");
    expect(parsed.asset).toBe("token-x");
  });

  it("builds metadata url", () => {
    const base = getMetadataBaseUrl({ network: "testnet" });
    const url = buildTokenMetadataUrl("SP000000000000000000002Q6VF78.token-x", {
      network: "testnet",
    });
    expect(url).toContain(base);
  });

  it("builds api base url", () => {
    const base = getApiBaseUrl({ network: "testnet" });
    expect(base).toContain("testnet");
  });
});

describe("clardex-sdk swap helpers", () => {
  it("estimates price impact as amount/reserve", () => {
    expect(estimatePriceImpactPercent(5, 100)).toBeCloseTo(5, 8);
    expect(estimatePriceImpactPercent(0, 100)).toBe(0);
    expect(estimatePriceImpactPercent(5, 0)).toBe(0);
  });

  it("suggests slippage similar to the app defaults", () => {
    expect(suggestSlippagePercent(0)).toBe(0.5);
    expect(suggestSlippagePercent(10)).toBe(2.3);
    expect(suggestSlippagePercent(50)).toBe(3);
  });

  it("suggests split counts for high impact swaps", () => {
    expect(suggestSplitCount(0, 5)).toBe(1);
    expect(suggestSplitCount(6, 5)).toBe(2);
    expect(suggestSplitCount(12, 5)).toBe(3);
  });

  it("calculates minimum received from slippage", () => {
    expect(calculateMinOut(100, 1)).toBeCloseTo(99, 8);
    expect(calculateMinOut(100, 0)).toBe(100);
    expect(calculateMinOut(100, 250)).toBe(0);
  });

  it("calculates minimum received in micro units", () => {
    expect(calculateMinOutMicro(100_000_000n, 1)).toBe(99_000_000n);
    expect(calculateMinOutMicro(100_000_000n, 0)).toBe(100_000_000n);
    expect(calculateMinOutMicro(100_000_000n, 250)).toBe(0n);
  });

  it("builds Hiro explorer links", () => {
    expect(buildHiroTxUrl("0xabc", "testnet")).toBe(
      "https://explorer.hiro.so/txid/0xabc?chain=testnet",
    );
    expect(buildHiroAddressUrl("SP123", "mainnet")).toBe(
      "https://explorer.hiro.so/address/SP123?chain=mainnet",
    );
    expect(
      buildHiroContractUrl("SP000000000000000000002Q6VF78.dex-pool-v5", "mainnet"),
    ).toBe(
      "https://explorer.hiro.so/contract/SP000000000000000000002Q6VF78/dex-pool-v5?chain=mainnet",
    );
  });

  it("converts amounts to and from micro units", () => {
    expect(toMicroAmount(1.25, 1_000_000)).toBe(1_250_000n);
    expect(toMicroAmount("1.25", 1_000_000)).toBe(1_250_000n);
    expect(toMicroAmount(2n, 1_000_000)).toBe(2_000_000n);
    expect(fromMicroAmount(1_250_000n, 1_000_000)).toBeCloseTo(1.25, 8);
    expect(() => toMicroAmount("1.2", 3)).toThrow();
  });

  it("parses and builds contract principals", () => {
    expect(parseContractPrincipal("SP123.dex")).toEqual({ address: "SP123", name: "dex" });
    expect(buildContractPrincipal("SP123", "dex")).toBe("SP123.dex");
    expect(isValidContractPrincipal("SP123.dex")).toBe(true);
    expect(isValidContractPrincipal("SP123")).toBe(false);
  });

  it("parses and builds token ids", () => {
    expect(parseTokenIdStrict("SP123.dex::token")).toEqual({
      contract: "SP123.dex",
      asset: "token",
    });
    expect(buildTokenId("SP123.dex", "token")).toBe("SP123.dex::token");
    expect(isValidTokenId("SP123.dex::token")).toBe(true);
    expect(isValidTokenId("STX")).toBe(false);
  });

  it("manages token metadata cache entries", () => {
    clearTokenMetadataCache();
    expect(getTokenMetadataCacheSize()).toBe(0);

    const key = buildTokenInfoCacheKey("STX", { network: "testnet" });
    expect(key).toContain("testnet");

    cacheTokenInfo(
      {
        id: "STX",
        contract: "",
        asset: "STX",
        name: "Stacks",
        symbol: "STX",
        image: null,
        verified: true,
        isStx: true,
      },
      { network: "testnet", fetchedAt: Date.now() - 1000 },
    );

    expect(getTokenMetadataCacheSize()).toBe(1);
    expect(getCachedTokenInfo("STX", { network: "testnet" })?.symbol).toBe("STX");
    expect(getCachedTokenInfo("STX", { network: "testnet", cacheTtlMs: 1 })).toBe(
      null,
    );
    expect(getTokenMetadataCacheSize()).toBe(0);
  });

  it("normalizes pool reserve values", () => {
    expect(
      normalizePoolReserves({ "reserve-x": 2_000_000, "reserve-y": 3_000_000 }, 1_000_000),
    ).toEqual({ reserveX: 2, reserveY: 3 });
    expect(normalizePoolState({ x: "1000000", y: "500000" }, 123, 1_000_000)).toEqual({
      reserveX: 1,
      reserveY: 0.5,
      totalShares: 123,
    });
  });
});
