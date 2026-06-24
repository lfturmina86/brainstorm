const DB_NAME = 'BrainStoreDB';
const DB_VERSION = 2; // Incrementado para v2 para atualizar índices
const STORE_NAME = 'notas';

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function initLocalDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      let store;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      } else {
        // Obtém a loja existente durante a atualização de versão
        store = request.transaction.objectStore(STORE_NAME);
      }
      
      // Cria índice por data se não existir
      if (!store.indexNames.contains('data_criacao')) {
        store.createIndex('data_criacao', 'data_criacao', { unique: false });
      }
      
      // Cria índice multiEntry para as tags (cria um índice para cada elemento do array)
      if (!store.indexNames.contains('tags')) {
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        console.log('[IndexedDB] Índice multiEntry para tags criado com sucesso.');
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB initialization failed:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves all notes from the local IndexedDB.
 * @returns {Promise<Array>}
 */
export function getLocalNotes() {
  return initLocalDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(transaction.objectStoreNames[0] || STORE_NAME);
      const index = store.index('data_criacao');
      
      // We want to fetch all notes, and sort them descending by creation date.
      // A cursor going prev (reverse) does this.
      const notes = [];
      const request = index.openCursor(null, 'prev');

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          notes.push(cursor.value);
          cursor.continue();
        } else {
          resolve(notes);
        }
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
}

/**
 * Saves or updates a note in the local IndexedDB.
 * @param {Object} note - The note object to save
 * @returns {Promise<void>}
 */
export function saveLocalNote(note) {
  // Ensure required fields are present
  if (!note.id || !note.titulo || note.conteudo === undefined) {
    return Promise.reject(new Error('Invalid note data for local save.'));
  }

  return initLocalDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Store dates as numbers (timestamp milliseconds) or preserve structure
      const noteToSave = {
        id: note.id,
        titulo: note.titulo,
        conteudo: note.conteudo,
        tags: Array.isArray(note.tags) ? note.tags : [],
        data_criacao: typeof note.data_criacao === 'number' 
          ? note.data_criacao 
          : new Date(note.data_criacao).getTime() || Date.now()
      };

      const request = store.put(noteToSave);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
}

/**
 * Deletes a note from the local IndexedDB.
 * @param {string} id - The ID of the note to delete
 * @returns {Promise<void>}
 */
export function deleteLocalNote(id) {
  if (!id) return Promise.reject(new Error('No ID provided for deletion.'));

  return initLocalDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
}

/**
 * Syncs the local database by clearing it and populating with the provided list.
 * @param {Array} notesList - The array of fresh notes from Firestore
 * @returns {Promise<void>}
 */
export function syncLocalNotes(notesList) {
  return initLocalDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Clear the store
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        if (notesList.length === 0) {
          resolve();
          return;
        }

        // Add all notes in the same transaction
        let completed = 0;
        let hasError = false;

        notesList.forEach((note) => {
          const noteToSave = {
            id: note.id,
            titulo: note.titulo,
            conteudo: note.conteudo,
            tags: Array.isArray(note.tags) ? note.tags : [],
            data_criacao: typeof note.data_criacao === 'number' 
              ? note.data_criacao 
              : new Date(note.data_criacao).getTime() || Date.now()
          };

          const addRequest = store.put(noteToSave);

          addRequest.onsuccess = () => {
            completed++;
            if (completed === notesList.length && !hasError) {
              resolve();
            }
          };

          addRequest.onerror = (event) => {
            if (!hasError) {
              hasError = true;
              reject(event.target.error);
            }
          };
        });
      };

      clearRequest.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
}

/**
 * Busca todas as notas locais que possuem uma tag específica utilizando o índice multiEntry.
 * @param {string} tag - A tag a ser pesquisada
 * @returns {Promise<Array>}
 */
export function getLocalNotesByTag(tag) {
  if (!tag) return Promise.resolve([]);

  return initLocalDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('tags');
      const request = index.getAll(tag.toLowerCase().trim());

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  });
}
