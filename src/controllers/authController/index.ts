import { Response } from 'express';
import { TypedRequest,AuthenticatePayload, AuthenticationCreatePayload } from '@/types';
import { Auth } from '@/models/auth';
import { sendResponse } from '@/helpers/response';
import jwt from 'jsonwebtoken';
import CONFIG from '@/config/config';

export class AuthController {

  static async authenticate(req: TypedRequest<AuthenticatePayload>, res: Response): Promise<Response> {
    try {
      const { access_key, access_secret } = req.body;
      const auth = await Auth.findByAccessKey(access_key);
      if (auth && auth.access_secret === access_secret) {
        // Check if auth is active
        if (auth.status !== 'active') {
          return sendResponse(res, {
            success: false,
            message: "Account is not active",
            status_code: 401,
            code: 4002
          });
        }
        const token = jwt.sign(
          {
            id: auth.id,
            access_key: auth.access_key,
            status: auth.status
          },
          CONFIG.JWT_SECRET,
          { expiresIn: '24h' }
        );
        const now = new Date();
        const expiresInMs = 24 * 60 * 60 * 1000; //24H
        const expiresAt = new Date(now.getTime() + expiresInMs);

        return sendResponse(res, {
          data: {
            token: token,
            expires_at: expiresAt
          },
          message: "Authentication successful!",
        });
      }
      return sendResponse(res, {
        success: false,
        message: "Invalid credentials",
        status_code: 401,
        code: 4001
      });
    }
    catch(error) {
      console.log("Error in authenticate ", error);
      return sendResponse(res, {
        success: false,
        message: "Authentication failed",
        error: JSON.stringify(error),
        status_code: 500,
        code: 5002
      });
    }
  }

  static async createAuth(req: TypedRequest<AuthenticationCreatePayload>, res: Response): Promise<Response> {
    try {
        const auth = await Auth.create(req.body)
        if (auth) {
          return sendResponse(res, {
            data: auth,
            message: "Successfully created user auth",
          });
        }
        return sendResponse(res, {
          success: false,
          message: "Error in creation user auth",
          status_code: 500,
          code: 5001
        });
    }
    catch(error) {
      console.log("Error in authenticate ",error)
      return sendResponse(res, {
        success: false,
        message: "Error in creation user auth",
        error: JSON.stringify(error),
        status_code: 500,
        code: 5002
      });
    }
  }

}