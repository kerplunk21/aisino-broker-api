# PAYMENT TERMINAL BROKER API DOCUMENTATION

### BASE_URL = ``` http://localhost:3000 ```

## API Configuration

The broker API uses standard HTTP/HTTPS communication with JSON payloads and JWT authentication.

```javascript
const apiConfig = {
  baseURL: 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
};
```

## 1. Authentication API

This document describes how clients authenticate to the payment terminal broker API.

## Endpoint

```
POST /api/authenticate
```

## Description

Authenticates a client using access key and secret credentials, returning a JWT token for subsequent API calls.

---

## Request

### Headers

| Key              | Value                |
|------------------|----------------------|
| Content-Type     | application/json     |

### Body

```json
{
  "access_key": "access_key_0001",
  "access_secret": "access_secret_0001"
}
```

- `access_key`: Unique access key identifier (string).
- `access_secret`: Corresponding secret for the access key (string)

---

## Response

### Success (200 OK)

```json
{
  "data": {
    "token": "jwt-token-here-0001",
    "expires_at": "2025-06-17T23:30:50.526Z"
  },
  "message": "Authentication successful!",
  "success": true,
  "status_code": 200,
  "code": 2000
}
```

### Error (401 Unauthorized)

```json
{
  "success": false,
  "message": "Invalid credentials",
  "status_code": 401,
  "code": 4001
}
```

### Error (401 - Inactive Account)

```json
{
  "success": false,
  "message": "Account is not active",
  "status_code": 401,
  "code": 4002
}
```

---



# 2. Device Management

All device endpoints require authentication via JWT token in the Authorization header.

## Authentication Header

```
Authorization: Bearer <JWT_TOKEN>
```

## 2.1 Pos-PaymentTerminal Binding API

### Endpoint

```
POST /api/device/bind
```

### Description

Bind the pos with payment terminal

### Request

#### Headers

| Key              | Value                        |
|------------------|------------------------------|
| Content-Type     | application/json             |
| Authorization    | Bearer <JWT_TOKEN>           |

#### Body

```json
{
  "name": "POS Device 001",
  "description": "Pos device in sample 001",
  "pos_id": "00000002",
  "payment_terminal_serial_no": "00078000335"
}
```
- `name`: Unique name for pos device
- `description`: Description details or remarks
- `pos_id`: Device unique identity
- `payment_terminal_serial_no`: Serial number of Aisino Payment Terminal Binded to POS

### Response

#### Success (201 Created)

```json
{
  "data": {
    "id": "dbca17fe-a64d-4b4d-b579-dddcaa57e79d",
    "name": "POS Device 001",
    "description": "Pos device in sample 001",
    "pos_id": "00000002",
    "status": "offline",
    "last_transaction": null,
    "created_at": "2025-06-17T00:25:10.379Z",
    "updated_at": "2025-06-17T00:26:19.273Z",
    "payment_terminal_serial_no": "00078000335"
  },
  "message": "Successfully updated device bindings",
  "success": true,
  "status_code": 200,
  "code": 2000
}
```


### Error (401 Unauthorized)

```json
{
  "success": false,
  "message": "Access token required",
  "code": 4010
}
```


### Error (400 Payload Error)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "pos_id",
      "message": "Required",
      "code": "invalid_type"
    }
  ]
}
```


### Error (500 Server Error)

```json
{
  "success": false,
  "message": "Error in payment request",
  "error": "Stringified unhandled error",
  "status_code": 500,
  "code": 5002
}
```



# 3. Payment Transaction

All transactions endpoints require authentication via JWT token in the Authorization header.

## Authentication Header

```
Authorization: Bearer <JWT_TOKEN>
```

## 3.1 Payment Request API

### Endpoint

```
POST /api/transaction/payment-request
```

### Description

Payment Request Transaction For QRPH or CARD Payment

### Request

#### Headers

| Key              | Value                        |
|------------------|------------------------------|
| Content-Type     | application/json             |
| Authorization    | Bearer <JWT_TOKEN>           |

#### Body

```json
{
  "reference_id": "transaction-id",
  "pos_id": "00000001",
  "amount": 1000,
  "payment_type": "QRPH"
}
```


- `reference_id`: Unique transaction id for reference.
- `pos_id`: Binded pos_id
- `amount`: Transaction total amount
- `payment_type`: "QRPH" or "CARD" (But card is not avail yet)


---

### Response

#### Success (201 Created)

```json
{
  "message": "Success payment request",
  "data": {
    "type": "qr-pending",
    "data": {
      "payment_method": 1,
      "payment_reference_no": "KOT4DD-5JNIYY-QT",
      "amount": "120.00",
      "qrph_string": "",
      "payment_id": "eoqC-EtgT-DeCV-P1rD-SapS"
    }
  },
  "success": true,
  "status_code": 200,
  "code": 2000
}
```


### Error (401 Unauthorized)

```json
{
  "success": false,
  "message": "Access token required",
  "code": 4010
}
```


### Error (400 Validation Error)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "amount",
      "message": "Expected number, received string",
      "code": "invalid_type"
    }
  ]
}
```


### Error (500 Server Error)

```json
{
  "success": false,
  "message": "Error in payment request",
  "error": "Stringified unhandled error",
  "status_code": 500,
  "code": 5002
}
```
---

## 3.2 Payment Check Status API

### Endpoint

```
POST /api/transaction/payment-status
```

### Description

Payment Request Transaction For QRPH or CARD Payment

### Request

#### Headers

| Key              | Value                        |
|------------------|------------------------------|
| Content-Type     | application/json             |
| Authorization    | Bearer <JWT_TOKEN>           |

#### Body

```json
{
  "payment_reference_no": "EK5QAI-C2UBK9-2M",
  "payment_id": "WsP0-EMU4-2BYT-RhX1-snRD",
  "pos_id": "00000001"
}
```


- `payment_reference_no`: Response payment_reference_no
- `payment_id`: Response payment payment_id
- `pos_id`: Binded pos_id


---

### Response

#### Success (201 Created)

```json
{
  "message": "Success check status",
  "data": {
    "approval_code": "",
    "payconnect_reference_no": "WsP0-EMU4-2BYT-RhX1-snRD",
    "payment_id": "WsP0-EMU4-2BYT-RhX1-snRD",
    "payment_reference_no": "EK5QAI-C2UBK9-2M",
    "pan": "",
    "payment_status": "PAYMENT_PENDING"
  },
  "success": true,
  "status_code": 200,
  "code": 2000
}
```


### Error (401 Unauthorized)

```json
{
  "success": false,
  "message": "Access token required",
  "code": 4010
}
```


### Error (400 Validation Error)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "pos_id",
      "message": "Expected string, received null",
      "code": "invalid_type"
    }
  ]
}
```


### Error (500 Server Error)

```json
{
  "success": false,
  "message": "Error in payment check status",
  "error": "Stringified unhandled error",
  "status_code": 500,
  "code": 5002
}
```