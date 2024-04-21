import * as P from './lower';

const builtIns = ['print'];

export function checkProgram(items: P.Item[]) {
  const defNames = items
    .filter<P.DefItem>(
      (item): item is P.DefItem => item.type === P.ItemType.def
    )
    .map(({ name }) => name);

  const bound = [...builtIns, ...defNames];

  for (const item of items) {
    switch (item.type) {
      case P.ItemType.def:
        checkDef(item, bound);
        break;
      case P.ItemType.term:
        checkTerm(item.term, bound);
        break;
    }
  }
}

function checkDef(def: P.DefItem, bound: string[]) {
  const { clauses } = def;
  checkMatchClauses(clauses, bound);
}

function checkTerm(term: P.Term, bound: string[]) {
  switch (term.type) {
    case P.TermType.tree: {
      return checkTerms(term.children, bound);
    }
    case P.TermType.var: {
      const { text } = term;
      if (!bound.includes(text)) {
        throw new Error(`unbound var: "${text}"`);
      }
      return;
    }
    case P.TermType.app: {
      const { opName, rands } = term;
      if (!bound.includes(opName)) {
        throw new Error(`unbound op: "${opName}"`);
      }
      return checkTerms(rands, bound);
    }
    case P.TermType.match: {
      const { terms, clauses } = term;
      checkTerms(terms, bound);
      checkMatchClauses(clauses, bound, terms.length);
      return;
    }
  }
}

function checkTerms(terms: P.Term[], bound: string[]) {
  for (const term of terms) {
    checkTerm(term, bound);
  }
}

function checkMatchClauses(
  clauses: P.MatchClause[],
  bound: string[],
  n?: number
) {
  const size = n ?? clauses[0]?.patterns.length;

  for (const clause of clauses) {
    const { patterns, body } = clause;

    if (patterns.length !== size) {
      throw new Error(`all clauses must have ${size} patterns`);
    }

    checkTerm(body, [...bound, ...patterns.flatMap(varsIn)]);
  }
}

function varsIn(pat: P.Pattern): string[] {
  switch (pat.type) {
    case P.PatternType.tree:
      return pat.children.flatMap(varsIn);
    case P.PatternType.var:
      return [pat.text];
    case P.PatternType.wildcard:
      return [];
    case P.PatternType.as:
      return [pat.name, ...varsIn(pat.pattern)];
  }
}
