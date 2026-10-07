import { createSign } from 'node:crypto';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface FirebasePushMessage {
  message: {
    token: string;
    data: { kind: 'message' };
    android: { priority: 'HIGH' };
  };
}

export function buildGenericFcmMessage(token: string): FirebasePushMessage {
  return {
    message: {
      token,
      // Data-only prevents the OS from displaying arbitrary server-supplied
      // text. VeilFirebaseMessagingService always renders the fixed generic copy.
      data: { kind: 'message' },
      android: { priority: 'HIGH' },
    },
  };
}

export class FirebasePushSendError extends Error {
  constructor(
    public readonly status: number,
    public readonly invalidToken: boolean
  ) {
    super(`Firebase push request failed (${status})`);
    this.name = 'FirebasePushSendError';
  }
}

export interface FirebasePushSenderOptions {
  projectId: string;
  getAccessToken: () => Promise<string>;
  fetcher?: typeof fetch;
}

export class FirebasePushSender {
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: FirebasePushSenderOptions) {
    this.fetcher = options.fetcher ?? fetch;
  }

  public async send(token: string): Promise<void> {
    const response = await this.fetcher(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.options.projectId)}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.options.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildGenericFcmMessage(token)),
        signal: AbortSignal.timeout(8_000),
      }
    );

    if (!response.ok) {
      const invalidToken = response.status === 404 && await responseIndicatesUnregistered(response);
      throw new FirebasePushSendError(response.status, invalidToken);
    }
  }
}

async function responseIndicatesUnregistered(response: Response): Promise<boolean> {
  try {
    const body = await response.json() as {
      error?: { details?: Array<{ errorCode?: string }> };
    };
    return body.error?.details?.some((detail) => detail.errorCode === 'UNREGISTERED') ?? false;
  } catch {
    return false;
  }
}

interface FirebaseServiceAccount {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

export function createFirebaseAccessTokenProvider(
  credentials: FirebaseServiceAccount,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now
): () => Promise<string> {
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Firebase service account is missing required credentials');
  }

  let cached: { token: string; expiresAt: number } | undefined;

  return async () => {
    const nowSeconds = Math.floor(now() / 1000);
    if (cached && cached.expiresAt > nowSeconds + 60) return cached.token;

    const jwt = createSignedServiceJwt(credentials.client_email!, credentials.private_key!, nowSeconds);
    const response = await fetcher(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Google OAuth token request failed (${response.status})`);

    const body = await response.json() as { access_token?: string; expires_in?: number };
    if (!body.access_token || typeof body.expires_in !== 'number') {
      throw new Error('Google OAuth token response was invalid');
    }

    cached = { token: body.access_token, expiresAt: nowSeconds + body.expires_in };
    return cached.token;
  };
}

function createSignedServiceJwt(clientEmail: string, privateKey: string, nowSeconds: number): string {
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = [
    encode({ alg: 'RS256', typ: 'JWT' }),
    encode({
      iss: clientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  ].join('.');

  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey, 'base64url')}`;
}

export function createFirebasePushSenderFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch
): FirebasePushSender | null {
  const projectId = env.FCM_PROJECT_ID?.trim();
  const serviceAccountJson = env.FCM_SERVICE_ACCOUNT_JSON;
  if (!projectId || !serviceAccountJson) return null;

  let credentials: FirebaseServiceAccount;
  try {
    credentials = JSON.parse(serviceAccountJson) as FirebaseServiceAccount;
  } catch {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON');
  }

  const configuredProject = credentials.project_id;
  if (configuredProject && configuredProject !== projectId) {
    throw new Error('Firebase project ID does not match the configured service account');
  }

  return new FirebasePushSender({
    projectId,
    getAccessToken: createFirebaseAccessTokenProvider(credentials, fetcher),
    fetcher,
  });
}
