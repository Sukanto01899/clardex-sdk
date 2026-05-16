import {
  AnchorMode,
  PostConditionMode,
  boolCV,
  contractPrincipalCV,
  fetchCallReadOnlyFunction,
  noneCV,
  Pc,
  someCV,
  standardPrincipalCV,
  uintCV,
  validateStacksAddress,
  cvToValue,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";
import {
  STACKS_MAINNET,
  STACKS_TESTNET,
  createNetwork,
  type StacksNetwork,
} from "@stacks/network";

export type Network = "mainnet" | "testnet";

export type PoolContract = {
  address: string;
  name: string;
};

export type PoolContractString = `${string}.${string}`;

export type TokenRef =
  | { type: "stx" }
  | { type: "sip10"; contract: string; asset?: string };

export type TokenRefString = "STX" | `${string}.${string}` | `${string}.${string}::${string}`;

export const parseTokenRef = (value: TokenRef | string): TokenRef => {
  if (value && typeof value === "object") {
    const token = value as Partial<TokenRef> & { contract?: unknown; asset?: unknown };
    if (token.type === "stx") return { type: "stx" };
    if (token.type === "sip10") {
      const contract = String(token.contract ?? "").trim();
      if (!contract) {
        throw new Error("Invalid sip10 token ref. Missing contract.");
      }
      const { address, name } = parseContractPrincipal(contract);
      const asset =
        typeof token.asset === "string" && token.asset.trim()
          ? token.asset.trim()
          : undefined;
      return { type: "sip10", contract: `${address}.${name}`, asset };
    }
    throw new Error("Invalid token ref. Expected type 'stx' or 'sip10'.");
  }

  const raw = String(value || "").trim();
  if (!raw) throw new Error("Token ref string is empty.");
  if (raw.toLowerCase() === "stx") return { type: "stx" };

  if (raw.includes("::")) {
    const { contract, asset } = parseTokenIdStrict(raw);
    return { type: "sip10", contract, asset };
  }

  const { address, name } = parseContractPrincipal(raw);
  return { type: "sip10", contract: `${address}.${name}` };
};

export const tryParseTokenRef = (value: unknown): TokenRef | null => {
  try {
    if (typeof value === "string") return parseTokenRef(value);
    if (value && typeof value === "object") return parseTokenRef(value as TokenRef);
    return null;
  } catch {
    return null;
  }
};

export const isValidTokenRef = (value: unknown): boolean =>
  tryParseTokenRef(value) !== null;

export const formatTokenRef = (token: TokenRef): TokenRefString => {
  if (token.type === "stx") return "STX";
  const contract = toContractIdString(token.contract);
  const asset = String(token.asset ?? "").trim();
  if (asset) return `${contract}::${asset}`;
  return contract;
};

export const tokenRefToAssetId = (token: TokenRef): "STX" | `${string}.${string}::${string}` => {
  if (token.type === "stx") return "STX";
  const contract = toContractIdString(token.contract);
  const asset = getSip10AssetName({ ...token, contract });
  return buildTokenId(contract, asset) as `${string}.${string}::${string}`;
};

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
  signal?: AbortSignal;
  retries?: number;
  retryDelayMs?: number;
  retryBackoffFactor?: number;
};

export type FetchTokenInfosOptions = TokenMetadataOptions & {
  concurrency?: number;
};

const DEFAULT_DECIMALS = 1_000_000;
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

const API_BY_NETWORK: Record<Network, string> = {
  mainnet: "https://api.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

export type CreateHiroNetworkOptions = {
  network: Network;
  apiBaseUrl?: string;
};

export const createHiroNetwork = (
  opts: CreateHiroNetworkOptions | Network = "mainnet",
): StacksNetwork => {
  const network = typeof opts === "string" ? opts : opts.network;
  const apiBaseUrl =
    typeof opts === "string" ? undefined : (opts.apiBaseUrl ?? undefined);

  const base = network === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;
  const baseUrl = apiBaseUrl ?? API_BY_NETWORK[network];

  return createNetwork({
    ...base,
    addressVersion: { ...base.addressVersion },
    client: { ...base.client, baseUrl },
  });
};

export type CreateClientOptions = {
  network: Network;
  apiUrl?: string;
};

// Alias helper: creates a `StacksNetwork` configured for Hiro API by network.
export const createClient = (
  opts: CreateClientOptions | Network = "mainnet",
): StacksNetwork => {
  if (typeof opts === "string") return createHiroNetwork(opts);
  return createHiroNetwork({ network: opts.network, apiBaseUrl: opts.apiUrl });
};

export const poolFromContractPrincipal = (contractPrincipal: string): PoolContract => {
  const { address, name } = parseContractPrincipal(contractPrincipal);
  return { address, name };
};

export const formatPoolContract = (pool: PoolContract): PoolContractString => {
  const address = String(pool?.address ?? "").trim();
  const name = String(pool?.name ?? "").trim();
  if (!address || !name) {
    throw new Error("Invalid pool contract. Expected { address, name }.");
  }
  if (address.includes(".") || name.includes(".")) {
    throw new Error("Invalid pool contract parts. Address/name must not include '.'");
  }
  if (!validateStacksAddress(address)) {
    throw new Error("Invalid pool contract address.");
  }
  return `${address}.${name}` as PoolContractString;
};

export const parsePoolContract = (value: PoolContract | string): PoolContract => {
  if (value && typeof value === "object") {
    const pool = value as Partial<PoolContract>;
    const address = String(pool.address ?? "").trim();
    const name = String(pool.name ?? "").trim();
    if (!address || !name) {
      throw new Error("Invalid pool contract. Missing address or name.");
    }
    if (address.includes(".") || name.includes(".")) {
      throw new Error("Invalid pool contract parts. Address/name must not include '.'");
    }
    if (!validateStacksAddress(address)) {
      throw new Error("Invalid pool contract address.");
    }
    return { address, name };
  }

  const raw = String(value || "").trim();
  if (!raw) throw new Error("Pool contract string is empty.");
  const { address, name } = parseContractPrincipal(raw);
  if (!validateStacksAddress(address)) {
    throw new Error("Invalid pool contract address.");
  }
  return { address, name };
};

export const tryParsePoolContract = (value: unknown): PoolContract | null => {
  try {
    if (typeof value === "string") return parsePoolContract(value);
    if (value && typeof value === "object") return parsePoolContract(value as PoolContract);
    return null;
  } catch {
    return null;
  }
};

export const isValidPoolContract = (value: unknown): boolean =>
  tryParsePoolContract(value) !== null;

export const poolContractToPrincipal = (pool: PoolContract): PoolContractString =>
  formatPoolContract(pool);

export const requirePoolContract = (value: PoolContract | string): PoolContractString => {
  const parsed = parsePoolContract(value);
  return formatPoolContract(parsed);
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

export const isValidStacksContractPrincipal = (contractPrincipal: string) => {
  try {
    const { address, name } = parseContractPrincipal(contractPrincipal);
    if (!validateStacksAddress(address)) return false;
    if (!name) return false;
    return true;
  } catch {
    return false;
  }
};

export const requireContractPrincipal = (contractPrincipal: string) => {
  const raw = String(contractPrincipal || "").trim();
  if (!raw) throw new Error("Contract principal is empty.");
  const { address, name } = parseContractPrincipal(raw);
  if (!validateStacksAddress(address)) {
    throw new Error("Invalid contract principal address.");
  }
  return `${address}.${name}`;
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

export const getSip10AssetName = (token: Extract<TokenRef, { type: "sip10" }>) => {
  const explicit = String(token.asset ?? "").trim();
  if (explicit) return explicit;
  const { name } = parseContractPrincipal(token.contract);
  return name;
};

type ContractIdString = `${string}.${string}`;

const toContractIdString = (contractPrincipal: string): ContractIdString => {
  const { address, name } = parseContractPrincipal(contractPrincipal);
  return `${address}.${name}` as ContractIdString;
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

export const buildHiroTokenContractUrl = (
  token: TokenRef | string,
  network: Network = "mainnet",
): string | null => {
  const ref = parseTokenRef(token);
  if (ref.type === "stx") return null;
  return buildHiroContractUrl(ref.contract, network);
};

export const tryBuildHiroTokenContractUrl = (
  token: unknown,
  network: Network = "mainnet",
): string | null => {
  try {
    if (typeof token === "string") return buildHiroTokenContractUrl(token, network);
    if (token && typeof token === "object") {
      return buildHiroTokenContractUrl(token as TokenRef, network);
    }
    return null;
  } catch {
    return null;
  }
};

export const inferNetworkFromStacksAddress = (address: string): Network | null => {
  const raw = String(address || "").trim().toUpperCase();
  if (raw.startsWith("SP") || raw.startsWith("SM")) return "mainnet";
  if (raw.startsWith("ST") || raw.startsWith("SN")) return "testnet";
  return null;
};

export const inferNetworkFromContractPrincipal = (
  contractPrincipal: string,
): Network | null => {
  try {
    const { address } = parseContractPrincipal(contractPrincipal);
    return inferNetworkFromStacksAddress(address);
  } catch {
    return null;
  }
};

export const shortenMiddle = (
  value: string,
  opts: { head?: number; tail?: number; separator?: string } = {},
): string => {
  const raw = String(value ?? "");
  const head = Math.max(0, Math.floor(opts.head ?? 6));
  const tail = Math.max(0, Math.floor(opts.tail ?? 4));
  const separator = typeof opts.separator === "string" ? opts.separator : "...";

  if (!raw) return "";
  if (head === 0 || tail === 0) return raw;
  if (raw.length <= head + tail + separator.length) return raw;
  return `${raw.slice(0, head)}${separator}${raw.slice(-tail)}`;
};

export const shortenStacksAddress = (address: string, opts?: { head?: number; tail?: number }) =>
  shortenMiddle(String(address ?? "").trim(), { head: opts?.head ?? 6, tail: opts?.tail ?? 4 });

export const shortenTxid = (txid: string, opts?: { head?: number; tail?: number }) =>
  shortenMiddle(String(txid ?? "").trim(), { head: opts?.head ?? 6, tail: opts?.tail ?? 6 });

export type ClardexAppTab = "swap" | "prices" | "pools" | "analytics" | "liquidity";

export type BuildClardexAppUrlParams = {
  pool?: PoolContract | string | null;
  tab?: ClardexAppTab | null;
  dir?: "x-to-y" | "y-to-x" | null;
  amount?: number | string | null;
  slippage?: number | string | null;
  deadline?: number | string | null;
};

export const buildClardexAppUrl = (
  baseUrl: string,
  params: BuildClardexAppUrlParams = {},
) => {
  const url = new URL(String(baseUrl || "").trim());

  const tab = params.tab ?? null;
  if (tab) url.searchParams.set("tab", tab);

  const pool = params.pool ?? null;
  if (typeof pool === "string" && pool.trim()) {
    url.searchParams.set("pool", pool.trim());
  } else if (pool && typeof pool === "object") {
    url.searchParams.set("pool", buildContractPrincipal(pool.address, pool.name));
  }

  const dir = params.dir ?? null;
  if (dir) url.searchParams.set("dir", dir);

  const amount = params.amount ?? null;
  if (amount !== null && amount !== undefined && String(amount).trim()) {
    url.searchParams.set("amount", String(amount).trim());
  }

  const slippage = params.slippage ?? null;
  if (slippage !== null && slippage !== undefined && String(slippage).trim()) {
    url.searchParams.set("slippage", String(slippage).trim());
  }

  const deadline = params.deadline ?? null;
  if (deadline !== null && deadline !== undefined && String(deadline).trim()) {
    url.searchParams.set("deadline", String(deadline).trim());
  }

  return url.toString();
};

export type ClardexClientOptions = {
  network: StacksNetwork;
  pool: PoolContract;
  senderAddress?: string;
  decimals?: number;
};

export const createClardexClient = (opts: ClardexClientOptions) => {
  const pool = opts.pool;
  const network = opts.network;
  const senderAddress = opts.senderAddress;
  const decimals = opts.decimals;

  const requireSenderAddress = (value?: string) => {
    const addr = String(value ?? senderAddress ?? "").trim();
    if (!addr) {
      throw new Error(
        "Missing senderAddress. Pass it to the client or the method call.",
      );
    }
    return addr;
  };

  return {
    network,
    pool,
    withPool(nextPool: PoolContract) {
      return createClardexClient({ ...opts, pool: nextPool });
    },
    withSender(nextSenderAddress: string) {
      return createClardexClient({ ...opts, senderAddress: nextSenderAddress });
    },

    buildSwapCall(params: Omit<SwapParams, "pool"> & { pool?: PoolContract }) {
      return buildSwapCall({ ...params, pool: params.pool ?? pool });
    },
    executeSwap(
      openContractCall: OpenContractCall,
      params: Omit<SwapParams, "pool"> & { pool?: PoolContract },
      options: SwapExecutionOptions,
    ) {
      return executeSwap(
        openContractCall,
        { ...params, pool: params.pool ?? pool },
        options,
      );
    },

    buildAddLiquidityCall(
      params: Omit<AddLiquidityParams, "pool"> & { pool?: PoolContract },
    ) {
      return buildAddLiquidityCall({ ...params, pool: params.pool ?? pool });
    },
    executeAddLiquidity(
      openContractCall: OpenContractCall,
      params: Omit<AddLiquidityParams, "pool"> & { pool?: PoolContract },
      options: SwapExecutionOptions,
    ) {
      return executeAddLiquidity(
        openContractCall,
        { ...params, pool: params.pool ?? pool },
        options,
      );
    },

    buildRemoveLiquidityCall(
      params: Omit<RemoveLiquidityParams, "pool"> & { pool?: PoolContract },
    ) {
      return buildRemoveLiquidityCall({ ...params, pool: params.pool ?? pool });
    },
    executeRemoveLiquidity(
      openContractCall: OpenContractCall,
      params: Omit<RemoveLiquidityParams, "pool"> & { pool?: PoolContract },
      options: SwapExecutionOptions,
    ) {
      return executeRemoveLiquidity(
        openContractCall,
        { ...params, pool: params.pool ?? pool },
        options,
      );
    },

    fetchPoolState(
      args: { senderAddress?: string; pool?: PoolContract; decimals?: number } = {},
    ) {
      const resolvedSender = requireSenderAddress(args.senderAddress);
      return fetchPoolState(
        network,
        args.pool ?? pool,
        resolvedSender,
        args.decimals ?? decimals,
      );
    },

    fetchPoolSnapshot(
      args: { senderAddress?: string; pool?: PoolContract; decimals?: number } = {},
    ) {
      const resolvedSender = requireSenderAddress(args.senderAddress);
      return fetchPoolSnapshot(
        network,
        args.pool ?? pool,
        resolvedSender,
        args.decimals ?? decimals,
      );
    },

    watchPoolSnapshot(
      onSnapshot: (snapshot: PoolSnapshot) => void,
      watchOpts: WatchPoolOptions & { senderAddress?: string; pool?: PoolContract } = {},
    ) {
      const resolvedSender = requireSenderAddress(watchOpts.senderAddress);
      return watchPoolSnapshot(
        network,
        watchOpts.pool ?? pool,
        resolvedSender,
        onSnapshot,
        watchOpts,
      );
    },

    fetchQuoteDetailed(
      params: Omit<QuoteParams, "pool" | "senderAddress"> & {
        pool?: PoolContract;
        senderAddress?: string;
        slippagePercent?: number;
        poolState?: PoolState;
        decimals?: number;
        decimalsIn?: number;
        decimalsOut?: number;
      },
    ) {
      const resolvedSender = requireSenderAddress(params.senderAddress);
      return fetchQuoteDetailed(network, {
        ...params,
        pool: params.pool ?? pool,
        senderAddress: resolvedSender,
        decimals: params.decimals ?? decimals,
      });
    },

    fetchQuoteExactOut(
      params: Parameters<typeof fetchQuoteExactOut>[1] & {
        pool?: PoolContract;
        senderAddress?: string;
        decimals?: number;
        decimalsIn?: number;
        decimalsOut?: number;
      },
    ) {
      const resolvedSender = requireSenderAddress(params.senderAddress);
      return fetchQuoteExactOut(network, {
        ...params,
        pool: params.pool ?? pool,
        senderAddress: resolvedSender,
        decimals: params.decimals ?? decimals,
      });
    },

    fetchTokenInfo(id: string, tokenOpts: TokenMetadataOptions = {}) {
      return fetchTokenInfo(id, tokenOpts);
    },

    fetchTokenInfos(ids: string[], tokenOpts: FetchTokenInfosOptions = {}) {
      return fetchTokenInfos(ids, tokenOpts);
    },

    validatePoolContract(poolRef: PoolContract | string = pool, validateOpts: TokenMetadataOptions = {}) {
      return validatePoolContract(poolRef, validateOpts);
    },

    validateSip10Token(id: string, validateOpts: TokenMetadataOptions = {}) {
      return validateSip10Token(id, validateOpts);
    },

    fetchTransactionStatus(txid: string, txOpts: Pick<WatchTransactionOptions, "apiBaseUrl"> = {}) {
      const baseUrl =
        txOpts.apiBaseUrl ??
        (network as unknown as { client?: { baseUrl?: string } }).client?.baseUrl;
      const networkName: Network = baseUrl?.includes("testnet") ? "testnet" : "mainnet";
      return fetchTransactionStatus(txid, networkName, baseUrl ?? undefined);
    },

    watchTransaction(txid: string, watchOpts: WatchTransactionOptions = {}) {
      const baseUrl =
        watchOpts.apiBaseUrl ??
        (network as unknown as { client?: { baseUrl?: string } }).client?.baseUrl;
      const networkName: Network = baseUrl?.includes("testnet") ? "testnet" : "mainnet";
      return watchTransaction(txid, networkName, { ...watchOpts, apiBaseUrl: baseUrl ?? undefined });
    },

    calculateImpermanentLoss(
      entryPrice: number,
      currentPrice: number,
    ) {
      return calculateImpermanentLoss(entryPrice, currentPrice);
    },

    calculatePositionValue(
      lpShares: number,
      totalShares: number,
      reserveX: number,
      reserveY: number,
    ) {
      return calculatePositionValue(lpShares, totalShares, reserveX, reserveY);
    },

    estimateFeeEarnings(params: FeeEarningsParams) {
      return estimateFeeEarnings(params);
    },

    fetchAllPoolQuotes(
      pools: PoolContract[],
      params: Omit<MultiPoolQuoteParams, "senderAddress"> & { senderAddress?: string },
    ) {
      const resolvedSender = requireSenderAddress(params.senderAddress);
      return fetchAllPoolQuotes(network, pools, {
        ...params,
        senderAddress: resolvedSender,
        decimals: params.decimals ?? decimals,
      });
    },

    fetchBestQuote(
      pools: PoolContract[],
      params: Omit<MultiPoolQuoteParams, "senderAddress"> & { senderAddress?: string },
    ) {
      const resolvedSender = requireSenderAddress(params.senderAddress);
      return fetchBestQuote(network, pools, {
        ...params,
        senderAddress: resolvedSender,
        decimals: params.decimals ?? decimals,
      });
    },
  };
};

export const isValidStacksAddress = (address: string) =>
  validateStacksAddress(String(address || "").trim());

export const requireStacksAddress = (address: string) => {
  const raw = String(address || "").trim();
  if (!raw) throw new Error("Stacks address is empty.");
  if (!validateStacksAddress(raw)) throw new Error("Invalid Stacks address.");
  return raw;
};

export const nowSeconds = (date: Date = new Date()) =>
  Math.floor(date.getTime() / 1000);

export const deadlineSecondsFromNow = (
  minutesFromNow: number,
  now = nowSeconds(),
) => now + Math.max(0, Math.floor(Number(minutesFromNow) * 60));

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

export const calculatePriceImpactPercent = (
  amountIn: number,
  amountOut: number,
  reserveIn: number,
  reserveOut: number,
) => {
  const input = Number(amountIn);
  const output = Number(amountOut);
  const inReserve = Number(reserveIn);
  const outReserve = Number(reserveOut);
  if (
    !Number.isFinite(input) ||
    !Number.isFinite(output) ||
    !Number.isFinite(inReserve) ||
    !Number.isFinite(outReserve)
  ) {
    return 0;
  }
  if (input <= 0 || output <= 0 || inReserve <= 0 || outReserve <= 0) return 0;
  const spotPrice = outReserve / inReserve;
  if (!Number.isFinite(spotPrice) || spotPrice <= 0) return 0;
  const executionPrice = output / input;
  if (!Number.isFinite(executionPrice) || executionPrice <= 0) return 0;
  const impact = ((spotPrice - executionPrice) / spotPrice) * 100;
  return Number.isFinite(impact) ? Math.max(0, impact) : 0;
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
const tokenInfoInFlight = new Map<string, Promise<TokenMetadata>>();

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
  const { address, name } = parseContractPrincipal(token.contract);
  return someCV(contractPrincipalCV(address, name));
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

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const wait = Math.max(0, Math.floor(ms));
    if (!wait) {
      resolve();
      return;
    }

    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const id = setTimeout(() => {
      cleanup();
      resolve();
    }, wait);

    const onAbort = () => {
      clearTimeout(id);
      cleanup();
      reject(new Error("Aborted"));
    };

    const cleanup = () => {
      if (!signal) return;
      signal.removeEventListener("abort", onAbort);
    };

    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || (status >= 500 && status <= 599);

const fetchWithRetry = async (
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  opts: Pick<
    TokenMetadataOptions,
    "signal" | "retries" | "retryDelayMs" | "retryBackoffFactor"
  >,
) => {
  const retries = Math.max(0, Math.floor(opts.retries ?? 2));
  const retryDelayMs = Math.max(0, Math.floor(opts.retryDelayMs ?? 250));
  const retryBackoffFactor = Math.max(1, Number(opts.retryBackoffFactor ?? 2));

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (opts.signal?.aborted) throw new Error("Aborted");
    try {
      const res = await fetcher(url, { ...init, signal: opts.signal });
      if (!isRetryableStatus(res.status) || attempt >= retries) {
        return res;
      }
    } catch (error) {
      if (attempt >= retries) throw error;
    }
    const backoff = retryDelayMs * retryBackoffFactor ** attempt;
    attempt += 1;
    await sleep(backoff, opts.signal);
  }
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

export const formatMicroAmount = (
  amountMicro: number | string | bigint,
  decimals: number,
  opts: { maxFractionDigits?: number; trimTrailingZeros?: boolean } = {},
) => {
  const decimalsInt = Math.floor(decimals);
  if (!Number.isFinite(decimalsInt) || decimalsInt <= 0) {
    throw new Error("Invalid decimals value.");
  }
  const precision = Math.round(Math.log10(decimalsInt));
  if (10 ** precision !== decimalsInt) {
    throw new Error("formatMicroAmount requires power-of-10 decimals.");
  }

  const micro =
    typeof amountMicro === "bigint"
      ? amountMicro
      : typeof amountMicro === "number"
        ? BigInt(Math.floor(amountMicro))
        : BigInt(String(amountMicro).trim() || "0");

  const sign = micro < 0n ? "-" : "";
  const abs = micro < 0n ? -micro : micro;
  const base = BigInt(decimalsInt);

  const whole = abs / base;
  const frac = abs % base;
  let fracStr = frac.toString().padStart(precision, "0");

  const maxFractionDigits =
    typeof opts.maxFractionDigits === "number"
      ? Math.max(0, Math.min(precision, Math.floor(opts.maxFractionDigits)))
      : precision;
  if (maxFractionDigits < precision) fracStr = fracStr.slice(0, maxFractionDigits);

  const trim = opts.trimTrailingZeros ?? true;
  if (trim && fracStr) fracStr = fracStr.replace(/0+$/, "");

  return fracStr ? `${sign}${whole.toString()}.${fracStr}` : `${sign}${whole.toString()}`;
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
  const res = await fetchWithRetry(
    fetcher,
    url,
    { headers: { accept: "application/json" } },
    opts,
  );
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
  const res = await fetchWithRetry(
    fetcher,
    `${getApiBaseUrl(opts)}/v2/contracts/interface/${address}/${contractName}`,
    { headers: { accept: "application/json" } },
    opts,
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

export const validatePoolContract = async (
  pool: PoolContract | string,
  opts: TokenMetadataOptions = {},
) => {
  const principal =
    typeof pool === "string"
      ? String(pool || "").trim()
      : buildContractPrincipal(pool.address, pool.name);

  if (!principal) {
    return { ok: false, message: "Pool must be address.contract format." };
  }

  let parts: ContractPrincipalParts;
  try {
    parts = parseContractPrincipal(principal);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid pool identifier.",
    };
  }

  const fetcher = getFetch(opts);
  const res = await fetchWithRetry(
    fetcher,
    `${getApiBaseUrl(opts)}/v2/contracts/interface/${parts.address}/${parts.name}`,
    { headers: { accept: "application/json" } },
    opts,
  );
  if (!res.ok) {
    return { ok: false, message: "Pool contract interface not found." };
  }

  const data = (await res.json()) as { functions?: { name?: string }[] };
  const functions = Array.isArray(data?.functions) ? data.functions : [];
  const required = [
    "get-reserves",
    "get-total-supply",
    "quote-x-for-y",
    "quote-y-for-x",
    "swap-x-for-y",
    "swap-y-for-x",
    "initialize-pool",
    "add-liquidity",
    "remove-liquidity",
  ];
  const missing = required.filter(
    (fn) => !functions.some((f) => f?.name === fn),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing pool functions: ${missing.join(", ")}.`,
      missing,
    };
  }

  return { ok: true as const };
};

export const validatePoolContractString = async (
  contractPrincipal: string,
  opts: TokenMetadataOptions = {},
) => {
  const principal = String(contractPrincipal ?? "").trim();
  if (!principal) {
    return { ok: false, message: "Pool contract is required." };
  }

  let parts: ContractPrincipalParts;
  try {
    parts = parseContractPrincipal(principal);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid pool contract identifier.",
    };
  }

  if (!validateStacksAddress(parts.address)) {
    return { ok: false, message: "Invalid pool contract address." };
  }
  if (!parts.name) {
    return { ok: false, message: "Missing pool contract name." };
  }

  return validatePoolContract(principal, opts);
};

export const fetchTokenInfo = async (
  id: string,
  opts: TokenMetadataOptions = {},
): Promise<TokenMetadata> => {
  const cacheKey = buildTokenInfoCacheKey(id, opts);
  const cached = getCachedTokenInfo(id, opts);
  if (cached) return cached;

  if (!opts.signal) {
    const inFlight = tokenInfoInFlight.get(cacheKey);
    if (inFlight) return inFlight;
  }

  const run = async (): Promise<TokenMetadata> => {
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
      cacheTokenInfo(info, opts);
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
      cacheTokenInfo(info, opts);
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

  if (opts.signal) {
    return run();
  }

  const promise = run();
  tokenInfoInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    tokenInfoInFlight.delete(cacheKey);
  }
};

export const fetchTokenInfos = async (
  ids: string[],
  opts: FetchTokenInfosOptions = {},
): Promise<TokenMetadata[]> => {
  const list = Array.isArray(ids) ? ids : [];
  if (list.length === 0) return [];

  const concurrency = Math.max(1, Math.floor(opts.concurrency ?? 6));
  let cursor = 0;
  const results: TokenMetadata[] = new Array(list.length);

  const worker = async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (opts.signal?.aborted) return;
      const idx = cursor;
      cursor += 1;
      if (idx >= list.length) return;
      results[idx] = await fetchTokenInfo(list[idx] as string, opts);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, () => worker()),
  );

  return results;
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

export const buildSwapPostConditions = (params: {
  senderAddress: string;
  tokenIn: TokenRef;
  amountIn: number | string | bigint;
  decimalsIn?: number;
  decimals?: number;
}): PostCondition[] => {
  const decimalsIn = params.decimalsIn ?? params.decimals ?? DEFAULT_DECIMALS;
  const amountInMicro = toMicroAmount(params.amountIn, decimalsIn);
  const sender = String(params.senderAddress || "").trim();
  if (!sender) throw new Error("senderAddress is required.");

  if (params.tokenIn.type === "stx") {
    return [Pc.principal(sender).willSendLte(amountInMicro).ustx()];
  }

  return [
    Pc.principal(sender)
      .willSendLte(amountInMicro)
      .ft(toContractIdString(params.tokenIn.contract), getSip10AssetName(params.tokenIn)),
  ];
};

export const buildAddLiquidityPostConditions = (params: {
  senderAddress: string;
  tokenX: TokenRef;
  tokenY: TokenRef;
  amountX: number | string | bigint;
  amountY: number | string | bigint;
  decimalsX?: number;
  decimalsY?: number;
  decimals?: number;
}): PostCondition[] => {
  const sender = String(params.senderAddress || "").trim();
  if (!sender) throw new Error("senderAddress is required.");

  const decimalsX = params.decimalsX ?? params.decimals ?? DEFAULT_DECIMALS;
  const decimalsY = params.decimalsY ?? params.decimals ?? DEFAULT_DECIMALS;
  const amountXMicro = toMicroAmount(params.amountX, decimalsX);
  const amountYMicro = toMicroAmount(params.amountY, decimalsY);

  const pcs: PostCondition[] = [];

  if (params.tokenX.type === "stx") {
    pcs.push(Pc.principal(sender).willSendLte(amountXMicro).ustx());
  } else {
    pcs.push(
      Pc.principal(sender)
        .willSendLte(amountXMicro)
        .ft(toContractIdString(params.tokenX.contract), getSip10AssetName(params.tokenX)),
    );
  }

  if (params.tokenY.type === "stx") {
    pcs.push(Pc.principal(sender).willSendLte(amountYMicro).ustx());
  } else {
    pcs.push(
      Pc.principal(sender)
        .willSendLte(amountYMicro)
        .ft(toContractIdString(params.tokenY.contract), getSip10AssetName(params.tokenY)),
    );
  }

  return pcs;
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
  const reserveOut =
    params.direction === "x-to-y" ? state.reserveY : state.reserveX;

  const priceImpactPercent =
    senderAmountForEstimate === null
      ? null
      : calculatePriceImpactPercent(
          senderAmountForEstimate,
          expectedOut,
          reserveIn,
          reserveOut,
        );
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
  let inFlight = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const snapshot = await fetchPoolSnapshot(
        network,
        pool,
        senderAddress,
        decimals,
      );
      onSnapshot(snapshot);
    } catch (error) {
      opts.onError?.(error);
    } finally {
      inFlight = false;
      if (!stopped) {
        timeoutId = setTimeout(() => void tick(), intervalMs);
      }
    }
  };

  const immediate = opts.immediate ?? true;
  if (immediate) void tick();
  else timeoutId = setTimeout(() => void tick(), intervalMs);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
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

// ---------------------------------------------------------------------------
// Transaction status
// ---------------------------------------------------------------------------

export type TransactionStatus =
  | "pending"
  | "success"
  | "abort_by_response"
  | "abort_by_post_condition"
  | "not_found";

export type TransactionResult = {
  txid: string;
  status: TransactionStatus;
  /** Block height once confirmed, undefined while pending. */
  blockHeight?: number;
  /** Clarity result repr string, e.g. "(ok true)" or "(err u104)". */
  resultRepr?: string;
};

export type WatchTransactionOptions = {
  /** How often to poll. Default 4 000 ms. */
  intervalMs?: number;
  /** Give up after this many ms and reject. Default 300 000 ms (5 min). */
  timeoutMs?: number;
  /** Called on every poll with the current result while still pending. */
  onStatus?: (result: TransactionResult) => void;
  /** Override the Hiro API base URL (useful for custom nodes). */
  apiBaseUrl?: string;
  signal?: AbortSignal;
};

const TERMINAL_TX_STATUSES: TransactionStatus[] = [
  "success",
  "abort_by_response",
  "abort_by_post_condition",
];

/**
 * Fetches the current on-chain status of a transaction from the Hiro API.
 * Returns `"not_found"` when the txid is unknown (not yet in mempool).
 */
export const fetchTransactionStatus = async (
  txid: string,
  networkName: Network,
  apiBaseUrl?: string,
): Promise<TransactionResult> => {
  const base = apiBaseUrl ?? API_BY_NETWORK[networkName];
  const url = `${base}/extended/v1/tx/${encodeURIComponent(txid)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });

  if (res.status === 404) {
    return { txid, status: "not_found" };
  }

  if (!res.ok) {
    throw new Error(`Hiro API error ${res.status} fetching tx ${txid}`);
  }

  const data = (await res.json()) as {
    tx_status?: string;
    block_height?: number;
    tx_result?: { repr?: string };
  };

  const raw = String(data.tx_status ?? "").trim();
  const status: TransactionStatus =
    raw === "success" ||
    raw === "abort_by_response" ||
    raw === "abort_by_post_condition"
      ? raw
      : raw === "pending"
        ? "pending"
        : "not_found";

  return {
    txid,
    status,
    blockHeight: typeof data.block_height === "number" ? data.block_height : undefined,
    resultRepr: data.tx_result?.repr,
  };
};

/**
 * Polls a transaction until it reaches a terminal state (success or abort),
 * then resolves with the final {@link TransactionResult}.
 *
 * Rejects when `timeoutMs` elapses or the `signal` is aborted.
 *
 * @example
 * const result = await watchTransaction(txid, "mainnet", {
 *   onStatus: (r) => console.log(r.status),
 * });
 * if (result.status === "success") { ... }
 */
export const watchTransaction = (
  txid: string,
  networkName: Network,
  opts: WatchTransactionOptions = {},
): Promise<TransactionResult> => {
  const intervalMs = Math.max(500, Math.floor(opts.intervalMs ?? 4_000));
  const timeoutMs = Math.max(1_000, Math.floor(opts.timeoutMs ?? 300_000));
  const apiBaseUrl = opts.apiBaseUrl;

  return new Promise((resolve, reject) => {
    let stopped = false;
    let inFlight = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pollId: ReturnType<typeof setTimeout> | null = null;

    const stop = (err?: unknown) => {
      if (stopped) return;
      stopped = true;
      if (pollId) clearTimeout(pollId);
      if (timeoutId) clearTimeout(timeoutId);
      if (err !== undefined) reject(err);
    };

    const tick = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const result = await fetchTransactionStatus(txid, networkName, apiBaseUrl);
        if (stopped) return;
        opts.onStatus?.(result);
        if (TERMINAL_TX_STATUSES.includes(result.status)) {
          stop();
          resolve(result);
          return;
        }
      } catch (err) {
        if (!stopped) opts.onStatus?.({ txid, status: "not_found" });
      } finally {
        inFlight = false;
        if (!stopped) {
          pollId = setTimeout(() => void tick(), intervalMs);
        }
      }
    };

    timeoutId = setTimeout(
      () => stop(new Error(`watchTransaction timed out after ${timeoutMs}ms for ${txid}`)),
      timeoutMs,
    );

    if (opts.signal) {
      if (opts.signal.aborted) {
        stop(new Error("watchTransaction aborted"));
        return;
      }
      opts.signal.addEventListener(
        "abort",
        () => stop(new Error("watchTransaction aborted")),
        { once: true },
      );
    }

    void tick();
  });
};

// ---------------------------------------------------------------------------
// LP math utilities
// ---------------------------------------------------------------------------

export type ImpermanentLossResult = {
  /** IL as a negative percentage, e.g. -5.72 means the LP lost 5.72% vs holding. */
  lossPercent: number;
  /** Value multiplier of the LP position relative to hold, e.g. 0.9428. */
  holdValueMultiplier: number;
};

/**
 * Calculates impermanent loss given the price ratio at entry vs now.
 *
 * Both prices should be expressed as `tokenY per tokenX`
 * (e.g. if 1 X = 2 Y at entry and now 1 X = 4 Y, pass `entryPrice=2, currentPrice=4`).
 *
 * @example
 * const { lossPercent } = calculateImpermanentLoss(100, 400);
 * // lossPercent ≈ -20  (price 4×'d → ~20% IL)
 */
export const calculateImpermanentLoss = (
  entryPrice: number,
  currentPrice: number,
): ImpermanentLossResult => {
  const p0 = Number(entryPrice);
  const p1 = Number(currentPrice);

  if (!Number.isFinite(p0) || !Number.isFinite(p1) || p0 <= 0 || p1 <= 0) {
    return { lossPercent: 0, holdValueMultiplier: 1 };
  }

  // k = price ratio (how many times the price moved)
  const k = p1 / p0;
  // AMM value relative to holding: 2√k / (1 + k)
  const holdValueMultiplier = (2 * Math.sqrt(k)) / (1 + k);
  const lossPercent = (holdValueMultiplier - 1) * 100;

  return {
    lossPercent: Number(lossPercent.toFixed(6)),
    holdValueMultiplier: Number(holdValueMultiplier.toFixed(8)),
  };
};

export type PositionValueResult = {
  /** Amount of token X the LP shares represent. */
  tokenX: number;
  /** Amount of token Y the LP shares represent. */
  tokenY: number;
  /** Fraction of the pool owned, 0–1. */
  poolShare: number;
};

/**
 * Calculates how much token X and token Y a given amount of LP shares
 * can be redeemed for at the current pool reserves.
 *
 * All values should be in the same unit (either all human-readable or all micro).
 *
 * @example
 * const { tokenX, tokenY } = calculatePositionValue(500, 10_000, 80_000, 120_000);
 */
export const calculatePositionValue = (
  lpShares: number,
  totalShares: number,
  reserveX: number,
  reserveY: number,
): PositionValueResult => {
  const shares = Number(lpShares);
  const total = Number(totalShares);
  const rx = Number(reserveX);
  const ry = Number(reserveY);

  if (
    !Number.isFinite(shares) ||
    !Number.isFinite(total) ||
    !Number.isFinite(rx) ||
    !Number.isFinite(ry) ||
    total <= 0 ||
    shares < 0
  ) {
    return { tokenX: 0, tokenY: 0, poolShare: 0 };
  }

  const poolShare = Math.min(1, shares / total);
  return {
    tokenX: rx * poolShare,
    tokenY: ry * poolShare,
    poolShare,
  };
};

export type FeeEarningsParams = {
  lpShares: number;
  totalShares: number;
  /** Total swap volume in token X over the period. */
  volumeX: number;
  /** Total swap volume in token Y over the period. */
  volumeY: number;
  /** Pool fee in basis points, e.g. 30 for 0.30%. */
  feeBps: number;
  /**
   * Duration the volume covers, in hours. Used for APR projection.
   * Pass `24` when `volumeX/volumeY` are 24h figures.
   */
  periodHours?: number;
};

export type FeeEarningsResult = {
  /** User's share of fees earned in token X over the period. */
  earnedX: number;
  /** User's share of fees earned in token Y over the period. */
  earnedY: number;
  /**
   * Annualised percentage return on the position value, expressed as a
   * percentage (e.g. 12.5 = 12.5% APR). `null` when position value is zero
   * or `periodHours` was not provided.
   */
  apr: number | null;
};

/**
 * Estimates the fee earnings for an LP position over a given volume period.
 *
 * @example
 * const { earnedX, earnedY, apr } = estimateFeeEarnings({
 *   lpShares: 1_000,
 *   totalShares: 50_000,
 *   volumeX: 200_000,
 *   volumeY: 180_000,
 *   feeBps: 30,
 *   periodHours: 24,
 * });
 */
export const estimateFeeEarnings = (params: FeeEarningsParams): FeeEarningsResult => {
  const {
    lpShares,
    totalShares,
    volumeX,
    volumeY,
    feeBps,
    periodHours,
  } = params;

  const shares = Number(lpShares);
  const total = Number(totalShares);
  const vx = Number(volumeX);
  const vy = Number(volumeY);
  const fee = Number(feeBps);

  if (
    !Number.isFinite(shares) ||
    !Number.isFinite(total) ||
    !Number.isFinite(vx) ||
    !Number.isFinite(vy) ||
    !Number.isFinite(fee) ||
    total <= 0 ||
    shares < 0 ||
    fee < 0
  ) {
    return { earnedX: 0, earnedY: 0, apr: null };
  }

  const poolShare = Math.min(1, shares / total);
  const feeRate = fee / 10_000;
  const earnedX = vx * feeRate * poolShare;
  const earnedY = vy * feeRate * poolShare;

  let apr: number | null = null;
  if (periodHours && periodHours > 0 && Number.isFinite(periodHours)) {
    // Total fees earned in X-equivalent (use X side as proxy)
    const totalFeeX = (vx + vy) * feeRate * poolShare;
    // Annualise: fees per hour → per year
    const annualFeeX = totalFeeX * (8_760 / periodHours);
    // Position value in X-equivalent (rough: earnedX proxy of pool value share)
    const positionValueX = vx > 0 ? (shares / total) * vx : 0;
    apr = positionValueX > 0 ? (annualFeeX / positionValueX) * 100 : null;
  }

  return { earnedX, earnedY, apr };
};

// ---------------------------------------------------------------------------
// Multi-pool quote comparison
// ---------------------------------------------------------------------------

export type PoolQuoteResult = {
  pool: PoolContract;
  quote: QuoteDetailedResult;
};

export type MultiPoolQuoteParams = Omit<QuoteParams, "pool"> & {
  slippagePercent?: number;
  decimals?: number;
  decimalsIn?: number;
  decimalsOut?: number;
};

/**
 * Fetches quotes from every pool in `pools` in parallel and returns them
 * sorted by `expectedOut` descending (best price first).
 *
 * Pools that fail (no liquidity, network error, etc.) are silently skipped
 * so a single bad pool never breaks the comparison.
 *
 * @example
 * const quotes = await fetchAllPoolQuotes(network, [poolA, poolB, poolC], {
 *   amountIn: 100,
 *   direction: "x-to-y",
 *   senderAddress: "SP...",
 * });
 * // quotes[0] has the best price
 */
export const fetchAllPoolQuotes = async (
  network: StacksNetwork,
  pools: PoolContract[],
  params: MultiPoolQuoteParams,
): Promise<PoolQuoteResult[]> => {
  if (!pools.length) return [];

  const settled = await Promise.allSettled(
    pools.map((pool) => fetchQuoteDetailed(network, { ...params, pool })),
  );

  const results: PoolQuoteResult[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      results.push({ pool: pools[i], quote: r.value });
    }
  }

  return results.sort((a, b) => b.quote.expectedOut - a.quote.expectedOut);
};

/**
 * Fetches quotes from every pool in `pools` in parallel and returns the one
 * with the highest `expectedOut`. Returns `null` when all pools fail.
 *
 * @example
 * const best = await fetchBestQuote(network, [poolA, poolB], {
 *   amountIn: 100,
 *   direction: "x-to-y",
 *   senderAddress: "SP...",
 * });
 * if (best) {
 *   console.log(best.pool, best.quote.expectedOut);
 * }
 */
export const fetchBestQuote = async (
  network: StacksNetwork,
  pools: PoolContract[],
  params: MultiPoolQuoteParams,
): Promise<PoolQuoteResult | null> => {
  const all = await fetchAllPoolQuotes(network, pools, params);
  return all.length > 0 ? all[0] : null;
};
