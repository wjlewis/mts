import * as Raw from './parse';
import { groupBy, mapValues } from './tools';

export type Item = FnItem | LetItem | TermItem;

export interface FnItem {
  type: ItemType.fn;
  name: string;
  clauses: MatchClause[];
}

export interface LetItem {
  type: ItemType.let;
  pattern: Pattern;
  term: Term;
}

export interface TermItem {
  type: ItemType.term;
  term: Term;
}

export enum ItemType {
  fn = 'fn',
  let = 'let',
  term = 'term',
}

export type Term = TreeTerm | VarTerm | AppTerm | MatchTerm;

export interface TreeTerm {
  type: TermType.tree;
  functor: string | symbol;
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
  match = 'match',
}

export type Pattern = TreePattern | WildcardPattern | VarPattern | AsPattern;

export interface TreePattern {
  type: PatternType.tree;
  functor: string | symbol;
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

export enum PatternType {
  tree = 'treePattern',
  var = 'varPattern',
  wildcard = 'wildcardPattern',
  as = 'asPattern',
}

export const internalCons = Symbol('internalCons');
export const internalNil = Symbol('internalNil');

/**
 * Consolidate all pattern definitions.
 * Desugar cons, string, and list patterns to internal Cons/Nil representation.
 */
export function lowerProgram(items: Raw.Item[]): Item[] {
  const fns = items.filter(
    (item): item is Raw.FnItem => item.type === Raw.ItemType.fn
  );

  const opDefs = mapValues(groupBy(fns, 'name'), (defs, name) => ({
    type: ItemType.fn as const,
    name,
    clauses: defs.map(({ patterns, body }) => ({
      patterns: patterns.map(lowerPattern),
      body: lowerTerm(body),
    })),
  }));

  const out: Item[] = [];
  const seenOps: Set<string> = new Set();

  for (const item of items) {
    switch (item.type) {
      case Raw.ItemType.fn: {
        const { name } = item;
        if (!seenOps.has(name)) {
          seenOps.add(name);
          out.push(opDefs[name]);
        }
        break;
      }

      case Raw.ItemType.let: {
        const { pattern, term } = item;
        out.push({
          type: ItemType.let,
          pattern: lowerPattern(pattern),
          term: lowerTerm(term),
        });
        break;
      }

      case Raw.ItemType.term: {
        const { term } = item;
        out.push({
          type: ItemType.term,
          term: lowerTerm(term),
        });
        break;
      }
    }
  }

  return out;
}

function lowerTerm(term: Raw.Term): Term {
  switch (term.type) {
    case Raw.TermType.tree: {
      const { functor, children } = term;

      return {
        type: TermType.tree,
        functor,
        children: children.map(lowerTerm),
      };
    }
    case Raw.TermType.var: {
      const { text } = term;

      return { type: TermType.var, text };
    }
    case Raw.TermType.app: {
      const { opName, rands } = term;

      return {
        type: TermType.app,
        opName,
        rands: rands.map(lowerTerm),
      };
    }
    case Raw.TermType.cons: {
      const { head, tail } = term;

      return {
        type: TermType.tree,
        functor: internalCons,
        children: [lowerTerm(head), lowerTerm(tail)],
      };
    }
    case Raw.TermType.string: {
      const { text } = term;
      const chars = text.split('');

      return toListTerm(
        chars.map(functor => ({
          type: TermType.tree as const,
          functor,
          children: [] as Term[],
        }))
      );
    }
    case Raw.TermType.list: {
      const { elts } = term;

      return toListTerm(elts.map(lowerTerm));
    }
    case Raw.TermType.match: {
      const { terms, clauses } = term;

      return {
        type: TermType.match,
        terms: terms.map(lowerTerm),
        clauses: clauses.map(lowerMatchClause),
      };
    }
  }
}

function lowerMatchClause(clause: Raw.MatchClause): MatchClause {
  const { patterns, body } = clause;

  return {
    patterns: patterns.map(lowerPattern),
    body: lowerTerm(body),
  };
}

function toListTerm(elts: Term[]): Term {
  return elts.reduceRight(
    (tail, head) => ({
      type: TermType.tree,
      functor: internalCons,
      children: [head, tail],
    }),
    { type: TermType.tree, functor: internalNil, children: [] }
  );
}

function lowerPattern(pat: Raw.Pattern): Pattern {
  switch (pat.type) {
    case Raw.PatternType.tree: {
      const { functor, children } = pat;

      return {
        type: PatternType.tree,
        functor,
        children: children.map(lowerPattern),
      };
    }
    case Raw.PatternType.wildcard: {
      return { type: PatternType.wildcard };
    }
    case Raw.PatternType.var: {
      const { text } = pat;

      return { type: PatternType.var, text };
    }
    case Raw.PatternType.as: {
      const { name, pattern } = pat;

      return {
        type: PatternType.as,
        name,
        pattern: lowerPattern(pattern),
      };
    }
    case Raw.PatternType.cons: {
      const { head, tail } = pat;

      return {
        type: PatternType.tree,
        functor: internalCons,
        children: [lowerPattern(head), lowerPattern(tail)],
      };
    }
    case Raw.PatternType.string: {
      const { text } = pat;
      const chars = text.split('');

      return toListPattern(
        chars.map(functor => ({
          type: PatternType.tree,
          functor,
          children: [],
        }))
      );
    }
    case Raw.PatternType.list: {
      const { elts } = pat;

      return toListPattern(elts.map(lowerPattern));
    }
  }
}

function toListPattern(elts: Pattern[]): Pattern {
  return elts.reduceRight(
    (tail, head) => ({
      type: PatternType.tree,
      functor: internalCons,
      children: [head, tail],
    }),
    { type: PatternType.tree, functor: internalNil, children: [] }
  );
}
