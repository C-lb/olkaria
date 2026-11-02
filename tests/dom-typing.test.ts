// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

describe('DOM typing', () => {
  it('types Element.append(node) and document.body.append(el) against the DOM lib', () => {
    const el = document.createElement('div');
    el.append(document.createElement('span'));
    document.body.append(el);
    expect(el.children.length).toBe(1);
  });
});
