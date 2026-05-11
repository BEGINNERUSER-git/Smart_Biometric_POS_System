import axios from "axios";
import ApiError from "../utility/ApiError.js";

const BLOCKCHAIN_API = "http://localhost:4000/api/pay";

export const processBlockchainPayment = async ({
  userId,
  merchantId,
  amount,
  palmHash
}) => {
  try {
    const response = await axios.post(BLOCKCHAIN_API, {
      userId,
      merchantId,
      amount,
      palmHash
    });

    return response.data;
  } catch (error) {
    throw new ApiError(
      502,
      "Blockchain API failed: " + (error.response?.data?.error || error.message)
    );
  }
};