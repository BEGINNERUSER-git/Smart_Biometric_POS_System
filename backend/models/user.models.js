import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const userSchema=new mongoose.Schema(
    {
        username:{
            type:String,
            required:true,
            trim:true,
            unique:true,
        },
        email:{
            type:String,
            required:true,
            trim:true,
            unique:true,
        },
        password:{
            type:String,    
            required:true,
            trim:true,
        },
        role:{  
            type:String,
            enum:["admin","cashier","manager"],
            default:"cashier"
        },
        wallet:{
            type:String,
            trim:true,
            default:""
        },
        refreshToken:{
            type:String,
            default:null
        }
    },
    {
        timestamps:true,
    }
);







userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 8);
  next();
});

userSchema.methods.isPasswordCorrect=async function(password){
 return await bcrypt.compare(password,this.password );
}

//GENERATE ACCESS TOKEN
userSchema.methods.generateAccessToken=function(){
   return jwt.sign(
      {
        _id:this._id,
        email:this.email,
        username:this.username,
        role:this.role,
        address:this.wallet
        

      },
      process.env.ACCESS_TOKEN_SECRET,

      {
   
        expiresIn:process.env.ACCESS_TOKEN_EXPIRATION

      }
    )
}

//GENERATE REFRESH TOKEN
userSchema.methods.generateRefreshToken=function(){
  return jwt.sign(
      {
        _id:this._id,
      
      },
      process.env.REFRESH_TOKEN_SECRET,

      {
        expiresIn:process.env.REFRESH_TOKEN_EXPIRATION
      }
    )
}

const User = mongoose.model("User", userSchema);
export default User;