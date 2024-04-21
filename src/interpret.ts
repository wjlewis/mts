import * as P from './lower';
import { zip } from './tools';

export default function interpret(items: P.Item[]) {
  const ops: Ops = {
    print: {
      type: OpType.builtIn,
      fn: (...terms) => {
        console.log(...terms.map(term => JSON.stringify(term, null, 2)));
        return {
          type: P.TermType.tree,
          functor: P.internalNil,
          children: [],
        };
      },
    },
  };

  for (const item of items) {
    switch (item.type) {
      case P.ItemType.def: {
        const { name, clauses } = item;
        ops[name] = {
          type: OpType.def,
          name,
          clauses,
        };
        break;
      }
      case P.ItemType.term: {
        const { term } = item;
        interpretTerm(term, Env.empty(), ops);
        break;
      }
    }
  }
}

function interpretTerm(term: P.Term, env: Env, ops: Ops): P.Term {
  switch (term.type) {
    case P.TermType.tree: {
      const { functor, children } = term;

      return {
        type: P.TermType.tree,
        functor,
        children: children.map(child => interpretTerm(child, env, ops)),
      };
    }
    case P.TermType.var: {
      const { text } = term;

      try {
        return env.lookup(text);
      } catch (err) {
        if (text in ops) {
          const op = ops[text];
          if (
            op.type === OpType.def &&
            op.clauses[0] &&
            op.clauses[0].patterns.length === 0
          ) {
            return interpretTerm(op.clauses[0].body, env, ops);
          }
        }
        throw err;
      }
    }
    case P.TermType.app: {
      const { opName, rands } = term;

      const args = rands.map(rand => interpretTerm(rand, env, ops));
      const op = ops[opName];

      return applyOp(op, args, env, ops);
    }
    case P.TermType.match: {
      const { terms, clauses } = term;

      const args = terms.map(term => interpretTerm(term, env, ops));
      for (const clause of clauses) {
        const { patterns, body } = clause;
        const s = matchAll(patterns, args, {});
        if (s) {
          return interpretTerm(body, env.extend(s), ops);
        }
      }

      throw new Error('pattern match failure');
    }
  }
}

function matchAll(pats: P.Pattern[], terms: P.Term[], s: Subst): Subst | null {
  return zip(pats, terms).reduce((s, [pat, term]) => {
    if (s === null) {
      return null;
    } else {
      return match(pat, term, s);
    }
  }, s as Subst | null);
}

function match(pat: P.Pattern, term: P.Term, s: Subst): Subst | null {
  switch (pat.type) {
    case P.PatternType.tree: {
      if (term.type === P.TermType.tree && pat.functor === term.functor) {
        return matchAll(pat.children, term.children, s);
      } else {
        return null;
      }
    }
    case P.PatternType.var: {
      const { text } = pat;
      if (text in s) {
        // Should these only ever be ground terms?
        return eqTerms(term, s[text]) ? s : null;
      } else {
        return { ...s, [text]: term };
      }
    }
    case P.PatternType.wildcard: {
      return s;
    }
    case P.PatternType.as: {
      const { name, pattern } = pat;
      const s1 = match(pattern, term, s);
      if (s1) {
        const v = { type: P.PatternType.var as const, text: name };
        return match(v, term, s1);
      } else {
        return null;
      }
    }
  }
}

function eqTerms(t: P.Term, u: P.Term): boolean {
  if (t.type === P.TermType.tree && u.type === P.TermType.tree) {
    return (
      t.functor === u.functor &&
      zip(t.children, u.children).every(([t, u]) => eqTerms(t, u))
    );
  } else {
    return false;
  }
}

type Subst = { [name: string]: P.Term };

function applyOp(op: Op, args: P.Term[], env: Env, ops: Ops): P.Term {
  switch (op.type) {
    case OpType.builtIn:
      return op.fn(...args);
    case OpType.def: {
      for (const clause of op.clauses) {
        const { patterns, body } = clause;
        const s = matchAll(patterns, args, {});

        if (s) {
          return interpretTerm(body, env.extend(s), ops);
        }
      }

      throw new Error(`pattern match failure: ${op.name}`);
    }
  }
}

class Env {
  constructor(private bindings: Subst, private base: Env | null = null) {}

  static empty() {
    return new Env({});
  }

  lookup(name: string): P.Term {
    if (name in this.bindings) {
      return this.bindings[name];
    } else if (this.base) {
      return this.base.lookup(name);
    } else {
      throw new Error(`unbound name: "${name}"`);
    }
  }

  extend(bindings: Subst): Env {
    return new Env(bindings, this);
  }
}

type Ops = { [name: string | symbol]: Op };

type Op = BuiltInOp | DefOp;

interface BuiltInOp {
  type: OpType.builtIn;
  fn: (...args: P.Term[]) => P.Term;
}

interface DefOp {
  type: OpType.def;
  name: string;
  clauses: P.MatchClause[];
}

enum OpType {
  builtIn = 'builtIn',
  def = 'def',
}
