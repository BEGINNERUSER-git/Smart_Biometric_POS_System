import mongoose from "mongoose";

const webhookSchema = new mongoose.Schema({
  provider: { type: String },
  headers: { type: Object },
  raw: { type: String },
  verified: { type: Boolean, default: false },
  processed: { type: Boolean, default: false },
  processedAt: { type: Date },
  reason: { type: String }
}, { timestamps: true });


export const Webhook = mongoose.model("Webhook", webhookSchema);
export default Webhook;