(function () {
  'use strict';

  function run() {
    if (!window.DataLayer) {
      const root = document.getElementById('skill-tree-root');
      if (root) root.innerHTML = '<p class="flowchart-error">Could not load app. Check that data.js is loaded.</p>';
      return;
    }

    const { skillTree: dataTree, diary: dataDiary, timetable: dataTimetable, trophies: dataTrophies } = window.DataLayer;

  // --- Navigation ---
  function initNav() {
    const sections = document.querySelectorAll('.section');
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.section;
        sections.forEach(s => {
          s.classList.toggle('active', s.id === 'section-' + id);
        });
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        if (id === 'skill-tree') renderSkillTree();
        if (id === 'diary') showDiaryForCurrentDate();
        if (id === 'timetable') renderTimetable();
        if (id === 'trophies') renderTrophies();
      });
    });
  }

  // --- Skill tree (dynamic flowchart) ---
  let currentSkillId = null;
  let branchModalMode = 'add'; // 'add' | 'rename'
  let branchModalParentId = null;
  let branchModalNodeId = null;

  const FALLBACK_HTML = '<div class="flowchart-fallback" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:2rem;text-align:center;"><span class="flowchart-node flowchart-node-root" style="font-size:1.25rem;font-weight:600;padding:0.75rem 1.5rem;border:2px solid #2563eb;border-radius:8px;color:#1a1a1a;background:#fff;cursor:pointer;">You</span><p class="flowchart-fallback-hint" style="margin:0;font-size:0.95rem;color:#666;">Click to add your first skill</p><button type="button" id="fallback-add-branch" style="padding:0.5rem 1rem;border-radius:8px;font-size:0.9rem;cursor:pointer;background:#2563eb;color:#fff;border:none;">+ Add main branch</button></div>';

  function renderSkillTree() {
    const container = document.getElementById('skill-tree-root');
    if (!container) return;
    try {
      const { root: tree, progress } = dataTree.get();
      if (!tree) return;

      const wrap = document.createElement('div');
      wrap.className = 'flowchart-wrap';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.className = 'flowchart-svg';
      svg.setAttribute('aria-hidden', 'true');
      const nodesEl = document.createElement('div');
      nodesEl.className = 'flowchart-nodes';
      wrap.appendChild(svg);
      wrap.appendChild(nodesEl);

      const centerRow = document.createElement('div');
      centerRow.className = 'flowchart-row flowchart-row-center';
      const centerWrap = document.createElement('div');
      centerWrap.className = 'flowchart-center-wrap';
      const centerNode = document.createElement('div');
      centerNode.className = 'flowchart-node flowchart-node-root';
      centerNode.dataset.id = tree.id;
      centerNode.innerHTML = '<span class="flowchart-node-label">' + escapeHtml(tree.label) + '</span>';
      centerNode.setAttribute('title', 'Click for options');
      centerNode.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCenterMenu(centerWrap, centerNode);
      });
      centerWrap.appendChild(centerNode);
      const centerMenu = document.createElement('div');
      centerMenu.className = 'flowchart-center-menu hidden';
      centerMenu.innerHTML =
        '<button type="button" class="btn btn-primary flowchart-center-menu-add">Add main branch</button>' +
        '<button type="button" class="btn btn-ghost flowchart-center-menu-edit">Edit my name</button>';
      centerMenu.querySelector('.flowchart-center-menu-add').addEventListener('click', (e) => {
        e.stopPropagation();
        hideCenterMenu();
        openBranchModal('add', 'user', null);
      });
      centerMenu.querySelector('.flowchart-center-menu-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        hideCenterMenu();
        openBranchModal('rename', null, 'user');
      });
      centerWrap.appendChild(centerMenu);
      centerRow.appendChild(centerWrap);
      const addMainBtn = document.createElement('button');
      addMainBtn.type = 'button';
      addMainBtn.className = 'btn btn-ghost flowchart-add-main';
      addMainBtn.textContent = '+ Add main branch';
      addMainBtn.addEventListener('click', (e) => { e.stopPropagation(); openBranchModal('add', 'user', null); });
      centerRow.appendChild(addMainBtn);
      nodesEl.appendChild(centerRow);

      if (tree.children && tree.children.length) {
        const childrenRow = document.createElement('div');
        childrenRow.className = 'flowchart-row';
        tree.children.forEach(node => {
          childrenRow.appendChild(buildNodeWrap(node, progress));
        });
        nodesEl.appendChild(childrenRow);
      }

      container.innerHTML = '';
      container.className = 'flowchart';
      container.appendChild(wrap);

      requestAnimationFrame(() => drawFlowchartLines(wrap, nodesEl, svg));
    } catch (e) {
      console.error('renderSkillTree failed', e);
      container.innerHTML = FALLBACK_HTML;
      container.className = 'tree-root';
    }
  }

  function wireFallbackClicks(container) {
    var addBtn = container.querySelector('button');
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.style.cursor = 'pointer';
      addBtn.style.background = '#2563eb';
      addBtn.style.color = '#fff';
      addBtn.addEventListener('click', function () {
        openBranchModal('add', 'user', null);
      });
    }
    var youSpan = container.querySelector('.flowchart-node-root');
    if (youSpan) {
      youSpan.style.cursor = 'pointer';
      youSpan.addEventListener('click', function () {
        openBranchModal('add', 'user', null);
      });
    }
  }

  function buildNodeWrap(node, progress) {
    const wrap = document.createElement('div');
    wrap.className = 'flowchart-node-wrap';
    const nodeEl = document.createElement('div');
    nodeEl.className = 'flowchart-node';
    nodeEl.dataset.id = node.id;
    const hasChildren = node.children && node.children.length > 0;
    const pct = (progress[node.id] && progress[node.id].progress != null) ? progress[node.id].progress : 0;
    nodeEl.innerHTML =
      '<span class="flowchart-node-label">' + escapeHtml(node.label) + '</span>' +
      (!hasChildren ? '<span class="flowchart-progress-wrap"><span class="flowchart-progress-fill" style="width:' + pct + '%"></span></span>' : '');
    nodeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openSkillModal(node.id, node.label, progress[node.id]);
    });
    wrap.appendChild(nodeEl);

    const actions = document.createElement('div');
    actions.className = 'flowchart-node-actions';
    const addSub = document.createElement('button');
    addSub.type = 'button';
    addSub.className = 'btn btn-ghost flowchart-add-sub';
    addSub.textContent = '+ Sub-branch';
    addSub.addEventListener('click', (e) => { e.stopPropagation(); openBranchModal('add', node.id, null); });
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost flowchart-edit';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openBranchModal('rename', null, node.id); });
    actions.appendChild(addSub);
    actions.appendChild(editBtn);
    wrap.appendChild(actions);

    if (hasChildren) {
      const childRow = document.createElement('div');
      childRow.className = 'flowchart-children-row';
      node.children.forEach(child => {
        childRow.appendChild(buildNodeWrap(child, progress));
      });
      wrap.appendChild(childRow);
    }
    return wrap;
  }

  function drawFlowchartLines(wrap, nodesEl, svg) {
    const wrapRect = wrap.getBoundingClientRect();
    const nodes = nodesEl.querySelectorAll('.flowchart-node[data-id]');
    const idToRect = {};
    nodes.forEach(el => {
      const r = el.getBoundingClientRect();
      idToRect[el.dataset.id] = {
        left: r.left - wrapRect.left + wrap.scrollLeft,
        top: r.top - wrapRect.top + wrap.scrollTop,
        width: r.width,
        height: r.height
      };
    });
    const tree = dataTree.getTree();
    const edges = [];
    function collectEdges(node, parentId) {
      if (parentId && node.id && idToRect[node.id] && idToRect[parentId]) {
        edges.push({ parentId, childId: node.id });
      }
      if (node.children) node.children.forEach(c => collectEdges(c, node.id));
    }
    if (tree.children) tree.children.forEach(c => collectEdges(c, tree.id));

    const w = wrap.scrollWidth || wrapRect.width;
    const h = wrap.scrollHeight || wrapRect.height;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.innerHTML = '';
    edges.forEach(({ parentId, childId }) => {
      const p = idToRect[parentId];
      const c = idToRect[childId];
      if (!p || !c) return;
      const x1 = p.left + p.width / 2;
      const y1 = p.top + p.height;
      const x2 = c.left + c.width / 2;
      const y2 = c.top;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', 'var(--border)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    });
  }

  function openBranchModal(mode, parentId, nodeId) {
    branchModalMode = mode;
    branchModalParentId = parentId;
    branchModalNodeId = nodeId;
    const titleEl = document.getElementById('modal-branch-title');
    const nameEl = document.getElementById('modal-branch-name');
    const saveBtn = document.getElementById('modal-branch-save');
    const delBtn = document.getElementById('modal-branch-delete');
    if (mode === 'add') {
      titleEl.textContent = parentId === 'user' ? 'Add main branch' : 'Add sub-branch';
      nameEl.value = '';
      nameEl.placeholder = 'e.g. Academics';
      saveBtn.textContent = 'Add';
      delBtn.classList.add('hidden');
    } else {
      const tree = dataTree.getTree();
      const node = findNodeInTree(tree, nodeId);
      titleEl.textContent = nodeId === 'user' ? 'Edit my name' : 'Edit branch';
      nameEl.value = node ? node.label : '';
      saveBtn.textContent = 'Save';
      delBtn.classList.toggle('hidden', nodeId === 'user');
    }
    var modalEl = document.getElementById('modal-branch');
    if (modalEl) modalEl.classList.remove('hidden');
    if (nameEl) nameEl.focus();
  }

  function findNodeInTree(node, id) {
    if (node.id === id) return node;
    if (node.children) for (const c of node.children) { const f = findNodeInTree(c, id); if (f) return f; }
    return null;
  }

  function closeBranchModal() {
    document.getElementById('modal-branch').classList.add('hidden');
    branchModalMode = branchModalParentId = branchModalNodeId = null;
  }

  function toggleCenterMenu(centerWrap, centerNode) {
    const menu = centerWrap.querySelector('.flowchart-center-menu');
    if (!menu) return;
    const isHidden = menu.classList.toggle('hidden');
    if (!isHidden) {
      const close = (e) => {
        if (!centerWrap.contains(e.target)) {
          hideCenterMenu();
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  function hideCenterMenu() {
    document.querySelectorAll('.flowchart-center-menu').forEach(m => m.classList.add('hidden'));
  }

  var modalBranchSave = document.getElementById('modal-branch-save');
  if (modalBranchSave) modalBranchSave.addEventListener('click', () => {
    const nameEl = document.getElementById('modal-branch-name');
    const name = nameEl ? nameEl.value.trim() : '';
    if (branchModalMode === 'add') {
      if (!name) return;
      dataTree.addNode(branchModalParentId, name);
    } else {
      if (branchModalNodeId) dataTree.renameNode(branchModalNodeId, name || 'Branch');
    }
    closeBranchModal();
    renderSkillTree();
  });
  var modalBranchCancel = document.getElementById('modal-branch-cancel');
  if (modalBranchCancel) modalBranchCancel.addEventListener('click', closeBranchModal);
  var modalBranchDelete = document.getElementById('modal-branch-delete');
  if (modalBranchDelete) modalBranchDelete.addEventListener('click', () => {
    if (branchModalNodeId && confirm('Delete this branch and all its sub-branches?')) {
      dataTree.deleteNode(branchModalNodeId);
      closeBranchModal();
      renderSkillTree();
    }
  });

  function openSkillModal(id, label, data) {
    currentSkillId = id;
    document.getElementById('modal-skill-title').textContent = label;
    document.getElementById('modal-skill-progress').value = (data && data.progress != null) ? data.progress : 0;
    document.getElementById('modal-skill-note').value = (data && data.note) || '';
    document.getElementById('modal-skill').classList.remove('hidden');
  }

  function closeSkillModal() {
    document.getElementById('modal-skill').classList.add('hidden');
    currentSkillId = null;
  }

  document.getElementById('modal-skill-save').addEventListener('click', () => {
    if (!currentSkillId) return;
    const progress = parseInt(document.getElementById('modal-skill-progress').value, 10) || 0;
    const note = document.getElementById('modal-skill-note').value.trim();
    dataTree.updateNode(currentSkillId, { progress, note });
    closeSkillModal();
    renderSkillTree();
  });
  document.getElementById('modal-skill-cancel').addEventListener('click', closeSkillModal);

  // --- Diary ---
  let diaryCurrentDate = new Date();

  function formatDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function showDiaryForCurrentDate() {
    const key = formatDateKey(diaryCurrentDate);
    document.getElementById('diary-date').value = key;
    document.getElementById('diary-content').value = dataDiary.getEntry(key);
  }

  function initDiary() {
    diaryCurrentDate = new Date();
    showDiaryForCurrentDate();
    document.getElementById('diary-date').addEventListener('change', (e) => {
      diaryCurrentDate = new Date(e.target.value + 'T12:00:00');
      showDiaryForCurrentDate();
    });
    document.getElementById('diary-prev').addEventListener('click', () => {
      diaryCurrentDate.setDate(diaryCurrentDate.getDate() - 1);
      showDiaryForCurrentDate();
    });
    document.getElementById('diary-next').addEventListener('click', () => {
      diaryCurrentDate.setDate(diaryCurrentDate.getDate() + 1);
      showDiaryForCurrentDate();
    });
    document.getElementById('diary-today').addEventListener('click', () => {
      diaryCurrentDate = new Date();
      showDiaryForCurrentDate();
    });
    const textarea = document.getElementById('diary-content');
    let saveTimeout;
    textarea.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const key = formatDateKey(diaryCurrentDate);
        dataDiary.setEntry(key, textarea.value);
      }, 400);
    });
  }

  // --- Timetable ---
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let editingSlotIndex = null;

  function renderTimetable() {
    const slots = dataTimetable.get();
    const grid = document.getElementById('timetable-grid');
    const empty = document.getElementById('timetable-empty');
    grid.innerHTML = '';
    grid.appendChild(document.createElement('div')).className = 'timetable-cell header';
    for (let d = 0; d < 7; d++) {
      const cell = document.createElement('div');
      cell.className = 'timetable-cell header';
      cell.textContent = DAYS[d];
      grid.appendChild(cell);
    }
    const byDay = [];
    for (let d = 0; d < 7; d++) byDay[d] = slots.filter(s => s.day === d).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    const maxRows = Math.max(1, ...byDay.map(arr => arr.length));
    for (let row = 0; row < maxRows; row++) {
      grid.appendChild(document.createElement('div')).className = 'timetable-cell';
      for (let d = 0; d < 7; d++) {
        const cell = document.createElement('div');
        cell.className = 'timetable-cell';
        const slot = byDay[d][row];
        if (slot) {
          const div = document.createElement('div');
          div.className = 'timetable-slot';
          div.textContent = (slot.startTime || '') + (slot.endTime ? ' – ' + slot.endTime : '') + ' ' + (slot.label || '');
          div.dataset.index = slots.indexOf(slot).toString();
          div.addEventListener('click', () => openSlotModal(slots.indexOf(slot)));
          cell.appendChild(div);
        }
        grid.appendChild(cell);
      }
    }
    empty.classList.toggle('hidden', slots.length > 0);
  }

  function openSlotModal(index) {
    editingSlotIndex = index;
    const isEdit = index >= 0;
    document.getElementById('modal-slot-title').textContent = isEdit ? 'Edit slot' : 'Add slot';
    document.getElementById('modal-slot-delete').classList.toggle('hidden', !isEdit);
    if (isEdit) {
      const slots = dataTimetable.get();
      const s = slots[index];
      document.getElementById('modal-slot-day').value = String(s.day);
      document.getElementById('modal-slot-start').value = s.startTime || '';
      document.getElementById('modal-slot-end').value = s.endTime || '';
      document.getElementById('modal-slot-label').value = s.label || '';
    } else {
      document.getElementById('modal-slot-day').value = '0';
      document.getElementById('modal-slot-start').value = '09:00';
      document.getElementById('modal-slot-end').value = '10:00';
      document.getElementById('modal-slot-label').value = '';
    }
    document.getElementById('modal-slot').classList.remove('hidden');
  }

  function closeSlotModal() {
    document.getElementById('modal-slot').classList.add('hidden');
    editingSlotIndex = null;
  }

  document.getElementById('timetable-add').addEventListener('click', () => openSlotModal(-1));
  document.getElementById('modal-slot-save').addEventListener('click', () => {
    const slots = dataTimetable.get();
    const slot = {
      day: parseInt(document.getElementById('modal-slot-day').value, 10),
      startTime: document.getElementById('modal-slot-start').value,
      endTime: document.getElementById('modal-slot-end').value,
      label: document.getElementById('modal-slot-label').value.trim()
    };
    if (editingSlotIndex >= 0) {
      slots[editingSlotIndex] = slot;
    } else {
      slots.push(slot);
    }
    dataTimetable.set(slots);
    closeSlotModal();
    renderTimetable();
  });
  document.getElementById('modal-slot-cancel').addEventListener('click', closeSlotModal);
  document.getElementById('modal-slot-delete').addEventListener('click', () => {
    if (editingSlotIndex < 0) return;
    const slots = dataTimetable.get().filter((_, i) => i !== editingSlotIndex);
    dataTimetable.set(slots);
    closeSlotModal();
    renderTimetable();
  });

  // --- Broken Trophy Room ---
  let editingTrophyId = null;

  function renderTrophies() {
    const list = dataTrophies.getAll();
    const container = document.getElementById('trophies-list');
    const empty = document.getElementById('trophies-empty');
    container.innerHTML = '';
    list.forEach(t => {
      const card = document.createElement('div');
      card.className = 'trophy-card';
      card.innerHTML =
        '<h4>' + escapeHtml(t.title || 'Untitled') + '</h4>' +
        (t.whatHappened ? '<div class="what">' + escapeHtml(t.whatHappened) + '</div>' : '') +
        (t.whatILearned ? '<div class="learned">' + escapeHtml(t.whatILearned) + '</div>' : '');
      card.addEventListener('click', () => openTrophyModal(t.id));
      container.appendChild(card);
    });
    empty.classList.toggle('hidden', list.length > 0);
  }

  function openTrophyModal(id) {
    editingTrophyId = id;
    const isEdit = !!id;
    document.getElementById('modal-trophy-title').textContent = isEdit ? 'Edit entry' : 'Add setback';
    document.getElementById('modal-trophy-delete').classList.toggle('hidden', !isEdit);
    if (isEdit) {
      const t = dataTrophies.getAll().find(x => x.id === id);
      if (t) {
        document.getElementById('modal-trophy-title-input').value = t.title || '';
        document.getElementById('modal-trophy-what').value = t.whatHappened || '';
        document.getElementById('modal-trophy-learned').value = t.whatILearned || '';
      }
    } else {
      document.getElementById('modal-trophy-title-input').value = '';
      document.getElementById('modal-trophy-what').value = '';
      document.getElementById('modal-trophy-learned').value = '';
    }
    document.getElementById('modal-trophy').classList.remove('hidden');
  }

  function closeTrophyModal() {
    document.getElementById('modal-trophy').classList.add('hidden');
    editingTrophyId = null;
  }

  document.getElementById('trophy-add').addEventListener('click', () => openTrophyModal(null));
  document.getElementById('modal-trophy-save').addEventListener('click', () => {
    const title = document.getElementById('modal-trophy-title-input').value.trim();
    const whatHappened = document.getElementById('modal-trophy-what').value.trim();
    const whatILearned = document.getElementById('modal-trophy-learned').value.trim();
    if (editingTrophyId) {
      dataTrophies.update(editingTrophyId, { title, whatHappened, whatILearned });
    } else {
      dataTrophies.add({ title: title || 'Untitled', whatHappened, whatILearned });
    }
    closeTrophyModal();
    renderTrophies();
  });
  document.getElementById('modal-trophy-cancel').addEventListener('click', closeTrophyModal);
  document.getElementById('modal-trophy-delete').addEventListener('click', () => {
    if (editingTrophyId) {
      dataTrophies.remove(editingTrophyId);
      closeTrophyModal();
      renderTrophies();
    }
  });

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // --- Close modals on overlay click ---
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        currentSkillId = null;
        editingSlotIndex = null;
        editingTrophyId = null;
        closeBranchModal();
      }
    });
  });

  // --- Boot ---
    initNav();
    initDiary();
    renderSkillTree();
    var container = document.getElementById('skill-tree-root');
    if (container && container.querySelector('.flowchart-fallback')) {
      wireFallbackClicks(container);
    }
    renderTimetable();
    renderTrophies();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
