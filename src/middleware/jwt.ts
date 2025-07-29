import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import CONFIG from '@/config/config';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
      code: 4010
    });
  }

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("JWT verification error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      code: 4011
    });
  }
};