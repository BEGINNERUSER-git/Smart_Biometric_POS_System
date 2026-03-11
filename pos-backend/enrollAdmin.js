const fs = require("fs");
const path = require("path");
const { Wallets } = require("fabric-network");
const FabricCAServices = require("fabric-ca-client");
require("dotenv").config();

async function main() {
  try {
    const ccpPath = path.resolve(__dirname, "..", "connection-org2.json");
    if (!fs.existsSync(ccpPath)) {
      throw new Error(
        `connection-org2.json not found at ${ccpPath}. Ensure it exists at the project root.`
      );
    }

    const ccp = JSON.parse(fs.readFileSync(ccpPath, "utf8"));

    const orgName = "Org2";
    const orgConfig = ccp.organizations[orgName];
    if (!orgConfig) {
      throw new Error(`Organization configuration for ${orgName} not found in connection profile.`);
    }

    const caName = orgConfig.certificateAuthorities[0];
    const caInfo = ccp.certificateAuthorities[caName];
    if (!caInfo) {
      throw new Error(`CA configuration for ${caName} not found in connection profile.`);
    }

    const caTLSCACerts = caInfo.tlsCACerts.pem;

    const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

    const walletPath = path.join(__dirname, "wallet");
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const adminId = process.env.FABRIC_ADMIN_ID || "admin";
    const adminSecret = process.env.FABRIC_ADMIN_SECRET || "adminpw";
    const mspId = orgConfig.mspid || "Org2MSP";

    const adminExists = await wallet.get(adminId);
    if (adminExists) {
      console.log(`An identity for the admin user "${adminId}" already exists in the wallet`);
      return;
    }

    const enrollment = await ca.enroll({
      enrollmentID: adminId,
      enrollmentSecret: adminSecret
    });

    const identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes()
      },
      mspId,
      type: "X.509"
    };

    await wallet.put(adminId, identity);
    console.log(`Successfully enrolled admin user "${adminId}" and imported it into the wallet at ${walletPath}`);
  } catch (error) {
    console.error(`Failed to enroll admin: ${error.message || error}`);
    process.exit(1);
  }
}

main();

