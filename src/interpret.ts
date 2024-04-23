import * as P from './lower';
import { zip } from './tools';
import { print, display } from './print';

export interface Value {
  functor: string | symbol;
  children: Value[];
}

type Subst = { [name: string]: Value };

class Env {
  constructor(private bindings: Subst, private base: Env | null = null) {}

  static empty() {
    return new Env({});
  }

  define(subst: Subst) {
    for (const [name, value] of Object.entries(subst)) {
      this.bindings[name] = value;
    }
  }

  lookup(name: string): Value {
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

export type Op = BuiltInOp | FnOp;

export interface BuiltInOp {
  type: OpType.builtIn;
  name: string;
  fn: (...args: Value[]) => Value;
}

export interface FnOp {
  type: OpType.fn;
  name: string;
  clauses: P.MatchClause[];
}

export enum OpType {
  builtIn = 'builtIn',
  fn = 'fn',
}

type Ops = { [name: string]: Op };

export default function interpret(items: P.Item[]) {
  const env = Env.empty();

  const ops: Ops = {
    display: {
      type: OpType.builtIn,
      name: 'display',
      fn: term => {
        console.log(display(term));
        return {
          functor: P.internalNil,
          children: [],
        };
      },
    },
    print: {
      type: OpType.builtIn,
      name: 'print',
      fn: (...terms) => {
        for (const term of terms) {
          console.log(print(term));
        }
        return {
          functor: P.internalNil,
          children: [],
        };
      },
    },
  };

  for (const item of items) {
    switch (item.type) {
      case P.ItemType.fn: {
        const { name, clauses } = item;
        ops[name] = {
          type: OpType.fn,
          name,
          clauses,
        };
        break;
      }

      case P.ItemType.let: {
        const { pattern, term } = item;
        const value = evalTerm(term, env, ops);
        const s = match(pattern, value, {});
        if (s !== null) {
          env.define(s);
        } else {
          throw new Error('pattern match failure');
        }
        break;
      }

      case P.ItemType.term: {
        const { term } = item;
        evalTerm(term, env, ops);
        break;
      }
    }
  }
}

function evalTerm(term: P.Term, env: Env, ops: Ops): Value {
  switch (term.type) {
    case P.TermType.tree: {
      const { functor, children } = term;

      return {
        functor,
        children: children.map(child => evalTerm(child, env, ops)),
      };
    }

    case P.TermType.var: {
      const { text } = term;
      return env.lookup(text);
    }

    case P.TermType.app: {
      const { opName, rands } = term;

      const args = rands.map(rand => evalTerm(rand, env, ops));
      if (!(opName in ops)) {
        throw new Error(`undefined op: "${opName}"`);
      }
      const op = ops[opName];

      return applyOp(op, args, env, ops);
    }

    case P.TermType.match: {
      const { terms, clauses } = term;

      const args = terms.map(term => evalTerm(term, env, ops));
      for (const clause of clauses) {
        const { patterns, body } = clause;
        const s = matchAll(patterns, args, {});
        if (s) {
          return evalTerm(body, env.extend(s), ops);
        }
      }

      throw new Error('pattern match failure');
    }
  }
}

function matchAll(pats: P.Pattern[], values: Value[], s: Subst): Subst | null {
  return zip(pats, values).reduce((s, [pat, term]) => {
    if (s === null) {
      return null;
    } else {
      return match(pat, term, s);
    }
  }, s as Subst | null);
}

function match(pat: P.Pattern, value: Value, s: Subst): Subst | null {
  switch (pat.type) {
    case P.PatternType.tree: {
      if (
        pat.functor === value.functor &&
        pat.children.length === value.children.length
      ) {
        return matchAll(pat.children, value.children, s);
      } else {
        return null;
      }
    }

    case P.PatternType.var: {
      const { text } = pat;
      if (text in s) {
        return eqValues(value, s[text]) ? s : null;
      } else {
        return { ...s, [text]: value };
      }
    }

    case P.PatternType.wildcard: {
      return s;
    }

    case P.PatternType.as: {
      const { name, pattern } = pat;
      const s1 = match(pattern, value, s);
      if (s1) {
        const v = { type: P.PatternType.var as const, text: name };
        return match(v, value, s1);
      } else {
        return null;
      }
    }
  }
}

function eqValues(t: Value, u: Value): boolean {
  return (
    t.functor === u.functor &&
    zip(t.children, u.children).every(([t, u]) => eqValues(t, u))
  );
}

function applyOp(op: Op, args: Value[], env: Env, ops: Ops): Value {
  switch (op.type) {
    case OpType.builtIn:
      return op.fn(...args);

    case OpType.fn: {
      for (const clause of op.clauses) {
        const { patterns, body } = clause;
        const s = matchAll(patterns, args, {});

        if (s) {
          return evalTerm(body, env.extend(s), ops);
        }
      }

      throw new Error(`pattern match failure: ${op.name}`);
    }
  }
}
