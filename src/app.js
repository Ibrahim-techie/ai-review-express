import express from "express";
import gemini from "./Client/gemini.js";
const app = express();

export default app;


app.use(express.json());


app.get("/", (req, res) => { 
    res.json({ message: "Hello, World!" });
})   



app.get("/healthcheck", (req, res) => {
    res.json({ status: "OK" });
}) 


app.post("/generate", async (req, res) => {
    const { prompt } = req.body;

    const response = await gemini.interactions.create({
        model:"gemini-3.8-flash",
        input:prompt
    })
    res.json({ response: response.output_text });
})

