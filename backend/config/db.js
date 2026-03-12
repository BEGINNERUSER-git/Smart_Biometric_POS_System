import mongoose from "mongoose";

const connectDB= async ()=>{
    try {
        const connectionInstance=await mongoose.connect(`${process.env.MONGO_URI}/smart_biometric_pos_system`,)
        console.log(`MongoDB connected: ${connectionInstance.connection.host}`)

    } catch (error) {
        console.error("Error connecting to the database.")
        process.exit(1);
    }
}
export default connectDB;