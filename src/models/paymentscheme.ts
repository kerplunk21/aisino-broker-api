import redisService from "@/services/redisService";
import { CAPK } from "@/types";

export class PaymentScheme {
  private static readonly capkKey = "paymentscheme:capk";

  static async upsertCAPKs(capkList: CAPK[]): Promise<CAPK[] | undefined> {
    try {
      if (!capkList || capkList.length === 0) {
        return capkList;
      }

      // Prepare fields and values for multi-HSET
      const fieldsAndValues: Record<string, any> = {};

      for (const capk of capkList) {
        fieldsAndValues[capk.checksum] = capk;
      }

      // Use the enhanced multiHset method
      const results = await redisService.multiHset(this.capkKey, fieldsAndValues);

      console.log(`Upserted ${capkList.length} CAPKs, results:`, results);
  
      return capkList;
    } catch (error) {
      console.error("Error upserting CAPKs:", error);
      return undefined;
    }
  }

  static async getCAPK(checkSum: string): Promise<CAPK | undefined> {
    try {
      const capkData = await redisService.hget(this.capkKey, checkSum);

      if (!capkData) {
        return undefined;
      }

      return JSON.parse(capkData) as CAPK;
    } catch (error) {
      console.error("Error getting CAPK:", error);
      return undefined;
    }
  }

  static async getAllCAPKs(): Promise<CAPK[] | undefined> {
    try {
      const capkHash = await redisService.hgetall(this.capkKey);
      if (!capkHash || Object.keys(capkHash).length === 0) {
        return [];
      }

      const capkList: CAPK[] = [];
      for (const [key, value] of Object.entries(capkHash)) {
        try {
          const capk = JSON.parse(value) as CAPK;
          capkList.push(capk);
        } catch (parseError) {
          console.error(`Error parsing CAPK for key ${key}:`, parseError);
        }
      }

      return capkList;
    } catch (error) {
      console.error("Error getting all CAPKs:", error);
      return undefined;
    }
  }

  static async deleteCAPK(rid: string, index?: string): Promise<boolean> {
    try {
      const fieldKey = index ? `${rid}:${index}` : rid;
      const result = await redisService.hdel(this.capkKey, fieldKey);

      return result;
    } catch (error) {
      console.error("Error deleting CAPK:", error);
      return false;
    }
  }

  static async clearAllCAPKs(): Promise<boolean> {
    try {
      const result = await redisService.del(this.capkKey);
      return result;
    } catch (error) {
      console.error("Error clearing all CAPKs:", error);
      return false;
    }
  }
}