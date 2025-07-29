import z from "zod";
import { Request, Response, NextFunction } from 'express';
import { QRPHPaymentStatusPayload, QRRequest, QRSuccessRequest, TypedRequest } from '@/types';

export const validateQRRequest = (
  req: TypedRequest<QRRequest>,
  res: Response,
  next: NextFunction
): void => {
  const {
    refNum,
    totalAmount,
    serialNum,
    token,
    merchantId,
    terminalId
  } = req.body;

  if (!refNum || !totalAmount || !serialNum || !token || !merchantId || !terminalId) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["refNum", "totalAmount", "serialNum", "token", "merchantId", "terminalId"]
    });
    return;
  }

  next();
};

export const validateQRSuccessRequest = (
  req: TypedRequest<QRSuccessRequest>,
  res: Response,
  next: NextFunction
): void => {
  const { approvalCode, requestReferenceNumber } = req.body;

  if (!approvalCode || !requestReferenceNumber) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["approvalCode", "requestReferenceNumber"]
    });
    return;
  }

  next();
};

export const validateQRPHPaymentStatus = (
  req: TypedRequest<QRPHPaymentStatusPayload>,
  res: Response,
  next: NextFunction
): void => {
  const { terminalId, rrn, paymentId } = req.body;

  if (!terminalId || !rrn || !paymentId) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["terminalId", "rrn", "paymentId"]
    });
    return;
  }

  next();
};


// Generic validation middleware
export const validatePayloadSchema = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate the request body
      const validatedData = schema.parse(req.body);
      // Replace the original body with validated data
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Return validation errors in a structured format
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      } else {
        // Handle unexpected errors
        res.status(500).json({
          success: false,
          message: 'Internal server error during validation'
        });
      }
    }
  };
};