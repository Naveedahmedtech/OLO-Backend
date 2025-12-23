import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ENV } from "./config/env";
import healthRouter from "./routes/health";
import { errorHandler } from "./middleware/errorHandler";
import routes from './routes'
import { connectDB } from "./utils/mongoose";
import path from "path";
import cookieParser from "cookie-parser";




const app = express();

// Middleware
app.use(helmet());
const allowedOrigins = [
  "http://localhost:3000",   // React dev
  "http://localhost:5173",   // sometimes React dev runs on this
  "https://carelink.example.com", // production frontend
  "https://olo-backend.onrender.com",
  "https://olo-frontend.onrender.com"
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // allow cookies/authorization headers
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

// Routes
app.use("/health", healthRouter);

// Root 
app.get("/", (_, res) => {
  res.send("CareLink API is running 🚀");
});

// serve static uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

connectDB();

// Centralized routes
app.use("/api", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(ENV.PORT, () => {
  console.log(`⚡️ Server running in ${ENV.NODE_ENV} on http://localhost:${ENV.PORT}`);
});
