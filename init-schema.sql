
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Transaction Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id VARCHAR(255),
  pos_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  amount INT,
  merchant_id VARCHAR(100),
  terminal_id VARCHAR(100),
  terminal_serial_no VARCHAR(100),
  alpha_code VARCHAR(3),
  payment_type VARCHAR(20) DEFAULT 'QRPH',
  payconnect_payment_id VARCHAR(255),
  payconnect_reference_no VARCHAR(255),
  payconnect_pan VARCHAR(255),
  payconnect_approval_code VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- QRPH Table
CREATE TABLE IF NOT EXISTS qrphtransactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  qrph_string TEXT,
  amount INT,
  ref_num VARCHAR(100),
  trace_no INT,
  batch_no INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Auth Table
CREATE TABLE IF NOT EXISTS auths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_key VARCHAR(100),
  access_secret VARCHAR(100),
  status VARCHAR(20) DEFAULT 'inactive',
  description VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255),
  description VARCHAR(255),
  pos_id VARCHAR(100),
  payment_terminal_serial_no VARCHAR(100),
  status VARCHAR(20) DEFAULT 'offline',
  last_transaction TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_qrphtransactions_transaction_id ON qrphtransactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_qrphtransactions_ref_num ON qrphtransactions(ref_num);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_pos_id ON devices(pos_id);
CREATE INDEX IF NOT EXISTS idx_auths_access_key ON auths(access_key);
CREATE INDEX IF NOT EXISTS idx_auths_status ON auths(status);
CREATE INDEX IF NOT EXISTS idx_transactions_payconnect_payment_id ON transactions(payconnect_payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payconnect_payment_id_status ON transactions(payconnect_payment_id, status);

-- Insert some default data (optional)
INSERT INTO auths (access_key, access_secret, status, description) 
VALUES ('default_key', 'default_secret', 'active', 'Default auth for testing')
ON CONFLICT DO NOTHING;

-- Log completion
SELECT 'Database schema initialized successfully!' as message;