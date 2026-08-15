/**
 * Production Configuration Types for VEIL.
 */

import { NotificationPrivacyMode } from '../notifications/types.ts';

export type AppEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  env: AppEnvironment;
  relayHttpUrl: string;
  relayWsUrl: string;
  enforceTls: boolean;
  requestTimeoutMs: number;
  maxOutboundQueueSize: number;
  maxAttachmentSizeBytes: number;
  defaultNotificationMode: NotificationPrivacyMode;
  logLevel: 'none' | 'error' | 'info';
}
