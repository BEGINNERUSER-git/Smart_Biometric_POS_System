import Product from "../models/product.models.js";
import ApiError from "../utility/ApiError.js";
import ApiResponse from "../utility/ApiResponse.js";

export const createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category, sku, supplier } = req.body;
    if (!name || price == null || stock == null || !sku) {
      throw new ApiError(400, "Name, price, stock, and SKU are required");
    }
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      throw new ApiError(409, "Product with this SKU already exists");
    }   
    const product = await Product.create({
      name,
      description: description || "",
        price,
        stock,
        category: category || "",
        sku,
        supplier: supplier || ""
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

