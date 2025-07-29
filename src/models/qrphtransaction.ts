import { BaseModel } from './base';
import { QRPHTransactionData, QRPHTransactionWithTransaction } from '../types';

export class QRPHTransaction extends BaseModel {
  static async create(data: QRPHTransactionData): Promise<QRPHTransactionData|undefined> {
    const {
      transaction_id,
      qrph_string,
      amount,
      ref_num,
      trace_no,
      batch_no,
      expires_at
    } = data;

    const query = `
      INSERT INTO qrphtransactions (
        transaction_id, qrph_string, amount, ref_num, trace_no, batch_no, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [transaction_id, qrph_string, amount, ref_num, trace_no, batch_no, expires_at];

    try {
      const result = await this.query<QRPHTransactionData>(query, values);
      return result.rows?.at(0);
    } catch (error: any) {
      throw new Error(`Failed to create QRPH transaction: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<QRPHTransactionWithTransaction | null> {
    const query = `
      SELECT q.*, t.reference_id, t.status as transaction_status
      FROM qrphtransactions q
      LEFT JOIN transaction t ON q.transaction_id = t.id
      WHERE q.id = $1
    `;

    try {
      const result = await this.query<QRPHTransactionWithTransaction>(query, [id]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to find QRPH transaction: ${error.message}`);
    }
  }

  static async findByTransactionId(transactionId: string): Promise<QRPHTransactionData[]> {
    const query = 'SELECT * FROM qrphtransactions WHERE transaction_id = $1';
    try {
      const result = await this.query<QRPHTransactionData>(query, [transactionId]);
      return result.rows;
    } catch (error: any) {
      throw new Error(`Failed to find QRPH transactions: ${error.message}`);
    }
  }

  static async update(id: string, data: Partial<QRPHTransactionData>): Promise<QRPHTransactionData | null> {
    const allowedFields = ['qrph_string', 'amount', 'ref_num', 'trace_no', 'batch_no', 'expires_at'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key) && data[key as keyof QRPHTransactionData] !== undefined) {
        updateFields.push(`${key} = $${++paramCount}`);
        values.push(data[key as keyof QRPHTransactionData]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE qrphtransactions
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    try {
      const result = await this.query<QRPHTransactionData>(query, values);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to update QRPH transaction: ${error.message}`);
    }
  }

  static async findByRefNum(refNum: string): Promise<QRPHTransactionData | null> {
    const query = 'SELECT * FROM qrphtransactions WHERE ref_num = $1';
    try {
      const result = await this.query<QRPHTransactionData>(query, [refNum]);
      return result.rows[0] || null;
    } catch (error: any) {
      throw new Error(`Failed to find QRPH transaction by ref_num: ${error.message}`);
    }
  }
}