/**
 * Custom Error Types for VEIL Client Networking.
 */

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class RelayUnavailableError extends NetworkError {
  constructor(message = 'Relay server is currently unreachable or unavailable') {
    super(message);
    this.name = 'RelayUnavailableError';
  }
}

export class MailboxRevokedError extends NetworkError {
  constructor(message = 'Mailbox has expired, been revoked, or does not exist on the relay') {
    super(message);
    this.name = 'MailboxRevokedError';
  }
}

export class ProtocolVersionMismatchError extends NetworkError {
  constructor(message = 'Relay server protocol version is incompatible with client') {
    super(message);
    this.name = 'ProtocolVersionMismatchError';
  }
}

export class TlsRequiredError extends NetworkError {
  constructor(message = 'Production configuration requires secure HTTPS / WSS relay endpoints') {
    super(message);
    this.name = 'TlsRequiredError';
  }
}

export class EnvelopePayloadTooLargeError extends NetworkError {
  constructor(message = 'Encrypted envelope exceeds maximum allowable size (64 KiB)') {
    super(message);
    this.name = 'EnvelopePayloadTooLargeError';
  }
}

export class UnauthorizedMailboxError extends NetworkError {
  constructor(message = 'Capability token is invalid or unauthorized for the requested mailbox') {
    super(message);
    this.name = 'UnauthorizedMailboxError';
  }
}
