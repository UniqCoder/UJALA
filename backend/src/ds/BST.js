// Plain (unbalanced) binary search tree, only used to compare heights with the AVL tree.
export class BST {
  constructor() {
    this.root = null;
  }

  // O(h): O(log n) on random input, O(n) on sorted input.
  insert(key) {
    const node = { key, left: null, right: null };
    if (!this.root) {
      this.root = node;
      return;
    }
    let n = this.root;
    for (;;) {
      if (key === n.key) return;
      const side = key < n.key ? 'left' : 'right';
      if (!n[side]) {
        n[side] = node;
        return;
      }
      n = n[side];
    }
  }

  // O(n). Iterative level count so a degenerate (list-shaped) tree can't overflow the call stack.
  height() {
    let level = this.root ? [this.root] : [];
    let height = 0;
    while (level.length > 0) {
      height++;
      const next = [];
      for (const n of level) {
        if (n.left) next.push(n.left);
        if (n.right) next.push(n.right);
      }
      level = next;
    }
    return height;
  }
}
