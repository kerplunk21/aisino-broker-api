import { Response } from 'express';
import { TypedRequest, BindPosTerminalPayload, DeviceData, UnBindPosTerminalPayload, DeviceListPayload } from '@/types';
import { sendResponse } from '@/helpers/response';
import { Device } from '@/models/device';
import { Utils } from '@/utils/utils';
import { APIService } from '@/services/apiService';
import bcrypt from 'bcrypt';

export class DeviceController {
    static async bindPosAndTerminal(req: TypedRequest<BindPosTerminalPayload>, res: Response): Promise<Response> {
        try {
            const payload = req.body;
            const existingDevice = await Device.findByPosId(payload.pos_id)
            let device: DeviceData | undefined;
            if (existingDevice) {
                device = await Device.update(existingDevice.id!, payload)
            }
            else {
                device = await Device.create({
                    ...payload,
                    id: Utils.generateUuid()
                })
            }
            if (device) {
                return sendResponse(res, {
                    data: device,
                    message: "Successfully updated device bindings",
                });
            }
            return sendResponse(res, {
                success: false,
                message: "Error in updating device bindings",
                status_code: 500,
                code: 5001
            });
        }
        catch(error) {
            console.log("Error in deviceController bindposterminal ",error)
            return sendResponse(res, {
                success: false,
                message: "Error in binding pos terminal",
                error: JSON.stringify(error),
                status_code: 500,
                code: 5002
            });
        }
    }

    static async unbindPosAndTerminal(req: TypedRequest<UnBindPosTerminalPayload>, res: Response): Promise<Response> {
        try {
            const payload = req.body;
            const device = await Device.findByPosId(payload.pos_id)
            if (!device) {
                return sendResponse(res, {
                    success: false,
                    message: "Device not found!",
                    status_code: 400,
                    code: 4001
                });
            }
            await Device.delete(device.id)
            return sendResponse(res, {
                message: "Successfully unbind the device with payment terminal",
                code: 2001
            });
        }
        catch(error) {
            console.log("Error in deviceController unbindposterminal ",error)
            return sendResponse(res, {
                success: false,
                message: "Unhandled error",
                error: JSON.stringify(error),
                status_code: 500,
                code: 5002
            });
        }
    }


    static async getBindedDevices(req: TypedRequest<DeviceListPayload>, res: Response) {
        const { pos_id, payment_terminal_serial_no } = req.body;
        const devices = await Device.findByPosDevices(
            pos_id,
            payment_terminal_serial_no
        );
        return sendResponse(res,{
            message: "Success",
            data: devices
        })
    }
}