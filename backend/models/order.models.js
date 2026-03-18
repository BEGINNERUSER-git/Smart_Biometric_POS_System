import mongoose from "mongoose";
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled", "pending_on_chain"],
      default: "pending",
    },
    payment: {
      provider: { type: String, default: null }, 
      providerOrderId: { type: String, default: null },
      providerTxId: { type: String, default: null }, 
      amount: { type: Number, default: 0 },
      status: { type: String, default: "pending" }, 
      raw: { type: Object, default: {} },
    },
    paidAt: { type: Date, default: null },

    ledgerId: { type: String, default: null },
    ledgerStatus: {
      type: String,
      enum: ["pending", "synced", "failed"],
      default: "pending",
    },
    fraud_score:{
      type:Number,
      default:0
    },
    risk_label:{
      type:String,
      enum:["Low","Medium","High"],
      default:"Low"
    },
    biometric_confidence:{
      type:Number,
      required:true
    }
  },
  {
    timestamps: true,
  }
);
export const Order = mongoose.model("Order", orderSchema);
export default Order;
