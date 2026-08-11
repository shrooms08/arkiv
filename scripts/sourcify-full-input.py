#!/usr/bin/env python3
"""
Verifies one contract on Sourcify using the ORIGINAL full standard-JSON input.

Needed because `forge verify-contract` submits a minimal standard JSON holding
only the files a contract imports. Under `via_ir = true` that can compile to
different bytecode than the original build, and Sourcify rejects it with
`extra_file_input_bug` (argotorg/sourcify#618) — metadata hashes match, bytecode
does not. Arkiv hits this; the small mocks do not.

The fix is to send solc exactly what it was given the first time, which Foundry
records under `contracts/out/build-info` when built with `--build-info`.

    forge build --build-info
    scripts/sourcify-full-input.py <chainId> <address> <src/File.sol:Contract> [creationTxHash]
"""
import glob
import json
import sys
import time
import urllib.error
import urllib.request

SERVER = "https://sourcify.dev/server"
# Sourcify accepts only these top-level keys; Foundry also writes version,
# allowPaths, basePath and includePaths, which are rejected with a 400.
ALLOWED_TOP_LEVEL = ("language", "sources", "settings", "storage_layout_overrides")


def build_info_for(source_path: str):
    """The build-info whose input contains `source_path`, plus its solc version."""
    for f in sorted(glob.glob("contracts/out/build-info/*.json")):
        with open(f) as fh:
            d = json.load(fh)
        sources = (d.get("input") or {}).get("sources") or {}
        if source_path in sources:
            return d
    return None


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    chain_id, address, identifier = sys.argv[1], sys.argv[2], sys.argv[3]
    creation_tx = sys.argv[4] if len(sys.argv) > 4 else None
    source_path = identifier.split(":")[0]

    info = build_info_for(source_path)
    if info is None:
        print(f"no build-info contains {source_path}; run `forge build --build-info` first")
        return 1

    std_json = {k: v for k, v in info["input"].items() if k in ALLOWED_TOP_LEVEL}
    long_version = info.get("solcLongVersion") or ""
    # Sourcify wants the commit-qualified version.
    compiler = long_version if "+commit." in long_version else "0.8.28+commit.7893614a"

    payload = {
        "stdJsonInput": std_json,
        "compilerVersion": compiler,
        "contractIdentifier": identifier,
    }
    if creation_tx:
        payload["creationTransactionHash"] = creation_tx

    req = urllib.request.Request(
        f"{SERVER}/v2/verify/{chain_id}/{address}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, timeout=180)
        job = json.loads(resp.read()).get("verificationId")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "already verified" in body.lower():
            print(f"{identifier} @ {address}: already verified")
            return 0
        print(f"submit failed: HTTP {e.code} {body[:400]}")
        return 1

    for _ in range(60):
        time.sleep(6)
        result = json.loads(
            urllib.request.urlopen(f"{SERVER}/v2/verify/{job}", timeout=60).read()
        )
        if not result.get("isJobCompleted"):
            continue
        contract = result.get("contract") or {}
        if contract.get("runtimeMatch") or contract.get("creationMatch"):
            print(
                f"{identifier} @ {address}: creation={contract.get('creationMatch')} "
                f"runtime={contract.get('runtimeMatch')}"
            )
            return 0
        print(f"{identifier} @ {address}: FAILED {json.dumps(result)[:400]}")
        return 1

    print(f"{identifier} @ {address}: timed out waiting for Sourcify")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
