import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

// Configuração padrão do Firebase.
// Substitua pelos dados do console do seu Firebase (Firebase Console -> Configurações do Projeto).
const firebaseConfig = {
  apiKey: "AIzaSyCAtmFEFoPl5tpTBtzLdBxc0blHXbuYvYQ",
  authDomain: "brainstorm-1d48f.firebaseapp.com",
  projectId: "brainstorm-1d48f",
  storageBucket: "brainstorm-1d48f.firebasestorage.app",
  messagingSenderId: "359925359881",
  appId: "1:359925359881:web:60f10eca0225f9770f1fd8"
};

/**
 * Verifica se a configuração do Firebase é válida ou se ainda está com os placeholders padrões.
 * @returns {boolean}
 */
export function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         !firebaseConfig.apiKey.includes('SEU_API_KEY') && 
         !firebaseConfig.projectId.includes('SEU_PROJECT_ID');
}

let app;
let db;
let auth;

// Se configurado, inicializa o Firebase SDK V9 Modular
if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('[Firebase] Inicializado com sucesso.');
  } catch (error) {
    console.error('[Firebase] Erro ao inicializar o SDK do Firebase:', error);
  }
} else {
  console.warn('[Firebase] Configurações pendentes. O aplicativo funcionará em Modo Local (IndexedDB).');
}

export { app, db, auth };
