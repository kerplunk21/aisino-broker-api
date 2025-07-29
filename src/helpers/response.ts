import { Response } from 'express';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  status_code: number;
  code: number;
  data?: T;
  error?: string;
}

export const sendResponse = <T>(
  res: Response,
  payload: Omit<ApiResponse<T>, 'success' | 'message' | 'status_code' | 'code'> & {
    success?: boolean;
    message?: string;
    status_code?: number;
    code?: number;
  }
): Response => {
  const defaults = {
    success: payload.success ?? true,
    message: payload.message ?? '',
    status_code: payload.status_code ?? 200,
    code: payload.code ?? (payload.status_code ? payload.status_code * 10 : 2000),
  };

  return res.status(defaults.status_code).json({
    ...payload,
    ...defaults
  });
};