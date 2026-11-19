import express from "express";
import gemini from "./Client/gemini.js";
import groq from "./Client/groq.js";
import cors from "cors";
import serveaiRoutes from "./routes/ai.routes.js";
const app = express();

export default app;



app.use(express.json());
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
}))

app.get("/", (req, res) => { 
    res.json({ message: "Hello, World!" });
})   



app.get("/healthcheck", (req, res) => {
    res.json({ status: "OK" });
}) 


app.use("/api", serveaiRoutes);





