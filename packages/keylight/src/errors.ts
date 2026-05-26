/**
 * Base error class for all Keylight errors.
 */
export class KeylightError extends Error {
  override name = 'KeylightError'
  readonly _tag: string = 'KeylightError'

  constructor(message: string, cause?: unknown) {
    super(message, { cause })
  }
}

/**
 * Error returned when connection to the device fails.
 */
export class KeylightConnectionError extends KeylightError {
  override name = 'KeylightConnectionError'
  override readonly _tag = 'KeylightConnectionError'
  readonly endpoint: string

  constructor(endpoint: string, cause?: unknown) {
    super(`Failed to connect to Keylight endpoint ${endpoint}`, cause)
    this.endpoint = endpoint
  }
}

/**
 * Error returned when the device responds with an HTTP error.
 */
export class KeylightHttpError extends KeylightError {
  override name = 'KeylightHttpError'
  override readonly _tag: string = 'KeylightHttpError'
  readonly endpoint: string
  readonly status: number
  readonly details?: string

  constructor(endpoint: string, status: number, details?: string) {
    super(
      `Keylight request to ${endpoint} failed with status ${status}${
        details ? `: ${details}` : ''
      }`
    )
    this.endpoint = endpoint
    this.status = status
    this.details = details
  }
}

/**
 * Backwards-compatible alias for bad request failures.
 */
export class KeylightBadRequestError extends KeylightError {
  override name = 'KeylightBadRequestError'
  override readonly _tag = 'KeylightBadRequestError'
  readonly endpoint: string
  readonly status = 400
  readonly details?: string

  constructor(endpoint: string, details?: string) {
    super(`Bad request to ${endpoint}${details ? `: ${details}` : ''}`)
    this.endpoint = endpoint
    this.details = details
  }
}

/**
 * Error returned when a device response does not match the API contract.
 */
export class KeylightDecodeError extends KeylightError {
  override name = 'KeylightDecodeError'
  override readonly _tag = 'KeylightDecodeError'
  readonly endpoint: string

  constructor(endpoint: string, cause?: unknown) {
    super(`Invalid Keylight response from ${endpoint}`, cause)
    this.endpoint = endpoint
  }
}

/**
 * Error returned when a value does not match the API contract.
 */
export class KeylightValidationError extends KeylightError {
  override name = 'KeylightValidationError'
  override readonly _tag = 'KeylightValidationError'
  readonly field: string
  readonly value: unknown
  readonly min?: number
  readonly max?: number
  readonly details?: string

  constructor(
    field: string,
    value: unknown,
    min?: number,
    max?: number,
    details?: string
  ) {
    super(formatValidationMessage(field, value, min, max, details))
    this.field = field
    this.value = value
    this.min = min
    this.max = max
    this.details = details
  }
}

function formatValidationMessage(
  field: string,
  value: unknown,
  min?: number,
  max?: number,
  details?: string
): string {
  if (details) {
    return `${field} is invalid: ${details}`
  }

  if (min !== undefined && max !== undefined) {
    return `${field} must be between ${min} and ${max}, got ${value}`
  }

  return `${field} is invalid`
}
