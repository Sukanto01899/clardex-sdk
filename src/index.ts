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

export const isStxRef = (
  token: TokenRef,
): token is Extract<TokenRef, { type: "stx" }> => token.type === "stx";

export const isSip10Ref = (
  token: TokenRef,
): token is Extract<TokenRef, { type: "sip10" }> => token.type === "sip10";

export const formatTokenRef = (token: TokenRef): TokenRefString => {
  if (isStxRef(token)) return "STX";
  const contract = toContractIdString(token.contract);
  const asset = String(token.asset ?? "").trim();
  if (asset) return `${contract}::${asset}`;
  return contract;
};

export const tokenRefToAssetId = (token: TokenRef): "STX" | `${string}.${string}::${string}` => {
  if (isStxRef(token)) return "STX";
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
  if (isStxRef(ref)) return null;
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

const CLARDEX_APP_TABS: ClardexAppTab[] = [
  "swap",
  "prices",
  "pools",
  "analytics",
  "liquidity",
];

export type ParsedClardexAppUrlParams = {
  pool: string | null;
  tab: ClardexAppTab | null;
  dir: "x-to-y" | "y-to-x" | null;
  amount: number | null;
  slippage: number | null;
  deadline: number | null;
};

/**
 * Parses the query params produced by {@link buildClardexAppUrl} back out of
 * a full URL (e.g. `window.location.href`), coercing each field to its
 * proper type and returning `null` for anything missing or invalid.
 *
 * @example
 * const params = parseClardexAppUrl(window.location.href);
 * if (params.dir) setSwapDirection(params.dir);
 * if (params.amount !== null) setSwapInput(String(params.amount));
 */
export const parseClardexAppUrl = (
  url: string | URL,
): ParsedClardexAppUrlParams => {
  const parsed = typeof url === "string" ? new URL(url) : url;
  const params = parsed.searchParams;

  const tabRaw = params.get("tab");
  const tab = CLARDEX_APP_TABS.includes(tabRaw as ClardexAppTab)
    ? (tabRaw as ClardexAppTab)
    : null;

  const dirRaw = params.get("dir");
  const dir = dirRaw === "x-to-y" || dirRaw === "y-to-x" ? dirRaw : null;

  const poolRaw = params.get("pool");
  const pool = poolRaw && poolRaw.trim() ? poolRaw.trim() : null;

  const amountRaw = params.get("amount");
  const amount = amountRaw === null ? null : parseAmount(amountRaw);

  const slippageRaw = params.get("slippage");
  const slippage = slippageRaw === null ? null : parseAmount(slippageRaw);

  const deadlineRaw = params.get("deadline");
  const deadline = deadlineRaw === null ? null : parseAmount(deadlineRaw);

  return { pool, tab, dir, amount, slippage, deadline };
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

    formatAmount(value: number, formatOpts?: FormatAmountOptions) {
      return formatAmount(value, formatOpts);
    },

    parseAmount(raw: unknown) {
      return parseAmount(raw);
    },

    estimateSwapOut(params: EstimateSwapOutParams) {
      return estimateSwapOut(params);
    },

    estimateSpotPrice(reserveIn: number, reserveOut: number) {
      return estimateSpotPrice(reserveIn, reserveOut);
    },

    buildSplitSwapCalls(
      params: Omit<BuildSplitSwapCallsParams, "pool"> & { pool?: PoolContract },
    ) {
      return buildSplitSwapCalls({ ...params, pool: params.pool ?? pool });
    },

    buildGetLPBalanceCall(userAddress: string, targetPool?: PoolContract) {
      return buildGetLPBalanceCall(targetPool ?? pool, userAddress);
    },

    fetchUserLPBalance(userAddress: string, targetPool?: PoolContract) {
      return fetchUserLPBalance(network, targetPool ?? pool, userAddress);
    },

    estimateLiquidityShares(
      params: Omit<EstimateLiquiditySharesParams, "decimals"> & { decimals?: number },
    ) {
      return estimateLiquidityShares({ ...params, decimals: params.decimals ?? decimals });
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

/**
 * Seconds remaining until a deadline built with {@link deadlineSecondsFromNow}.
 * Negative once the deadline has passed.
 *
 * @example
 * const deadline = deadlineSecondsFromNow(30);
 * secondsUntilDeadline(deadline); // ≈ 1800
 */
export const secondsUntilDeadline = (
  deadline: number,
  now = nowSeconds(),
) => Math.floor(Number(deadline)) - now;

/**
 * Whether a deadline built with {@link deadlineSecondsFromNow} has already passed.
 *
 * @example
 * const deadline = deadlineSecondsFromNow(30);
 * isDeadlineExpired(deadline); // false
 * isDeadlineExpired(deadline, deadline + 1); // true
 */
export const isDeadlineExpired = (
  deadline: number,
  now = nowSeconds(),
) => secondsUntilDeadline(deadline, now) <= 0;

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

/**
 * Calculates the percentage change from `oldValue` to `newValue`, e.g. for
 * a 24h price/reserve/volume comparison. Returns `null` when `oldValue` is
 * missing or not a positive finite number, since no meaningful percentage
 * can be computed from a zero/negative/unknown baseline.
 *
 * Pairs naturally with {@link formatSignedPercent} for display.
 *
 * @example
 * calculatePercentChange(100, 120)  // 20
 * calculatePercentChange(100, 90)   // -10
 * calculatePercentChange(0, 50)     // null
 * calculatePercentChange(null, 50)  // null
 */
export const calculatePercentChange = (
  oldValue: number | null | undefined,
  newValue: number | null | undefined,
): number | null => {
  const prev = Number(oldValue);
  const next = Number(newValue);
  if (!Number.isFinite(prev) || prev <= 0 || !Number.isFinite(next)) return null;
  return ((next - prev) / prev) * 100;
};

/**
 * Calculates the absolute (unsigned) relative drift between an input ratio
 * and a reference ratio — e.g. a deposit's tokenY/tokenX ratio vs. the
 * pool's current reserve ratio, to detect when a liquidity add is off the
 * pool price. Returns a fraction (multiply by 100, or pass to
 * {@link formatFractionAsPercent}, for display).
 *
 * Returns `null` when `referenceRatio` is not a positive finite number,
 * since drift can't be measured against a zero/unknown reference.
 *
 * @example
 * calculateRatioDrift(1.1, 1.0)  // 0.1   (10% off the reference)
 * calculateRatioDrift(1.0, 1.0)  // 0
 * calculateRatioDrift(1.0, 0)    // null
 */
export const calculateRatioDrift = (
  inputRatio: number,
  referenceRatio: number,
): number | null => {
  const input = Number(inputRatio);
  const reference = Number(referenceRatio);
  if (!Number.isFinite(reference) || reference <= 0 || !Number.isFinite(input)) {
    return null;
  }
  return Math.abs(input - reference) / reference;
};

/**
 * Checks whether a token allowance covers a required amount before
 * submitting a swap/liquidity tx, using a small epsilon so an allowance
 * that exactly equals the requirement isn't flagged as insufficient due to
 * floating-point rounding.
 *
 * A missing/`null` allowance is treated as `0`. A non-positive
 * `requiredAmount` always passes (nothing to approve).
 *
 * @example
 * hasSufficientAllowance(100, 100)    // true
 * hasSufficientAllowance(50, 100)     // false
 * hasSufficientAllowance(null, 100)   // false
 * hasSufficientAllowance(100, 0)      // true
 */
export const hasSufficientAllowance = (
  allowance: number | null | undefined,
  requiredAmount: number,
): boolean => {
  const required = Number(requiredAmount);
  if (!Number.isFinite(required) || required <= 0) return true;
  const current = Number(allowance ?? 0);
  if (!Number.isFinite(current)) return false;
  return current + Number.EPSILON >= required;
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

export type SlippageClampOptions = {
  minPct?: number;
  maxPct?: number;
  fallbackPct?: number;
};

/**
 * Clamps a user-typed slippage percentage into a safe range, falling back
 * to a sane default when the input is missing or not a valid number.
 *
 * Use this on the raw text from a slippage % input field before passing the
 * result to {@link calculateMinOut} / {@link calculateMinOutMicro}.
 *
 * @example
 * clampSlippagePercent("0.5")   // 0.5
 * clampSlippagePercent("120")   // 50  (clamped to maxPct)
 * clampSlippagePercent("-1")    // 0   (clamped to minPct)
 * clampSlippagePercent("abc")   // 0.5 (fallback)
 * clampSlippagePercent("")      // 0.5 (fallback)
 */
export const clampSlippagePercent = (
  rawValue: unknown,
  opts: SlippageClampOptions = {},
): number => {
  const minPct = opts.minPct ?? 0;
  const maxPct = opts.maxPct ?? 50;
  const fallbackPct = opts.fallbackPct ?? 0.5;
  const parsed = parseAmount(rawValue);
  if (parsed === null) return fallbackPct;
  return clampNumber(parsed, minPct, maxPct);
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
  if (isStxRef(token)) return noneCV();
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

  if (isStxRef(params.tokenIn)) {
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

  if (isStxRef(params.tokenX)) {
    pcs.push(Pc.principal(sender).willSendLte(amountXMicro).ustx());
  } else {
    pcs.push(
      Pc.principal(sender)
        .willSendLte(amountXMicro)
        .ft(toContractIdString(params.tokenX.contract), getSip10AssetName(params.tokenX)),
    );
  }

  if (isStxRef(params.tokenY)) {
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
        boolCV(isStxRef(params.tokenX)),
        boolCV(isStxRef(params.tokenY)),
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
// Account balances
// ---------------------------------------------------------------------------

/**
 * Extracts a fungible token's raw balance string from a Hiro
 * `/extended/v1/address/{address}/balances` response's `fungible_tokens`
 * map, matching by the full `contract.name::asset` token id first, then
 * falling back to any key whose trailing `.contractName::assetName` suffix
 * matches — which handles responses keyed by a different deployer/case
 * prefix than the one you queried with.
 *
 * Returns `undefined` when no match is found (treat as a zero balance).
 *
 * @example
 * const data = await (await fetch(`${apiBase}/extended/v1/address/${addr}/balances`)).json();
 * const raw = findFungibleTokenBalance(data.fungible_tokens, "SP....token-x::token-x");
 * const amount = raw ? fromMicroAmount(raw, 1_000_000) : 0;
 */
export const findFungibleTokenBalance = (
  fungibleTokens: Record<string, { balance?: string }> | null | undefined,
  tokenId: string,
): string | undefined => {
  const tokens = fungibleTokens || {};
  const id = String(tokenId || "").trim();
  if (!id) return undefined;
  if (tokens[id]?.balance) return tokens[id].balance;

  const assetIndex = id.indexOf("::");
  if (assetIndex === -1) return undefined;
  const contract = id.slice(0, assetIndex);
  const asset = id.slice(assetIndex + 2);
  const dotIndex = contract.lastIndexOf(".");
  if (dotIndex === -1) return undefined;
  const contractName = contract.slice(dotIndex + 1);

  const suffix = `.${contractName}::${asset}`;
  const key = Object.keys(tokens).find((k) => k.endsWith(suffix));
  return key ? tokens[key]?.balance : undefined;
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

// ---------------------------------------------------------------------------
// Display formatting & input parsing
// ---------------------------------------------------------------------------

export type FormatAmountOptions = {
  /**
   * Maximum number of decimal places shown. Default `6`.
   * Trailing zeros are always trimmed.
   */
  maxDecimals?: number;
  /**
   * Minimum number of significant digits kept when the value is very small.
   * E.g. `0.000001234` with `minSignificant: 3` → `"0.00000123"`.
   * Default `2`.
   */
  minSignificant?: number;
  /**
   * When `true`, values ≥ 1 000 are formatted with K / M / B / T suffixes.
   * E.g. `1_234_567` → `"1.23M"`. Default `false`.
   */
  compact?: boolean;
  /**
   * Show a `"<"` prefix when the non-zero value rounds to zero under
   * `maxDecimals`. E.g. `0.0000001` with `maxDecimals: 6` → `"<0.000001"`.
   * Default `true`.
   */
  ltPrefix?: boolean;
  /** BCP 47 locale used for `Intl.NumberFormat`. Default `"en-US"`. */
  locale?: string;
};

/**
 * Formats a token amount for display, with smart decimal trimming and
 * optional compact (K/M/B/T) notation.
 *
 * @example
 * formatAmount(1_234_567.89)          // "1,234,567.89"
 * formatAmount(0.000001234)           // "0.00000123"
 * formatAmount(0.0000001)             // "<0.000001"
 * formatAmount(1_234_567, { compact: true })  // "1.23M"
 * formatAmount(0)                     // "0"
 * formatAmount(NaN)                   // "—"
 */
export const formatAmount = (
  value: number,
  opts: FormatAmountOptions = {},
): string => {
  const maxDecimals = opts.maxDecimals ?? 6;
  const minSignificant = opts.minSignificant ?? 2;
  const compact = opts.compact ?? false;
  const ltPrefix = opts.ltPrefix ?? true;
  const locale = opts.locale ?? "en-US";

  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  // Compact notation for large numbers
  if (compact && abs >= 1_000) {
    const tiers: [number, string][] = [
      [1e12, "T"],
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];
    for (const [threshold, suffix] of tiers) {
      if (abs >= threshold) {
        const compact = abs / threshold;
        const formatted = new Intl.NumberFormat(locale, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 0,
        }).format(compact);
        return `${sign}${formatted}${suffix}`;
      }
    }
  }

  // For values >= 1, use standard locale formatting
  if (abs >= 1) {
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: maxDecimals,
      minimumFractionDigits: 0,
    }).format(value);
    return formatted;
  }

  // For small values, show enough significant digits
  const str = abs.toFixed(20);
  const dotIndex = str.indexOf(".");
  const decimals = dotIndex === -1 ? "" : str.slice(dotIndex + 1);

  // Count leading zeros after decimal point
  let leadingZeros = 0;
  for (const ch of decimals) {
    if (ch === "0") leadingZeros++;
    else break;
  }

  // Total decimal places needed: leading zeros + minSignificant digits
  const targetDecimals = Math.min(leadingZeros + minSignificant, 18);
  const rounded = Number(abs.toFixed(Math.max(targetDecimals, maxDecimals)));

  // If rounded to zero but original wasn't, show "<" prefix
  if (rounded === 0) {
    if (ltPrefix) {
      const smallest = Number(`1e-${maxDecimals}`);
      return `${sign}<${new Intl.NumberFormat(locale, {
        maximumFractionDigits: maxDecimals,
        minimumFractionDigits: maxDecimals,
      }).format(smallest)}`;
    }
    return `${sign}0`;
  }

  return (
    sign +
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: Math.max(targetDecimals, maxDecimals),
      minimumFractionDigits: 0,
    }).format(rounded)
  );
};

/**
 * Safely parses a user-typed amount string into a number.
 *
 * Strips thousands separators (`,`), currency symbols, and surrounding
 * whitespace. Returns `null` for empty, non-numeric, or non-finite input.
 *
 * @example
 * parseAmount("1,234.56")   // 1234.56
 * parseAmount("  0.5  ")    // 0.5
 * parseAmount("$1,000")     // 1000
 * parseAmount("")            // null
 * parseAmount("abc")         // null
 * parseAmount("-3.14")       // -3.14
 */
export const parseAmount = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;

  const str = String(raw)
    .trim()
    // Strip common currency/whitespace characters but keep digits, dots, dashes
    .replace(/[$€£¥₿\s_]/g, "")
    // Strip thousands separators: commas between digit groups
    .replace(/,(?=\d{3}(\D|$))/g, "")
    // Final fallback: strip any remaining commas
    .replace(/,/g, "");

  if (!str) return null;

  const n = Number(str);
  if (!Number.isFinite(n)) return null;

  return n;
};

/**
 * Formats a pool fee given in basis points as a display percentage.
 *
 * @example
 * formatFeeBps(30)    // "0.30%"
 * formatFeeBps(100)   // "1.00%"
 * formatFeeBps(5)     // "0.05%"
 * formatFeeBps(NaN)   // "—"
 */
export const formatFeeBps = (
  feeBps: number,
  opts: { maxDecimals?: number } = {},
): string => {
  const bps = Number(feeBps);
  if (!Number.isFinite(bps)) return "—";
  const maxDecimals = opts.maxDecimals ?? 2;
  return `${(bps / 100).toFixed(maxDecimals)}%`;
};

/**
 * Formats a percentage value with an explicit `+`/`-` sign, e.g. for 24h
 * price change or PnL. Returns `"N/A"` for `null`/non-finite input.
 *
 * @example
 * formatSignedPercent(5.2)    // "+5.20%"
 * formatSignedPercent(-3.1)   // "-3.10%"
 * formatSignedPercent(0)      // "0.00%"
 * formatSignedPercent(null)   // "N/A"
 */
export const formatSignedPercent = (
  value: number | null,
  opts: { maxDecimals?: number } = {},
): string => {
  if (value === null || !Number.isFinite(value)) return "N/A";
  const maxDecimals = opts.maxDecimals ?? 2;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(maxDecimals)}%`;
};

/**
 * Formats a 0–1 fraction (e.g. pool share, ratio drift) as a display
 * percentage. Unlike {@link formatSignedPercent}, the input is a fraction
 * (0.05 → "5.00%"), not an already-scaled percent value.
 *
 * @example
 * formatFractionAsPercent(0.1234)   // "12.34%"
 * formatFractionAsPercent(1)        // "100.00%"
 * formatFractionAsPercent(0.5, { maxDecimals: 0 })  // "50%"
 * formatFractionAsPercent(NaN)      // "—"
 */
export const formatFractionAsPercent = (
  fraction: number,
  opts: { maxDecimals?: number } = {},
): string => {
  const value = Number(fraction);
  if (!Number.isFinite(value)) return "—";
  const maxDecimals = opts.maxDecimals ?? 2;
  return `${(value * 100).toFixed(maxDecimals)}%`;
};

// ---------------------------------------------------------------------------
// Local AMM math (no network required)
// ---------------------------------------------------------------------------

export type EstimateSwapOutParams = {
  /** Amount of the input token (human-readable, not micro). */
  amountIn: number;
  /** Current reserve of the input token. */
  reserveIn: number;
  /** Current reserve of the output token. */
  reserveOut: number;
  /** Pool fee in basis points, e.g. `30` for 0.30%. */
  feeBps: number;
};

export type EstimateSwapOutResult = {
  /** Expected output amount (human-readable). */
  amountOut: number;
  /** Fee charged in terms of the input token. */
  fee: number;
  /** Price impact as a positive percentage, e.g. `2.5` means 2.5%. */
  priceImpactPercent: number;
  /** Spot price before the swap: output token per input token. */
  spotPrice: number;
  /** Execution price of this trade: output token per input token. */
  executionPrice: number;
  /** Reserve of the input token after the swap. */
  newReserveIn: number;
  /** Reserve of the output token after the swap. */
  newReserveOut: number;
  /** Spot price after the swap. */
  newSpotPrice: number;
};

/**
 * Estimates swap output using the constant-product AMM formula (x·y = k)
 * with a percentage fee — identical to the on-chain Clarity math.
 *
 * All values are in the same unit (human-readable or micro — be consistent).
 * Returns `null` when the inputs are invalid or there is no liquidity.
 *
 * Use this for **instant UI feedback** from a locally cached `PoolState`.
 * Always confirm with {@link fetchQuoteDetailed} before submitting a tx.
 *
 * @example
 * const est = estimateSwapOut({
 *   amountIn: 100,
 *   reserveIn: 50_000,
 *   reserveOut: 80_000,
 *   feeBps: 30,
 * });
 * // est.amountOut ≈ 157.8
 * // est.priceImpactPercent ≈ 0.2
 */
export const estimateSwapOut = (
  params: EstimateSwapOutParams,
): EstimateSwapOutResult | null => {
  const amountIn = Number(params.amountIn);
  const reserveIn = Number(params.reserveIn);
  const reserveOut = Number(params.reserveOut);
  const feeBps = Number(params.feeBps);

  if (
    !Number.isFinite(amountIn) ||
    !Number.isFinite(reserveIn) ||
    !Number.isFinite(reserveOut) ||
    !Number.isFinite(feeBps) ||
    amountIn <= 0 ||
    reserveIn <= 0 ||
    reserveOut <= 0 ||
    feeBps < 0 ||
    feeBps >= 10_000
  ) {
    return null;
  }

  // Constant-product formula with fee (same as Uniswap v2 / Clarity equivalent)
  const feeMult = 10_000 - feeBps;
  const amountInWithFee = amountIn * feeMult;
  const amountOut = (amountInWithFee * reserveOut) / (10_000 * reserveIn + amountInWithFee);
  const fee = amountIn * (feeBps / 10_000);

  if (amountOut <= 0 || amountOut >= reserveOut) return null;

  const spotPrice = reserveOut / reserveIn;
  const executionPrice = amountOut / amountIn;
  const priceImpactPercent = Math.max(0, ((spotPrice - executionPrice) / spotPrice) * 100);

  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = reserveOut - amountOut;
  const newSpotPrice = newReserveOut / newReserveIn;

  return {
    amountOut,
    fee,
    priceImpactPercent,
    spotPrice,
    executionPrice,
    newReserveIn,
    newReserveOut,
    newSpotPrice,
  };
};

/**
 * Returns the current spot price of a pool: how many output tokens per one
 * input token, before fees, based on the reserve ratio.
 *
 * @example
 * estimateSpotPrice(50_000, 80_000) // → 1.6  (1 X = 1.6 Y)
 */
export const estimateSpotPrice = (
  reserveIn: number,
  reserveOut: number,
): number | null => {
  const ri = Number(reserveIn);
  const ro = Number(reserveOut);
  if (!Number.isFinite(ri) || !Number.isFinite(ro) || ri <= 0 || ro <= 0) return null;
  return ro / ri;
};

// ---------------------------------------------------------------------------
// Split swap calls
// ---------------------------------------------------------------------------

export type BuildSplitSwapCallsParams = Omit<SwapParams, "amountIn" | "minOut"> & {
  /**
   * Total input amount to split across all calls (human-readable number).
   * Must be a plain `number` so it can be divided evenly.
   */
  amountIn: number;
  /**
   * Total minimum output across all calls. Divided evenly between splits.
   * Defaults to `0` (no minimum per split).
   */
  minOut?: number;
  /**
   * How many equal-sized calls to build. Clamped to [1, 100].
   * Use {@link suggestSplitCount} to calculate a good value from price impact.
   */
  splitCount: number;
};

export type SplitSwapCallsResult = {
  /** Individual contract calls, each swapping `amountInPerCall` tokens. */
  calls: ContractCall[];
  /** Actual split count used after clamping. */
  splitCount: number;
  /** Input amount for each individual call. */
  amountInPerCall: number;
  /** Minimum output for each individual call (`minOut / splitCount`). */
  minOutPerCall: number;
};

/**
 * Builds `splitCount` equal swap contract calls from a single large swap,
 * reducing price impact by spreading the trade across multiple transactions.
 *
 * Pair with {@link suggestSplitCount} to determine the right number of splits:
 *
 * @example
 * const impact = 18; // % from fetchQuoteDetailed
 * const count = suggestSplitCount(impact); // → 4
 *
 * const { calls, amountInPerCall } = buildSplitSwapCalls({
 *   splitCount: count,
 *   amountIn: 400,
 *   minOut: 620,
 *   pool, tokenX, tokenY,
 *   direction: "x-to-y",
 *   recipient: "SP...",
 *   deadline: deadlineSecondsFromNow(30),
 * });
 * // calls.length === 4, each swaps 100 tokens with minOut 155
 */
export const buildSplitSwapCalls = (
  params: BuildSplitSwapCallsParams,
): SplitSwapCallsResult => {
  const splitCount = Math.min(100, Math.max(1, Math.round(Number(params.splitCount))));
  const totalAmountIn = Number(params.amountIn);
  const totalMinOut = Number(params.minOut ?? 0);

  if (!Number.isFinite(totalAmountIn) || totalAmountIn <= 0) {
    throw new Error("buildSplitSwapCalls: amountIn must be a positive number.");
  }
  if (!Number.isFinite(totalMinOut) || totalMinOut < 0) {
    throw new Error("buildSplitSwapCalls: minOut must be a non-negative number.");
  }

  const amountInPerCall = totalAmountIn / splitCount;
  const minOutPerCall = totalMinOut / splitCount;

  const { splitCount: _sc, minOut: _mo, ...baseParams } = params;

  const calls = Array.from({ length: splitCount }, () =>
    buildSwapCall({ ...baseParams, amountIn: amountInPerCall, minOut: minOutPerCall }),
  );

  return { calls, splitCount, amountInPerCall, minOutPerCall };
};

// ---------------------------------------------------------------------------
// LP balance & liquidity share estimation
// ---------------------------------------------------------------------------

/**
 * Builds a read-only contract call for `get-lp-balance` — the user's current
 * LP share balance in a pool.
 */
export const buildGetLPBalanceCall = (
  pool: PoolContract,
  userAddress: string,
): ContractCall => ({
  contractAddress: pool.address,
  contractName: pool.name,
  functionName: "get-lp-balance",
  functionArgs: [standardPrincipalCV(userAddress)],
});

/**
 * Fetches a user's LP share balance from the pool contract.
 *
 * The returned value is in the same raw integer unit as `PoolState.totalShares`,
 * so `lpBalance / totalShares` gives the pool ownership fraction directly.
 *
 * @example
 * const lpBalance = await fetchUserLPBalance(network, pool, "SP...");
 * const poolShare = lpBalance / poolState.totalShares; // e.g. 0.05 = 5%
 */
export const fetchUserLPBalance = async (
  network: StacksNetwork,
  pool: PoolContract,
  userAddress: string,
): Promise<number> => {
  const raw = await fetchCallReadOnlyFunction({
    contractAddress: pool.address,
    contractName: pool.name,
    functionName: "get-lp-balance",
    functionArgs: [standardPrincipalCV(userAddress)],
    senderAddress: userAddress,
    network,
  });
  return normalizePoolTotalShares(unwrapReadOnlyOk(raw));
};

export type EstimateLiquiditySharesParams = {
  /** Amount of token X to deposit (human-readable). */
  amountX: number;
  /** Amount of token Y to deposit (human-readable). */
  amountY: number;
  /** Current pool state from {@link fetchPoolState} or {@link fetchPoolSnapshot}. */
  pool: PoolState;
  /**
   * Token decimal multiplier, e.g. `1_000_000` for 6-decimal tokens.
   * Default `1_000_000`.
   */
  decimals?: number;
};

export type EstimateLiquiditySharesResult = {
  /**
   * Estimated LP shares minted (raw integer, same unit as `PoolState.totalShares`).
   * Use `shares / (pool.totalShares + shares)` to get the post-deposit pool share.
   */
  shares: number;
  /**
   * Actual token X consumed after ratio balancing.
   * May be less than `amountX` when Y is the constraining side.
   */
  actualX: number;
  /**
   * Actual token Y consumed after ratio balancing.
   * May be less than `amountY` when X is the constraining side.
   */
  actualY: number;
  /** Ownership fraction of the pool after deposit, 0–1. */
  poolShareAfter: number;
  /** `true` when the pool has no liquidity yet — first deposit sets the price. */
  initializing: boolean;
};

/**
 * Estimates the LP shares a deposit would yield using the same constant-product
 * math as the on-chain contract — no network call required.
 *
 * When the pool is being initialized (`pool.totalShares === 0`), shares are
 * calculated as `√(amountX_micro × amountY_micro)`.
 * Otherwise the constraining side determines the share count and the other
 * side is adjusted to maintain the current ratio.
 *
 * @example
 * const est = estimateLiquidityShares({ amountX: 100, amountY: 160, pool });
 * console.log(est.shares);      // raw LP shares to be minted
 * console.log(est.actualX);     // may be < 100 if Y side is constrained
 * console.log(est.poolShareAfter * 100); // e.g. "2.34%"
 */
export const estimateLiquidityShares = (
  params: EstimateLiquiditySharesParams,
): EstimateLiquiditySharesResult | null => {
  const decimals = params.decimals ?? DEFAULT_DECIMALS;
  const amountX = Number(params.amountX);
  const amountY = Number(params.amountY);

  if (
    !Number.isFinite(amountX) || !Number.isFinite(amountY) ||
    amountX < 0 || amountY < 0
  ) return null;

  const { reserveX, reserveY, totalShares } = params.pool;
  const initializing = totalShares === 0;

  // Convert inputs to micro for integer arithmetic
  const amountXMicro = Math.floor(amountX * decimals);
  const amountYMicro = Math.floor(amountY * decimals);

  if (initializing) {
    // First deposit: shares = √(amountX_micro × amountY_micro)
    if (amountXMicro <= 0 || amountYMicro <= 0) return null;
    const shares = Math.floor(Math.sqrt(amountXMicro * amountYMicro));
    if (shares <= 0) return null;
    return {
      shares,
      actualX: amountX,
      actualY: amountY,
      poolShareAfter: 1,
      initializing: true,
    };
  }

  if (reserveX <= 0 || reserveY <= 0 || totalShares <= 0) return null;

  const reserveXMicro = Math.floor(reserveX * decimals);
  const reserveYMicro = Math.floor(reserveY * decimals);

  // Shares from each side — take the minimum (constraining side)
  const sharesFromX = (amountXMicro * totalShares) / reserveXMicro;
  const sharesFromY = (amountYMicro * totalShares) / reserveYMicro;
  const shares = Math.floor(Math.min(sharesFromX, sharesFromY));

  if (shares <= 0) return null;

  // Actual amounts consumed at the constrained share count
  const actualX = (shares * reserveXMicro) / totalShares / decimals;
  const actualY = (shares * reserveYMicro) / totalShares / decimals;
  const poolShareAfter = shares / (totalShares + shares);

  return { shares, actualX, actualY, poolShareAfter, initializing: false };
};

// ---------------------------------------------------------------------------
// Quote serialization
// ---------------------------------------------------------------------------

/**
 * JSON-safe version of {@link QuoteDetailedResult}: the four `bigint` fields
 * (`amountInMicro`, `expectedOutMicro`, `minOutMicro`, `feeMicro`) are
 * represented as decimal strings so the object survives `JSON.stringify`,
 * storage, and network transport without silent data loss.
 */
export type SerializedQuote = Omit<
  QuoteDetailedResult,
  "amountInMicro" | "expectedOutMicro" | "minOutMicro" | "feeMicro"
> & {
  amountInMicro: string;
  expectedOutMicro: string;
  minOutMicro: string | null;
  feeMicro: string;
};

/**
 * Converts a {@link QuoteDetailedResult} to a {@link SerializedQuote} by
 * turning every `bigint` field into its decimal string representation.
 * The result is safe to pass to `JSON.stringify`, store in a database, or
 * send over a network.
 *
 * @example
 * const quote = await client.fetchQuoteDetailed({ ... });
 * const payload = JSON.stringify(serializeQuote(quote));
 */
export const serializeQuote = (quote: QuoteDetailedResult): SerializedQuote => ({
  ...quote,
  amountInMicro: quote.amountInMicro.toString(),
  expectedOutMicro: quote.expectedOutMicro.toString(),
  minOutMicro: quote.minOutMicro === null ? null : quote.minOutMicro.toString(),
  feeMicro: quote.feeMicro.toString(),
});

/**
 * Restores a {@link SerializedQuote} back to a full {@link QuoteDetailedResult}
 * by parsing the string micro fields back to `bigint`.
 *
 * Throws if any string field is not a valid integer.
 *
 * @example
 * const quote = deserializeQuote(JSON.parse(payload));
 * quote.amountInMicro; // bigint
 */
export const deserializeQuote = (raw: SerializedQuote): QuoteDetailedResult => ({
  ...raw,
  amountInMicro: BigInt(raw.amountInMicro),
  expectedOutMicro: BigInt(raw.expectedOutMicro),
  minOutMicro: raw.minOutMicro === null ? null : BigInt(raw.minOutMicro),
  feeMicro: BigInt(raw.feeMicro),
});
