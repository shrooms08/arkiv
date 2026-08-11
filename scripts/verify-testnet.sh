#!/usr/bin/env bash
# Verifies every deployed contract on X Layer testnet (chain 1952).
#
# Two verifiers, deliberately:
#   - Sourcify needs no API key and supports chains 196 and 1952. It is the
#     baseline, so verification is never blocked on a credential we do not have.
#   - OKLink is the explorer people will actually click, and needs OK_ACCESS_KEY.
#     Attempted only when that key is present.
#
# Targets come from scripts/verify-targets.ts, which resolves each contract's
# constructor arguments — without them nothing verifies. That includes the
# per-basket Basket contracts, which the factory creates internally and which
# hold the actual funds; an archive of unverified contracts reads as careless.
set -uo pipefail

CHAIN=1952
RPC=${RPC:-https://testrpc.xlayer.tech}
cd "$(dirname "$0")/.."

TARGETS=$(mktemp)
trap 'rm -f "$TARGETS"' EXIT
npx tsx scripts/verify-targets.ts "$CHAIN" "$RPC" > "$TARGETS" || {
  echo "could not build verification targets"; exit 1;
}

ok=0; failed=0
while read -r addr path args; do
  [ -z "$addr" ] && continue
  echo "--- ${path##*:} @ $addr"

  common=(--chain-id "$CHAIN" --rpc-url "$RPC" --watch --compiler-version 0.8.28)
  [ -n "${args:-}" ] && common+=(--constructor-args "0x$args")

  if (cd contracts && forge verify-contract "$addr" "$path" "${common[@]}" \
      --verifier sourcify --verifier-url https://sourcify.dev/server) 2>&1 | tail -3; then
    ok=$((ok+1))
  # forge sends a MINIMAL standard JSON holding only the files this contract
  # imports. Under via_ir that can compile to different bytecode than the
  # original build, and Sourcify rejects it (`extra_file_input_bug`). Retry with
  # the exact input solc was given the first time. Arkiv needs this; the mocks
  # do not, which is why it is a fallback rather than the default path.
  elif scripts/sourcify-full-input.py "$CHAIN" "$addr" "$path"; then
    echo "    recovered via full standard-JSON input"
    ok=$((ok+1))
  else
    failed=$((failed+1))
    echo "    sourcify failed for $addr"
  fi

  if [ -n "${OK_ACCESS_KEY:-}" ]; then
    (cd contracts && forge verify-contract "$addr" "$path" "${common[@]}" \
      --verifier oklink --etherscan-api-key "$OK_ACCESS_KEY") 2>&1 | tail -3 || \
      echo "    oklink failed for $addr"
  fi
done < "$TARGETS"

echo
echo "submitted: $ok ok, $failed failed"
echo "sourcify: https://repo.sourcify.dev/contracts/full_match/$CHAIN/"
