import { BaseModel } from './base';
import { CardTransactionData, CardTransactionWithTransaction } from '../types';

export class CardTransaction extends BaseModel {
  static async create(data: CardTransactionData): Promise<CardTransactionData | undefined> {
    const {
      transaction_id,
      amount,
      ref_num,
      trace_no,
      batch_no,
      masked_pan,
      card_type,
      currency,
      entry_mode,
      issuer_bank,
      emv_tags,
      merchant_id,
    } = data;

    const query = `
      INSERT INTO cardtransactions (
        transaction_id, amount, ref_num, trace_no, batch_no, masked_pan,
        card_type, currency, entry_mode, issuer_bank, emv_tags, merchant_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      transaction_id, amount, ref_num, trace_no, batch_no, masked_pan,
      card_type, currency, entry_mode, issuer_bank, emv_tags, merchant_id
    ];

    try {
      const result = await this.query<CardTransactionData>(query, values);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to create card transaction: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<CardTransactionWithTransaction | null> {
    const query = `
      SELECT c.*, t.reference_id, t.status as transaction_status
      FROM cardtransactions c
      LEFT JOIN transactions t ON c.transaction_id = t.id
      WHERE c.id = $1
    `;

    try {
      const result = await this.query<CardTransactionWithTransaction>(query, [id]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to find card transaction: ${error.message}`);
    }
  }

  static async findByTransactionId(transactionId: string): Promise<CardTransactionData[]> {
    const query = 'SELECT * FROM cardtransactions WHERE transaction_id = $1';
    try {
      const result = await this.query<CardTransactionData>(query, [transactionId]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find card transactions: ${error.message}`);
    }
  }

  static async update(id: string, data: Partial<CardTransactionData>): Promise<CardTransactionData | null> {
    const allowedFields = [
      'amount', 'ref_num', 'trace_no', 'batch_no', 'masked_pan', 'card_type',
      'currency', 'entry_mode', 'issuer_bank', 'emv_tags', 'merchant_id', 'expires_at'
    ];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key) && data[key as keyof CardTransactionData] !== undefined) {
        updateFields.push(`${key} = $${++paramCount}`);
        values.push(data[key as keyof CardTransactionData]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE cardtransactions
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    try {
      const result = await this.query<CardTransactionData>(query, values);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to update card transaction: ${error.message}`);
    }
  }

  static async findByRefNum(refNum: string): Promise<CardTransactionData | null> {
    const query = 'SELECT * FROM cardtransactions WHERE ref_num = $1';
    try {
      const result = await this.query<CardTransactionData>(query, [refNum]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to find card transaction by ref_num: ${error.message}`);
    }
  }

  static async findByMaskedPan(maskedPan: string): Promise<CardTransactionData[]> {
    const query = 'SELECT * FROM cardtransactions WHERE masked_pan = $1 ORDER BY created_at DESC';
    try {
      const result = await this.query<CardTransactionData>(query, [maskedPan]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find card transactions by masked_pan: ${error.message}`);
    }
  }

  static async findByMerchantId(merchantId: string): Promise<CardTransactionData[]> {
    const query = 'SELECT * FROM cardtransactions WHERE merchant_id = $1 ORDER BY created_at DESC';
    try {
      const result = await this.query<CardTransactionData>(query, [merchantId]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find card transactions by merchant_id: ${error.message}`);
    }
  }

  static async findByBatchNo(batchNo: number): Promise<CardTransactionData[]> {
    const query = 'SELECT * FROM cardtransactions WHERE batch_no = $1 ORDER BY created_at DESC';
    try {
      const result = await this.query<CardTransactionData>(query, [batchNo]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find card transactions by batch_no: ${error.message}`);
    }
  }
}