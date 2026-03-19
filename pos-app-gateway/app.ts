import * as fs from "fs";
import * as path from "path";
import { Gateway, Wallets, Network } from "fabric-network";
import express, { Request, Response } from "express";

export interface PaymentRequest {
  palmHash: string;
  merchantId: string;
  amount: number;
}

export interface PaymentResponse {
  status: string;
  txId: string | null;
  message: string;
}

const CHANNEL_NAME = "mychannel";

const CHAINCODE_NAME = "palmpos";

const ORG2_WALLET_PATH =
  process.env.FABRIC_WALLET_PATH ||
  path.resolve(__dirname, "..", "wallets", "org2");
const ORG2_IDENTITY_LABEL =
  process.env.FABRIC_IDENTITY_LABEL || "appUserOrg2";

const CONNECTION_PROFILE_PATH =
  process.env.FABRIC_CONNECTION_PROFILE ||
  path.resolve(__dirname, "..", "connection-org2.json");

async function buildGateway(): Promise<Gateway> {
  if (!fs.existsSync(CONNECTION_PROFILE_PATH)) {
    throw new Error(
      `Connection profile not found at ${CONNECTION_PROFILE_PATH}. ` +
        "Ensure connection-org2.json is in the project root or set FABRIC_CONNECTION_PROFILE."
    );
  }

  const ccpContent = fs.readFileSync(CONNECTION_PROFILE_PATH, "utf8");
  const ccp = JSON.parse(ccpContent);

  const wallet = await Wallets.newFileSystemWallet(ORG2_WALLET_PATH);
  const identity = await wallet.get(ORG2_IDENTITY_LABEL);
  if (!identity) {
    throw new Error(
      `Identity ${ORG2_IDENTITY_LABEL} not found in wallet at ${ORG2_WALLET_PATH}.` +
        " Enroll or import an Org2 client identity before processing payments."
    );
  }

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: ORG2_IDENTITY_LABEL,
    discovery: {
      enabled: true,
      asLocalhost: true,
    },
  });

  return gateway;
}

async function getNetwork(
  gateway: Gateway,
  channelName: string
): Promise<Network> {
  return gateway.getNetwork(channelName);
}

/**
 * Submits a biometric payment to the Palm POS chaincode.
 *
 * This is the function your ML layer should call once it has produced
 * a palm-vein hash for the customer.
 */
export async function submitBiometricPayment(
  palmHash: string,
  merchantId: string,
  amount: number
): Promise<PaymentResponse> {
  if (!palmHash || !palmHash.trim()) {
    throw new Error("palmHash is required");
  }
  if (!merchantId || !merchantId.trim()) {
    throw new Error("merchantId is required");
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be a positive number");
  }

  let gateway: Gateway | undefined;
  try {
    gateway = await buildGateway();
    const network = await getNetwork(gateway, CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);

    const tx = contract.createTransaction("VerifyAndPay");
    const txId = tx.getTransactionId();
    const resultBuffer = await tx.submit(palmHash, merchantId, amount.toString());

    const resultString = resultBuffer.toString("utf8") || "APPROVED";

    return {
      status: resultString,
      txId,
      message: "Payment approved",
    };
  } catch (err: any) {
    const message =
      typeof err?.message === "string" ? err.message : String(err);
    const isDenied =
      message.includes("transaction denied") ||
      message.includes("DENIED_BIOMETRIC_MISMATCH") ||
      message.includes("DENIED_INSUFFICIENT_FUNDS") ||
      message.includes("DENIED_INVALID_AMOUNT");

    return {
      status: isDenied ? "DENIED" : "ERROR",
      txId: null,
      message,
    };
  } finally {
    if (gateway) {
      await gateway.disconnect();
    }
  }
}

/**
 * Minimal Express API to expose a POS payment endpoint:
 *   POST /pos/payments
 *   body: { palmHash, merchantId, amount }
 */
export async function startPosApiServer(port = 3000): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post(
    "/pos/payments",
    async (req: Request, res: Response): Promise<void> => {
      const { palmHash, merchantId, amount } = req.body as PaymentRequest;

      try {
        const response = await submitBiometricPayment(
          palmHash,
          merchantId,
          amount
        );

        const httpStatus =
          response.status === "APPROVED"
            ? 200
            : response.status === "DENIED"
            ? 403
            : 500;

        res.status(httpStatus).json(response);
      } catch (err: any) {
        const message =
          typeof err?.message === "string" ? err.message : String(err);
        res.status(400).json({
          status: "ERROR",
          txId: null,
          message,
        });
      }
    }
  );

  app.listen(port, () => {
    // Server is ready to accept POS requests.
    // Intentionally no console.log spam for production readiness.
  });
}

// Allow running this file directly, e.g. via:
//   npx ts-node pos-app-gateway/app.ts
// or after compilation:
//   node pos-app-gateway/dist/app.js
if (require.main === module) {
  // Default port can be overridden with PORT env variable.
  startPosApiServer(parseInt(process.env.PORT || "3000", 10)).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start POS API server", err);
    process.exit(1);
  });
}


