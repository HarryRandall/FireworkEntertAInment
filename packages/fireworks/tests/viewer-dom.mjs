/** Native element double for transport lifecycle tests without WebGL. */
export class Element extends EventTarget {
  children = [];
  attributes = new Map();
  value = '';
  textContent = '';
  dataset = {};
  style = {};
  constructor(tag) {
    super();
    this.tag = tag;
  }
  append(...children) {
    for (const child of children) {
      if (child instanceof Element) child.parent = this;
      this.children.push(child);
    }
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  querySelectorAll() {
    return this.children.flatMap((child) =>
      child instanceof Element
        ? [...(child.dataset.setting ? [child] : []), ...child.querySelectorAll()]
        : [],
    );
  }
  closest() {
    return ['input', 'select', 'button'].includes(this.tag) ? this : null;
  }
  focus() {
    document.activeElement = this;
  }
  remove() {
    this.parent.children = this.parent.children.filter((child) => child !== this);
  }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      if (!(child instanceof Element)) continue;
      const result = child.find(predicate);
      if (result) return result;
    }
  }
}
