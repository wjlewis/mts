import * as P from './lower';

export function checkProgram(items: P.Item[]) {
  for (const item of items) {
    switch (item.type) {
      case P.ItemType.fn:
        checkFn(item);
        break;
      case P.ItemType.let: {
        checkLet(item);
        break;
      }
      case P.ItemType.term:
        checkTerm(item.term);
        break;
    }
  }
}

function checkFn(fn: P.FnItem) {
  const { clauses } = fn;
  checkMatchClauses(clauses);
}

function checkLet(item: P.LetItem) {
  const { term } = item;
  checkTerm(term);
}

function checkTerm(term: P.Term) {
  switch (term.type) {
    case P.TermType.tree: {
      const { children } = term;
      return checkTerms(children);
    }

    case P.TermType.var: {
      return;
    }

    case P.TermType.app: {
      const { rands } = term;
      return checkTerms(rands);
    }

    case P.TermType.match: {
      const { terms, clauses } = term;
      checkTerms(terms);
      checkMatchClauses(clauses, terms.length);
      return;
    }
  }
}

function checkTerms(terms: P.Term[]) {
  for (const term of terms) {
    checkTerm(term);
  }
}

function checkMatchClauses(clauses: P.MatchClause[], n?: number) {
  const size = n ?? clauses[0]?.patterns.length;

  for (const clause of clauses) {
    const { patterns, body } = clause;

    if (patterns.length !== size) {
      throw new Error(`all clauses must have ${size} patterns`);
    }

    checkTerm(body);
  }
}
