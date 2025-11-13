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
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
    },
    payment: {
      provider: { type: String, default: null }, // stripe | razorpay
      providerOrderId: { type: String, default: null }, // paymentIntent id or razorpay order id
      providerTxId: { type: String, default: null }, // charge / payment id (from webhook)
      amount: { type: Number, default: 0 },
      status: { type: String, default: "pending" }, // requires_payment | created | paid | failed
      raw: { type: Object, default: {} },
    },
    paidAt: { type: Date, default: null },

    ledgerId: { type: String, default: null },
    ledgerStatus: {
      type: String,
      enum: ["pending", "synced", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);
export const Order = mongoose.model("Order", orderSchema);
export default Order;
