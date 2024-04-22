import { Value } from './interpret';
import { internalCons, internalNil } from './lower';

export function display(value: Value): string {
  return show(value, true);
}

export function print(value: Value): string {
  return show(value);
}

export function show(value: Value, raw = false): string {
  const { functor, children } = value;

  const list = tryToList(value);

  if (list !== null) {
    if (
      list.every(
        elt =>
          typeof elt.functor === 'string' &&
          elt.functor.length === 1 &&
          elt.children.length === 0
      )
    ) {
      const content = `${list
        .map(elt => (raw ? elt.functor : unescapeText(elt.functor as string)))
        .join('')}`;
      if (raw) {
        return content;
      } else {
        return `"${content}"`;
      }
    } else {
      return `[${list.map(x => show(x, raw)).join(', ')}]`;
    }
  } else if (functor === internalCons) {
    const [head, tail] = children;
    return `${show(head)} : ${show(tail)}`;
  } else if (functor === internalNil) {
    return '[]';
  } else if (typeof functor === 'string') {
    const f = printAtom(functor);
    if (children.length === 0) {
      return f;
    } else {
      return `${f}(${children.map(c => show(c, raw)).join(', ')})`;
    }
  } else {
    throw new Error('bad value');
  }
}

function tryToList(value: Value): Value[] | null {
  const { functor, children } = value;

  if (functor === internalNil) {
    return [];
  } else if (functor === internalCons) {
    const [head, tail] = children;
    const tailList = tryToList(tail);
    if (tailList) {
      return [head, ...tailList];
    } else {
      return null;
    }
  } else {
    return null;
  }
}

function printAtom(atom: string): string {
  const unescaped = unescapeText(atom);
  const c = unescaped[0];
  if ('A' <= c && c <= 'Z') {
    return unescaped;
  } else {
    return `'${unescaped}'`;
  }
}

function unescapeText(text: string) {
  return text.replace(/[\t\n\r]/, match => escapes[match]);
}

const escapes: { [c: string]: string } = {
  '\t': '\\t',
  '\n': '\\n',
  '\r': '\\r',
};
