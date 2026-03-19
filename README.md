# Smart Biometric POS System

This repository contains a Smart Biometric POS System built on **Hyperledger Fabric** with a backend gateway and PostgreSQL for receipts/audit storage.

## Project structure

- `fabric-samples/`
  - **Infrastructure/network only** (your Fabric test network lives here).
  - Keep this folder as close to upstream as possible.

- `pos-backend/`
  - Node.js **API server**.
  - Submits transactions to Fabric and persists a copy of successful receipts to PostgreSQL (`biometric_transactions`).
  - Stores Fabric identities in `pos-backend/wallet/`.

- `pos-app-gateway/`
  - Node.js/TypeScript **blockchain bridge** (optional lightweight gateway or integration point for ML layer).

- `chaincode/`
  - Custom **smart contract (chaincode)** implementing palm-hash based payments.

## Key configuration

- `connection-org2.json` lives in the repository root and is used by:
  - `pos-backend/*` (CA enrollment + gateway)
  - `pos-app-gateway/*` (Fabric gateway client)

## Deployment notes

- Chaincode name: `palmpos`
- Channel name: `mychannel`

After moving folders (see the migration instructions you used), update any scripts or service env vars to match your local paths and credentials.

