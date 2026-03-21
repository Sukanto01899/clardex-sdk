import {
  buildAddLiquidityCall,
  buildRemoveLiquidityCall,
  buildSwapCall,
  buildQuoteXForYCall,
  buildQuoteYForXCall,
  buildGetReservesCall,
  buildGetTotalSupplyCall,
  buildPoolSnapshotCalls,
  parseTokenId,
  buildTokenMetadataUrl,
  getMetadataBaseUrl,
  getApiBaseUrl,
} from "../src/index";
import { cvToValue } from "@stacks/transactions";

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

  it("builds quote calls", () => {
    const qx = buildQuoteXForYCall(pool, 1);
    const qy = buildQuoteYForXCall(pool, 1);
    expect(qx.functionName).toBe("quote-x-for-y");
    expect(qy.functionName).toBe("quote-y-for-x");
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
