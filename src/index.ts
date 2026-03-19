import {
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
  amountIn: number;
  minOut: number;
  recipient: string;
  deadline: number;
  direction: "x-to-y" | "y-to-x";
  decimals?: number;
};

export type AddLiquidityParams = {
  pool: PoolContract;
  tokenX: TokenRef;
  tokenY: TokenRef;
  amountX: number;
  amountY: number;
  minShares: number;
  initializing: boolean;
  decimals?: number;
};

export type RemoveLiquidityParams = {
  pool: PoolContract;
  tokenX: TokenRef;
  tokenY: TokenRef;
  shares: number;
  minX: number;
  minY: number;
  decimals?: number;
};

export type ContractCall = {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
};

export type SwapExecutionOptions = {
  network: unknown;
  anchorMode: unknown;
  postConditionMode: unknown;
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
  baseUrl?: string;
  cacheTtlMs?: number;
};

const DEFAULT_DECIMALS = 1_000_000;
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

const API_BY_NETWORK: Record<Network, string> = {
  mainnet: "https://api.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

const metadataCache = new Map<
  string,
  { info: TokenMetadata; fetchedAt: number }
>();

const tokenToOptionalCv = (token: TokenRef) => {
  if (token.type === "stx") return noneCV();
  const [address, contractName] = token.contract.split(".");
  return someCV(contractPrincipalCV(address, contractName));
};

export const parseTokenId = (id: string) => {
  const [contract, asset] = id.split("::");
  return { contract, asset };
};

export const getMetadataBaseUrl = (opts: TokenMetadataOptions = {}) => {
  if (opts.baseUrl) return opts.baseUrl;
  const network = opts.network ?? "mainnet";
  return API_BY_NETWORK[network];
};

export const buildTokenMetadataUrl = (
  contractPrincipal: string,
  opts: TokenMetadataOptions = {},
) => `${getMetadataBaseUrl(opts)}/metadata/v1/ft/${contractPrincipal}`;

const toMicro = (amount: number, decimals: number) =>
  BigInt(Math.floor(amount * decimals));

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
  const res = await fetch(url);
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
  const res = await fetch(
    `${getMetadataBaseUrl(opts)}/v2/contracts/interface/${address}/${contractName}`,
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
  const decimals = params.decimals ?? DEFAULT_DECIMALS;
  const functionName =
    params.direction === "x-to-y" ? "swap-x-for-y" : "swap-y-for-x";
  const amountMicro = toMicro(params.amountIn, decimals);
  const minOutMicro = toMicro(params.minOut, decimals);
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
  const decimals = params.decimals ?? DEFAULT_DECIMALS;
  const amountXMicro = toMicro(params.amountX, decimals);
  const amountYMicro = toMicro(params.amountY, decimals);
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
  return {
    contractAddress: params.pool.address,
    contractName: params.pool.name,
    functionName: "remove-liquidity",
    functionArgs: [
      tokenToOptionalCv(params.tokenX),
      tokenToOptionalCv(params.tokenY),
      uintCV(BigInt(Math.floor(params.shares))),
      uintCV(BigInt(Math.floor(params.minX))),
      uintCV(BigInt(Math.floor(params.minY))),
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
  const value = unwrapReadOnlyOk(result) as { dy?: unknown; fee?: unknown };
  return {
    amountOut: parseClarityNumber(value.dy) / decimals,
    fee: parseClarityNumber(value.fee) / decimals,
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
  const value = unwrapReadOnlyOk(result) as { dx?: unknown; fee?: unknown };
  return {
    amountOut: parseClarityNumber(value.dx) / decimals,
    fee: parseClarityNumber(value.fee) / decimals,
  };
};

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
