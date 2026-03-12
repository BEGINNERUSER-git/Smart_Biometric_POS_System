import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name:{
            type:String,
            required:true,
            trim:true,
        },
        price:{
            type:Number,
            required:true,
            default:0
        },
        stock:{
            type:Number,
            required:true,
            default:0
        },
        category:{
            type:String,
            trim:true,
            default:""
        },
        barcode:{
            type:String,
            trim:true,
            unique:true,
            required:true,
        },
       
    },

    {
        timestamps:true,
    }
);
export const Product=mongoose.model("Product",productSchema);
export default Product;
