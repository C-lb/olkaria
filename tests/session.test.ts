// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { rememberRoom, recallRoom, forgetRoom } from '../host/session';
it('remembers and forgets the room for this tab', () => {
  expect(recallRoom()).toBeNull();
  rememberRoom('ABCD', 'k'); expect(recallRoom()).toEqual({ code: 'ABCD', hostKey: 'k' });
  forgetRoom(); expect(recallRoom()).toBeNull();
});

// Added after the brief's test.
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it('keeps the room as JSON under olkaria.room', () => {
  rememberRoom('ABCD', 'k');
  expect(JSON.parse(sessionStorage.getItem('olkaria.room') ?? 'null')).toEqual({ code: 'ABCD', hostKey: 'k' });
  forgetRoom();
  expect(sessionStorage.getItem('olkaria.room')).toBeNull();
});

it('remembers the latest room only', () => {
  rememberRoom('ABCD', 'one');
  rememberRoom('WXYZ', 'two');
  expect(recallRoom()).toEqual({ code: 'WXYZ', hostKey: 'two' });
});

it('reads anything it did not write as no room', () => {
  const junk = [
    '', 'not json', 'null', '7', '"ABCD"', '[]', '{}',
    '{"code":"ABCD"}', '{"hostKey":"k"}', '{"code":"","hostKey":"k"}', '{"code":"ABCD","hostKey":""}',
    '{"code":1,"hostKey":"k"}', '{"code":"ABCD","hostKey":2}',
  ];
  for (const value of junk) {
    sessionStorage.setItem('olkaria.room', value);
    expect(recallRoom(), value).toBeNull();
  }
});

it('drops fields it does not know when it reads the room back', () => {
  sessionStorage.setItem('olkaria.room', '{"code":"ABCD","hostKey":"k","extra":true}');
  expect(recallRoom()).toStrictEqual({ code: 'ABCD', hostKey: 'k' });
});

it('treats storage that throws on use as no room, and never throws itself', () => {
  const denied = () => { throw new DOMException('denied', 'SecurityError'); };
  vi.stubGlobal('sessionStorage', { getItem: denied, setItem: denied, removeItem: denied });
  expect(() => rememberRoom('ABCD', 'k')).not.toThrow();
  expect(recallRoom()).toBeNull();
  expect(() => forgetRoom()).not.toThrow();
});

it('treats storage that throws on access as no room, and never throws itself', () => {
  // Some browsers throw from the sessionStorage getter itself when site data is blocked.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw new DOMException('denied', 'SecurityError'); },
  });
  try {
    expect(() => rememberRoom('ABCD', 'k')).not.toThrow();
    expect(recallRoom()).toBeNull();
    expect(() => forgetRoom()).not.toThrow();
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
