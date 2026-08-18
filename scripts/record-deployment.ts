/**
 * Fills a deployment manifest from a Foundry broadcast artefact, then completes
 * it by READING THE CHAIN.
 *
 * The artefact alone is not enough. It records the transactions we sent, so it
 * knows the 18 contracts the deployer created directly — but the three `Basket`
 * contracts are created by `Arkiv.createBasket` via internal CREATE, and appear
 * nowhere in it. It also names every wrapper `MockWrapper_N`, which is an
 * artefact of deploy order rather than anything meaningful.
 *
 * So symbols and baskets are resolved by calling the deployed contracts. That
 * makes the manifest self-checking: if a wrapper is not really at that address,
 * `symbol()` fails and nothing is written.
 *
 *   npx tsx scripts/record-deployment.ts <chainId> <script-name> [rpcUrl]
 *   npx tsx scripts/record-deployment.ts 1952 DeployTestnet.s.sol
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, getAddress, http, type Address } from "viem";

const [chainId, scriptName, rpcArg] = process.argv.slice(2);
if (!chainId || !scriptName) {
  console.error("usage: record-deployment.ts <chainId> <script-name> [rpcUrl]");
  process.exit(1);
}

const RPC: Record<string, string> = {
  "1952": "https://testrpc.xlayer.tech",
  "196": "https://rpc.xlayer.tech",
};
const rpcUrl = rpcArg ?? RPC[chainId];
if (!rpcUrl) {
  console.error(`no RPC known for chain ${chainId}; pass one as the third argument`);
  process.exit(1);
}

interface BroadcastTx {
  transactionType: string;
  contractName: string | null;
  contractAddress: string | null;
  hash: string;
  function: string | null;
}

const broadcast = JSON.parse(
  readFileSync(join("contracts", "broadcast", scriptName, chainId, "run-latest.json"), "utf8"),
) as {
  transactions: (BroadcastTx & { transaction: { from?: string } })[];
  receipts: { blockNumber: string }[];
  timestamp: number;
};

const file = chainId === "196" ? "xlayer-mainnet.json" : "xlayer-testnet.json";
const path = join("deployments", file);
const manifest = JSON.parse(readFileSync(path, "utf8"));

const client = createPublicClient({ transport: http(rpcUrl) });

const symbolAbi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;
const thesisUriAbi = [
  { type: "function", name: "thesisURI", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const nameAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;
const basketsAbi = [
  {
    type: "function",
    name: "getAllBaskets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
] as const;

// --- 1. Directly-deployed contracts, from the artefact -----------------------
const created = broadcast.transactions.filter(
  (t) => t.transactionType === "CREATE" && t.contractName && t.contractAddress,
);

const contracts: Record<string, string> = {};
const assets: Record<string, string> = {};

for (const tx of created) {
  const address = getAddress(tx.contractAddress!);
  if (tx.contractName === "MockWrapper") {
    // Name it by what it actually calls itself on chain, not by deploy order.
    const symbol = (await client.readContract({
      address,
      abi: symbolAbi,
      functionName: "symbol",
    })) as string;
    assets[symbol] = address;
    contracts[`MockWrapper:${symbol}`] = address;
  } else {
    contracts[tx.contractName!] = address;
  }
}

// --- 2. Baskets, which exist only on chain -----------------------------------
const arkiv = contracts.Arkiv as Address | undefined;
// `index` is the position in the registry's `baskets` array, which IS the
// serial: ARKIV-000N is index N-1. It is recorded explicitly rather than
// inferred from array position here, because two baskets can share a ticker and
// deriving a serial from the ticker collides the moment one does.
const baskets: {
  index: number;
  symbol: string;
  name: string;
  address: string;
  thesisHash: string | null;
}[] = [];
if (arkiv) {
  const addresses = (await client.readContract({
    address: arkiv,
    abi: basketsAbi,
    functionName: "getAllBaskets",
  })) as readonly Address[];

  // getAllBaskets returns the registry array in order, so the position here is
  // the registry index. Do not sort this.
  for (const [index, address] of addresses.entries()) {
    const [symbol, name, thesisURI] = await Promise.all([
      client.readContract({ address, abi: symbolAbi, functionName: "symbol" }) as Promise<string>,
      client.readContract({ address, abi: nameAbi, functionName: "name" }) as Promise<string>,
      client.readContract({ address, abi: thesisUriAbi, functionName: "thesisURI" }) as Promise<string>,
    ]);
    const hash = thesisURI.startsWith("arkiv:") ? thesisURI.slice("arkiv:".length) : null;
    baskets.push({ index, symbol, name, address: getAddress(address), thesisHash: hash });
    // Tickers are user-supplied and not unique, so a second basket with the
    // same ticker is keyed by its serial rather than silently overwriting the
    // first one's entry.
    const key = `Basket:${symbol}`;
    contracts[key in contracts ? `${key}#${index + 1}` : key] = getAddress(address);
  }
}

// --- 3. Provenance ------------------------------------------------------------
// Foundry writes `timestamp` in milliseconds; treating it as seconds dates the
// deployment to the year 58580.
const ts = broadcast.timestamp;
const ms = ts > 1e12 ? ts : ts * 1000;

const first = broadcast.transactions[0];
const sample = (fn: string) => broadcast.transactions.find((t) => t.function?.startsWith(fn))?.hash ?? null;

manifest.status = "deployed";
manifest.deployedAt = new Date(ms).toISOString();
manifest.deployBlock = broadcast.receipts.length
  ? Number(BigInt(broadcast.receipts[0]!.blockNumber))
  : null;
manifest.deployer = first?.transaction?.from ? getAddress(first.transaction.from) : null;
manifest.contracts = contracts;
// On mainnet the assets are not deployed by this script: USDG and the 14
// wrappers already exist on chain 196. So rather than harvesting them from the
// broadcast artifact, which would find nothing, read the deployed registry's
// own allowlist. Only assets the registry actually accepted are recorded, and
// each symbol is read from the token itself rather than assumed from a label.
if (chainId === "196" && contracts.Arkiv) {
  const assetInfoAbi = [
    {
      type: "function",
      name: "assetInfo",
      stateMutability: "view",
      inputs: [{ type: "address" }],
      outputs: [{ name: "allowed", type: "bool" }, { name: "isCore", type: "bool" }],
    },
  ] as const;

  const configured = [...readFileSync(join("contracts", "src", "config", "XLayerConfig.sol"), "utf8")
    .matchAll(/address internal constant W_\w+ = (0x[0-9a-fA-F]{40});/g)]
    .map((m) => getAddress(m[1] as string));

  for (const wrapper of configured) {
    const [allowed] = (await client.readContract({
      address: contracts.Arkiv as `0x${string}`,
      abi: assetInfoAbi,
      functionName: "assetInfo",
      args: [wrapper],
    })) as [boolean, boolean];
    if (!allowed) continue;
    const symbol = (await client.readContract({
      address: wrapper,
      abi: symbolAbi,
      functionName: "symbol",
    })) as string;
    // The registry holds wrappers named wGLDx; the app's universe calls that
    // asset GLDx. Strip the wrapper prefix so both sides agree on the symbol.
    assets[symbol.replace(/^w/, "")] = wrapper;
  }
}

manifest.assets = assets;
manifest.baskets = baskets;
manifest.transactions = { mint: sample("mint("), redeem: sample("redeem(") };

writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `recorded ${Object.keys(contracts).length} contracts, ${Object.keys(assets).length} assets, ` +
    `${baskets.length} baskets to ${path}`,
);
