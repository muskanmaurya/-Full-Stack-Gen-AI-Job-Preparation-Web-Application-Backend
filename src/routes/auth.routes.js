import express from "express";
import {getMeController,logoutUserController,loginUserController, registerUserController} from "../controllers/auth.controller.js";
import authUser from "../middlewares/auth.middleware.js";

const authRouter=express.Router();

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */

authRouter.post("/register",registerUserController);

/**
 * @route POST /api/auth/login
 * @description Login an existing user
 * @access Public
 */

authRouter.post("/login",loginUserController);

/**
 * @route GET /api/auth/logout
 * @description Logout the current user
 * @access Public
 */

authRouter.get("/logout",logoutUserController)

/**
 * @route GET /api/auth/get-me
 * @description get the current logged in user details
 * @access Private
 */
authRouter.get("/get-me",authUser,getMeController)




export default authRouter;
