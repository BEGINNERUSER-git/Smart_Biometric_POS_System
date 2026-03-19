#!/usr/bin/env bash
#
# Helper script to deploy the palm-vein biometric POS chaincode ("palmpos")
# to a running Fabric test network.
#
# This script is intentionally conservative and expects you to have:
#   - A Fabric test-network directory (usually from an upstream fabric-samples clone).
#   - Started the test network (e.g. ./network.sh up createChannel -c mychannel).
#
# Configuration:
#   TEST_NETWORK_DIR  : path to a fabric-samples/test-network directory
#                       (default: $HOME/fabric-samples/test-network)
#   CHAINCODE_SRC_PATH: path to this chaincode directory
#                       (default: absolute path of this script's directory)
#

set -euo pipefail

TEST_NETWORK_DIR="${TEST_NETWORK_DIR:-"$HOME/fabric-samples/test-network"}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAINCODE_SRC_PATH="${CHAINCODE_SRC_PATH:-"$SCRIPT_DIR"}"

CC_NAME="palmpos"
CC_CHANNEL="mychannel"
CC_LANG="go"

echo "Using test network directory: $TEST_NETWORK_DIR"
echo "Using chaincode source path:  $CHAINCODE_SRC_PATH"
echo "Chaincode name:               $CC_NAME"
echo "Channel:                      $CC_CHANNEL"
echo

if [[ ! -d "$TEST_NETWORK_DIR" ]]; then
  echo "ERROR: TEST_NETWORK_DIR does not exist: $TEST_NETWORK_DIR" >&2
  echo "Set TEST_NETWORK_DIR to your fabric-samples/test-network path and retry." >&2
  exit 1
fi

if [[ ! -d "$CHAINCODE_SRC_PATH" ]]; then
  echo "ERROR: CHAINCODE_SRC_PATH does not exist: $CHAINCODE_SRC_PATH" >&2
  exit 1
fi

pushd "$TEST_NETWORK_DIR" > /dev/null

if [[ ! -x "./network.sh" ]]; then
  echo "ERROR: network.sh not found or not executable in $TEST_NETWORK_DIR" >&2
  exit 1
fi

echo "Deploying chaincode '$CC_NAME' from '$CHAINCODE_SRC_PATH' to channel '$CC_CHANNEL'..."
./network.sh deployCC -c "$CC_CHANNEL" -ccn "$CC_NAME" -ccp "$CHAINCODE_SRC_PATH" -ccl "$CC_LANG"

echo "Chaincode '$CC_NAME' deployment command completed."

popd > /dev/null

