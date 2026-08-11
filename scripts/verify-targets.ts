/**
 * Emits verification targets: `<address> <source:Contract> <constructorArgsHex>`.
 *
 * Source paths are relative to `contracts/`, because that is where foundry.toml
 * lives and therefore the only directory `forge verify-contract` can resolve
 * them from.
 *
 * Constructor arguments are required to verify, and are obtained two different
 * ways because the contracts arrive two different ways:
 *
 *   - Directly deployed contracts: slice the creation transaction's calldata
 *     against the compiled creation bytecode. Whatever trails the known prefix
 *     IS the encoded constructor argument blob, byte for byte. This beats
 *     re-encoding the artefact's decoded `arguments`, which round-trips strings
 *     and numbers through JSON and can disagree with what was actually mined.
 *
 *   - Baskets: created by `Arkiv.createBasket` through an internal CREATE, so
 *     there is no transaction to slice. Their arguments are re-encoded from what
 *     the deployed basket reports about itself.
 *
 *   npx tsx scripts/verify-targets.ts [chainId] [rpcUrl]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, encodeAbiParameters, http, type Address, type Hex } from "viem";

const chainId = process.argv[2] ?? "1952";
const rpcUrl = process.argv[3] ?? "https://testrpc.xlayer.tech";

const manifest = JSON.parse(
  readFileSync(join("deployments", chainId === "196" ? "xlayer-mainnet.json" : "xlayer-testnet.json"), "utf8"),
);
const broadcast = JSON.parse(
  readFileSync(join("contracts", "broadcast", "DeployTestnet.s.sol", chainId, "run-latest.json"), "utf8"),
) as {
  transactions: {
    transactionType: string;
    contractName: string | null;
    contractAddress: string | null;
    transaction: { input?: Hex; data?: Hex };
  }[];
};

const SOURCE: Record<string, string> = {
  Arkiv: "src/Arkiv.sol:Arkiv",
  MockUSDG: "src/mocks/TestnetMocks.sol:MockUSDG",
  MockSanctionsList: "src/mocks/TestnetMocks.sol:MockSanctionsList",
  MockDexAdapter: "src/mocks/TestnetMocks.sol:MockDexAdapter",
  MockWrapper: "src/mocks/TestnetMocks.sol:MockWrapper",
  Basket: "src/Basket.sol:Basket",
};

/** Compiled creation bytecode for a contract, from the Foundry artefact. */
function creationBytecode(file: string, contract: string): string {
  const artefact = JSON.parse(
    readFileSync(join("contracts", "out", file, `${contract}.json`), "utf8"),
  );
  return (artefact.bytecode.object as string).toLowerCase().replace(/^0x/, "");
}

const ARTEFACT_FILE: Record<string, string> = {
  Arkiv: "Arkiv.sol",
  Basket: "Basket.sol",
  MockUSDG: "TestnetMocks.sol",
  MockSanctionsList: "TestnetMocks.sol",
  MockDexAdapter: "TestnetMocks.sol",
  MockWrapper: "TestnetMocks.sol",
};

const out: string[] = [];

// --- Directly deployed: slice the creation calldata --------------------------
for (const tx of broadcast.transactions) {
  if (tx.transactionType !== "CREATE" || !tx.contractName || !tx.contractAddress) continue;
  const name = tx.contractName;
  const input = ((tx.transaction.input ?? tx.transaction.data ?? "0x") as string)
    .toLowerCase()
    .replace(/^0x/, "");
  const prefix = creationBytecode(ARTEFACT_FILE[name]!, name);

  if (!input.startsWith(prefix)) {
    console.error(`! ${name} @ ${tx.contractAddress}: creation bytecode does not match artefact`);
    process.exit(1);
  }
  const args = input.slice(prefix.length);
  out.push(`${tx.contractAddress} ${SOURCE[name]} ${args}`);
}

// --- Baskets: re-encode from what the deployed contract reports ---------------
const client = createPublicClient({ transport: http(rpcUrl) });
const abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "thesisURI", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "usdg", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "arkiv", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "composition",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "address[]" },
      { type: "uint16[]" },
      { type: "uint256[]" },
      { type: "uint256" },
    ],
  },
] as const;

for (const b of manifest.baskets ?? []) {
  const address = b.address as Address;
  const read = <T>(functionName: string) =>
    client.readContract({ address, abi, functionName: functionName as never }) as Promise<T>;

  const [name, symbol, thesisURI, usdg, arkiv, composition] = await Promise.all([
    read<string>("name"),
    read<string>("symbol"),
    read<string>("thesisURI"),
    read<Address>("usdg"),
    read<Address>("arkiv"),
    read<readonly [readonly Address[], readonly number[], readonly bigint[], bigint]>("composition"),
  ]);

  const args = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "string" },
      { type: "string" },
      { type: "address[]" },
      { type: "uint16[]" },
      { type: "string" },
    ],
    [arkiv, usdg, name, symbol, [...composition[0]], [...composition[1]], thesisURI],
  );
  out.push(`${address} ${SOURCE.Basket} ${args.replace(/^0x/, "")}`);
}

console.log(out.join("\n"));
