import {
  AnchorMode,
  PostConditionMode,
  boolCV,
  contractPrincipalCV,
  fetchCallReadOnlyFunction,
  noneCV,
  someCV,
  standardPrincipalCV,
  uintCV,
  cvToValue,
  type ClarityValue,
} from "@stacks/transactions";
import type { StacksNetwork } from "@stacks/network";

export type Network = "mainnet" | "testnet";

export type PoolContract = {
  address: string;
  name: string;
};

export type TokenRef =
  | { type: "stx" }
  | { type: "sip10"; contract: string };

export type SwapParams = {
  pool: PoolContract;
  tokenX: TokenRef;
  tokenY: TokenRef;
  amountIn: number | string | bigint;
  minOut: number | string | bigint;
  recipient: string;
  deadline: number;
  direction: "x-to-y" | "y-to-x";
  decimals?: number;
  decimalsIn?: number;
  decimalsOut?: number;
};

export type AddLiquidityParams = {
  pool: PoolContract;
  tokenX: TokenRef;
  tokenY: TokenRef;
  amountX: number | string | bigint;
  amountY: number | string | bigint;
  minShares: number;
  initializing: boolean;
  decimals?: number;
  decimalsX?: number;
  decimalsY?: number;
};

export type RemoveLiquidityParams = {
  pool: PoolContract;
  tokenX: TokenRef;
  tokenY: TokenRef;
  shares: number;
  minX: number | string | bigint;
  minY: number | string | bigint;
  decimals?: number;
  decimalsX?: number;
  decimalsY?: number;
};

export type ContractCall = {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
};

export type SwapExecutionOptions = {
  network: StacksNetwork;
  anchorMode: AnchorMode;
  postConditionMode: PostConditionMode;
  onFinish?: (payload: { txId: string }) => void;
  onCancel?: () => void;
};

export type OpenContractCall = (
  options: ContractCall & SwapExecutionOptions,
) => Promise<unknown>;

export type QuoteResult = {
  amountOut: number;
  fee: number;
};

export type PoolState = {
  reserveX: number;
  reserveY: number;
  totalShares: number;
};

export type TokenMetadata = {
  id: string;
  contract: string;
  asset: string;
  name?: string;
  symbol?: string;
  image?: string | null;
  verified: boolean;
  isStx: boolean;
  error?: string;
};

export type TokenMetadataOptions = {
  network?: Network;
  metadataBaseUrl?: string;
  apiBaseUrl?: string;
  cacheTtlMs?: number;
  fetcher?: typeof fetch;
};

const DEFAULT_DECIMALS = 1_000_000;
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

const API_BY_NETWORK: Record<Network, string> = {
  mainnet: "https://api.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

export const buildHiroTxUrl = (txid: string, network: Network = "mainnet") =>
  `https://explorer.hiro.so/txid/${txid}?chain=${network}`;

export const buildHiroContractUrl = (
  contractPrincipal: string,
  network: Network = "mainnet",
) => {
  const [address, name] = contractPrincipal.split(".");
  if (!address || !name) {
    throw new Error("Invalid contract principal. Expected address.contract");
  }
  return `https://explorer.hiro.so/contract/${address}/${name}?chain=${network}`;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const estimatePriceImpactPercent = (
  amountIn: number,
  reserveIn: number,
) => {
  const amount = Number(amountIn);
  const reserve = Number(reserveIn);
  if (!Number.isFinite(amount) || !Number.isFinite(reserve)) return 0;
  if (amount <= 0 || reserve <= 0) return 0;
  return (amount / reserve) * 100;
};

export type SlippageSuggestionOptions = {
  fallbackPct?: number;
  basePct?: number;
  impactMultiplier?: number;
  minPct?: number;
  maxPct?: number;
  stepPct?: number;
};

export const suggestSlippagePercent = (
  priceImpactPercent: number,
  opts: SlippageSuggestionOptions = {},
) => {
  const impact = Number(priceImpactPercent);
  const fallbackPct = opts.fallbackPct ?? 0.5;
  if (!Number.isFinite(impact) || impact <= 0) return fallbackPct;

  const basePct = opts.basePct ?? 0.3;
  const impactMultiplier = opts.impactMultiplier ?? 0.2;
  const minPct = opts.minPct ?? 0.1;
  const maxPct = opts.maxPct ?? 3;
  const stepPct = opts.stepPct ?? 0.1;

  const raw = clampNumber(basePct + impact * impactMultiplier, minPct, maxPct);
  if (!Number.isFinite(stepPct) || stepPct <= 0) {
    return Math.round(raw * 10) / 10;
  }
  const rounded = Math.round(raw / stepPct) * stepPct;
  return Math.round(rounded * 1000) / 1000;
};

export const suggestSplitCount = (
  priceImpactPercent: number,
  targetImpactPercent = 5,
) => {
  const impact = Number(priceImpactPercent);
  const target = Number(targetImpactPercent);
  if (!Number.isFinite(impact) || impact <= 0) return 1;
  if (!Number.isFinite(target) || target <= 0) return 1;
  if (impact <= target) return 1;
  return Math.max(2, Math.ceil(impact / target));
};

export const calculateMinOut = (
  expectedOut: number,
  slippagePercent: number,
) => {
  const out = Number(expectedOut);
  const slip = Number(slippagePercent);
  if (!Number.isFinite(out) || out <= 0) return 0;
  if (!Number.isFinite(slip) || slip <= 0) return out;
  const ratio = clampNumber(slip / 100, 0, 1);
  return out * (1 - ratio);
};

const metadataCache = new Map<
  string,
  { info: TokenMetadata; fetchedAt: number }
>();

const tokenToOptionalCv = (token: TokenRef) => {
  if (token.type === "stx") return noneCV();
  const [address, contractName] = token.contract.split(".");
  if (!address || !contractName) {
    throw new Error("Invalid token contract format. Expected address.contract");
  }
  return someCV(contractPrincipalCV(address, contractName));
};

export const parseTokenId = (id: string) => {
  const [contract, asset] = id.split("::");
  return { contract, asset };
};

export const getMetadataBaseUrl = (opts: TokenMetadataOptions = {}) => {
  if (opts.metadataBaseUrl) return opts.metadataBaseUrl;
  const network = opts.network ?? "mainnet";
  return API_BY_NETWORK[network];
};

export const getApiBaseUrl = (opts: TokenMetadataOptions = {}) => {
  if (opts.apiBaseUrl) return opts.apiBaseUrl;
  const network = opts.network ?? "mainnet";
  return API_BY_NETWORK[network];
};

export const buildTokenMetadataUrl = (
  contractPrincipal: string,
  opts: TokenMetadataOptions = {},
) => `${getMetadataBaseUrl(opts)}/metadata/v1/ft/${contractPrincipal}`;

const getFetch = (opts: TokenMetadataOptions = {}) => {
  if (opts.fetcher) return opts.fetcher;
  if (typeof fetch !== "undefined") return fetch;
  throw new Error("No fetch implementation available. Provide opts.fetcher.");
};

const toMicro = (amount: number | string | bigint, decimals: number) => {
  const decimalsInt = Math.floor(decimals);
  if (!Number.isFinite(decimalsInt) || decimalsInt <= 0) {
    throw new Error("Invalid decimals value.");
  }
  if (typeof amount === "bigint") {
    return amount * BigInt(decimalsInt);
  }
  if (typeof amount === "number") {
    return BigInt(Math.floor(amount * decimalsInt));
  }
  if (typeof amount !== "string") {
    throw new Error("Invalid amount type.");
  }
  const trimmed = amount.trim();
  if (!trimmed) throw new Error("Amount string is empty.");
  const sign = trimmed.startsWith("-") ? -1n : 1n;
  const numeric = trimmed.replace(/^[-+]/, "");
  if (!/^\d+(\.\d+)?$/.test(numeric)) {
    throw new Error("Invalid decimal string.");
  }
  const [wholeRaw, fracRaw = ""] = numeric.split(".");
  const precision = Math.round(Math.log10(decimalsInt));
  if (10 ** precision !== decimalsInt) {
    throw new Error("String amounts require power-of-10 decimals.");
  }
  const fracPadded = `${fracRaw}000000000000000000`.slice(0, precision);
  const whole = BigInt(wholeRaw || "0");
  const frac = BigInt(fracPadded || "0");
  return sign * (whole * BigInt(decimalsInt) + frac);
};

const parseClarityNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object") {
    const record = value as { value?: unknown };
    if ("value" in record) return parseClarityNumber(record.value);
  }
  return 0;
};

const unwrapReadOnlyOk = (raw: unknown) => {
  const parsed = cvToValue(raw as never) as {
    value?: unknown;
    success?: boolean;
    type?: string;
  };
  if (parsed && typeof parsed === "object") {
    if ("success" in parsed) {
      if (!parsed.success) {
        throw new Error(
          `Read-only call failed: ${String(
            (parsed as { value?: unknown }).value ?? "",
          )}`,
        );
      }
      return (parsed as { value?: unknown }).value;
    }
    if ("type" in parsed && parsed.type === "ok") {
      return parsed.value;
    }
  }
  return parsed;
};

export const fetchTokenMetadata = async (
  contractPrincipal: string,
  opts: TokenMetadataOptions = {},
) => {
  const url = buildTokenMetadataUrl(contractPrincipal, opts);
  const fetcher = getFetch(opts);
  const res = await fetcher(url);
  if (!res.ok) {
    throw new Error(`Metadata not found (${res.status})`);
  }
  return (await res.json()) as {
    name?: string;
    symbol?: string;
    image_uri?: string;
    image_thumbnail_uri?: string;
    metadata?: { cached_image?: string; cached_thumbnail_image?: string };
  };
};

export const validateSip10Token = async (
  id: string,
  opts: TokenMetadataOptions = {},
) => {
  if (!id.includes("::")) {
    return { ok: false, message: "Token must be contract::asset format." };
  }
  const { contract, asset } = parseTokenId(id);
  if (!contract || !asset) {
    return { ok: false, message: "Invalid token identifier." };
  }
  const [address, contractName] = contract.split(".");
  if (!address || !contractName) {
    return { ok: false, message: "Invalid contract identifier." };
  }
  const fetcher = getFetch(opts);
  const res = await fetcher(
    `${getApiBaseUrl(opts)}/v2/contracts/interface/${address}/${contractName}`,
  );
  if (!res.ok) {
    return { ok: false, message: "Contract interface not found." };
  }
  const data = (await res.json()) as {
    functions?: { name?: string }[];
    fungible_tokens?: Array<Record<string, unknown>>;
  };
  const functions = Array.isArray(data?.functions) ? data.functions : [];
  const required = ["transfer", "get-balance", "get-total-supply"];
  const hasAll = required.every((fn) =>
    functions.some((f) => f?.name === fn),
  );
  if (!hasAll) {
    return { ok: false, message: "Missing SIP-010 functions." };
  }
  const fts = Array.isArray(data?.fungible_tokens) ? data.fungible_tokens : [];
  if (fts.length > 0) {
    const matches = fts.some((token) => {
      const name = token?.name;
      const symbol = token?.symbol;
      const tokenField = token?.token;
      const assetId = token?.asset_identifier;
      if (typeof name === "string" && name === asset) return true;
      if (typeof symbol === "string" && symbol === asset) return true;
      if (typeof tokenField === "string" && tokenField === asset) return true;
      if (typeof assetId === "string" && assetId.endsWith(`::${asset}`)) {
        return true;
      }
      return false;
    });
    if (!matches) {
      return { ok: false, message: "Asset not found in contract." };
    }
  }
  return { ok: true as const };
};

export const fetchTokenInfo = async (
  id: string,
  opts: TokenMetadataOptions = {},
): Promise<TokenMetadata> => {
  const cacheKey = `${getMetadataBaseUrl(opts)}:${id}`;
  const ttl = opts.cacheTtlMs ?? DEFAULT_TTL;
  const cached = metadataCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return cached.info;
  }

  if (id === "STX") {
    const info: TokenMetadata = {
      id,
      contract: "",
      asset: "STX",
      name: "Stacks",
      symbol: "STX",
      image: null,
      verified: true,
      isStx: true,
    };
    metadataCache.set(cacheKey, { info, fetchedAt: Date.now() });
    return info;
  }

  if (!id.includes("::")) {
    return {
      id,
      contract: "",
      asset: "",
      verified: false,
      isStx: false,
      error: "Token id must be contract::asset",
    };
  }

  const { contract, asset } = parseTokenId(id);
  try {
    const data = await fetchTokenMetadata(contract, opts);
    const info: TokenMetadata = {
      id,
      contract,
      asset,
      name: data?.name,
      symbol: data?.symbol,
      image:
        data?.image_thumbnail_uri ||
        data?.image_uri ||
        data?.metadata?.cached_thumbnail_image ||
        data?.metadata?.cached_image ||
        null,
      verified: true,
      isStx: false,
    };
    metadataCache.set(cacheKey, { info, fetchedAt: Date.now() });
    return info;
  } catch (error) {
    return {
      id,
      contract,
      asset,
      verified: false,
      isStx: false,
      error: error instanceof Error ? error.message : "Metadata fetch failed",
    };
  }
};

export const buildSwapCall = (params: SwapParams): ContractCall => {
  const decimalsIn = params.decimalsIn ?? params.decimals ?? DEFAULT_DECIMALS;
  const decimalsOut = params.decimalsOut ?? params.decimals ?? DEFAULT_DECIMALS;
  const functionName =
    params.direction === "x-to-y" ? "swap-x-for-y" : "swap-y-for-x";
  const amountMicro = toMicro(params.amountIn, decimalsIn);
  const minOutMicro = toMicro(params.minOut, decimalsOut);
  return {
    contractAddress: params.pool.address,
    contractName: params.pool.name,
    functionName,
    functionArgs: [
      tokenToOptionalCv(params.tokenX),
      tokenToOptionalCv(params.tokenY),
      uintCV(amountMicro),
      uintCV(minOutMicro),
      standardPrincipalCV(params.recipient),
      uintCV(BigInt(params.deadline)),
    ],
  };
};

export const executeSwap = async (
  openContractCall: OpenContractCall,
  params: SwapParams,
  options: SwapExecutionOptions,
) => {
  const call = buildSwapCall(params);
  return openContractCall({
    ...call,
    ...options,
  });
};

export const executeAddLiquidity = async (
  openContractCall: OpenContractCall,
  params: AddLiquidityParams,
  options: SwapExecutionOptions,
) => {
  const call = buildAddLiquidityCall(params);
  return openContractCall({
    ...call,
    ...options,
  });
};

export const executeRemoveLiquidity = async (
  openContractCall: OpenContractCall,
  params: RemoveLiquidityParams,
  options: SwapExecutionOptions,
) => {
  const call = buildRemoveLiquidityCall(params);
  return openContractCall({
    ...call,
    ...options,
  });
};

export const buildAddLiquidityCall = (
  params: AddLiquidityParams,
): ContractCall => {
  const decimalsX = params.decimalsX ?? params.decimals ?? DEFAULT_DECIMALS;
  const decimalsY = params.decimalsY ?? params.decimals ?? DEFAULT_DECIMALS;
  const amountXMicro = toMicro(params.amountX, decimalsX);
  const amountYMicro = toMicro(params.amountY, decimalsY);
  if (params.initializing) {
    return {
      contractAddress: params.pool.address,
      contractName: params.pool.name,
      functionName: "initialize-pool",
      functionArgs: [
        tokenToOptionalCv(params.tokenX),
        tokenToOptionalCv(params.tokenY),
        boolCV(params.tokenX.type === "stx"),
        boolCV(params.tokenY.type === "stx"),
        uintCV(amountXMicro),
        uintCV(amountYMicro),
      ],
    };
  }
  return {
    contractAddress: params.pool.address,
    contractName: params.pool.name,
    functionName: "add-liquidity",
    functionArgs: [
      tokenToOptionalCv(params.tokenX),
      tokenToOptionalCv(params.tokenY),
      uintCV(amountXMicro),
      uintCV(amountYMicro),
      uintCV(BigInt(Math.floor(params.minShares))),
    ],
  };
};

export const buildRemoveLiquidityCall = (
  params: RemoveLiquidityParams,
): ContractCall => {
  const decimalsX = params.decimalsX ?? params.decimals ?? DEFAULT_DECIMALS;
  const decimalsY = params.decimalsY ?? params.decimals ?? DEFAULT_DECIMALS;
  return {
    contractAddress: params.pool.address,
    contractName: params.pool.name,
    functionName: "remove-liquidity",
    functionArgs: [
      tokenToOptionalCv(params.tokenX),
      tokenToOptionalCv(params.tokenY),
      uintCV(BigInt(Math.floor(params.shares))),
      uintCV(toMicro(params.minX, decimalsX)),
      uintCV(toMicro(params.minY, decimalsY)),
    ],
  };
};

export const buildQuoteXForYCall = (
  pool: PoolContract,
  amountIn: number,
  decimals = DEFAULT_DECIMALS,
): ContractCall => ({
  contractAddress: pool.address,
  contractName: pool.name,
  functionName: "quote-x-for-y",
  functionArgs: [uintCV(toMicro(amountIn, decimals))],
});

export const buildQuoteYForXCall = (
  pool: PoolContract,
  amountIn: number,
  decimals = DEFAULT_DECIMALS,
): ContractCall => ({
  contractAddress: pool.address,
  contractName: pool.name,
  functionName: "quote-y-for-x",
  functionArgs: [uintCV(toMicro(amountIn, decimals))],
});

export const buildGetReservesCall = (pool: PoolContract): ContractCall => ({
  contractAddress: pool.address,
  contractName: pool.name,
  functionName: "get-reserves",
  functionArgs: [],
});

export const buildGetTotalSupplyCall = (pool: PoolContract): ContractCall => ({
  contractAddress: pool.address,
  contractName: pool.name,
  functionName: "get-total-supply",
  functionArgs: [],
});

export const fetchQuoteXForY = async (
  network: StacksNetwork,
  pool: PoolContract,
  amountIn: number,
  senderAddress: string,
  decimals = DEFAULT_DECIMALS,
): Promise<QuoteResult> => {
  const call = buildQuoteXForYCall(pool, amountIn, decimals);
  const result = await fetchCallReadOnlyFunction({
    contractAddress: call.contractAddress,
    contractName: call.contractName,
    functionName: call.functionName,
    functionArgs: call.functionArgs,
    senderAddress,
    network,
  });
  const value = unwrapReadOnlyOk(result) as Record<string, unknown>;
  return {
    amountOut:
      parseClarityNumber(
        value.dy ?? value.amountOut ?? value["amount-out"] ?? 0,
      ) / decimals,
    fee: parseClarityNumber(value.fee ?? 0) / decimals,
  };
};

export const fetchQuoteYForX = async (
  network: StacksNetwork,
  pool: PoolContract,
  amountIn: number,
  senderAddress: string,
  decimals = DEFAULT_DECIMALS,
): Promise<QuoteResult> => {
  const call = buildQuoteYForXCall(pool, amountIn, decimals);
  const result = await fetchCallReadOnlyFunction({
    contractAddress: call.contractAddress,
    contractName: call.contractName,
    functionName: call.functionName,
    functionArgs: call.functionArgs,
    senderAddress,
    network,
  });
  const value = unwrapReadOnlyOk(result) as Record<string, unknown>;
  return {
    amountOut:
      parseClarityNumber(
        value.dx ?? value.amountOut ?? value["amount-out"] ?? 0,
      ) / decimals,
    fee: parseClarityNumber(value.fee ?? 0) / decimals,
  };
};

export const buildPoolSnapshotCalls = (pool: PoolContract) => ({
  reserves: buildGetReservesCall(pool),
  totalSupply: buildGetTotalSupplyCall(pool),
});

export const fetchPoolState = async (
  network: StacksNetwork,
  pool: PoolContract,
  senderAddress: string,
  decimals = DEFAULT_DECIMALS,
): Promise<PoolState> => {
  const reserves = await fetchCallReadOnlyFunction({
    contractAddress: pool.address,
    contractName: pool.name,
    functionName: "get-reserves",
    functionArgs: [],
    senderAddress,
    network,
  });
  const totalSupply = await fetchCallReadOnlyFunction({
    contractAddress: pool.address,
    contractName: pool.name,
    functionName: "get-total-supply",
    functionArgs: [],
    senderAddress,
    network,
  });
  const reserveValue = unwrapReadOnlyOk(reserves) as {
    x?: unknown;
    y?: unknown;
    reserveX?: unknown;
    reserveY?: unknown;
    "reserve-x"?: unknown;
    "reserve-y"?: unknown;
  };
  const totalSupplyValue = parseClarityNumber(unwrapReadOnlyOk(totalSupply));
  const reserveX =
    parseClarityNumber(
      reserveValue["reserve-x"] ?? reserveValue.reserveX ?? reserveValue.x,
    ) / decimals;
  const reserveY =
    parseClarityNumber(
      reserveValue["reserve-y"] ?? reserveValue.reserveY ?? reserveValue.y,
    ) / decimals;
  return {
    reserveX,
    reserveY,
    totalShares: totalSupplyValue,
  };
};
