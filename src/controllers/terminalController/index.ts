import { Response } from 'express';
import { PaymentConfig, TerminalSerialPayload, TypedRequest } from '@/types';
import { sendResponse } from '@/helpers/response';
import redisService from '@/services/redisService';
import { Utils } from '@/utils/utils';
export class TerminalController {
  static readonly terminalConfigHKey = 'terminal-config';
  static async updateTerminalConfiguration(req: TypedRequest<PaymentConfig>, res: Response): Promise<Response> {
    try {
      const payload = req.body;
      payload.revision_id = Utils.generateUuid()
      await redisService.hmset(`${TerminalController.terminalConfigHKey}:${payload.terminal_serial_no}`, payload);
      return sendResponse(res, {
        message: "Updated Terminal Config with revision_id: "+payload.revision_id
      })
    }
    catch(error){
      console.log("Error in process payment ", error)
      return sendResponse(res, {
          success: false,
          message: "Error in Update Terminal Configuration",
          error: JSON.stringify(error),
          status_code: 500,
          code: 5003
      });
    }
  }

  static async getTerminalConfig(req: TypedRequest<TerminalSerialPayload>, res: Response): Promise<Response> {
        try {
      const { serial } = req.body;
      const config = await redisService.hgetall(`${TerminalController.terminalConfigHKey}:${serial}`);
      return sendResponse(res, {
        message: "Success!",
        data: config
      })
    }
    catch(error){
      console.log("Error in process payment ", error)
      return sendResponse(res, {
          success: false,
          message: "Error in Get Terminal Configuration",
          error: JSON.stringify(error),
          status_code: 500,
          code: 5003
      });
    }
  }
}
