export default class Lexer {
  private pos = 0;
  private peeked: Token | null = null;

  constructor(private source: string) {
    this.skipTrivia();
  }

  peek(): Token {
    this.assertHasMore();
    if (!this.peeked) {
      this.peeked = this.next();
    }
    return this.peeked;
  }

  pop(): Token {
    this.assertHasMore();
    const out = this.peeked ?? this.next();
    this.peeked = null;
    return out;
  }

  expect(...types: Type[]): Token {
    const out = this.pop();
    if (!types.includes(out.type)) {
      throw new Error(`expected ${types.join(', ')}, not ${out.type}`);
    }
    return out;
  }

  private next(): Token {
    const startPos = this.pos;
    const c = this.source[this.pos++];

    let type: Type;
    if (c in simpleTokens) {
      let match = simpleTokens[c];
      while (typeof match === 'object') {
        if (this.source[this.pos] in match) {
          match = match[this.source[this.pos++]];
        } else if ('default' in match) {
          match = match.default;
        } else {
          throw new Error('bad simple token');
        }
      }
      type = match as Type;
    } else if (startsBareAtom(c)) {
      this.skipWhile(continuesName);
      type = Type.bareAtom;
    } else if (startsIdent(c)) {
      this.skipWhile(continuesName);
      type = Type.ident;
    } else if (c === '"' || c === "'") {
      const quote = c;

      let escapeNext = false;
      while (this.pos < this.source.length) {
        if (escapeNext) {
          this.pos++;
          escapeNext = false;
          continue;
        }

        const c = this.source[this.pos];
        if (c === '\n' || c === '\r') {
          break;
        } else if (c === quote) {
          break;
        } else if (c === '\\') {
          this.pos++;
          escapeNext = true;
        } else {
          this.pos++;
        }
      }

      if (this.source[this.pos] !== quote) {
        throw new Error('unterminated string literal');
      }
      this.pos++;
      type = quote === "'" ? Type.quotedAtom : Type.string;
    } else {
      throw new Error(`unrecognized character ${c}`);
    }

    const text = this.source.substring(startPos, this.pos);

    this.skipTrivia();

    return {
      type: remapType(type, text),
      text,
    };
  }

  private skipWhile(test: (c: string) => any) {
    while (this.pos < this.source.length && test(this.source[this.pos])) {
      this.pos++;
    }
  }

  private skipTrivia() {
    while (this.pos < this.source.length) {
      const c = this.source[this.pos];
      if (' \t\n\r'.includes(c)) {
        this.pos++;
      } else if (c === '/' && this.source[this.pos + 1] === '/') {
        while (!'\n\r'.includes(this.source[this.pos])) {
          this.pos++;
        }
      } else {
        break;
      }
    }
  }

  hasMore(): boolean {
    return this.pos < this.source.length || !!this.peeked;
  }

  assertHasMore() {
    if (!this.hasMore()) {
      throw new Error('unexpected EOF');
    }
  }
}

export interface Token {
  type: Type;
  text: string;
}

export enum Type {
  lParen = 'lParen',
  rParen = 'rParen',
  lCurly = 'lCurly',
  rCurly = 'rCurly',
  lBracket = 'lBracket',
  rBracket = 'rBracket',
  comma = 'comma',
  semi = 'semi',
  eq = 'eq',
  arrow = 'arrow',
  colon = 'colon',
  pipe = 'pipe',
  bang = 'bang',
  amp = 'amp',
  fnKw = 'fnKw',
  letKw = 'letKw',
  matchKw = 'matchKw',
  bareAtom = 'bareAtom',
  quotedAtom = 'quotedAtom',
  ident = 'ident',
  wildcard = 'wildcard',
  string = 'string',
}

type SimpleTokens = {
  [c: string]: Type | SimpleTokens;
};

const simpleTokens: SimpleTokens = {
  '(': Type.lParen,
  ')': Type.rParen,
  '{': Type.lCurly,
  '}': Type.rCurly,
  '[': Type.lBracket,
  ']': Type.rBracket,
  ',': Type.comma,
  ';': Type.semi,
  '=': {
    '>': Type.arrow,
    default: Type.eq,
  },
  ':': Type.colon,
  '@': Type.amp,
};

function startsBareAtom(c: string): boolean {
  return 'A' <= c && c <= 'Z';
}

function startsIdent(c: string): boolean {
  return ('a' <= c && c <= 'z') || c === '_';
}

function continuesName(c: string): boolean {
  return (
    ('a' <= c && c <= 'z') ||
    ('A' <= c && c <= 'Z') ||
    ('0' <= c && c <= '9') ||
    c === '_'
  );
}

function remapType(type: Type, text: string): Type {
  switch (text) {
    case '_':
      return Type.wildcard;
    case 'fn':
      return Type.fnKw;
    case 'let':
      return Type.letKw;
    case 'match':
      return Type.matchKw;
    default:
      return type;
  }
}
