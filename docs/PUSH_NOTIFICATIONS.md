# Android background notifications setup

The code path is implemented, but it remains inactive until the app and relay are connected to a Firebase project.

## Firebase project setup

1. Create or select a Firebase project and add an Android app with application ID `chat.veil.app`.
2. Enable Firebase Cloud Messaging for that project.
3. Download the app's `google-services.json` and place it at `android/app/google-services.json`. Do not place a service-account key in the Android project.
4. In Firebase / Google Cloud IAM, create a service account with the Firebase Cloud Messaging API Admin role and securely provide its JSON key to the relay environment as `FCM_SERVICE_ACCOUNT_JSON`. Set `FCM_PROJECT_ID` to the same project ID.
5. Rebuild and install the Android app. In VEIL, open **Settings → Notifications → Enable Background Alerts**. The consent text explains that Google sees the push token and delivery timing; the notification payload stays generic.

The FCM HTTP v1 API requires an authorized service-account OAuth token and a project-scoped message send request. Firebase's official setup guides are [Android FCM setup](https://firebase.google.com/docs/cloud-messaging/android/get-started) and [FCM HTTP v1 authorization](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

## Relay environment

Set these only on the relay server (for example, as Render environment variables):

```text
FCM_PROJECT_ID=your-firebase-project-id
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Do not commit service-account credentials or paste them into source files. If either variable is missing, the relay disables background push and returns an explicit service-unavailable response to registration attempts. Existing message delivery continues.

## Behavior

- Only Android is supported by this implementation.
- Push is a generic alert/wake signal for user-visible text, media, and voice messages. The encrypted sender request includes a one-bit notification hint, so the relay can avoid pushing for read receipts and control envelopes. The client syncs the encrypted mailbox when reopened; the relay and Google never receive message plaintext in a push payload.
- The relay can observe which envelope sends were marked for notification. This leaks message-vs-control timing, but no identity or content. The opt-in Settings copy discloses Google token/timing access and this relay hint.
- The same FCM installation token is associated with only one mailbox at a time, so alerts follow one Space per device.
- `SILENT_COUNTER` turns off push registration.
- Removing VEIL from Recents should still allow FCM alerts. Android **Force stop** prevents delivery until the app is opened again.

See [the push threat model](ai/THREAT_MODEL_PUSH.md) for the metadata trade-offs and release gates.
