/**
 * Fills a deployment manifest from a Foundry broadcast artefact.
 *
 * Reads the addresses that were actually mined rather than anything typed by
 * hand, so `deployments/*.json` cannot drift from the chain.
 *
 *   npx tsx scripts/record-deployment.ts <chainId> <script-name>
 *   npx tsx scripts/record-deployment.ts 1952 DeployTestnet.s.sol
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [chainId, scriptName] = process.argv.slice(2);
if (!chainId || !scriptName) {
  console.error("usage: record-deployment.ts <chainId> <script-name>");
  process.exit(1);
}

const broadcast = JSON.parse(
  readFileSync(join("contracts", "broadcast", scriptName, chainId, "run-latest.json"), "utf8"),
) as {
  transactions: { transactionType: string; contractName: string | null; contractAddress: string | null; hash: string }[];
  receipts: { blockNumber: string }[];
  timestamp: number;
};

const file = chainId === "196" ? "xlayer-mainnet.json" : "xlayer-testnet.json";
const path = join("deployments", file);
const manifest = JSON.parse(readFileSync(path, "utf8"));

const contracts: Record<string, string> = {};
for (const tx of broadcast.transactions) {
  if (tx.transactionType === "CREATE" && tx.contractName && tx.contractAddress) {
    // Later deploys of the same name (e.g. per-basket Basket) get suffixed.
    const key = contracts[tx.contractName]
      ? `${tx.contractName}_${Object.keys(contracts).filter((k) => k.startsWith(tx.contractName!)).length}`
      : tx.contractName;
    contracts[key] = tx.contractAddress;
  }
}

manifest.status = "deployed";
manifest.deployedAt = new Date(broadcast.timestamp * 1000).toISOString();
manifest.deployBlock = broadcast.receipts.length
  ? Number(BigInt(broadcast.receipts[0]!.blockNumber))
  : null;
manifest.contracts = contracts;

writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`recorded ${Object.keys(contracts).length} contracts to ${path}`);
