// tests/credits.test.ts
// Every file shipped under host/art/assets/ is credited in CREDITS.md, and everything CREDITS.md credits is there.
// CREDITS.md names a shipped file as a backticked repo path (`host/art/assets/...`); paths inside a source pack are
// written without that prefix, so they are never mistaken for shipped files.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = 'host/art/assets';
const CREDITS = join(ROOT, 'CREDITS.md');
/** R10: about 3 MB for the whole folder. */
const BUDGET_BYTES = 3 * 1024 * 1024;

/** Repo-relative POSIX paths of every file under `dir`, dotfiles (a stray .DS_Store) aside. */
function filesUnder(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...filesUnder(path));
    else out.push(path);
  }
  return out;
}

/** The shipped files a credits text names: every backticked span that starts with host/art/assets/. */
function namedIn(text: string): string[] {
  return [...text.matchAll(/`(host\/art\/assets\/[^`\s]+)`/g)].map((m) => m[1]);
}

const credits = existsSync(CREDITS) ? readFileSync(CREDITS, 'utf8') : '';
const files = filesUnder(ASSETS);
const named = namedIn(credits);

describe('CREDITS.md', () => {
  it('exists', () => {
    expect(existsSync(CREDITS)).toBe(true);
  });

  it('names every file under host/art/assets/', () => {
    expect(files.length).toBeGreaterThan(0);
    const credited = new Set(named);
    expect(files.filter((f) => !credited.has(f))).toEqual([]);
  });

  it('names no file that is not there', () => {
    expect(named.filter((f) => !existsSync(join(ROOT, ...f.split('/'))))).toEqual([]);
  });

  it('gives a licence and a source address in every section that credits a file', () => {
    const sections = credits.split(/^## /m).slice(1).filter((s) => namedIn(s).length > 0);
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) {
      const title = s.split('\n')[0];
      expect(s, title).toMatch(/licen[cs]e/i);
      expect(s, title).toMatch(/https:\/\//);
    }
  });

  it('has no em dashes', () => {
    const emDash = String.fromCodePoint(0x2014);   // spelled as a code point, so this file has none either
    expect(credits.includes(emDash)).toBe(false);
  });
});

describe('host/art/assets/', () => {
  it('holds only PNGs, web fonts and the font licence, within about 3 MB', () => {
    expect(files.filter((f) => !/\.(png|woff2)$/.test(f) && !f.endsWith('/OFL.txt'))).toEqual([]);
    const bytes = files.reduce((sum, f) => sum + statSync(join(ROOT, ...f.split('/'))).size, 0);
    expect(bytes).toBeLessThan(BUDGET_BYTES);
  });
});
