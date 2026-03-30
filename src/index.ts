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

export type QuoteMicroResult = {
  amountOutMicro: bigint;
  feeMicro: bigint;
};

export type QuoteParams = {
  pool: PoolContract;
  amountIn: number | string | bigint;
  senderAddress: string;
  direction: "x-to-y" | "y-to-x";
  decimals?: number;
  decimalsIn?: number;
  decimalsOut?: number;
};

export type QuoteDetailedResult = {
  amountIn: number;
  amountInMicro: bigint;
  expectedOut: number;
  expectedOutMicro: bigint;
  minOut: number | null;
  minOutMicro: bigint | null;
  fee: number;
  feeMicro: bigint;
  decimalsIn: number;
  decimalsOut: number;
  priceImpactPercent: number | null;
  suggestedSlippagePercent: number;
  warnings: string[];
};

export type PoolState = {
  reserveX: number;
  reserveY: number;
  totalShares: number;
};

export type PoolSnapshot = PoolState & { fetchedAt: number };

export type ExactOutQuoteResult = {
  desiredOut: number;
  desiredOutMicro: bigint;
  amountIn: number | null;
  amountInMicro: bigint;
  expectedOut: number;
  expectedOutMicro: bigint;
  fee: number;
  feeMicro: bigint;
  decimalsIn: number;
  decimalsOut: number;
  iterations: number;
  warnings: string[];
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

export type ContractPrincipalParts = { address: string; name: string };

export const parseContractPrincipal = (
  contractPrincipal: string,
): ContractPrincipalParts => {
  const raw = String(contractPrincipal || "").trim();
  const firstDot = raw.indexOf(".");
  const lastDot = raw.lastIndexOf(".");
  if (firstDot <= 0 || lastDot !== firstDot || firstDot === raw.length - 1) {
    throw new Error("Invalid contract principal. Expected address.contract");
  }
  const address = raw.slice(0, firstDot);
  const name = raw.slice(firstDot + 1);
  if (!address || !name) {
    throw new Error("Invalid contract principal. Expected address.contract");
  }
  return { address, name };
};

export const isValidContractPrincipal = (contractPrincipal: string) => {
  try {
    parseContractPrincipal(contractPrincipal);
    return true;
  } catch {
    return false;
  }
};

export const buildContractPrincipal = (address: string, name: string) => {
  const addr = String(address || "").trim();
  const contractName = String(name || "").trim();
  if (!addr || !contractName) {
    throw new Error("Invalid contract principal parts.");
  }
  if (addr.includes(".") || contractName.includes(".")) {
    throw new Error("Contract principal parts must not include '.'");
  }
  return `${addr}.${contractName}`;
};

export const buildHiroTxUrl = (txid: string, network: Network = "mainnet") =>
  `https://explorer.hiro.so/txid/${txid}?chain=${network}`;

export const buildHiroAddressUrl = (address: string, network: Network = "mainnet") =>
  `https://explorer.hiro.so/address/${address}?chain=${network}`;

export const buildHiroContractUrl = (
  contractPrincipal: string,
  network: Network = "mainnet",
) => {
  const { address, name } = parseContractPrincipal(contractPrincipal);
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

export const buildTokenInfoCacheKey = (
  id: string,
  opts: TokenMetadataOptions = {},
) => `${getMetadataBaseUrl(opts)}:${id}`;

export const getTokenMetadataCacheSize = () => metadataCache.size;

export const clearTokenMetadataCache = () => {
  const count = metadataCache.size;
  metadataCache.clear();
  return count;
};

export const cacheTokenInfo = (
  info: TokenMetadata,
  opts: TokenMetadataOptions & { fetchedAt?: number } = {},
) => {
  const cacheKey = buildTokenInfoCacheKey(info.id, opts);
  const fetchedAt = typeof opts.fetchedAt === "number" ? opts.fetchedAt : Date.now();
  metadataCache.set(cacheKey, { info, fetchedAt });
  return cacheKey;
};

export const getCachedTokenInfo = (
  id: string,
  opts: TokenMetadataOptions = {},
) => {
  const cacheKey = buildTokenInfoCacheKey(id, opts);
  const cached = metadataCache.get(cacheKey);
  if (!cached) return null;
  const ttl = opts.cacheTtlMs ?? DEFAULT_TTL;
  if (Date.now() - cached.fetchedAt >= ttl) {
    metadataCache.delete(cacheKey);
    return null;
  }
  return cached.info;
};

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

export type TokenIdParts = { contract: string; asset: string };

export const parseTokenIdStrict = (id: string): TokenIdParts => {
  const raw = String(id || "").trim();
  const parts = raw.split("::");
  if (parts.length !== 2) {
    throw new Error("Invalid token id. Expected contract::asset");
  }
  const [contract, asset] = parts;
  if (!contract || !asset) {
    throw new Error("Invalid token id. Expected contract::asset");
  }
  parseContractPrincipal(contract);
  return { contract, asset };
};

export const isValidTokenId = (id: string) => {
  try {
    parseTokenIdStrict(id);
    return true;
  } catch {
    return false;
  }
};

export const buildTokenId = (contractPrincipal: string, asset: string) => {
  const { address, name } = parseContractPrincipal(contractPrincipal);
  const assetName = String(asset || "").trim();
  if (!assetName) {
    throw new Error("Invalid token asset.");
  }
  if (assetName.includes("::")) {
    throw new Error("Invalid token asset.");
  }
  return `${address}.${name}::${assetName}`;
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

export const toMicroAmount = (
  amount: number | string | bigint,
  decimals: number,
) => {
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

export const fromMicroAmount = (
  amountMicro: number | string | bigint,
  decimals: number,
) => {
  const decimalsInt = Math.floor(decimals);
  if (!Number.isFinite(decimalsInt) || decimalsInt <= 0) {
    throw new Error("Invalid decimals value.");
  }

  if (typeof amountMicro === "bigint") {
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (amountMicro > maxSafe || amountMicro < -maxSafe) {
      throw new Error("Micro amount exceeds MAX_SAFE_INTEGER.");
    }
    return Number(amountMicro) / decimalsInt;
  }

  const parsed = typeof amountMicro === "number" ? amountMicro : Number(amountMicro);
  if (!Number.isFinite(parsed)) return 0;
  return parsed / decimalsInt;
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

const parseClarityUInt = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.floor(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0n;
    try {
      return BigInt(trimmed);
    } catch {
      return 0n;
    }
  }
  if (value && typeof value === "object") {
    const record = value as { value?: unknown };
    if ("value" in record) return parseClarityUInt(record.value);
  }
  return 0n;
};

export const normalizePoolReserves = (
  value: unknown,
  decimals = DEFAULT_DECIMALS,
) => {
  const reserveValue = value as
    | {
        x?: unknown;
        y?: unknown;
        reserveX?: unknown;
        reserveY?: unknown;
        "reserve-x"?: unknown;
        "reserve-y"?: unknown;
      }
    | null
    | undefined;
  const reserveX =
    parseClarityNumber(
      reserveValue?.["reserve-x"] ?? reserveValue?.reserveX ?? reserveValue?.x,
    ) / decimals;
  const reserveY =
    parseClarityNumber(
      reserveValue?.["reserve-y"] ?? reserveValue?.reserveY ?? reserveValue?.y,
    ) / decimals;
  return { reserveX, reserveY };
};

export const normalizePoolTotalShares = (value: unknown) =>
  parseClarityNumber(value);

export const normalizePoolState = (
  reservesValue: unknown,
  totalSupplyValue: unknown,
  decimals = DEFAULT_DECIMALS,
): PoolState => {
  const reserves = normalizePoolReserves(reservesValue, decimals);
  return {
    reserveX: reserves.reserveX,
    reserveY: reserves.reserveY,
    totalShares: normalizePoolTotalShares(totalSupplyValue),
  };
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
  const cacheKey = buildTokenInfoCacheKey(id, opts);
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
  const amountMicro = toMicroAmount(params.amountIn, decimalsIn);
  const minOutMicro = toMicroAmount(params.minOut, decimalsOut);
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
  const amountXMicro = toMicroAmount(params.amountX, decimalsX);
  const amountYMicro = toMicroAmount(params.amountY, decimalsY);
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
      uintCV(toMicroAmount(params.minX, decimalsX)),
      uintCV(toMicroAmount(params.minY, decimalsY)),
    ],
  };
};

export const buildQuoteXForYCall = (
  pool: PoolContract,
  amountIn: number | string | bigint,
  decimals = DEFAULT_DECIMALS,
): ContractCall => ({
  contractAddress: pool.address,
  contractName: pool.name,
  functionName: "quote-x-for-y",
  functionArgs: [uintCV(toMicroAmount(amountIn, decimals))],
});

export const buildQuoteYForXCall = (
  pool: PoolContract,
  amountIn: number | string | bigint,
  decimals = DEFAULT_DECIMALS,
): ContractCall => ({
  contractAddress: pool.address,
  contractName: pool.name,
  functionName: "quote-y-for-x",
  functionArgs: [uintCV(toMicroAmount(amountIn, decimals))],
});

export const buildQuoteCall = (
  pool: PoolContract,
  amountIn: number | string | bigint,
  direction: "x-to-y" | "y-to-x",
  decimals = DEFAULT_DECIMALS,
): ContractCall =>
  direction === "x-to-y"
    ? buildQuoteXForYCall(pool, amountIn, decimals)
    : buildQuoteYForXCall(pool, amountIn, decimals);

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
  return fetchQuote(network, {
    pool,
    amountIn,
    senderAddress,
    direction: "x-to-y",
    decimals,
  });
};

export const fetchQuoteYForX = async (
  network: StacksNetwork,
  pool: PoolContract,
  amountIn: number,
  senderAddress: string,
  decimals = DEFAULT_DECIMALS,
): Promise<QuoteResult> => {
  return fetchQuote(network, {
    pool,
    amountIn,
    senderAddress,
    direction: "y-to-x",
    decimals,
  });
};

export const calculateMinOutMicro = (
  expectedOutMicro: bigint,
  slippagePercent: number,
) => {
  const pct = Number(slippagePercent);
  if (!Number.isFinite(pct) || pct <= 0) return expectedOutMicro;
  if (pct >= 100) return 0n;
  const bps = BigInt(Math.ceil(pct * 100)); // 1% = 100 bps
  const maxBps = 10_000n;
  const keep = maxBps - (bps > maxBps ? maxBps : bps);
  return (expectedOutMicro * keep) / maxBps;
};

export const fetchQuoteMicro = async (
  network: StacksNetwork,
  params: QuoteParams,
): Promise<QuoteMicroResult> => {
  const decimalsIn = params.decimalsIn ?? params.decimals ?? DEFAULT_DECIMALS;
  const call = buildQuoteCall(
    params.pool,
    params.amountIn,
    params.direction,
    decimalsIn,
  );

  return fetchQuoteMicroFromAmountInMicro(network, {
    pool: params.pool,
    amountInMicro: parseClarityUInt(cvToValue(call.functionArgs[0] as never)),
    direction: params.direction,
    senderAddress: params.senderAddress,
  });
};

export const buildQuoteCallFromMicro = (
  pool: PoolContract,
  amountInMicro: bigint,
  direction: "x-to-y" | "y-to-x",
): ContractCall => ({
  contractAddress: pool.address,
  contractName: pool.name,
  functionName: direction === "x-to-y" ? "quote-x-for-y" : "quote-y-for-x",
  functionArgs: [uintCV(amountInMicro)],
});

export const fetchQuoteMicroFromAmountInMicro = async (
  network: StacksNetwork,
  params: {
    pool: PoolContract;
    amountInMicro: bigint;
    senderAddress: string;
    direction: "x-to-y" | "y-to-x";
  },
): Promise<QuoteMicroResult> => {
  const call = buildQuoteCallFromMicro(params.pool, params.amountInMicro, params.direction);
  const result = await fetchCallReadOnlyFunction({
    contractAddress: call.contractAddress,
    contractName: call.contractName,
    functionName: call.functionName,
    functionArgs: call.functionArgs,
    senderAddress: params.senderAddress,
    network,
  });
  const value = unwrapReadOnlyOk(result) as Record<string, unknown>;
  const amountOutKey = params.direction === "x-to-y" ? "dy" : "dx";
  return {
    amountOutMicro: parseClarityUInt(
      value[amountOutKey] ?? value.amountOut ?? value["amount-out"] ?? 0,
    ),
    feeMicro: parseClarityUInt(value.fee ?? 0),
  };
};

export const findMinAmountInMicroForExactOut = async (opts: {
  desiredOutMicro: bigint;
  maxInMicro: bigint;
  quoteOutMicro: (amountInMicro: bigint) => Promise<bigint>;
  maxIterations?: number;
}): Promise<{
  reachable: boolean;
  amountInMicro: bigint;
  amountOutMicro: bigint;
  iterations: number;
}> => {
  const desiredOutMicro = opts.desiredOutMicro;
  const maxInMicro = opts.maxInMicro;
  const maxIterations = Math.max(1, Math.floor(opts.maxIterations ?? 32));

  if (desiredOutMicro <= 0n) {
    return { reachable: true, amountInMicro: 0n, amountOutMicro: 0n, iterations: 0 };
  }
  if (maxInMicro <= 0n) {
    return { reachable: false, amountInMicro: 0n, amountOutMicro: 0n, iterations: 0 };
  }

  let low = 0n;
  let high = maxInMicro;
  let bestIn: bigint | null = null;
  let bestOut = 0n;

  for (let i = 0; i < maxIterations && low <= high; i++) {
    const mid = (low + high) / 2n;
    const out = await opts.quoteOutMicro(mid);
    if (out >= desiredOutMicro) {
      bestIn = mid;
      bestOut = out;
      if (mid === 0n) break;
      high = mid - 1n;
    } else {
      low = mid + 1n;
    }
  }

  if (bestIn === null) {
    const outAtMax = await opts.quoteOutMicro(maxInMicro);
    return {
      reachable: false,
      amountInMicro: maxInMicro,
      amountOutMicro: outAtMax,
      iterations: maxIterations,
    };
  }

  return {
    reachable: true,
    amountInMicro: bestIn,
    amountOutMicro: bestOut,
    iterations: maxIterations,
  };
};

export const fetchQuote = async (
  network: StacksNetwork,
  params: QuoteParams,
): Promise<QuoteResult> => {
  const decimalsIn = params.decimalsIn ?? params.decimals ?? DEFAULT_DECIMALS;
  const decimalsOut = params.decimalsOut ?? params.decimals ?? DEFAULT_DECIMALS;
  const micro = await fetchQuoteMicro(network, { ...params, decimalsIn, decimalsOut });
  return {
    amountOut: fromMicroAmount(micro.amountOutMicro, decimalsOut),
    fee: fromMicroAmount(micro.feeMicro, decimalsOut),
  };
};

const toNumberForEstimates = (
  amount: number | string | bigint,
  decimals: number,
): number | null => {
  if (typeof amount === "number") return Number.isFinite(amount) ? amount : null;
  if (typeof amount === "string") {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const decimalsInt = Math.floor(decimals);
  if (!Number.isFinite(decimalsInt) || decimalsInt <= 0) return null;
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const abs = amount < 0n ? -amount : amount;
  if (abs > maxSafe * BigInt(decimalsInt)) return null;
  return Number(amount) / decimalsInt;
};

export const fetchQuoteDetailed = async (
  network: StacksNetwork,
  params: QuoteParams & {
    slippagePercent?: number;
    poolState?: PoolState;
  },
): Promise<QuoteDetailedResult> => {
  const decimalsIn = params.decimalsIn ?? params.decimals ?? DEFAULT_DECIMALS;
  const decimalsOut = params.decimalsOut ?? params.decimals ?? DEFAULT_DECIMALS;
  const amountInMicro = toMicroAmount(params.amountIn, decimalsIn);
  const micro = await fetchQuoteMicro(network, { ...params, decimalsIn, decimalsOut });

  const expectedOutMicro = micro.amountOutMicro;
  const feeMicro = micro.feeMicro;

  const expectedOut = fromMicroAmount(expectedOutMicro, decimalsOut);
  const fee = fromMicroAmount(feeMicro, decimalsOut);
  const amountIn = fromMicroAmount(amountInMicro, decimalsIn);

  const minOutMicro =
    typeof params.slippagePercent === "number"
      ? calculateMinOutMicro(expectedOutMicro, params.slippagePercent)
      : null;
  const minOut =
    minOutMicro === null ? null : fromMicroAmount(minOutMicro, decimalsOut);

  const warnings: string[] = [];
  const senderAmountForEstimate = toNumberForEstimates(params.amountIn, decimalsIn);
  const state =
    params.poolState ??
    (await fetchPoolState(network, params.pool, params.senderAddress, DEFAULT_DECIMALS));
  const reserveIn =
    params.direction === "x-to-y" ? state.reserveX : state.reserveY;

  const priceImpactPercent =
    senderAmountForEstimate === null ? null : estimatePriceImpactPercent(senderAmountForEstimate, reserveIn);
  if (priceImpactPercent === null) {
    warnings.push("Price impact unavailable (amount too large).");
  } else if (priceImpactPercent >= 15) {
    warnings.push("Very high price impact.");
  } else if (priceImpactPercent >= 5) {
    warnings.push("High price impact.");
  }

  const suggestedSlippagePercent = suggestSlippagePercent(priceImpactPercent ?? 0);
  if (typeof params.slippagePercent === "number" && params.slippagePercent < suggestedSlippagePercent) {
    warnings.push("Slippage may be too low for current price impact.");
  }

  return {
    amountIn,
    amountInMicro,
    expectedOut,
    expectedOutMicro,
    minOut,
    minOutMicro,
    fee,
    feeMicro,
    decimalsIn,
    decimalsOut,
    priceImpactPercent,
    suggestedSlippagePercent,
    warnings,
  };
};

export const fetchQuoteExactOut = async (
  network: StacksNetwork,
  params: {
    pool: PoolContract;
    senderAddress: string;
    direction: "x-to-y" | "y-to-x";
    desiredOut: number | string | bigint;
    maxAmountIn: number | string | bigint;
    decimalsIn?: number;
    decimalsOut?: number;
    decimals?: number;
    maxIterations?: number;
  },
): Promise<ExactOutQuoteResult> => {
  const decimalsIn = params.decimalsIn ?? params.decimals ?? DEFAULT_DECIMALS;
  const decimalsOut = params.decimalsOut ?? params.decimals ?? DEFAULT_DECIMALS;
  const desiredOutMicro = toMicroAmount(params.desiredOut, decimalsOut);
  const maxInMicro = toMicroAmount(params.maxAmountIn, decimalsIn);

  const search = await findMinAmountInMicroForExactOut({
    desiredOutMicro,
    maxInMicro,
    maxIterations: params.maxIterations,
    quoteOutMicro: async (amountInMicro) => {
      const q = await fetchQuoteMicroFromAmountInMicro(network, {
        pool: params.pool,
        amountInMicro,
        senderAddress: params.senderAddress,
        direction: params.direction,
      });
      return q.amountOutMicro;
    },
  });

  const quote = await fetchQuoteMicroFromAmountInMicro(network, {
    pool: params.pool,
    amountInMicro: search.amountInMicro,
    senderAddress: params.senderAddress,
    direction: params.direction,
  });

  const warnings: string[] = [];
  if (!search.reachable) warnings.push("Desired output not reachable within maxAmountIn.");

  let amountIn: number | null = null;
  try {
    amountIn = fromMicroAmount(search.amountInMicro, decimalsIn);
  } catch {
    amountIn = null;
  }

  return {
    desiredOut: fromMicroAmount(desiredOutMicro, decimalsOut),
    desiredOutMicro,
    amountIn,
    amountInMicro: search.amountInMicro,
    expectedOut: fromMicroAmount(quote.amountOutMicro, decimalsOut),
    expectedOutMicro: quote.amountOutMicro,
    fee: fromMicroAmount(quote.feeMicro, decimalsOut),
    feeMicro: quote.feeMicro,
    decimalsIn,
    decimalsOut,
    iterations: search.iterations,
    warnings,
  };
};

export const buildPoolSnapshotCalls = (pool: PoolContract) => ({
  reserves: buildGetReservesCall(pool),
  totalSupply: buildGetTotalSupplyCall(pool),
});

export const fetchPoolSnapshot = async (
  network: StacksNetwork,
  pool: PoolContract,
  senderAddress: string,
  decimals = DEFAULT_DECIMALS,
): Promise<PoolSnapshot> => {
  const [reservesRaw, totalSupplyRaw] = await Promise.all([
    fetchCallReadOnlyFunction({
      contractAddress: pool.address,
      contractName: pool.name,
      functionName: "get-reserves",
      functionArgs: [],
      senderAddress,
      network,
    }),
    fetchCallReadOnlyFunction({
      contractAddress: pool.address,
      contractName: pool.name,
      functionName: "get-total-supply",
      functionArgs: [],
      senderAddress,
      network,
    }),
  ]);

  const reservesValue = unwrapReadOnlyOk(reservesRaw);
  const totalSupplyValue = unwrapReadOnlyOk(totalSupplyRaw);
  const state = normalizePoolState(reservesValue, totalSupplyValue, decimals);
  return { ...state, fetchedAt: Date.now() };
};

export type WatchPoolOptions = {
  intervalMs?: number;
  immediate?: boolean;
  decimals?: number;
  onError?: (error: unknown) => void;
  signal?: AbortSignal;
};

export const watchPoolSnapshot = (
  network: StacksNetwork,
  pool: PoolContract,
  senderAddress: string,
  onSnapshot: (snapshot: PoolSnapshot) => void,
  opts: WatchPoolOptions = {},
) => {
  const intervalMs = Math.max(250, Math.floor(opts.intervalMs ?? 15_000));
  const decimals = opts.decimals ?? DEFAULT_DECIMALS;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const snapshot = await fetchPoolSnapshot(network, pool, senderAddress, decimals);
      onSnapshot(snapshot);
    } catch (error) {
      opts.onError?.(error);
    }
  };

  if (opts.immediate ?? true) void tick();
  const id = setInterval(() => void tick(), intervalMs);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(id);
  };

  if (opts.signal) {
    if (opts.signal.aborted) stop();
    else opts.signal.addEventListener("abort", stop, { once: true });
  }

  return stop;
};

export const fetchPoolState = async (
  network: StacksNetwork,
  pool: PoolContract,
  senderAddress: string,
  decimals = DEFAULT_DECIMALS,
): Promise<PoolState> => {
  const snapshot = await fetchPoolSnapshot(network, pool, senderAddress, decimals);
  return {
    reserveX: snapshot.reserveX,
    reserveY: snapshot.reserveY,
    totalShares: snapshot.totalShares,
  };
};
