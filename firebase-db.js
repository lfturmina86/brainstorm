import { db, auth, isFirebaseConfigured } from './firebase-config.js';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { 
  saveLocalNote, 
  deleteLocalNote, 
  getLocalNotes, 
  syncLocalNotes,
  getLocalNotesByTag
} from './local-db.js';

// ==========================================
// Módulo do Firebase Authentication
// ==========================================

/**
 * Realiza o login do usuário com email e senha.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<UserCredential>}
 */
export function loginUser(email, password) {
  if (!isFirebaseConfigured()) {
    return Promise.reject(new Error('Firebase não configurado.'));
  }
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Cria uma nova conta de usuário com email e senha.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<UserCredential>}
 */
export function registerUser(email, password) {
  if (!isFirebaseConfigured()) {
    return Promise.reject(new Error('Firebase não configurado.'));
  }
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Desconecta o usuário atual.
 * @returns {Promise<void>}
 */
export function logoutUser() {
  if (!isFirebaseConfigured()) {
    return Promise.resolve();
  }
  return signOut(auth);
}

/**
 * Monitora o estado da autenticação do usuário.
 * @param {Function} callback - Função de callback executada a cada mudança de estado
 * @returns {Function} - Função para desinscrever o listener
 */
export function subscribeToAuth(callback) {
  if (!isFirebaseConfigured()) {
    // Retorna um desinscrever mock que não faz nada
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

// ==========================================
// Módulo do Cloud Firestore (CRUD com Cache)
// ==========================================

/**
 * Auxiliar para gerar ID único no modo offline/local
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'local_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Cria uma nova nota no Firestore e atualiza o Cache Local (IndexedDB).
 * @param {Object} noteData - Dados da nota contendo titulo, conteudo, tags (array)
 * @returns {Promise<Object>} A nota criada com o ID e data de criação
 */
export async function createNote(noteData) {
  const { titulo, conteudo, tags } = noteData;
  const data_criacao = Date.now();
  let id = '';

  const noteObject = {
    titulo: titulo || '',
    conteudo: conteudo || '',
    tags: Array.isArray(tags) ? tags : [],
    data_criacao: data_criacao
  };

  const isOnline = navigator.onLine;

  if (isFirebaseConfigured() && isOnline) {
    try {
      // Cria referência de documento para obter um ID único gerado pelo Firestore
      const newDocRef = doc(collection(db, 'notas'));
      id = newDocRef.id;
      
      // Salva no Firestore
      await setDoc(newDocRef, { ...noteObject, id });
      console.log('[Firebase DB] Nota criada no Firestore com ID:', id);
    } catch (error) {
      console.error('[Firebase DB] Erro ao salvar no Firestore, salvando apenas localmente:', error);
      id = generateUUID();
    }
  } else {
    id = generateUUID();
    console.log('[Firebase DB] Criando nota localmente (Sem Firebase ou Offline), ID:', id);
  }

  // Completa o objeto da nota com ID
  const savedNote = { id, ...noteObject };

  // Atualiza o cache local (IndexedDB)
  await saveLocalNote(savedNote);
  return savedNote;
}

/**
 * Lê todas as notas aplicando o cache.
 * Estratégia: Lê do cache local por padrão.
 * Se forceRefresh for verdadeiro e houver internet, busca do Firestore e atualiza o cache local.
 * @param {boolean} forceRefresh - Força a busca direta no Cloud Firestore
 * @returns {Promise<Array>} Lista de notas ordenadas por data de criação desc.
 */
export async function getNotes(forceRefresh = false) {
  const isOnline = navigator.onLine;

  // Se o Firebase não estiver configurado ou estiver offline, busca obrigatoriamente do IndexedDB
  if (!isFirebaseConfigured() || !isOnline) {
    console.log('[Firebase DB] Lendo do Cache Local (IndexedDB) - Sem rede ou sem Firebase.');
    return await getLocalNotes();
  }

  // Se forceRefresh for falso, tenta ler do IndexedDB primeiro
  if (!forceRefresh) {
    const cachedNotes = await getLocalNotes();
    if (cachedNotes && cachedNotes.length > 0) {
      console.log('[Firebase DB] Lendo do Cache Local (IndexedDB) - Economizando leitura de Firestore.');
      return cachedNotes;
    }
  }

  // Se forceRefresh for verdadeiro OU se o cache local estiver vazio (e estiver online), busca do Firestore
  try {
    console.log('[Firebase DB] Buscando notas do Cloud Firestore...');
    const q = query(collection(db, 'notas'), orderBy('data_criacao', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const notesList = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      notesList.push({
        id: doc.id,
        titulo: data.titulo,
        conteudo: data.conteudo,
        tags: data.tags || [],
        data_criacao: data.data_criacao
      });
    });

    // Sincroniza o IndexedDB com os novos dados buscados do Firestore
    await syncLocalNotes(notesList);
    console.log('[Firebase DB] Cache local sincronizado com o Firestore. Notas carregadas:', notesList.length);
    
    return notesList;
  } catch (error) {
    console.error('[Firebase DB] Erro ao buscar no Firestore, retornando cache local:', error);
    return await getLocalNotes();
  }
}

/**
 * Atualiza uma nota existente no Firestore e no Cache Local (IndexedDB).
 * @param {string} id - ID da nota
 * @param {Object} updatedFields - Campos a serem atualizados (titulo, conteudo, tags)
 * @returns {Promise<Object>} Nota atualizada
 */
export async function updateNote(id, updatedFields) {
  if (!id) throw new Error('ID da nota é obrigatório para atualização.');

  const isOnline = navigator.onLine;
  const cleanFields = {};
  
  if (updatedFields.titulo !== undefined) cleanFields.titulo = updatedFields.titulo;
  if (updatedFields.conteudo !== undefined) cleanFields.conteudo = updatedFields.conteudo;
  if (updatedFields.tags !== undefined) cleanFields.tags = Array.isArray(updatedFields.tags) ? updatedFields.tags : [];

  if (isFirebaseConfigured() && isOnline) {
    try {
      const noteRef = doc(db, 'notas', id);
      await updateDoc(noteRef, cleanFields);
      console.log('[Firebase DB] Nota atualizada no Firestore com ID:', id);
    } catch (error) {
      console.error('[Firebase DB] Erro ao atualizar no Firestore, atualizando apenas localmente:', error);
    }
  }

  // Atualiza no cache local
  // Primeiro, recupera a nota antiga para não perder outros campos (como data_criacao)
  const cachedNotes = await getLocalNotes();
  const existingNote = cachedNotes.find(note => note.id === id) || { id, data_criacao: Date.now() };
  
  const updatedNote = {
    ...existingNote,
    ...cleanFields
  };

  await saveLocalNote(updatedNote);
  return updatedNote;
}

/**
 * Deleta uma nota no Firestore e no Cache Local (IndexedDB).
 * @param {string} id - ID da nota a ser excluída
 * @returns {Promise<void>}
 */
export async function deleteNote(id) {
  if (!id) throw new Error('ID da nota é obrigatório para exclusão.');

  const isOnline = navigator.onLine;

  if (isFirebaseConfigured() && isOnline) {
    try {
      const noteRef = doc(db, 'notas', id);
      await deleteDoc(noteRef);
      console.log('[Firebase DB] Nota deletada do Firestore com ID:', id);
    } catch (error) {
      console.error('[Firebase DB] Erro ao deletar no Firestore, deletando apenas localmente:', error);
    }
  }

  // Deleta do cache local
  await deleteLocalNote(id);
}

/**
 * Busca notas que possuem uma tag específica.
 * Se estiver online e configurado, consulta o Firestore usando a cláusula 'where array-contains'.
 * Se estiver offline ou não configurado, consulta o IndexedDB usando o índice multiEntry 'tags'.
 * @param {string} tag - A tag a ser buscada
 * @returns {Promise<Array>}
 */
export async function getNotesByTag(tag) {
  if (!tag) return [];

  const isOnline = navigator.onLine;
  const cleanedTag = tag.trim().toLowerCase();

  if (isFirebaseConfigured() && isOnline) {
    try {
      console.log(`[Firebase DB] Buscando notas com a tag #${cleanedTag} no Firestore...`);
      const q = query(
        collection(db, 'notas'), 
        where('tags', 'array-contains', cleanedTag)
      );
      const querySnapshot = await getDocs(q);
      
      const notesList = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notesList.push({
          id: doc.id,
          titulo: data.titulo,
          conteudo: data.conteudo,
          tags: data.tags || [],
          data_criacao: data.data_criacao
        });
      });
      
      console.log(`[Firebase DB] Encontradas ${notesList.length} notas com a tag #${cleanedTag} no Firestore.`);
      return notesList;
    } catch (error) {
      console.error('[Firebase DB] Erro ao buscar por tag no Firestore, buscando localmente:', error);
    }
  }

  console.log(`[Firebase DB] Buscando notas com a tag #${cleanedTag} no cache local (IndexedDB)...`);
  return await getLocalNotesByTag(cleanedTag);
}
