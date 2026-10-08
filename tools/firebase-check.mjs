import { config as loadEnv } from 'dotenv';

loadEnv();

function present(name) {
  const value = process.env[name];
  return Boolean(value && String(value).trim().length > 0);
}

const web = {
  FIREBASE_API_KEY: present('FIREBASE_API_KEY'),
  FIREBASE_AUTH_DOMAIN: present('FIREBASE_AUTH_DOMAIN'),
  FIREBASE_PROJECT_ID: present('FIREBASE_PROJECT_ID'),
  FIREBASE_APP_ID: present('FIREBASE_APP_ID'),
};

const admin = {
  FIREBASE_PROJECT_ID: present('FIREBASE_PROJECT_ID'),
  FIREBASE_CLIENT_EMAIL: present('FIREBASE_CLIENT_EMAIL'),
  FIREBASE_PRIVATE_KEY: present('FIREBASE_PRIVATE_KEY'),
  GOOGLE_APPLICATION_CREDENTIALS: present('GOOGLE_APPLICATION_CREDENTIALS'),
};

const webOk = Object.values(web).every(Boolean);
const adminCertOk =
  admin.FIREBASE_PROJECT_ID &&
  admin.FIREBASE_CLIENT_EMAIL &&
  admin.FIREBASE_PRIVATE_KEY;
const adminAdcOk =
  admin.FIREBASE_PROJECT_ID && admin.GOOGLE_APPLICATION_CREDENTIALS;
const adminOk = adminCertOk || adminAdcOk;

console.log('Firebase web (Angular):');
for (const [key, ok] of Object.entries(web)) {
  console.log(`  ${ok ? '✓' : '·'} ${key}`);
}

console.log('Firebase Admin (Nest):');
for (const [key, ok] of Object.entries(admin)) {
  console.log(`  ${ok ? '✓' : '·'} ${key}`);
}

if (webOk && adminOk) {
  console.log(
    'Status: web + Admin look configured. Nest will verify real ID tokens; Bearer dev: is disabled.',
  );
  process.exit(0);
}

if (!webOk && !adminOk) {
  console.log(
    'Status: not configured yet. Local API still accepts Bearer dev:<uid> outside production. See docs/firebase.md',
  );
  process.exit(0);
}

if (!webOk) {
  console.log(
    'Status: Admin looks set but web config is incomplete — fill FIREBASE_API_KEY / AUTH_DOMAIN / APP_ID for Angular.',
  );
}
if (!adminOk) {
  console.log(
    'Status: web looks set but Admin is incomplete — set CLIENT_EMAIL + PRIVATE_KEY (or GOOGLE_APPLICATION_CREDENTIALS).',
  );
}
process.exit(1);
