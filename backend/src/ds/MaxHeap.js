// Array-backed binary max-heap ordered by a comparator.
// cmp(a, b) > 0 means a should come out before b.
export class MaxHeap {
  constructor(cmp) {
    this.cmp = cmp;
    this.data = [];
    this.comparisons = 0;
  }

  get size() {
    return this.data.length;
  }

  // O(log n)
  push(x) {
    this.data.push(x);
    this.#siftUp(this.data.length - 1);
  }

  // O(log n). Removes and returns the highest-priority element.
  pop() {
    const d = this.data;
    if (d.length === 0) return undefined;
    const top = d[0];
    const last = d.pop();
    if (d.length > 0) {
      d[0] = last;
      this.#siftDown(0);
    }
    return top;
  }

  #higher(i, j) {
    this.comparisons++;
    return this.cmp(this.data[i], this.data[j]) > 0;
  }

  #swap(i, j) {
    const d = this.data;
    [d[i], d[j]] = [d[j], d[i]];
  }

  #siftUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#higher(i, parent)) break;
      this.#swap(i, parent);
      i = parent;
    }
  }

  #siftDown(i) {
    const n = this.data.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let top = i;
      if (l < n && this.#higher(l, top)) top = l;
      if (r < n && this.#higher(r, top)) top = r;
      if (top === i) return;
      this.#swap(i, top);
      i = top;
    }
  }
}

// Heap sort. Returns a new array, highest priority first, plus the number of
// comparisons made. O(n log n) time, O(n) extra space.
export function heapSort(items, cmp) {
  const heap = new MaxHeap(cmp);
  for (const x of items) heap.push(x);
  const sorted = [];
  while (heap.size > 0) sorted.push(heap.pop());
  return { sorted, comparisons: heap.comparisons };
}
