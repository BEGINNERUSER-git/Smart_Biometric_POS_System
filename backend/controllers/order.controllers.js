// backend/controllers/order.controllers.js
import mongoose from "mongoose";
import Order from "../models/order.models.js";
import Product from "../models/product.models.js";
import User from "../models/user.models.js"; 
import { evaluateTransaction } from "../services/evaluation.service.js";
import { verifyBiometric } from "../services/biometric.service.js";
import { predictFraud } from "../services/ml.service.js";
import blockchainService from "../services/blockchain.service.js";
import ApiError from "../utility/ApiError.js";
import ApiResponse from "../utility/ApiResponse.js";

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    throw new ApiError(500, "Invalid biometric embeddings");
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const { products, biometricImageBase64, biometricImagesBase64 } = req.body;

    if (!products || products.length === 0) {
      throw new ApiError(400, "Products required");
    }
    if (!biometricImageBase64 && (!Array.isArray(biometricImagesBase64) || biometricImagesBase64.length === 0)) {
      throw new ApiError(400, "Biometric image is required");
    }

    let totalAmount = 0;
    const enrichedProducts = [];

    for (const item of products) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new ApiError(404, "Product not found");
      if (product.stock < item.quantity) {
        throw new ApiError(400, "Insufficient stock");
      }

      product.stock -= item.quantity;
      await product.save({ session });

      totalAmount += product.price * item.quantity;
      enrichedProducts.push({ productId: product._id, quantity: item.quantity });
    }

    const user = await User.findById(userId).session(session);
    if (!user || !user.isBiometricEnrolled) {
      throw new ApiError(400, "Biometric not enrolled");
    }

    // Biometric verification
    const bioRes = await verifyBiometric({
      userId,
      imageBase64: biometricImageBase64,
      imagesBase64: biometricImagesBase64
    });

    const score = typeof bioRes.features !== "undefined"
      ? cosineSimilarity(user.biometric.embedding, bioRes.features)
      : bioRes.biometric_confidence;

    if (score < 0.75) {
      throw new ApiError(401, "Biometric verification failed");
    }

    // Fraud scoring
    const fraudRes = await predictFraud({
      amount: totalAmount,
      time_diff: new Date().getTime() - user.lastTransactionTime,
      tx_count_24h: user.transactionCount,
      user_id: user._id,
      distance_km: user.distance,
      city_pop: user.city_pop,
      location_change: user.location_change,
      device_change: user.device_change,
      hour: new Date().getHours(),
      day_of_week: new Date().getDay(),
      is_weekend: new Date().getDay() === 0 || new Date().getDay() === 6,
    });

    const { fraud_score, risk_label } = fraudRes;
    const decision = evaluateTransaction({
      biometric_confidence: score,
      fraud_score
    });

    if (!decision.allowed) {
      throw new ApiError(401, decision.reason);
    }

    const [createdOrder] = await Order.create(
      [{
        userId,
        products: enrichedProducts,
        totalAmount,
        fraud_score,
        risk_label,
        biometric_confidence: score,
        status: decision.status || (risk_label === "High" ? "pending" : "completed")
      }],
      { session }
    );

    // Blockchain integration (non‑blocking but fail‑visible)
    try {
      await blockchainService.recordTransactionOnLedger({
        orderId: createdOrder._id,
        userId,
        amount: totalAmount,
        biometric_hash: bioRes.hash,
        fraud_score
      });
      createOrder.ledgerId = txData.txId;
      createOrder.ledgerStatus = txData.status;
      await createdOrder.save({ session });
    } catch (bcErr) {
      // Option A: mark order as pending_on_chain but still commit
      createdOrder.status = "pending_on_chain";
      createdOrder.ledgerStatus = "failed";
      await createdOrder.save({ session });

      throw new ApiError(500, "Failed to record transaction on ledger");
    }

    await session.commitTransaction();
    session.endSession();

    return res
      .status(201)
      .json(new ApiResponse(201, "Order created", createdOrder));

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const getAllOrders = async (req, res, next) => {

  try {

    const orders = await Order.find()
      .populate("userId", "-password")
      .populate("products.productId");

    return new ApiResponse(
      res,
      200,
      "Orders fetched successfully",
      { orders }
    );

  } catch (error) {
    return next(new ApiError(500, "Error fetching orders"));
  }
};



export const getOrderById = async (req, res, next) => {

  try {

    const { id } = req.params;
     if(
      req.user.role !== "admin" &&
      order.userId.toString() !== id
     ) {
      throw new ApiError(403, "Access denied for this order");
     }
     
    const order = await Order.findById(id)
      .populate("userId", "-password")
      .populate("products.productId");
    
    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    return new ApiResponse(
      res,
      200,
      "Order fetched successfully",
      { order }
    );

  } catch (error) {
    return next(new ApiError(500, error.message));
  }
};



export const updateOrderById = async (req, res, next) => {

  try {

    const { id } = req.params;

    const order = await Order.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    return new ApiResponse(
      res,
      200,
      "Order updated successfully",
      { order }
    );

  } catch (error) {
    return next(new ApiError(500, error.message));
  }
};



export const deleteOrderById = async (req, res, next) => {

  try {

    const { id } = req.params;

    const order = await Order.findByIdAndDelete(id);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    return new ApiResponse(
      res,
      200,
      "Order deleted successfully"
    );

  } catch (error) {
    return next(new ApiError(500, error.message));
  }
};