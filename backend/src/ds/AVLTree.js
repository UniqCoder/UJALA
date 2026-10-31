// AVL tree used as the appliance catalogue (symbol table keyed by name).

class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.left = null;
    this.right = null;
    this.height = 1;
  }
}

const h = (n) => (n ? n.height : 0);
const update = (n) => {
  n.height = 1 + Math.max(h(n.left), h(n.right));
};

function rotateRight(y) {
  const x = y.left;
  y.left = x.right;
  x.right = y;
  update(y);
  update(x);
  return x;
}

function rotateLeft(x) {
  const y = x.right;
  x.right = y.left;
  y.left = x;
  update(x);
  update(y);
  return y;
}

// Restores the AVL property at n with one of the four rotation cases.
function rebalance(n) {
  update(n);
  const balance = h(n.left) - h(n.right);
  if (balance > 1) {
    if (h(n.left.left) < h(n.left.right)) n.left = rotateLeft(n.left); // LR
    return rotateRight(n); // LL
  }
  if (balance < -1) {
    if (h(n.right.right) < h(n.right.left)) n.right = rotateRight(n.right); // RL
    return rotateLeft(n); // RR
  }
  return n;
}

export class AVLTree {
  constructor() {
    this.root = null;
    this.size = 0;
  }

  // O(log n). Inserting an existing key replaces its value.
  insert(key, value) {
    const insertAt = (n) => {
      if (!n) {
        this.size++;
        return new Node(key, value);
      }
      if (key < n.key) n.left = insertAt(n.left);
      else if (key > n.key) n.right = insertAt(n.right);
      else {
        n.value = value;
        return n;
      }
      return rebalance(n);
    };
    this.root = insertAt(this.root);
  }

  // O(log n)
  get(key) {
    let n = this.root;
    while (n) {
      if (key === n.key) return n.value;
      n = key < n.key ? n.left : n.right;
    }
    return undefined;
  }

  // O(1)
  height() {
    return h(this.root);
  }

  // O(log n + k) for k matches. In-order walk that skips subtrees which
  // cannot hold keys starting with prefix. Empty prefix lists everything in order.
  prefixSearch(prefix) {
    const out = [];
    const hi = prefix + '￿';
    const walk = (n) => {
      if (!n) return;
      if (n.key > prefix) walk(n.left);
      if (n.key.startsWith(prefix)) out.push(n.value);
      if (n.key < hi) walk(n.right);
    };
    walk(this.root);
    return out;
  }
}
