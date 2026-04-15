import userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import tokenBlacklistModel from "../models/blacklist.model.js";

/**
 * @name registerUserController
 * @description Register a new user
 * @access Public
 */

export const registerUserController = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Please provide username, email and password",
      });
    }

    const isUserAlreadyExists = await userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (isUserAlreadyExists) {
      return res.status(400).json({
        message: "account already exists with this email address or username",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" },
    );

   res.cookie("token", token, {
    httpOnly: true,
    secure: true,   // Required for HTTPS (Vercel/Render)
    sameSite: "none", // Required for Cross-Domain cookies
    maxAge: 24 * 60 * 60 * 1000 // 1 day
});;

    res.status(201).json({
      message: "user registered successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.log("error in registerUserController: ", error);
    res.status(500).json({
      message: "internal server error",
    });
  }
};

/**
 * @name LoginUserController
 * @description Login an existing user
 * @access Public
 */

export const loginUserController = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password",
      });
    }

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1d" },
    );

   res.cookie("token", token, {
    httpOnly: true,
    secure: true,   // Required for HTTPS (Vercel/Render)
    sameSite: "none", // Required for Cross-Domain cookies
    maxAge: 24 * 60 * 60 * 1000 // 1 day
});

    res.status(200).json({
      message: "user logged in successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.log("error in loginUserController: ", error);
    res.status(500).json({
      message: "internal server error",
    });
  }
};

/**
 * @route GET /api/auth/logout
 * @description Logout the current user
 * @access public
 */

export const logoutUserController = async (req, res) => {
  const token = req.cookies.token;

  try {
    if (token) {
      await tokenBlacklistModel.create({ token });
    }

    res.clearCookie("token");

    res.status(200).json({
      message: "user logged out successfully",
    });
  } catch (error) {
    console.log("error in logoutUserController: ", error);
    res.status(500).json({
      message: "internal server error",
    });
  }
};

/**
 * @route GET /api/auth/get-me
 * @description get the current user details
 * @access Private
 */
export const getMeController = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);

    res.status(200).json({
      message: "user details fetched successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.log("error in getMeController: ", error);
    res.status(500).json({
      message: "internal server error",
    });
  }
};
