import { getOrderById,
    createOrder,
    deleteOrderById,
    updateOrderById,
    getAllOrders
 } from "../controllers/order.controllers.js";

import { authorizeRoles } from "../middleware/permissions.middleware.js";

import { verifyJWT } from "../middleware/auth.middleware.js";

import express from "express";
const router = express.Router();

router.post("/",verifyJWT, createOrder);
router.get("/", verifyJWT ,authorizeRoles("admin"),getAllOrders);
router.get("/:id", verifyJWT ,getOrderById);
router.put("/:id", verifyJWT,authorizeRoles("admin"), updateOrderById);
router.delete("/:id", verifyJWT,authorizeRoles("admin"), deleteOrderById);
export default router;