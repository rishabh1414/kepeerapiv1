function authMiddleware(req, res, next) {
  try {
    const incomingApiKey = req.header("x-api-key");
    const expectedApiKey = process.env.NODE_API_KEY;

    if (!expectedApiKey) {
      return res.status(500).json({
        success: false,
        error: "NODE_API_KEY is not configured"
      });
    }

    if (!incomingApiKey || incomingApiKey !== expectedApiKey) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Authentication failed"
    });
  }
}

module.exports = authMiddleware;
