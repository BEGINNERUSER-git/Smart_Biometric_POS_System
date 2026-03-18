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

router.use(verifyJWT);  
router.post("/",authorizeRoles("merchant"), createOrder);
router.get("/", authorizeRoles("admin"),getAllOrders);
router.get("/:id", getOrderById);
router.put("/:id", authorizeRoles("admin"), updateOrderById);
router.delete("/:id", authorizeRoles("admin"), deleteOrderById);
export default router;