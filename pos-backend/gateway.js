const fs = require("fs");
const path = require("path");
const { Gateway, Wallets } = require("fabric-network");
require("dotenv").config();

// Prefer explicit CHANNEL_NAME / CHAINCODE_NAME for clarity, but fall back
// to previous FABRIC_* variables and sensible defaults.
const CHANNEL_NAME =
  process.env.CHANNEL_NAME ||
  process.env.FABRIC_CHANNEL ||
  "mychannel";

// Default to the deployed chaincode name from deploy_palmpos.sh ("palmpos").
const CHAINCODE_NAME =
  process.env.CHAINCODE_NAME ||
  process.env.FABRIC_CHAINCODE ||
  "palmpos";

async function getPalmContract() {
  return getPalmPaymentContract();
}

async function getContractForName(chaincodeName) {
  const { gateway, contract } = await getPalmPaymentContract();
  if (!chaincodeName || chaincodeName === CHAINCODE_NAME) {
    return { gateway, contract };
  }
  const network = await gateway.getNetwork(CHANNEL_NAME);
  const named = network.getContract(chaincodeName);
  return { gateway, contract: named };
}

async function getPalmPaymentContract() {
  const ccpPath = path.resolve(__dirname, "..", "connection-org2.json");
  if (!fs.existsSync(ccpPath)) {
    throw new Error(
      `connection-org2.json not found at ${ccpPath}. Ensure it exists at the project root.`
    );
  }

  const ccp = JSON.parse(fs.readFileSync(ccpPath, "utf8"));

  const walletPath = path.join(__dirname, "wallet");
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  const appUserId = process.env.FABRIC_APP_USER_ID || "appUser";
  const identity = await wallet.get(appUserId);
  if (!identity) {
    throw new Error(
      `An identity for the user "${appUserId}" does not exist in the wallet. Run "npm run registerUser" first.`
    );
  }

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: appUserId,
    discovery: {
      enabled: true,
      asLocalhost: true
    }
  });

  const network = await gateway.getNetwork(CHANNEL_NAME);
  const contract = network.getContract(CHAINCODE_NAME);

  return { gateway, contract };
}

module.exports = {
  getPalmPaymentContract,
  getPalmContract,
  getContractForName
};

