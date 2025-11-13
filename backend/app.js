import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Importing Routes
import productRoutes from './routes/product.routes.js';
import userRoutes from './routes/user.routes.js';
import orderRoutes from './routes/order.routes.js';
// Using Routes
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);

// Global Error Handler
import ApiError from './utility/ApiError.js';
app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            status: 'error',    
            message: err.message,
            errors: err.errors || null
        });
    }
    console.error(err);
    return res.status(500).json({
        status: 'error',
        message: 'Internal Server Error'
    });
}
);
export default app;