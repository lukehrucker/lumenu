# Elgato Key Light API Reference

## Overview

The Elgato Key Light and Key Light Air are edge-lit LED video lights controlled via a built-in HTTP API. This document provides a complete reference of the API surface for controlling these IoT devices. Summarized from https://github.com/adamesch/elgato-key-light-api

## Connection Details

### Network Configuration

- **IP Address**: Obtain from your DHCP server/router or via Control Center app (Settings → Advanced)
- **Port**: `9123`
- **Base URL**: `/elgato`
- **Authentication**: None required

### Full Endpoint Format

```
http://{DEVICE_IP}:9123/elgato/{endpoint}
```

### Example

```bash
curl --location --request GET 'http://192.168.1.61:9123/elgato/lights' \
  --header 'Accept: application/json'
```

## HTTP Response Codes

The API returns only two status codes:

- `200 OK` - Request succeeded
- `400 Bad Request` - Malformed request syntax

All responses are JSON-formatted.

---

## API Endpoints

### 1. Identify Device

Flash the light to identify a specific device.

**Endpoint**: `POST /elgato/identify`

**URI Parameters**: None

**Request Body**: None

**Response**: None (200 OK on success)

**Example**:

```bash
curl --location --request POST 'http://192.168.1.61:9123/elgato/identify' \
  --header 'Accept: application/json'
```

---

### 2. Get Accessory Info

Retrieve device hardware specifications and metadata.

**Endpoint**: `GET /elgato/accessory-info`

**URI Parameters**: None

**Request Body**: None

**Response Schema**:

```json
{
  "productName": "string",
  "hardwareBoardType": "integer",
  "firmwareBuildNumber": "integer",
  "firmwareVersion": "string",
  "serialNumber": "string",
  "displayName": "string",
  "features": ["string"]
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| productName | string | Product model name |
| hardwareBoardType | integer | Hardware board identifier |
| firmwareBuildNumber | integer | Firmware build number |
| firmwareVersion | string | Firmware version string |
| serialNumber | string | Device serial number |
| displayName | string | User-defined device name |
| features | array | Array of supported feature strings (e.g., "lights") |

**Example**:

```bash
curl --location --request GET 'http://192.168.1.61:9123/elgato/accessory-info' \
  --header 'Accept: application/json'
```

**Example Response**:

```json
{
  "productName": "Elgato Key Light",
  "hardwareBoardType": 53,
  "firmwareBuildNumber": 192,
  "firmwareVersion": "1.0.3",
  "serialNumber": "XXXXXXXXXXXX",
  "displayName": "",
  "features": ["lights"]
}
```

---

### 3. Update Accessory Info

Modify device hardware information (primarily display name).

**Endpoint**: `PUT /elgato/accessory-info`

**URI Parameters**: None

**Request Body Schema**:

```json
{
  "productName": "string (optional)",
  "hardwareBoardType": "integer (optional)",
  "firmwareBuildNumber": "integer (optional)",
  "firmwareVersion": "string (optional)",
  "serialNumber": "string (optional)",
  "displayName": "string (optional)",
  "features": ["string (optional)"]
}
```

**Body Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| productName | string | No | Product model name |
| hardwareBoardType | integer | No | Hardware board identifier |
| firmwareBuildNumber | integer | No | Firmware build number |
| firmwareVersion | string | No | Firmware version string |
| serialNumber | string | No | Device serial number |
| displayName | string | No | User-defined device name |
| features | array | No | Array of supported features |

**Response**: Returns updated accessory info object (same schema as GET)

**Example**:

```bash
curl --location --request PUT 'http://192.168.1.61:9123/elgato/accessory-info' \
  --header 'Accept: application/json' \
  --data-raw '{
    "displayName": "MyKeyLight"
  }'
```

**Example Response**:

```json
{
  "productName": "Elgato Key Light",
  "hardwareBoardType": 53,
  "firmwareBuildNumber": 192,
  "firmwareVersion": "1.0.3",
  "serialNumber": "XXXXXXXXXXXX",
  "displayName": "MyKeyLight",
  "features": ["lights"]
}
```

---

### 4. Get Lights Status

Retrieve current lighting state, brightness, and color temperature.

**Endpoint**: `GET /elgato/lights`

**URI Parameters**: None

**Request Body**: None

**Response Schema**:

```json
{
  "numberOfLights": "integer",
  "lights": [
    {
      "on": "integer",
      "brightness": "integer",
      "temperature": "integer"
    }
  ]
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| numberOfLights | integer | Number of light elements in array |
| lights | array | Array of light objects |
| lights[].on | integer | Power state (0 = off, 1 = on) |
| lights[].brightness | integer | Brightness percentage (0-100) |
| lights[].temperature | integer | Color temperature in converted format (see note below) |

**Temperature Conversion**: The temperature value uses a custom format. To convert:

- Kelvin to API format: `temperature = (1000000 / kelvin) - 10`
- API format to Kelvin: `kelvin = 1000000 / (temperature + 10)`
- Range: 143-344 (representing ~7000K-2900K)

**Example**:

```bash
curl --location --request GET 'http://192.168.1.61:9123/elgato/lights' \
  --header 'Accept: application/json'
```

**Example Response**:

```json
{
  "numberOfLights": 1,
  "lights": [
    {
      "on": 0,
      "brightness": 25,
      "temperature": 166
    }
  ]
}
```

---

### 5. Update Lights Status

Control light power, brightness, and color temperature.

**Endpoint**: `PUT /elgato/lights`

**URI Parameters**: None

**Request Body Schema**:

```json
{
  "numberOfLights": "integer",
  "lights": [
    {
      "on": "integer (optional)",
      "brightness": "integer (optional)",
      "temperature": "integer (optional)"
    }
  ]
}
```

**Body Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| numberOfLights | integer | Yes | Number of lights in array (typically 1) |
| lights | array | Yes | Array of light objects |
| lights[].on | integer | No | Power state (0 = off, 1 = on) |
| lights[].brightness | integer | No | Brightness percentage (0-100) |
| lights[].temperature | integer | No | Color temperature (143-344) |

**Response**: Returns updated lights object (same schema as GET)

**Example 1 - Turn on and set brightness and temperature**:

```bash
curl --location --request PUT 'http://192.168.1.61:9123/elgato/lights' \
  --header 'Accept: application/json' \
  --data-raw '{
    "numberOfLights": 1,
    "lights": [
      {
        "on": 1,
        "brightness": 78,
        "temperature": 266
      }
    ]
  }'
```

**Example Response**:

```json
{
  "numberOfLights": 1,
  "lights": [
    {
      "on": 1,
      "brightness": 78,
      "temperature": 266
    }
  ]
}
```

**Example 2 - Turn off (preserving other settings)**:

```bash
curl --location --request PUT 'http://192.168.1.61:9123/elgato/lights' \
  --header 'Accept: application/json' \
  --data-raw '{
    "numberOfLights": 1,
    "lights": [
      {
        "on": 0
      }
    ]
  }'
```

**Example Response**:

```json
{
  "numberOfLights": 1,
  "lights": [
    {
      "on": 0,
      "brightness": 78,
      "temperature": 266
    }
  ]
}
```

---

### 6. Get Light Settings

Retrieve device behavior settings for power-on state and transition timings.

**Endpoint**: `GET /elgato/lights/settings`

**URI Parameters**: None

**Request Body**: None

**Response Schema**:

```json
{
  "powerOnBehavior": "integer",
  "powerOnBrightness": "integer",
  "powerOnTemperature": "integer",
  "switchOnDurationMs": "integer",
  "switchOffDurationMs": "integer",
  "colorChangeDurationMs": "integer"
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| powerOnBehavior | integer | Behavior when powered on (0 = restore last state, 1 = use default settings) |
| powerOnBrightness | integer | Default brightness when powered on (0-100) |
| powerOnTemperature | integer | Default color temperature when powered on (143-344) |
| switchOnDurationMs | integer | Fade-in duration in milliseconds |
| switchOffDurationMs | integer | Fade-out duration in milliseconds |
| colorChangeDurationMs | integer | Color/brightness transition duration in milliseconds |

**Example**:

```bash
curl --location --request GET 'http://192.168.1.61:9123/elgato/lights/settings' \
  --header 'Accept: application/json'
```

**Example Response**:

```json
{
  "powerOnBehavior": 1,
  "powerOnBrightness": 20,
  "powerOnTemperature": 213,
  "switchOnDurationMs": 100,
  "switchOffDurationMs": 300,
  "colorChangeDurationMs": 100
}
```

---

### 7. Update Light Settings

Modify device behavior settings.

**Endpoint**: `PUT /elgato/lights/settings`

**URI Parameters**: None

**Request Body Schema**:

```json
{
  "powerOnBehavior": "integer (optional)",
  "powerOnBrightness": "integer (optional)",
  "powerOnTemperature": "integer (optional)",
  "switchOnDurationMs": "integer (optional)",
  "switchOffDurationMs": "integer (optional)",
  "colorChangeDurationMs": "integer (optional)"
}
```

**Body Parameters**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| powerOnBehavior | integer | No | Power-on behavior setting |
| powerOnBrightness | integer | No | Default brightness (0-100) |
| powerOnTemperature | integer | No | Default temperature (143-344) |
| switchOnDurationMs | integer | No | Fade-in duration (milliseconds) |
| switchOffDurationMs | integer | No | Fade-out duration (milliseconds) |
| colorChangeDurationMs | integer | No | Transition duration (milliseconds) |

**Response**: Returns updated settings object (same schema as GET)

**Example**:

```bash
curl --location --request PUT 'http://192.168.1.61:9123/elgato/lights/settings' \
  --header 'Accept: application/json' \
  --data-raw '{
    "powerOnBehavior": 0
  }'
```

**Example Response**:

```json
{
  "powerOnBehavior": 0,
  "powerOnBrightness": 20,
  "powerOnTemperature": 213,
  "switchOnDurationMs": 100,
  "switchOffDurationMs": 300,
  "colorChangeDurationMs": 100
}
```

---

## API Resources Summary

The API provides three main resources:

### 1. Lights (`/elgato/lights`)

Controls the light's power state, brightness, and color temperature.

- GET - Read current state
- PUT - Update state

### 2. Accessory Info (`/elgato/accessory-info`)

Manages device hardware information and metadata.

- GET - Read device info
- PUT - Update device info (primarily display name)

### 3. Settings (`/elgato/lights/settings`)

Configures device behavior on power-up and transition timings.

- GET - Read settings
- PUT - Update settings

## Functions

### Identify (`/elgato/identify`)

POST-only endpoint to flash the light for physical identification.

---

## Quick Reference

| Endpoint                  | Method | Purpose                                    |
| ------------------------- | ------ | ------------------------------------------ |
| `/elgato/identify`        | POST   | Flash light for identification             |
| `/elgato/accessory-info`  | GET    | Get device hardware info                   |
| `/elgato/accessory-info`  | PUT    | Update device info                         |
| `/elgato/lights`          | GET    | Get current light state                    |
| `/elgato/lights`          | PUT    | Control light power/brightness/temperature |
| `/elgato/lights/settings` | GET    | Get device behavior settings               |
| `/elgato/lights/settings` | PUT    | Update device behavior settings            |

---

## Notes

- All endpoints require `Accept: application/json` header
- PUT requests should include `Content-Type: application/json` header
- Partial updates are supported - only include fields you want to change
- Temperature values use a custom conversion formula (not direct Kelvin)
- No authentication or API keys required
- Device discovery via DHCP or Elgato Control Center app
