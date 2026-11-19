import { Router } from "express";
import {generateResponse } from "../controllers/ai.controller.js";
import {validateReviewRequest} from "../validation/validaterequest.js";
const router = Router();

router.route("/generate").post(validateReviewRequest, generateResponse);
export default router;
