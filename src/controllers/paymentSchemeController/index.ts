import { Response } from 'express';
import { CVRequirements, TerminalCapabilities, TypedRequest } from '@/types';
import { sendResponse } from '@/helpers/response';
import { APIService } from '@/services/apiService';
import bcrypt from 'bcrypt';
import { DevicePaymentTerminalCurrencySchema, DevicePaymentTerminalPropertiesSchema } from '@/schemas/device';
import redisService from '@/services/redisService';

export class PaymentSchemeController {

  static async upsertCapks(req: TypedRequest<{serial: string;}>, res: Response): Promise<Response> {
    try {
      return sendResponse(res, {
        message: "Success upsert capks"
      })
    }
    catch(error) {
      return sendResponse(res, {
        status_code: 500,
        message: "Unhandled error"
      })
   }
  }

}