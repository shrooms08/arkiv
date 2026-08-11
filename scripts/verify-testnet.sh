#!/usr/bin/env bash
# Verifies every deployed contract on X Layer testnet (chain 1952).
#
# Two verifiers, deliberately:
#   - Sourcify needs no API key and supports chains 196 and 1952. It is the
#     baseline, so verification is never blocked on a credential we do not have.
#   - OKLink is the explorer people will actually click, and needs OK_ACCESS_KEY.
#     Attempted only when that key is present.
#
# Includes the per-basket Basket contracts: an archive full of unverified
# contracts reads as careless, and the Basket is the contract holding the funds.
set -euo pipefail

CHAIN=1952
RPC=${RPC:-https://testrpc.xlayer.tech}
MANIFEST=deployments/xlayer-testnet.json

verify() {
  local addr=$1 path=$2 args=${3:-}
  echo "--- $path @ $addr"
  local common=(--chain-id "$CHAIN" --rpc-url "$RPC" --watch)
  [ -n "$args" ] && common+=(--constructor-args "$args")

  forge verify-contract "$addr" "$path" "${common[@]}" --verifier sourcify || \
    echo "    sourcify failed for $addr"

  if [ -n "${OK_ACCESS_KEY:-}" ]; then
    forge verify-contract "$addr" "$path" "${common[@]}" \
      --verifier oklink --etherscan-api-key "$OK_ACCESS_KEY" || \
      echo "    oklink failed for $addr"
  fi
}

cd "$(dirname "$0")/.."
python3 - "$MANIFEST" <<'PY' > /tmp/arkiv-verify-targets
import json, sys
m = json.load(open(sys.argv[1]))
paths = {
    "Arkiv": "contracts/src/Arkiv.sol:Arkiv",
    "MockUSDG": "contracts/src/mocks/TestnetMocks.sol:MockUSDG",
    "MockSanctionsList": "contracts/src/mocks/TestnetMocks.sol:MockSanctionsList",
    "MockDexAdapter": "contracts/src/mocks/TestnetMocks.sol:MockDexAdapter",
}
for name, addr in (m.get("contracts") or {}).items():
    if not addr:
        continue
    base = name.split("_")[0]
    if base.startswith("MockWrapper"):
        print(f"{addr} contracts/src/mocks/TestnetMocks.sol:MockWrapper")
    elif base == "Basket":
        print(f"{addr} contracts/src/Basket.sol:Basket")
    elif base in paths:
        print(f"{addr} {paths[base]}")
for b in m.get("baskets") or []:
    if b.get("address"):
        print(f"{b['address']} contracts/src/Basket.sol:Basket")
PY

while read -r addr path; do
  [ -z "$addr" ] && continue
  verify "$addr" "$path"
done < /tmp/arkiv-verify-targets

echo "done. sourcify: https://repo.sourcify.dev/contracts/full_match/$CHAIN/"
