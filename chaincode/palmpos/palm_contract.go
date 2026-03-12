package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// User represents a biometric wallet owner in the POS system.
type User struct {
	PalmHash      string  `json:"palmHash"`
	WalletBalance float64 `json:"walletBalance"`
	UserID        string  `json:"userId"`
}

// TransactionStatus represents the outcome of a payment attempt.
type TransactionStatus string

const (
	StatusApproved                TransactionStatus = "APPROVED"
	StatusDeniedBiometricMismatch TransactionStatus = "DENIED_BIOMETRIC_MISMATCH"
	StatusDeniedInsufficientFunds TransactionStatus = "DENIED_INSUFFICIENT_FUNDS"
	StatusDeniedInvalidAmount     TransactionStatus = "DENIED_INVALID_AMOUNT"
)

// PaymentRecord logs both successful and denied payment attempts on-ledger.
type PaymentRecord struct {
	RecordType string            `json:"recordType"` // always "PAYMENT_RECORD"
	TxID       string            `json:"txId"`
	PalmHash   string            `json:"palmHash"`
	MerchantID string            `json:"merchantId"`
	Amount     float64           `json:"amount"`
	Status     TransactionStatus `json:"status"`
	Reason     string            `json:"reason,omitempty"`
	Timestamp  string            `json:"timestamp"`
}

// PalmPOSContract defines the smart-contract for the biometric POS logic.
type PalmPOSContract struct {
	contractapi.Contract
}

// RegisterUser creates a new biometric wallet bound to a palm hash.
//
// Primary key: palmHash
func (c *PalmPOSContract) RegisterUser(ctx contractapi.TransactionContextInterface, palmHash string, userID string, initialBalance float64) error {
	if palmHash == "" {
		return errors.New("palmHash must not be empty")
	}
	if userID == "" {
		return errors.New("userID must not be empty")
	}
	if initialBalance < 0 {
		return errors.New("initialBalance cannot be negative")
	}

	exists, err := c.userExists(ctx, palmHash)
	if err != nil {
		return fmt.Errorf("failed to check existing user: %w", err)
	}
	if exists {
		return fmt.Errorf("user with palmHash %s already registered", palmHash)
	}

	u := &User{
		PalmHash:      palmHash,
		WalletBalance: initialBalance,
		UserID:        userID,
	}

	userBytes, err := json.Marshal(u)
	if err != nil {
		return fmt.Errorf("failed to marshal user: %w", err)
	}

	if err := ctx.GetStub().PutState(palmHash, userBytes); err != nil {
		return fmt.Errorf("failed to persist user: %w", err)
	}

	return nil
}

// VerifyAndPay verifies the palm hash and attempts to debit the wallet.
//
// If the biometric hash does not match an existing user, a denied
// PaymentRecord with Status DENIED_BIOMETRIC_MISMATCH is written to the
// ledger and the transaction fails with "Transaction denied" semantics.
func (c *PalmPOSContract) VerifyAndPay(ctx contractapi.TransactionContextInterface, palmHash string, merchantID string, amount float64) (string, error) {
	if palmHash == "" {
		return "", errors.New("palmHash must not be empty")
	}
	if merchantID == "" {
		return "", errors.New("merchantID must not be empty")
	}

	txID := ctx.GetStub().GetTxID()
	now, _ := ctx.GetStub().GetTxTimestamp()
	timestamp := time.Now().UTC().Format(time.RFC3339)
	if now != nil {
		// Best-effort use of Fabric-provided timestamp.
		timestamp = time.Unix(now.Seconds, int64(now.Nanos)).UTC().Format(time.RFC3339)
	}

	if amount <= 0 {
		if err := c.logPayment(ctx, &PaymentRecord{
			RecordType: "PAYMENT_RECORD",
			TxID:       txID,
			PalmHash:   palmHash,
			MerchantID: merchantID,
			Amount:     amount,
			Status:     StatusDeniedInvalidAmount,
			Reason:     "amount must be greater than zero",
			Timestamp:  timestamp,
		}); err != nil {
			return "", fmt.Errorf("failed to log invalid amount denial: %w", err)
		}
		return "", errors.New("transaction denied: invalid amount")
	}

	userBytes, err := ctx.GetStub().GetState(palmHash)
	if err != nil {
		return "", fmt.Errorf("failed to read user state: %w", err)
	}
	if userBytes == nil {
		if err := c.logPayment(ctx, &PaymentRecord{
			RecordType: "PAYMENT_RECORD",
			TxID:       txID,
			PalmHash:   palmHash,
			MerchantID: merchantID,
			Amount:     amount,
			Status:     StatusDeniedBiometricMismatch,
			Reason:     "no registered user for provided palm hash",
			Timestamp:  timestamp,
		}); err != nil {
			return "", fmt.Errorf("failed to log biometric mismatch denial: %w", err)
		}
		return "", errors.New("transaction denied: biometric hash mismatch")
	}

	var user User
	if err := json.Unmarshal(userBytes, &user); err != nil {
		return "", fmt.Errorf("failed to unmarshal user state: %w", err)
	}

	if user.WalletBalance < amount {
		if err := c.logPayment(ctx, &PaymentRecord{
			RecordType: "PAYMENT_RECORD",
			TxID:       txID,
			PalmHash:   palmHash,
			MerchantID: merchantID,
			Amount:     amount,
			Status:     StatusDeniedInsufficientFunds,
			Reason:     "insufficient wallet balance",
			Timestamp:  timestamp,
		}); err != nil {
			return "", fmt.Errorf("failed to log insufficient funds denial: %w", err)
		}
		return "", errors.New("transaction denied: insufficient funds")
	}

	user.WalletBalance -= amount

	updatedUserBytes, err := json.Marshal(&user)
	if err != nil {
		return "", fmt.Errorf("failed to marshal updated user: %w", err)
	}
	if err := ctx.GetStub().PutState(palmHash, updatedUserBytes); err != nil {
		return "", fmt.Errorf("failed to persist updated user: %w", err)
	}

	if err := c.logPayment(ctx, &PaymentRecord{
		RecordType: "PAYMENT_RECORD",
		TxID:       txID,
		PalmHash:   palmHash,
		MerchantID: merchantID,
		Amount:     amount,
		Status:     StatusApproved,
		Timestamp:  timestamp,
	}); err != nil {
		return "", fmt.Errorf("failed to log approved payment: %w", err)
	}

	return string(StatusApproved), nil
}

// GetBalance returns the wallet balance for a given palm hash.
func (c *PalmPOSContract) GetBalance(ctx contractapi.TransactionContextInterface, palmHash string) (float64, error) {
	if palmHash == "" {
		return 0, errors.New("palmHash must not be empty")
	}

	userBytes, err := ctx.GetStub().GetState(palmHash)
	if err != nil {
		return 0, fmt.Errorf("failed to read user state: %w", err)
	}
	if userBytes == nil {
		return 0, fmt.Errorf("no user found for palmHash %s", palmHash)
	}

	var user User
	if err := json.Unmarshal(userBytes, &user); err != nil {
		return 0, fmt.Errorf("failed to unmarshal user state: %w", err)
	}

	return user.WalletBalance, nil
}

// userExists checks if a User is already registered for the given palm hash.
func (c *PalmPOSContract) userExists(ctx contractapi.TransactionContextInterface, palmHash string) (bool, error) {
	data, err := ctx.GetStub().GetState(palmHash)
	if err != nil {
		return false, err
	}
	return data != nil, nil
}

// logPayment writes a PaymentRecord to the ledger under a composite key.
func (c *PalmPOSContract) logPayment(ctx contractapi.TransactionContextInterface, record *PaymentRecord) error {
	if record == nil {
		return errors.New("payment record must not be nil")
	}

	compositeKey, err := ctx.GetStub().CreateCompositeKey("payment", []string{record.PalmHash, record.TxID})
	if err != nil {
		return fmt.Errorf("failed to create composite key for payment record: %w", err)
	}

	recordBytes, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal payment record: %w", err)
	}

	if err := ctx.GetStub().PutState(compositeKey, recordBytes); err != nil {
		return fmt.Errorf("failed to persist payment record: %w", err)
	}

	return nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&PalmPOSContract{})
	if err != nil {
		panic(fmt.Sprintf("error creating palm POS chaincode: %v", err))
	}

	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("error starting palm POS chaincode: %v", err))
	}
}

