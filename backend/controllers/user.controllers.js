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
    const { username, email, password, role } = req.body;
    if ([username, email, password].some(field => field?.trim() === "")) {
      throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
      $or: [{ username }, { email }]
    });
    if (existedUser) {
      throw new ApiError(409, "User already exists");
    }

    const user = await User.create({
      username,
      email,
      password,
      role: role || "user"
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    
    return new ApiResponse(res, 201, "User registered successfully", { user: createdUser });

  } catch (error) {
    throw new ApiError(400, error.message, "User registration failed");
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!(email || username) || !password) {
      throw new ApiError(400, "Email/username and password are required");
    }

    const user = await User.findOne({ $or: [{ email }, { username }] });
    if (!user) throw new ApiError(404, "User not found");

    const isMatch = await user.isPasswordCorrect(password);
    if (!isMatch) throw new ApiError(401, "Invalid credentials");

    const { accessToken, refreshToken } = await generateAccessandRefreshtoken(user._id);
    const userSafe = await User.findById(user._id).select("-password -refreshToken");

    const options = { httpOnly: true, secure: true };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { user: userSafe, role: user.role, accessToken, refreshToken }, "Login successful"));

  } catch (error) {
    throw new ApiError(400, error.message, "Login error");
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

export const getAllUsers=async (req,res,next)=>{
    try {
        const users=await User.find().select("-password -refreshToken");
        res.status(200).json(new ApiResponse(200,"Users fetched successfully",users))
    } catch (error) {
        next(error);
    }   
}

export const getUserById=async (req,res,next)=>{
    try {
        const userId=req.params.id;
        const user=await User.findById(userId).select("-password -refreshToken");   
        if(!user){
            return next(new ApiError(404,"User not found"));
        }
        res.status(200).json(new ApiResponse(200,"User fetched successfully",user))
    } catch (error) {
        next(error);
    }
}

export const deleteUserById=async (req,res,next)=>{
    try {
        const userId=req.params.id;
        const user=await User.findByIdAndDelete(userId);   
        if(!user){
            return next(new ApiError(404,"User not found"));
        }
        res.status(200).json(new ApiResponse(200,"User deleted successfully"))
    } catch (error) {
        next(error);
    }
}
export const updateUserById=async (req,res,next)=>{
    try {
        const userId=req.params.id;
        const updateData=req.body;
        const user=await User.findByIdAndUpdate(userId,updateData,{new:true}).select("-password -refreshToken");   
        if(!user){
            return next(new ApiError(404,"User not found"));
        }
        res.status(200).json(new ApiResponse(200,"User updated successfully",user))
    } catch (error) {
        next(error);
    }
}

