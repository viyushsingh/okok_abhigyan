/**
 * Data layer: localStorage for now. Replace internals with fetch() to add a backend later.
 * Keys prefixed with abhigyan_ to avoid clashes.
 */
const PREFIX = 'abhigyan_';

const storage = {
  get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }
};

// --- Skill tree (dynamic: user creates all branches) ---
const TREE_KEY = 'skillTree';

function getDefaultRoot() {
  return { id: 'user', label: 'You', children: [] };
}

function findNode(node, id) {
  if (node.id === id) return node;
  if (!node.children) return null;
  for (const c of node.children) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

function findParent(node, targetId, parent) {
  if (node.id === targetId) return parent;
  if (!node.children) return null;
  for (const c of node.children) {
    const found = findParent(c, targetId, node);
    if (found !== null) return found;
  }
  return null;
}

function collectIds(node, out) {
  out.push(node.id);
  if (node.children) node.children.forEach(c => collectIds(c, out));
}

const skillTree = {
  getTree() {
    const saved = storage.get(TREE_KEY);
    if (!saved || !saved.id) {
      const def = getDefaultRoot();
      try {
        skillTree.setTree(def);
      } catch (e) {
        // localStorage may be disabled or full; still return default so UI can render
      }
      return def;
    }
    return saved;
  },
  setTree(tree) {
    storage.set(TREE_KEY, tree);
  },
  get() {
    const root = skillTree.getTree();
    const progress = storage.get('skillProgress') || {};
    return { root, progress };
  },
  setProgress(progress) {
    storage.set('skillProgress', progress);
  },
  getProgress() {
    return storage.get('skillProgress') || {};
  },
  addNode(parentId, label) {
    const root = skillTree.getTree();
    const parent = parentId === 'user' ? root : findNode(root, parentId);
    if (!parent) return null;
    if (!parent.children) parent.children = [];
    const id = 'n_' + Date.now();
    const node = { id, label: label.trim() || 'Branch', children: [] };
    parent.children.push(node);
    skillTree.setTree(root);
    return id;
  },
  renameNode(id, label) {
    const root = skillTree.getTree();
    const node = findNode(root, id);
    if (!node) return;
    node.label = label.trim() || node.label;
    skillTree.setTree(root);
  },
  deleteNode(id) {
    const root = skillTree.getTree();
    if (id === 'user') return;
    const parent = findParent(root, id, null);
    if (!parent || !parent.children) return;
    const i = parent.children.findIndex(c => c.id === id);
    if (i < 0) return;
    const ids = [];
    collectIds(parent.children[i], ids);
    parent.children.splice(i, 1);
    const progress = skillTree.getProgress();
    ids.forEach(rid => delete progress[rid]);
    skillTree.setProgress(progress);
    skillTree.setTree(root);
  },
  updateNode(id, updates) {
    const progress = skillTree.getProgress();
    progress[id] = { ...(progress[id] || {}), ...updates };
    skillTree.setProgress(progress);
  }
};

// --- Diary: one entry per day ---
const diary = {
  getEntry(date) {
    const all = storage.get('diary') || {};
    return all[date] || '';
  },
  setEntry(date, content) {
    const all = storage.get('diary') || {};
    all[date] = content;
    storage.set('diary', all);
  }
};

// --- Timetable: array of slots ---
const timetable = {
  get() {
    return storage.get('timetable') || [];
  },
  set(slots) {
    storage.set('timetable', slots);
  }
};

// --- Broken Trophy Room ---
const trophies = {
  getAll() {
    return storage.get('trophies') || [];
  },
  add(trophy) {
    const list = trophies.getAll();
    const id = 't_' + Date.now();
    list.push({ id, ...trophy, createdAt: new Date().toISOString() });
    storage.set('trophies', list);
    return id;
  },
  update(id, trophy) {
    const list = trophies.getAll();
    const i = list.findIndex(t => t.id === id);
    if (i === -1) return;
    list[i] = { ...list[i], ...trophy };
    storage.set('trophies', list);
  },
  remove(id) {
    const list = trophies.getAll().filter(t => t.id !== id);
    storage.set('trophies', list);
  }
};

window.DataLayer = { skillTree, diary, timetable, trophies };
