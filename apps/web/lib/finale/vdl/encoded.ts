/** Finale writes effects edited in its effect editor as `{<version><base64 zstd s-expression>}`. */
import { zstdDecompressSync } from 'node:zlib';

const MAX_DECODED_BYTES = 1_000_000; // Decoded tree budget, bytes; observed trees are about 1 KB.

type Node = { head: string[]; quantities: { value: number; unit: string }[]; children: Node[] };

/** Numbers recovered from the compiled tree; words are re-read by the phrase parser. */
export interface EncodedEffect {
  phrase: string;
  caliberMm: number | null;
  heightM: number | null;
  liftS: number | null;
  breakRadiusM: number | null;
  starLifeS: number | null;
  tree: string;
}

export function isEncodedEffect(text: string): boolean {
  return /^\{\d[A-Za-z0-9+/=]+\}$/.test(text.trim());
}

function tokens(text: string): string[] {
  return text.match(/\(|\)|\{[^}]*\}|"[^"]*"|[^\s()]+/g) ?? [];
}

function parseNode(list: string[], start: number): { node: Node; next: number } {
  const node: Node = { head: [], quantities: [], children: [] };
  let index = start + 1;
  while (index < list.length && list[index] !== ')') {
    const token = list[index];
    if (token === '(') {
      const child = parseNode(list, index);
      node.children.push(child.node);
      index = child.next;
      continue;
    }
    const quantity = token.match(/^(-?\d+(?:\.\d+)?)(mm|m|s|pft|dly)$/);
    if (quantity) node.quantities.push({ value: Number(quantity[1]), unit: quantity[2] });
    else if (/^[a-z][a-z-]*$/.test(token)) node.head.push(token);
    index += 1;
  }
  return { node, next: index + 1 };
}

function quantity(node: Node, unit: string): number | null {
  return node.quantities.find((item) => item.unit === unit)?.value ?? null;
}

function find(node: Node, predicate: (candidate: Node) => boolean): Node | null {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

/** Reads the shell launch, its rising phase and its first visible break from a decoded tree. */
function readEffectTree(tree: string): EncodedEffect {
  const list = tokens(tree);
  if (list[0] !== '(') throw new Error('The encoded effect is not a Finale effect tree.');
  const root = parseNode(list, 0).node;
  const launch =
    find(root, (node) => node.head[0] === 'launch' && node.head[1] !== 'ground') ??
    find(root, (node) => node.head[0] === 'launch');
  if (!launch) throw new Error('The encoded effect has no launch.');
  const phrase = launch.head.slice(1).join(' ');
  const rising = find(launch, (node) => node.head[0] === 'phase' && node.head[1] === 'rising');
  const burst = launch.children
    .flatMap((star) => star.children)
    .find((node) => node.head[0] === 'break');
  const burstStar = burst?.children.find((node) => node.head[0] === 'star');
  const starLife = burstStar
    ? burstStar.children
        .filter((node) => node.head[0] === 'phase')
        .reduce((sum, node) => sum + (quantity(node, 's') ?? 0), 0)
    : 0;
  const radius = burst ? quantity(burst, 'm') : null;
  return {
    phrase,
    caliberMm: quantity(launch, 'mm'),
    heightM: quantity(launch, 'm'),
    liftS: rising ? quantity(rising, 's') : null,
    breakRadiusM: radius !== null && radius > 0 ? radius : null,
    starLifeS: starLife > 0 ? starLife : null,
    tree,
  };
}

/** Decodes `{2KLUv…}` into Finale's s-expression and the values the importer uses. */
export function decodeEncodedEffect(text: string): EncodedEffect {
  const match = text.trim().match(/^\{(\d)([A-Za-z0-9+/=]+)\}$/);
  if (!match) throw new Error('This is not an encoded Finale effect.');
  let tree: string;
  try {
    const bytes = zstdDecompressSync(Buffer.from(match[2], 'base64'), {
      maxOutputLength: MAX_DECODED_BYTES,
    });
    tree = bytes.toString('utf8');
  } catch {
    throw new Error('The encoded Finale effect could not be decompressed.');
  }
  return readEffectTree(tree);
}
