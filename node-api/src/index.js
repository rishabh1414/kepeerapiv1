require("dotenv").config();

const express = require("express");
const cors = require("cors");

const vaultRouter = require("./routes/vault");

const app = express();
const port = process.env.PORT || 3000;
const keeperServiceUrl = process.env.KEEPER_SERVICE_URL || "http://localhost:8900";

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    return res.json({
      status: "ok",
      service: "keeper-node-api"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Health check failed"
    });
  }
});

app.use("/api/vault", vaultRouter);
app.use("/", vaultRouter);

app.use((err, req, res, next) => {
  return res.status(500).json({
    success: false,
    error: err.message || "Internal server error"
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port} and Keeper Service URL: ${keeperServiceUrl}`);
});
