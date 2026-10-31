// FIFO queue on a circular buffer that doubles when full.
export class Queue {
  constructor(capacity = 16) {
    this.buf = new Array(capacity);
    this.head = 0;
    this.length = 0;
  }

  get size() {
    return this.length;
  }

  // O(1) amortized
  enqueue(x) {
    if (this.length === this.buf.length) this.#grow();
    this.buf[(this.head + this.length) % this.buf.length] = x;
    this.length++;
  }

  // O(1)
  dequeue() {
    if (this.length === 0) return undefined;
    const x = this.buf[this.head];
    this.buf[this.head] = undefined;
    this.head = (this.head + 1) % this.buf.length;
    this.length--;
    return x;
  }

  // O(n), copies elements in queue order into a buffer twice the size.
  #grow() {
    const bigger = new Array(this.buf.length * 2);
    for (let i = 0; i < this.length; i++) {
      bigger[i] = this.buf[(this.head + i) % this.buf.length];
    }
    this.buf = bigger;
    this.head = 0;
  }
}
