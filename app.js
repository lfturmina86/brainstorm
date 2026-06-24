import { isFirebaseConfigured } from './firebase-config.js';
import { 
  createNote, 
  getNotes, 
  updateNote, 
  deleteNote, 
  loginUser, 
  registerUser, 
  logoutUser, 
  subscribeToAuth 
} from './firebase-db.js';

// ==========================================
// Estado Global da Aplicação
// ==========================================
let state = {
  notes: [],
  selectedNoteId: null,
  activeFilterTag: 'all',
  searchQuery: '',
  currentUser: null,
  isRegisterMode: false,
  activeTab: 'editor' // 'editor' ou 'map'
};

// Instância global da simulação de física do D3 (para pausar/limpar se necessário)
let mapSimulation = null;

// ==========================================
// Seletores de Elementos DOM
// ==========================================
const elements = {
  // Badges e Alertas
  networkStatus: document.getElementById('network-status'),
  firebaseStatus: document.getElementById('firebase-status'),
  authStatus: document.getElementById('auth-status'),
  firebaseWarningBanner: document.getElementById('firebase-warning-banner'),
  btnCloseBanner: document.getElementById('btn-close-banner'),
  
  // Painel Esquerdo (Sidebar)
  searchInput: document.getElementById('search-input'),
  tagList: document.getElementById('tag-list'),
  notesList: document.getElementById('notes-list'),
  btnNewNote: document.getElementById('btn-new-note'),
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  sidebar: document.getElementById('sidebar'),
  
  // Abas de Navegação
  tabEditor: document.getElementById('tab-editor'),
  tabMap: document.getElementById('tab-map'),
  editorTabContent: document.getElementById('editor-tab-content'),
  mapTabContent: document.getElementById('map-tab-content'),
  
  // Painel de Conteúdo (Editor)
  emptyState: document.getElementById('empty-state'),
  btnEmptyNewNote: document.getElementById('btn-empty-new-note'),
  btnForceRefresh: document.getElementById('btn-force-refresh'),
  editorContainer: document.getElementById('editor-container'),
  
  // Editor
  noteCreatedDate: document.getElementById('note-created-date'),
  btnSaveNote: document.getElementById('btn-save-note'),
  btnDeleteNote: document.getElementById('btn-delete-note'),
  noteTitle: document.getElementById('note-title'),
  noteContent: document.getElementById('note-content'),
  
  // Campo de Tags Interativas
  interactiveTagsList: document.getElementById('interactive-tags-list'),
  noteTagsInput: document.getElementById('note-tags-input'),
  
  // Conexões (Notas Relacionadas)
  connectionsPanel: document.getElementById('connections-panel'),
  connectionsList: document.getElementById('connections-list'),
  
  // Mapa de Ideias D3
  ideaMapSvg: document.getElementById('idea-map'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomReset: document.getElementById('btn-zoom-reset'),
  btnMapRefresh: document.getElementById('btn-map-refresh'),
  
  // Modal de Autenticação
  authModal: document.getElementById('auth-modal'),
  authModalTitle: document.getElementById('auth-modal-title'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  btnAuthAction: document.getElementById('btn-auth-action'),
  btnAuthToggle: document.getElementById('btn-auth-toggle'),
  btnAuthLogout: document.getElementById('btn-auth-logout'),
  btnAuthClose: document.getElementById('btn-auth-close'),

  // Modal de Confirmação Customizado
  confirmModal: document.getElementById('confirm-modal'),
  btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
  btnConfirmOk: document.getElementById('btn-confirm-ok')
};

// ==========================================
// Inicialização do Aplicativo
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Registra Service Worker para PWA
  registerServiceWorker();

  // Configura Listeners de Rede (Online/Offline)
  setupNetworkMonitoring();

  // Configura Estado Inicial do Firebase
  setupFirebaseUI();

  // Configura Escutas de Eventos (Event Listeners)
  setupEventListeners();

  // Monitora Autenticação
  setupAuthMonitoring();

  // Carrega Notas Iniciais
  fetchAndRenderNotes();
});

// ==========================================
// Registro do PWA Service Worker
// ==========================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado com sucesso:', reg.scope);
        })
        .catch((err) => {
          console.error('[PWA] Falha ao registrar o Service Worker:', err);
        });
    });
  }
}

// ==========================================
// Monitoramento de Conexão e Firebase Status
// ==========================================
function setupNetworkMonitoring() {
  const updateOnlineStatus = () => {
    const isOnline = navigator.onLine;
    if (isOnline) {
      elements.networkStatus.className = 'badge badge-online';
      elements.networkStatus.innerHTML = '<span class="dot"></span> Online';
      if (isFirebaseConfigured()) {
        elements.btnForceRefresh.style.display = 'inline-flex';
      }
    } else {
      elements.networkStatus.className = 'badge badge-offline';
      elements.networkStatus.innerHTML = '<span class="dot"></span> Offline';
      elements.btnForceRefresh.style.display = 'none';
    }
    // Recarrega as notas do Firestore se voltar online
    if (isOnline && isFirebaseConfigured()) {
      fetchAndRenderNotes(true);
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus(); // Chamada inicial
}

function setupFirebaseUI() {
  if (isFirebaseConfigured()) {
    elements.firebaseStatus.className = 'badge badge-firebase';
    elements.firebaseStatus.innerHTML = '<span class="dot"></span> Firebase Conectado';
    elements.firebaseWarningBanner.style.display = 'none';
    elements.authStatus.style.display = 'inline-flex';
  } else {
    elements.firebaseStatus.className = 'badge badge-local';
    elements.firebaseStatus.innerHTML = '<span class="dot"></span> Modo Local';
    elements.firebaseWarningBanner.style.display = 'flex';
    elements.authStatus.style.display = 'none';
  }
}

function setupAuthMonitoring() {
  subscribeToAuth((user) => {
    state.currentUser = user;
    if (user) {
      elements.authStatus.className = 'badge badge-online';
      elements.authStatus.innerHTML = `<i data-lucide="user-check" style="width:10px;height:10px;"></i> ${user.email.split('@')[0]}`;
      elements.authModalTitle.textContent = 'Sua Conta Firebase';
      elements.btnAuthAction.style.display = 'none';
      elements.btnAuthToggle.style.display = 'none';
      elements.btnAuthLogout.style.display = 'block';
      elements.authEmail.value = user.email;
      elements.authEmail.disabled = true;
      elements.authPassword.style.display = 'none';
      elements.authPassword.previousElementSibling.style.display = 'none'; // label
    } else {
      elements.authStatus.className = 'badge badge-local';
      elements.authStatus.innerHTML = '<i data-lucide="user" style="width:10px;height:10px;"></i> Conectar';
      elements.authModalTitle.textContent = 'Conectar ao Firebase';
      elements.btnAuthAction.style.display = 'block';
      elements.btnAuthToggle.style.display = 'block';
      elements.btnAuthLogout.style.display = 'none';
      elements.authEmail.value = '';
      elements.authEmail.disabled = false;
      elements.authPassword.style.display = 'block';
      elements.authPassword.previousElementSibling.style.display = 'block'; // label
      state.isRegisterMode = false;
      updateAuthModalFields();
    }
    lucide.createIcons();
    // Atualiza notas baseando-se no novo estado do usuário
    fetchAndRenderNotes();
  });
}

// ==========================================
// Manipulação e Renderização de Notas
// ==========================================
async function fetchAndRenderNotes(forceRefresh = false) {
  try {
    state.notes = await getNotes(forceRefresh);
    renderNotes();
    renderTags();
    
    // Se a nota selecionada não existe mais na lista, limpa o editor
    if (state.selectedNoteId && !state.notes.some(n => n.id === state.selectedNoteId)) {
      closeEditor();
    } else if (state.selectedNoteId) {
      // Re-seleciona a nota para atualizar visualizações ou conexões
      const currentNote = state.notes.find(n => n.id === state.selectedNoteId);
      renderRelatedNotes(currentNote);
    }

    // Se a aba de mapa de ideias estiver ativa, atualiza o gráfico
    if (state.activeTab === 'map') {
      renderIdeaMap();
    }
  } catch (error) {
    console.error('Erro ao buscar notas:', error);
  }
}

function renderNotes() {
  elements.notesList.innerHTML = '';
  
  // Filtra as notas por busca e tag ativa
  const filteredNotes = state.notes.filter(note => {
    const titleMatch = note.titulo.toLowerCase().includes(state.searchQuery.toLowerCase());
    const contentMatch = note.conteudo.toLowerCase().includes(state.searchQuery.toLowerCase());
    const tagQueryMatch = note.tags.some(t => t.toLowerCase().includes(state.searchQuery.toLowerCase()));
    const textMatch = titleMatch || contentMatch || tagQueryMatch;
    
    const tagMatch = state.activeFilterTag === 'all' || note.tags.includes(state.activeFilterTag);
    
    return textMatch && tagMatch;
  });

  if (filteredNotes.length === 0) {
    elements.notesList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.85rem;">
        Nenhuma nota encontrada.
      </div>
    `;
    return;
  }

  filteredNotes.forEach(note => {
    const noteEl = document.createElement('div');
    noteEl.className = `note-item ${note.id === state.selectedNoteId ? 'active' : ''}`;
    noteEl.dataset.id = note.id;
    
    const dateFormatted = new Date(note.data_criacao).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short'
    });

    const tagsHtml = note.tags.slice(0, 3).map(tag => `
      <span class="note-item-tag">#${tag}</span>
    `).join('');

    const previewText = note.conteudo ? note.conteudo : 'Sem conteúdo adicional.';

    noteEl.innerHTML = `
      <div class="note-item-title">${note.titulo || 'Sem Título'}</div>
      <div class="note-item-preview">${previewText}</div>
      <div class="note-item-footer">
        <span>${dateFormatted}</span>
        <div class="note-item-tags">
          ${tagsHtml}
        </div>
      </div>
    `;

    noteEl.addEventListener('click', () => {
      selectNote(note.id);
    });

    elements.notesList.appendChild(noteEl);
  });
}

function renderTags() {
  // Extrai todas as tags únicas
  const allTags = new Set();
  state.notes.forEach(note => {
    if (Array.isArray(note.tags)) {
      note.tags.forEach(tag => {
        if (tag.trim()) allTags.add(tag.trim().toLowerCase());
      });
    }
  });

  // Preserva o botão "Todas"
  elements.tagList.innerHTML = `
    <span class="tag-chip ${state.activeFilterTag === 'all' ? 'active' : ''}" data-tag="all">Todas</span>
  `;

  // Adiciona chips dinamicamente
  Array.from(allTags).sort().forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = `tag-chip ${state.activeFilterTag === tag ? 'active' : ''}`;
    tagEl.dataset.tag = tag;
    tagEl.textContent = `#${tag}`;
    elements.tagList.appendChild(tagEl);
  });

  // Configura cliques nas tags
  elements.tagList.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      elements.tagList.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeFilterTag = chip.dataset.tag;
      renderNotes();
    });
  });
}

function selectNote(noteId) {
  state.selectedNoteId = noteId;
  const note = state.notes.find(n => n.id === noteId);
  
  if (!note) return;

  // Atualiza active class na barra lateral
  elements.notesList.querySelectorAll('.note-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === noteId);
  });

  // Carrega título e conteúdo no editor
  elements.noteTitle.value = note.titulo;
  elements.noteContent.value = note.conteudo;
  elements.noteTagsInput.value = '';
  
  // Renderiza Chips das tags interativas
  renderInteractiveTags(note.tags);
  
  const createdDate = new Date(note.data_criacao).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  elements.noteCreatedDate.textContent = `Criada em: ${createdDate}`;

  // Renderiza notas relacionadas (interconectadas)
  renderRelatedNotes(note);

  // Exibe editor e esconde tela de boas-vindas
  elements.emptyState.style.display = 'none';
  elements.editorContainer.style.display = 'flex';
  
  // Fecha sidebar no mobile se selecionou nota
  if (window.innerWidth <= 768) {
    elements.sidebar.classList.remove('active');
  }
}

// Renderiza os chips de tags interativas no campo de edição
function renderInteractiveTags(tags) {
  elements.interactiveTagsList.innerHTML = '';
  
  if (!Array.isArray(tags)) return;

  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'interactive-tag-chip';
    chip.innerHTML = `
      #${tag}
      <span class="remove-tag" data-tag="${tag}">&times;</span>
    `;

    chip.querySelector('.remove-tag').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTagFromActiveNote(tag);
    });

    elements.interactiveTagsList.appendChild(chip);
  });
}

function removeTagFromActiveNote(tagToRemove) {
  if (!state.selectedNoteId) return;
  const note = state.notes.find(n => n.id === state.selectedNoteId);
  if (!note) return;

  note.tags = note.tags.filter(tag => tag !== tagToRemove);
  renderInteractiveTags(note.tags);
  renderRelatedNotes(note);
  
  // Auto-salva a alteração
  handleSaveNote();
}

function addTagToActiveNote(tagToAdd) {
  if (!state.selectedNoteId) return;
  const note = state.notes.find(n => n.id === state.selectedNoteId);
  if (!note) return;

  // Sanitiza a tag para remover caracteres especiais, exceto traço e sublinhado
  const cleanedTag = tagToAdd.trim().toLowerCase().replace(/[^a-zA-Z0-9á-úÁ-ÚíÍóÓúÚçÇñÑ_-]/g, '');
  if (!cleanedTag) return;

  if (!note.tags.includes(cleanedTag)) {
    note.tags.push(cleanedTag);
    renderInteractiveTags(note.tags);
    renderRelatedNotes(note);
    
    // Auto-salva a alteração
    handleSaveNote();
  }
}

function renderRelatedNotes(note) {
  elements.connectionsList.innerHTML = '';
  
  if (!note.tags || note.tags.length === 0) {
    elements.connectionsPanel.style.display = 'none';
    return;
  }

  // Acha outras notas que compartilham pelo menos uma tag (case insensitive)
  const currentTags = note.tags.map(t => t.toLowerCase().trim());
  
  const related = state.notes.filter(otherNote => {
    if (otherNote.id === note.id) return false;
    return otherNote.tags.some(otherTag => 
      currentTags.includes(otherTag.toLowerCase().trim())
    );
  });

  if (related.length === 0) {
    elements.connectionsPanel.style.display = 'none';
    return;
  }

  elements.connectionsPanel.style.display = 'flex';
  
  related.forEach(relNote => {
    // Acha quais tags coincidem
    const overlappingTags = relNote.tags.filter(t => 
      currentTags.includes(t.toLowerCase().trim())
    );

    const card = document.createElement('div');
    card.className = 'connection-card';
    card.innerHTML = `
      <div class="connection-card-title">${relNote.titulo || 'Sem Título'}</div>
      <div class="connection-card-tags">
        ${overlappingTags.map(t => `#${t}`).join(' ')}
      </div>
    `;

    card.addEventListener('click', () => {
      selectNote(relNote.id);
    });

    elements.connectionsList.appendChild(card);
  });
}

function closeEditor() {
  state.selectedNoteId = null;
  elements.editorContainer.style.display = 'none';
  elements.emptyState.style.display = 'flex';
  renderNotes();
}

// ==========================================
// Alternar Abas (Editor / Mapa)
// ==========================================
function switchTab(tabName) {
  if (state.activeTab === tabName) return;

  state.activeTab = tabName;

  // Atualiza classes ativas dos botões das abas
  elements.tabEditor.classList.toggle('active', tabName === 'editor');
  elements.tabMap.classList.toggle('active', tabName === 'map');

  // Atualiza exibição dos contêineres de conteúdo
  if (tabName === 'editor') {
    elements.editorTabContent.style.display = 'flex';
    elements.mapTabContent.style.display = 'none';
    // Para a simulação física do mapa para economizar CPU
    if (mapSimulation) {
      mapSimulation.stop();
    }
  } else {
    elements.editorTabContent.style.display = 'none';
    elements.mapTabContent.style.display = 'flex';
    // Renderiza e inicializa física do mapa de ideias
    setTimeout(() => {
      renderIdeaMap();
    }, 50); // Timeout rápido para garantir que o contêiner D3 tenha dimensões calculadas
  }
}

// ==========================================
// Mapa de Ideias Interativo com D3.js
// ==========================================
function renderIdeaMap() {
  const container = elements.mapTabContent;
  const svgEl = elements.ideaMapSvg;
  const svg = d3.select(svgEl);
  
  // Limpa elementos anteriores do SVG
  svg.selectAll('*').remove();

  if (state.notes.length === 0) {
    svg.append('text')
      .attr('x', '50%')
      .attr('y', '50%')
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .style('font-size', '0.9rem')
      .text('Crie algumas notas para visualizar o seu mapa mental.');
    return;
  }

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  // 1. Preparar Nós (Notas)
  const nodes = state.notes.map(note => ({
    id: note.id,
    title: note.titulo || 'Sem Título',
    tags: note.tags || []
  }));

  // 2. Preparar Arestas (Links de tags compartilhadas)
  const links = [];
  for (let i = 0; i < state.notes.length; i++) {
    for (let j = i + 1; j < state.notes.length; j++) {
      const noteA = state.notes[i];
      const noteB = state.notes[j];
      
      // Encontra tags comuns
      const commonTags = noteA.tags.filter(t => noteB.tags.includes(t));
      if (commonTags.length > 0) {
        links.push({
          source: noteA.id,
          target: noteB.id,
          tags: commonTags
        });
      }
    }
  }

  // 3. Montar a Simulação Física
  // Otimização de Resfriamento Rápido: Usamos alphaDecay(0.045) para parar os cálculos em ~3s (aproximadamente 60-80 ticks)
  mapSimulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(40))
    .alphaDecay(0.045); 

  mapSimulation.on('end', () => {
    console.log('[D3 Map] Simulação física estabilizada e suspensa automaticamente para economizar processamento.');
  });

  // 4. Configurar Zoom e Pan
  const zoomContainer = svg.append('g').attr('class', 'zoom-container');

  const zoomBehavior = d3.zoom()
    .scaleExtent([0.15, 3.5])
    .on('zoom', (event) => {
      zoomContainer.attr('transform', event.transform);
    });

  svg.call(zoomBehavior);

  // Botões de Controle de Zoom Flutuantes
  d3.select(elements.btnZoomIn).on('click', () => {
    svg.transition().duration(250).call(zoomBehavior.scaleBy, 1.3);
  });

  d3.select(elements.btnZoomOut).on('click', () => {
    svg.transition().duration(250).call(zoomBehavior.scaleBy, 0.7);
  });

  d3.select(elements.btnZoomReset).on('click', () => {
    svg.transition().duration(350).call(
      zoomBehavior.transform, 
      d3.zoomIdentity.translate(0, 0).scale(1)
    );
  });

  d3.select(elements.btnMapRefresh).on('click', () => {
    console.log('[D3 Map] Forçando reinicialização da física do mapa.');
    mapSimulation.alpha(1).restart();
  });

  // 5. Plota as Linhas (Arestas/Links)
  const link = zoomContainer.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', d => {
      const sourceId = d.source.id || d.source;
      const targetId = d.target.id || d.target;
      const isHighlighted = (sourceId === state.selectedNoteId || targetId === state.selectedNoteId);
      return isHighlighted ? 'map-link highlighted' : 'map-link';
    });

  // 6. Plota os Grupos de Nós (Círculos e Títulos)
  const node = zoomContainer.append('g')
    .selectAll('.map-node')
    .data(nodes)
    .join('g')
    .attr('class', d => d.id === state.selectedNoteId ? 'map-node active' : 'map-node')
    .call(drag(mapSimulation));

  // Desenha os círculos dos nós
  node.append('circle')
    .attr('r', d => d.id === state.selectedNoteId ? 10 : 7);

  // Adiciona o texto com o título das notas
  node.append('text')
    .attr('dy', 20)
    .text(d => d.title.length > 20 ? d.title.substring(0, 17) + '...' : d.title);

  // Ouvinte de clique nos nós para abrir a nota correspondente no editor
  node.on('click', (event, d) => {
    // Se o usuário estava arrastando, ignora o clique
    if (event.defaultPrevented) return;
    
    selectNote(d.id);
    switchTab('editor');
  });

  // 7. Atualização do Posicionamento na Física (Tick)
  mapSimulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
  });

  // Inicializa o zoom encaixando todos os nós na tela se houver nós
  if (nodes.length > 0) {
    // Dá um tempo inicial pequeno para centralização mais estável
    setTimeout(() => {
      if (!mapSimulation) return;
      const bounds = zoomContainer.node().getBBox();
      if (bounds.width === 0 || bounds.height === 0) return;
      
      const dx = bounds.width;
      const dy = bounds.height;
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height / 2;
      
      const scale = 0.85 / Math.max(dx / width, dy / height);
      const limitScale = Math.min(Math.max(scale, 0.4), 1.2); // limites confortáveis
      
      const translate = [width / 2 - limitScale * x, height / 2 - limitScale * y];
      
      svg.transition().duration(400).call(
        zoomBehavior.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(limitScale)
      );
    }, 250);
  }
}

// Lógica de Arrasto de Nós (Drag) com D3
function drag(simulation) {
  function dragstarted(event, d) {
    // Reativa a física temporariamente ao iniciar o arraste para animar o movimento
    if (!event.active) simulation.alphaTarget(0.15).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    // Esfria novamente a física ao soltar o nó
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

// ==========================================
// Operações do CRUD
// ==========================================
async function handleNewNote() {
  const noteData = {
    titulo: 'Nova Anotação',
    conteudo: '',
    tags: []
  };

  try {
    const newNote = await createNote(noteData);
    // Adiciona ao estado local imediatamente
    state.notes.unshift(newNote);
    renderNotes();
    renderTags();
    selectNote(newNote.id);
  } catch (error) {
    console.error('Erro ao criar nota:', error);
  }
}

async function handleSaveNote() {
  if (!state.selectedNoteId) return;

  const id = state.selectedNoteId;
  const titulo = elements.noteTitle.value.trim() || 'Sem Título';
  const conteudo = elements.noteContent.value;
  
  // As tags já estão integradas no objeto de estado local. 
  // Apenas recuperamos a lista de tags salva no estado da nota correspondente.
  const note = state.notes.find(n => n.id === id);
  const tags = note ? note.tags : [];

  const updatedFields = { titulo, conteudo, tags };

  try {
    const updatedNote = await updateNote(id, updatedFields);
    
    // Atualiza estado local
    const index = state.notes.findIndex(n => n.id === id);
    if (index !== -1) {
      state.notes[index] = updatedNote;
    }
    
    renderNotes();
    renderTags();
    renderRelatedNotes(updatedNote);
    
    // Feedback visual do botão
    const originalText = elements.btnSaveNote.innerHTML;
    elements.btnSaveNote.innerHTML = '<i data-lucide="check"></i> Salvo!';
    lucide.createIcons();
    setTimeout(() => {
      elements.btnSaveNote.innerHTML = originalText;
      lucide.createIcons();
    }, 1500);
    
  } catch (error) {
    console.error('Erro ao salvar nota:', error);
  }
}

async function handleDeleteNote() {
  console.log('[App] handleDeleteNote acionado. Nota ID selecionada:', state.selectedNoteId);
  if (!state.selectedNoteId) {
    console.warn('[App] Nenhuma nota selecionada para exclusão.');
    return;
  }

  // Em vez de usar confirm() nativo, que é bloqueado em vários navegadores ao repetir ações,
  // abrimos o modal de confirmação customizado da UI.
  elements.confirmModal.classList.add('active');
}

async function executeDeleteNote() {
  const id = state.selectedNoteId;
  if (!id) return;

  // Fecha o modal de confirmação
  elements.confirmModal.classList.remove('active');
  console.log('[App] Executando exclusão no modal de confirmação para o ID:', id);

  try {
    console.log('[App] Chamando deleteNote no banco de dados para o ID:', id);
    await deleteNote(id);
    console.log('[App] Nota deletada do banco de dados com sucesso.');
    
    // Remove do estado local
    state.notes = state.notes.filter(n => n.id !== id);
    closeEditor();
    renderTags();
    console.log('[App] Estado da UI atualizado após exclusão.');
  } catch (error) {
    console.error('[App] Erro ao deletar nota:', error);
    alert('Erro ao excluir nota: ' + error.message);
  }
}

// ==========================================
// Configuração de Eventos UI
// ==========================================
function setupEventListeners() {
  // Configuração das Abas
  elements.tabEditor.addEventListener('click', () => switchTab('editor'));
  elements.tabMap.addEventListener('click', () => switchTab('map'));

  // Criar Notas
  elements.btnNewNote.addEventListener('click', handleNewNote);
  elements.btnEmptyNewNote.addEventListener('click', handleNewNote);
  
  // Salvar / Excluir
  elements.btnSaveNote.addEventListener('click', handleSaveNote);
  elements.btnDeleteNote.addEventListener('click', handleDeleteNote);

  // Confirmação de exclusão do modal customizado
  elements.btnConfirmCancel.addEventListener('click', () => {
    elements.confirmModal.classList.remove('active');
  });
  elements.btnConfirmOk.addEventListener('click', executeDeleteNote);
  
  // Auto-salvar no blur dos campos para dar sensação de PWA moderno
  elements.noteTitle.addEventListener('blur', handleSaveNote);
  elements.noteContent.addEventListener('blur', handleSaveNote);

  // Escuta de Teclado no Campo Interativo de Tags
  elements.noteTagsInput.addEventListener('keydown', (e) => {
    // Adiciona ao pressionar Enter ou Vírgula
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); // Impede o envio de form ou digitação da vírgula
      const tagText = elements.noteTagsInput.value.trim();
      if (tagText) {
        addTagToActiveNote(tagText);
        elements.noteTagsInput.value = '';
      }
    }
  });

  // Também adiciona tag se o campo perder o foco (blur) com algum texto
  elements.noteTagsInput.addEventListener('blur', () => {
    const tagText = elements.noteTagsInput.value.trim();
    if (tagText) {
      addTagToActiveNote(tagText);
      elements.noteTagsInput.value = '';
    }
  });

  // Busca e Filtros
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderNotes();
  });
  
  elements.btnForceRefresh.addEventListener('click', () => {
    fetchAndRenderNotes(true);
  });

  // Fechar banner de aviso do Firebase
  elements.btnCloseBanner.addEventListener('click', () => {
    elements.firebaseWarningBanner.style.display = 'none';
  });

  // Toggle Sidebar no Mobile
  elements.btnToggleSidebar.addEventListener('click', () => {
    elements.sidebar.classList.toggle('active');
  });

  // Fechar sidebar clicando fora dela em telas pequenas
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (!elements.sidebar.contains(e.target) && !elements.btnToggleSidebar.contains(e.target)) {
        elements.sidebar.classList.remove('active');
      }
    }
  });

  // Gerenciamento do Modal de Login
  elements.authStatus.addEventListener('click', () => {
    elements.authModal.classList.add('active');
  });

  elements.btnAuthClose.addEventListener('click', () => {
    elements.authModal.classList.remove('active');
  });

  // Fecha modal ao clicar fora do conteúdo
  elements.authModal.addEventListener('click', (e) => {
    if (e.target === elements.authModal) {
      elements.authModal.classList.remove('active');
    }
  });

  // Toggle Login/Registro no modal
  elements.btnAuthToggle.addEventListener('click', () => {
    state.isRegisterMode = !state.isRegisterMode;
    updateAuthModalFields();
  });

  // Executar Ação de Auth (Login ou Registro)
  elements.btnAuthAction.addEventListener('click', handleAuthAction);
  
  // Desconectar Conta
  elements.btnAuthLogout.addEventListener('click', async () => {
    try {
      await logoutUser();
      elements.authModal.classList.remove('active');
    } catch (err) {
      alert('Erro ao desconectar: ' + err.message);
    }
  });
}

// ==========================================
// Lógica de Autenticação na Interface
// ==========================================
function updateAuthModalFields() {
  if (state.isRegisterMode) {
    elements.authModalTitle.textContent = 'Criar Nova Conta';
    elements.btnAuthAction.textContent = 'Cadastrar';
    elements.btnAuthToggle.textContent = 'Já tem uma conta? Faça login';
  } else {
    elements.authModalTitle.textContent = 'Conectar ao Firebase';
    elements.btnAuthAction.textContent = 'Entrar';
    elements.btnAuthToggle.textContent = 'Criar uma nova conta';
  }
}

async function handleAuthAction() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;

  if (!email || !password) {
    alert('Por favor, preencha todos os campos.');
    return;
  }

  if (password.length < 6) {
    alert('A senha deve ter no mínimo 6 caracteres.');
    return;
  }

  elements.btnAuthAction.disabled = true;
  const originalText = elements.btnAuthAction.textContent;
  elements.btnAuthAction.textContent = 'Processando...';

  try {
    if (state.isRegisterMode) {
      await registerUser(email, password);
      alert('Conta criada com sucesso!');
    } else {
      await loginUser(email, password);
    }
    elements.authModal.classList.remove('active');
  } catch (error) {
    console.error('Erro de autenticação:', error);
    alert('Erro: ' + error.message);
  } finally {
    elements.btnAuthAction.disabled = false;
    elements.btnAuthAction.textContent = originalText;
  }
}
