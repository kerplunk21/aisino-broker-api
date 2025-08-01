import { Response, Request } from 'express';
import { PaymentConfig, TerminalSerialPayload, TypedRequest } from '@/types';
import { sendResponse } from '@/helpers/response';
import redisService from '@/services/redisService';
import { Utils } from '@/utils/utils';
import { APIService } from '@/services/apiService';
import bcrypt from 'bcrypt';
import { PaymentConfigSchema } from '@/schemas/terminal';
import CONFIG from '@/config/config';
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
      console.log("Error in getTerminalCongfig ", error)
      return sendResponse(res, {
          success: false,
          message: "Error in Get Terminal Configuration",
          error: JSON.stringify(error),
          status_code: 500,
          code: 5003
      });
    }
  }

  static async getWorkingKeys(req: TypedRequest<TerminalSerialPayload>, res: Response): Promise<Response> {
    try {
      const { serial } = req.body;
      // fetch token and terminal config
      const token = await APIService.fetchAuth({
        serialNo: serial,
        brandName: bcrypt.hashSync(CONFIG.BRAND_NAME, (bcrypt.genSaltSync(12))),
        tradeName: bcrypt.hashSync(CONFIG.TRADE_NAME, (bcrypt.genSaltSync(12)))
      })
      if (!token) {
        return sendResponse(res, {
          success: false,
          message: "Payment Request Error",
          error: "No payment terminal config found",
          status_code: 500,
          code: 5005
        });
      }
      const terminalConfigKey = `${TerminalController.terminalConfigHKey}:${serial}`
      const { success, data: config } = PaymentConfigSchema.safeParse(await redisService.hgetall(terminalConfigKey));
      if (!success) {
        return sendResponse(res, {
          success: false,
          message: "Payment Request Error",
          error: "No payment terminal config found",
          status_code: 500,
          code: 5006
        });
      }
      const workingKeys = APIService.getKeys(token, config?.terminalConfig?.terminalId!)
      return sendResponse(res, {
        data: workingKeys
      });
    }
    catch(error) {
      console.log("Error in getWorkingKeys ", error)
      return sendResponse(res, {
          success: false,
          message: "Error in Get Working Keys",
          error: JSON.stringify(error),
          status_code: 500,
          code: 5003
      });
    }
  }

}
