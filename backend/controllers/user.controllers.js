import User from "../models/user.models.js";
import ApiError from "../utility/ApiError.js";
import ApiResponse from "../utility/ApiResponse.js";

const generateAccessandRefreshtoken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Error generating access and refresh token.");
    }
};

export const registerUser = async (req, res) => {
    try {
        const { username, email, password, role, biometric_template_id } = req.body;

        if ([username, email, password, role].some(field => field?.trim() === "")) {
            throw new ApiError(400, "Username, email, password, and role are required");
        }

        if ((role === "merchant" || role === "customer") && !biometric_template_id) {
            throw new ApiError(400, "Biometric template ID is required for this role");
        }

       
        const existedUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existedUser) {
            throw new ApiError(409, "User with this email or username already exists");
        }

        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password,
            role,
            biometric_template_id: (role === "admin") ? null : biometric_template_id,
            isBiometricEnrolled: !!biometric_template_id 
        });

        const createdUser = await User.findById(user._id).select("-password -refreshToken");

        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while registering the user");
        }

        return res.status(201).json(
            new ApiResponse(201, "User registered successfully", { user: createdUser })
        );

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "User registration failed");
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, username, password, role } = req.body;

        if (!(email || username) || !password) {
            throw new ApiError(400, "Email/Username and password are required");
        }

        const user = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (!user) {
            throw new ApiError(404, "User does not exist");
        }

        if (role && user.role !== role) {
            throw new ApiError(401, `Access denied. User is not registered as a ${role}`);
        }

      
        const isPasswordCorrect = await user.isPasswordCorrect(password);
        if (!isPasswordCorrect) {
            throw new ApiError(401, "Invalid user credentials");
        }

        
        const { accessToken, refreshToken } = await generateAccessandRefreshtoken(user._id);

       
        const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

     
        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200, 
                    { 
                        user: loggedInUser, 
                        accessToken, 
                        refreshToken,
                        // POS-specific flags
                        isBiometricReady: user.isBiometricEnrolled 
                    }, 
                    "User logged in successfully"
                )
            );

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Internal Login Error");
    }
};

export const logout = async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: null } }, { new: true });

    const options = { httpOnly: true, secure: true };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "Logout successful"));
};

export const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select("-password -refreshToken");
        res.status(200).json(new ApiResponse(200, "Users fetched successfully", users))
    } catch (error) {
        next(error);
    }
}

export const getUserById = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId).select("-password -refreshToken");
        if (!user) {
            return next(new ApiError(404, "User not found"));
        }
        res.status(200).json(new ApiResponse(200, "User fetched successfully", user))
    } catch (error) {
        next(error);
    }
}

export const deleteUserById = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return next(new ApiError(404, "User not found"));
        }
        res.status(200).json(new ApiResponse(200, "User deleted successfully"))
    } catch (error) {
        next(error);
    }
}
export const updateUserById = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const updateData = req.body;
        const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select("-password -refreshToken");
        if (!user) {
            return next(new ApiError(404, "User not found"));
        }
        res.status(200).json(new ApiResponse(200, "User updated successfully", user))
    } catch (error) {
        next(error);
    }
}

