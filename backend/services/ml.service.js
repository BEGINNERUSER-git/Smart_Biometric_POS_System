import axios  from "axios";
export const predict=async (features)=>{
  try {
    const response=await axios.post("http://localhost:5000/predict",features)
    return response.data;
} catch (error) {
    console.error("ML service error", error.message);
    return {
        fraud_score:0,
        risk_label:"Low"
    }
  }
}