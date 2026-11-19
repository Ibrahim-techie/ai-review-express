export const validateReviewRequest = (req, res, next) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      success: false,
      message: "Prompt is required and must be a string",
    });
  }

  next();
};