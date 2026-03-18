import { getProductById,
    getAllProducts,
    createProduct,
    deleteProductById,
    updateProductById,
    getProductByBarcode
 } from "../controllers/product.controllers.js";

import { authorizeRoles } from "../middleware/permissions.middleware.js";

import { verifyJWT } from "../middleware/auth.middleware.js"; 

import express from "express";
const router = express.Router();
router.get("/", verifyJWT, getAllProducts);
router.get("/id/:id", verifyJWT, getProductById);
router.get("/barcode/:barcode", verifyJWT, getProductByBarcode); // Essential for POS scanning


router.post("/", verifyJWT, authorizeRoles("admin"), createProduct);
router.put("/:id", verifyJWT, authorizeRoles("admin"), updateProductById);
router.delete("/:id", verifyJWT, authorizeRoles("admin"), deleteProductById);
export default router;