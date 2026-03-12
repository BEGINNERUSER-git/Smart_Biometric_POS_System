import { getProductById,
    getAllProducts,
    createProduct,
    deleteProductById
 } from "../controllers/product.controllers.js";

import { authorizeRoles } from "../middleware/permissions.middleware.js";

import { verifyJWT } from "../middleware/auth.middleware.js"; 

import express from "express";
const router = express.Router();
router.post("/",verifyJWT, authorizeRoles("admin"), createProduct);
router.get("/", verifyJWT,getAllProducts);
router.get("/:id", verifyJWT ,getProductById);
router.delete("/:id", verifyJWT,authorizeRoles("admin"), deleteProductById);
export default router;