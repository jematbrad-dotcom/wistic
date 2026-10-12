// Kopieer dit bestand naar firebase-config.js en vul je eigen waarden in.
// firebase-config.js staat in .gitignore: je echte gegevens horen niet in Git.
const firebaseConfig = {
  apiKey: "PLAK_JE_FIREBASE_API_KEY",              // Firebase > Project settings > Web app
  authDomain: "JE-PROJECT.firebaseapp.com",
  projectId: "JE-PROJECT-ID",
  storageBucket: "JE-PROJECT.firebasestorage.app",
  messagingSenderId: "JE-SENDER-ID",
  appId: "JE-APP-ID",
  measurementId: "JE-MEASUREMENT-ID",
  googleClientId: "JE-GOOGLE-OAUTH-CLIENT-ID",     // Google Cloud > Credentials > OAuth client ID (Desktop app)
  googleClientSecret: "JE-GOOGLE-OAUTH-CLIENT-SECRET"
};

module.exports = firebaseConfig;
module.exports.firebaseConfig = firebaseConfig;
