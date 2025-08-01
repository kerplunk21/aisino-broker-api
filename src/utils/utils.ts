import { MerchantConfigFields } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export class Utils {
  private static readonly CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  static transactionDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  static customMerchantConfig<T extends Record<string, any>>(
    arrayOfObject: T[],
    fields: MerchantConfigFields
  ): Record<string, any>[] {
    return arrayOfObject.map(obj => {
      const newObj: Record<string, any> = {};
      for (const key in fields) {
        if (fields.hasOwnProperty(key) && obj[fields[key]] !== undefined) {
          newObj[key] = obj[fields[key]];
        }
      }
      return newObj;
    });
  }

  static parseMessage(payload: Buffer): any | false {
    try {
      return JSON.parse(payload.toString());
    } catch (e) {
      return false;
    }
  }

  static generateUuid(): string {
    return uuidv4();
  }

  static generateRefNum(): string {
    const getRandomChar = () =>
      this.CHARS.charAt(
        Math.floor(Math.random() * this.CHARS.length)
      );

    const segment = (length: number) =>
      Array.from({ length }, getRandomChar).join('');

    return `${segment(6)}-${segment(6)}-${segment(2)}`;
  }

  static toSixDigitString(num: number): string {
    return num.toString().padStart(6, '0');
  }

}