import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import handler from "./api/process.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API endpoint
app.post("/api/process", (req, res) => {
  handler(req, res);
});

// Safe wildcard for Express 5
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});