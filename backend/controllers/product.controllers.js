import Product from "../models/product.models.js";
import ApiError from "../utility/ApiError.js";
import ApiResponse from "../utility/ApiResponse.js";

export const createProduct = async (req, res) => {
  try {
    const { name,  price, stock, category ,barcode} = req.body;
    if (!name || price == null || stock == null || barcode==null ) {
      throw new ApiError(400, "Name, price, stock, and barcode are required");
    }
    const product = await Product.create({
      name,
        price,
        stock,
        category: category || "",
        barcode:barcode
    });
    return new ApiResponse(res, 201, "Product created successfully", { product });
  } catch (error) {
    throw new ApiError(400, error.message, "Product creation failed");
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    return new ApiResponse(res, 200, "Products retrieved successfully", { products });
  } catch (error) {
    throw new ApiError(500, "Error retrieving products");
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      throw new ApiError(404, "Product not found");
    }
    return new ApiResponse(res, 200, "Product retrieved successfully", { product });
  } catch (error) {
    throw new ApiError(500, "Error retrieving product");
  } 
};
export const updateProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const product = await Product.findByIdAndUpdate(id,
        updates, { new: true, runValidators: true });
    if (!product) {
      throw new ApiError(404, "Product not found");
    }   
    return new ApiResponse(res, 200, "Product updated successfully", { product });
  } catch (error) {
    throw new ApiError(500, "Error updating product");
  }
};

export const deleteProductById = async (req, res) => {  
    try {   
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);    
    if (!product) {
      throw new ApiError(404, "Product not found");
    }   
    return new ApiResponse(res, 200, "Product deleted successfully");
    } catch (error) {
    throw new ApiError(500, "Error deleting product");
  }
};  

export const getProductByBarcode=async(req,res)=>{
  try {
    const {barcode}=req.params
    const product=await Product.findOne({barcode})
    if(!product){
      throw new ApiError(404,"Product Not found");
    }
    return new ApiResponse(res,200,"Product retrieved successfully",{product})  
    return 
  } catch (error) {
    
    throw new ApiError(500,"Error retrieving product by barcode");
  }
}
