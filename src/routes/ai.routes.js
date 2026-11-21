import { Router } from "express";
import { createReview, getMeta } from "../controllers/review.controller.js";
import { reviewRateLimits } from "../middleware/rateLimit.js";
import { validateReviewRequest } from "../validation/validaterequest.js";

const router = Router();

router.get("/meta", getMeta);
router.post("/review", ...reviewRateLimits, validateReviewRequest, createReview);

export default router;
