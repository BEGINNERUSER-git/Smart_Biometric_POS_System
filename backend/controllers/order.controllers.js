import Order from "../models/order.models.js";
import ApiError from "../utility/ApiError.js";
import ApiResponse from "../utility/ApiResponse.js";

export const createOrder = async (req, res, next) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return next(new ApiError(401, "Authentication required"));

    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return next(new ApiError(400, "Products array required"));
    }

    // Validate product items shape and quantities
    for (const p of products) {
      if (!p.productId) return next(new ApiError(400, "Each item needs productId"));
      if (typeof p.quantity !== "number" || p.quantity <= 0) return next(new ApiError(400, "Invalid quantity"));
    }

    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      let totalAmount = 0;
      const enriched = [];

      for (const item of products) {
        const prod = await products.findById(item.productId).session(session);
        if (!prod) {
          await session.abortTransaction();
          return next(new ApiError(404, `Product ${item.productId} not found`));
        }
        if (prod.stock < item.quantity) {
          await session.abortTransaction();
          return next(new ApiError(400, `Insufficient stock for ${prod.name}`));
        }
        // decrement stock
        prod.stock -= item.quantity;
        await prod.save({ session });

        const lineTotal = prod.price * item.quantity;
        totalAmount += lineTotal;
        enriched.push({
          productId: prod._id,
          quantity: item.quantity,
          price: prod.price,
          name: prod.name
        });
      }

      const order = await Order.create([{
        userId,
        products: enriched.map(e => ({ productId: e.productId, quantity: e.quantity })),
        totalAmount,
        status: "pending"
      }], { session });

      await session.commitTransaction();
      session.endSession();

      const createdOrder = await Order.findById(order[0]._id)
        .populate({ path: "userId", select: "-password -refreshToken" })
        .populate({ path: "products.productId" });



      return new ApiResponse(res, 201, "Order created successfully", { order: createdOrder });
    } catch (errInner) {
      await session.abortTransaction();
      session.endSession();
      return next(errInner);
    }
  } catch (error) {
    return next(new ApiError(500, error.message || "Order creation failed"));
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate("userId", "-password -refreshToken").populate("products.productId");
    return new ApiResponse(res, 200, "Orders retrieved successfully", { orders });
  } catch (error) {
    throw new ApiError(500, "Error retrieving orders");
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate("userId", "-password -refreshToken").populate("products.productId");
    if (!order) {
      throw new ApiError(404, "Order not found");
    }   
    return new ApiResponse(res, 200, "Order retrieved successfully", { order });
  } catch (error) {
    throw new ApiError(500, "Error retrieving order");
  }
};

export const updateOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const order = await Order.findByIdAndUpdate(id,
        updates, { new: true, runValidators: true });   
    if (!order) {
      throw new ApiError(404, "Order not found");
    }
    return new ApiResponse(res, 200, "Order updated successfully", { order });
  } catch (error) {
    throw new ApiError(500, "Error updating order");
  }
};

export const deleteOrderById = async (req, res) => {    
    try {
        const { id } = req.params;
        const order = await Order.findByIdAndDelete(id);    
        if (!order) {
            throw new ApiError(404, "Order not found");
        }   
        return new ApiResponse(res, 200, "Order deleted successfully");
    }   
    catch (error) {
        throw new ApiError(500, "Error deleting order");
    }
};

