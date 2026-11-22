import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

interface AppletFirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

function readEnv(key: string): string {
  const val = import.meta.env[key];
  return typeof val === 'string' ? val.trim() : '';
}

function resolveFirebaseConfig(): {
  options: FirebaseOptions;
  databaseId?: string;
} {
  const envApiKey = readEnv('VITE_FIREBASE_API_KEY');
  const envAuthDomain = readEnv('VITE_FIREBASE_AUTH_DOMAIN');
  const envProjectId = readEnv('VITE_FIREBASE_PROJECT_ID');
  const envStorageBucket = readEnv('VITE_FIREBASE_STORAGE_BUCKET');
  const envMessagingSenderId = readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID');
  const envAppId = readEnv('VITE_FIREBASE_APP_ID');

  const hasEnvConfig = Boolean(
    envApiKey && envAuthDomain && envProjectId && envAppId
  );

  if (hasEnvConfig) {
    return {
      options: {
        apiKey: envApiKey,
        authDomain: envAuthDomain,
        projectId: envProjectId,
        storageBucket: envStorageBucket || undefined,
        messagingSenderId: envMessagingSenderId || undefined,
        appId: envAppId,
      },
      databaseId: undefined,
    };
  }

  const fallback = appletConfig as AppletFirebaseConfig;
  return {
    options: {
      apiKey: fallback.apiKey,
      authDomain: fallback.authDomain,
      projectId: fallback.projectId,
      storageBucket: fallback.storageBucket,
      messagingSenderId: fallback.messagingSenderId,
      appId: fallback.appId,
    },
    databaseId: fallback.firestoreDatabaseId || undefined,
  };
}

const { options, databaseId } = resolveFirebaseConfig();

const app = getApps().length > 0 ? getApp() : initializeApp(options);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      databaseId
    );
  } catch {
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db = createFirestoreInstance();

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Periksa konfigurasi Firebase Anda: klien dalam mode offline.');
    }
  }
}
