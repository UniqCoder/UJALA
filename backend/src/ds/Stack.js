// LIFO stack on an array with an explicit top index.
export class Stack {
  constructor() {
    this.items = [];
    this.top = 0;
  }

  get size() {
    return this.top;
  }

  // O(1) amortized
  push(x) {
    this.items[this.top++] = x;
  }

  // O(1)
  pop() {
    if (this.top === 0) return undefined;
    const x = this.items[--this.top];
    this.items[this.top] = undefined;
    return x;
  }
}
