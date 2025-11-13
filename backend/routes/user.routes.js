import {
    registerUser,
    loginUser,
    logout,
    getAllUsers,
    getUserById,
    deleteUserById,
    updateUserById


} from "../controllers/user.controllers.js";


import {authorizeRoles } from "../middleware/permissions.middleware.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

import express from "express";
const router=express.Router();
router.post("/register",registerUser);
router.post("/login",loginUser);
router.post("/logout",verifyJWT,logout);
router.get("/", verifyJWT ,authorizeRoles("admin"),getAllUsers);
router.get("/:id",verifyJWT,authorizeRoles("admin"),getUserById);
router.delete("/:id",verifyJWT,authorizeRoles("admin"),deleteUserById);
router.put("/:id",verifyJWT,authorizeRoles("admin"),updateUserById);
export default router;


