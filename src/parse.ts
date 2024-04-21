import Lexer, { Type as TT } from './Lexer';

// Program = Item*{";"}
// Item = Def | Term
// Def = Ident [ "(" Pattern*{","} ")" ] "=" Term
//
// Term  = Term1 [ ":" Term ]*
// Term1 = (Atom | QuotedAtom | Ident) [ "(" Term*{","} ")" ]
//       | String
//       | "[" Term*{","} "]"
//       | "(" Term ")"
//       | "match" Term+{","} "{" MatchClause*{","} "}"
//
// MatchClause = Pattern "=>" Term
//
// Pattern  = Pattern1 [ ":" Pattern ]*
// Pattern1 = (Atom | QuotedAtom) [ "(" Pattern*{","} ")" ]
//          | "_"
//          | Ident [ "@" Pattern ]
//          | String
//          | "[" Pattern*{","} "]"
//          | "(" Pattern ")"

export type Item = DefItem | TermItem;

export interface DefItem {
  type: ItemType.def;
  name: string;
  patterns: Pattern[];
  body: Term;
}

export interface TermItem {
  type: ItemType.term;
  term: Term;
}

export enum ItemType {
  def = 'def',
  term = 'term',
}

export type Term =
  | TreeTerm
  | VarTerm
  | AppTerm
  | ConsTerm
  | StringTerm
  | ListTerm
  | MatchTerm;

export interface TreeTerm {
  type: TermType.tree;
  functor: string;
  children: Term[];
}

export interface VarTerm {
  type: TermType.var;
  text: string;
}

export interface AppTerm {
  type: TermType.app;
  opName: string;
  rands: Term[];
}

export interface ConsTerm {
  type: TermType.cons;
  head: Term;
  tail: Term;
}

export interface StringTerm {
  type: TermType.string;
  text: string;
}

export interface ListTerm {
  type: TermType.list;
  elts: Term[];
}

export interface MatchTerm {
  type: TermType.match;
  terms: Term[];
  clauses: MatchClause[];
}

export interface MatchClause {
  patterns: Pattern[];
  body: Term;
}

export enum TermType {
  tree = 'tree',
  var = 'var',
  app = 'app',
  cons = 'cons',
  string = 'string',
  list = 'list',
  match = 'match',
}

export type Pattern =
  | TreePattern
  | WildcardPattern
  | VarPattern
  | AsPattern
  | ConsPattern
  | StringPattern
  | ListPattern;

export interface TreePattern {
  type: PatternType.tree;
  functor: string;
  children: Pattern[];
}

export interface VarPattern {
  type: PatternType.var;
  text: string;
}

export interface WildcardPattern {
  type: PatternType.wildcard;
}

export interface AsPattern {
  type: PatternType.as;
  name: string;
  pattern: Pattern;
}

export interface ConsPattern {
  type: PatternType.cons;
  head: Pattern;
  tail: Pattern;
}

export interface StringPattern {
  type: PatternType.string;
  text: string;
}

export interface ListPattern {
  type: PatternType.list;
  elts: Pattern[];
}

export enum PatternType {
  tree = 'tree',
  var = 'var',
  wildcard = 'wildcard',
  as = 'as',
  cons = 'cons',
  string = 'string',
  list = 'list',
}

export function parseProgram(l: Lexer): Item[] {
  const items: Item[] = [];

  while (l.hasMore()) {
    items.push(parseItem(l));
    l.expect(TT.semi);
  }

  return items;
}

export function parseItem(l: Lexer): Item {
  if (l.peek().type === TT.letKw) {
    return parseDef(l);
  } else {
    return { type: ItemType.term, term: parseTerm(l) };
  }
}

export function parseDef(l: Lexer): DefItem {
  l.expect(TT.letKw);
  const name = l.expect(TT.ident).text;

  let patterns: Pattern[] = [];
  if (l.hasMore() && l.peek().type === TT.lParen) {
    l.pop();
    patterns = parseCommaSep(l, parsePattern, [TT.rParen]);
    l.expect(TT.rParen);
  }

  l.expect(TT.eq);

  const body = parseTerm(l);

  return {
    type: ItemType.def,
    patterns,
    name,
    body,
  };
}

export function parseTerm(l: Lexer): Term {
  let term = parseTerm1(l);

  while (l.hasMore() && l.peek().type === TT.colon) {
    l.pop();
    term = {
      type: TermType.cons,
      head: term,
      tail: parseTerm(l),
    };
  }

  return term;
}

function parseTerm1(l: Lexer): Term {
  const peeked = l.peek();

  if ([TT.bareAtom, TT.quotedAtom, TT.ident].includes(peeked.type)) {
    return parseTreeOrVarOrApp(l);
  } else if (peeked.type === TT.string) {
    return {
      type: TermType.string,
      text: getStringText(l.pop().text),
    };
  } else if (peeked.type === TT.lBracket) {
    l.pop();
    const elts = parseCommaSep(l, parseTerm, [TT.rBracket]);
    l.expect(TT.rBracket);
    return {
      type: TermType.list,
      elts,
    };
  } else if (peeked.type === TT.lParen) {
    l.pop();
    const inner = parseTerm(l);
    l.expect(TT.rParen);
    return inner;
  } else if (peeked.type === TT.matchKw) {
    return parseMatchTerm(l);
  } else {
    throw new Error('expected a term');
  }
}

function parseTreeOrVarOrApp(l: Lexer): Term {
  const start = l.expect(TT.bareAtom, TT.quotedAtom, TT.ident);
  const text =
    start.type === TT.quotedAtom ? getStringText(start.text) : start.text;

  let terms: Term[] = [];
  if (l.hasMore() && l.peek().type === TT.lParen) {
    l.pop();
    terms = parseCommaSep(l, parseTerm, [TT.rParen]);
    l.expect(TT.rParen);
  }

  if (start.type === TT.ident) {
    if (terms.length > 0) {
      return {
        type: TermType.app,
        opName: text,
        rands: terms,
      };
    } else {
      return {
        type: TermType.var,
        text,
      };
    }
  } else {
    return {
      type: TermType.tree,
      functor: text,
      children: terms,
    };
  }
}

function parseMatchTerm(l: Lexer): Term {
  l.expect(TT.matchKw);
  const terms = parseCommaSep(l, parseTerm, [TT.lCurly]);
  l.expect(TT.lCurly);
  const clauses = parseCommaSep(l, parseMatchClause, [TT.rCurly]);
  l.expect(TT.rCurly);

  return {
    type: TermType.match,
    terms,
    clauses,
  };
}

function parseMatchClause(l: Lexer): MatchClause {
  const patterns = parseCommaSep(l, parsePattern, [TT.arrow]);
  l.expect(TT.arrow);
  const body = parseTerm(l);

  return { patterns, body };
}

export function parsePattern(l: Lexer): Pattern {
  let pat = parsePattern1(l);

  while (l.hasMore() && l.peek().type === TT.colon) {
    l.pop();
    pat = {
      type: PatternType.cons,
      head: pat,
      tail: parsePattern(l),
    };
  }

  return pat;
}

function parsePattern1(l: Lexer): Pattern {
  const peeked = l.peek();

  if ([TT.bareAtom, TT.quotedAtom].includes(peeked.type)) {
    return parseTreePattern(l);
  } else if (peeked.type === TT.wildcard) {
    l.pop();
    return { type: PatternType.wildcard };
  } else if (peeked.type === TT.ident) {
    return parseVarOrAsPattern(l);
  } else if (peeked.type === TT.string) {
    return {
      type: PatternType.string,
      text: getStringText(l.pop().text),
    };
  } else if (peeked.type === TT.lBracket) {
    l.pop();
    const elts = parseCommaSep(l, parsePattern, [TT.rBracket]);
    l.expect(TT.rBracket);
    return {
      type: PatternType.list,
      elts,
    };
  } else if (peeked.type === TT.lParen) {
    l.pop();
    const inner = parsePattern(l);
    l.expect(TT.rParen);
    return inner;
  } else {
    throw new Error('expected a pattern');
  }
}

function parseTreePattern(l: Lexer): Pattern {
  const start = l.expect(TT.bareAtom, TT.quotedAtom);
  const text =
    start.type === TT.quotedAtom ? getStringText(start.text) : start.text;

  let children: Pattern[] = [];
  if (l.hasMore() && l.peek().type === TT.lParen) {
    l.pop();
    children = parseCommaSep(l, parsePattern, [TT.rParen]);
    l.expect(TT.rParen);
  }

  return {
    type: PatternType.tree,
    functor: text,
    children,
  };
}

function parseVarOrAsPattern(l: Lexer): Pattern {
  const text = l.expect(TT.ident).text;

  if (l.hasMore() && l.peek().type === TT.amp) {
    l.pop();
    return {
      type: PatternType.as,
      name: text,
      pattern: parsePattern(l),
    };
  } else {
    return {
      type: PatternType.var,
      text,
    };
  }
}

function parseCommaSep<T>(
  l: Lexer,
  parseElt: (l: Lexer) => T,
  stopSet: TT[]
): T[] {
  const elts: T[] = [];

  if (!l.hasMore() || stopSet.includes(l.peek().type)) {
    return elts;
  }

  elts.push(parseElt(l));
  while (l.hasMore()) {
    if (stopSet.includes(l.peek().type)) {
      break;
    }
    l.expect(TT.comma);
    if (!l.hasMore() || stopSet.includes(l.peek().type)) {
      break;
    }
    elts.push(parseElt(l));
  }

  return elts;
}

function getStringText(text: string): string {
  const content = text.substring(1, text.length - 1);
  if (text.startsWith("'")) {
    return content.replace(/\\'/g, "'");
  } else {
    return content.replace(/\\\"/g, '"');
  }
}
