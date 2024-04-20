TypeScript's type system contains within in a beautiful little pattern-matching
language.
A language that's Turing complete, as it turns out.
`mts` is a language based on this language-inside-a-type-system.
It's main feature is an evaluator and a compiler that generates equivalent
TypeScript _types_.

- Data is uppercased.
- Rules are lowercased.
- Variables are lowercased.
  -> No ambiguity?
- Special characters can't be used as variables -> they're literal atoms.

## Desugaring

### Definitions

All definitions for the same name must have the same number of parameters.
First step is to transform a set of definitions into a single definition
containing a `match` term:

```rust
let plus(Zero, n) = n;
let plus(Suc(p), n) = Suc(plus(p, n));

// =>

let plus(_X, _Y) = match _X, _Y {
  Zero, n => n,
  Suc(p), n => Suc(plus(p, n)),
}
```

### Lists and Strings

Lists and strings are just sugar over `[]` and `(:)`.

```rust
[One, Two, three]
// =>
One:Two:three:[]

"testing"
// =>
't':'e':'s':'t':'i':'n':'g':[]
```

After this stage we should no longer have any `list` or `string` terms, only
conses and `[]`.

## Validation

- All variables are bound (including "operators").
- Match clauses have the correct number of patterns.

## Evaluation

### Patterns

A _pattern_ is compared to a _term_.
We need to determine:

- Does the term match the pattern?
- If so, what does the pattern bind?

```rust
// Trees.
let pmatch(TreePattern(text1, cs1), Tree(text2, cs2)) = match text1 {
  text2 => pmatch_all(cs1, cs2),
  _ => Fail,
};

// Wilcards.
let pmatch(WildcardPattern, _) = Success([]);

// Variables.
let pmatch(VarPattern(v), t) = Success([Bind(v, t)]);

// As.
let pmatch(AsPattern(v, pat), t) = match pmatch(pat, t) {
  // Add a binding for `v` with the entire term `t`.
  Success(bs) => Success(Bind(v, t) : bs),
  Fail => Fail,
}

// Cons/Nil.
let pmatch(ConsPattern(head, tail), ConsTerm(thead, ttail))
  = match pmatch(head, thead) {
    // ...
}

// Default.
let pmatch(_, _) => Fail

// Match all.
let pmatch_all([], []) = [];
let pmatch_all(p:ps, q:qs) = match pmatch(p, q) {
  Success(bs1) => match pmatch_all(ps, qs) {
    Success(bs2) => Success(append(bs1, bs2)),
    Fail => Fail,
  },
  Fail => Fail,
};
let pmatch_all(_, _) = Fail;

let append([], ys) = ys;
let append(x:xs, ys) = x : append(xs, ys);
```

## Compilation

## Terms

- Atoms, like `Zero`, `Nil`, `F`, etc.
- Compound terms, like `Suc(Suc(Zero))` or `ParseResult(Cons(Sym(quote), Cons(Sym(foo), Nil)))`.
- Atoms must begin with a character or be quoted.

```rust
// foo() === foo
let foo = Suc(Zero)
let foo() = Suc(Zero)
```

```rust
let plus(Zero, n) = n;
let plus(Suc(p), n) = Suc(plus(p, n));

let times(Zero, _) = zero;
let times(Suc(p), n) = plus(n, times(p, n));

let n_1 = Suc(Zero);
let n_2 = Suc(n_1);
let n_3 = Suc(n_2);
let n_4 = Suc(n_3);
let n_5 = Suc(n_4);
let n_6 = Suc(n_5);
let n_7 = Suc(n_6);
let n_8 = Suc(n_7);
let n_9 = Suc(n_8);
let n_10 = Suc(n_9);

let digit_to_nat('0') = Zero;
let digit_to_nat('1') = n_1;
let digit_to_nat('2') = n_2;
let digit_to_nat('3') = n_3;
let digit_to_nat('4') = n_4;
let digit_to_nat('5') = n_5;
let digit_to_nat('6') = n_6;
let digit_to_nat('7') = n_7;
let digit_to_nat('8') = n_8;
let digit_to_nat('9') = n_9;

let sym_chars = "abcdefghijklmnopqrstuvwxyz";
let starts_sym(c) = is_char_in(c, sym_chars);

let is_char_in(c, []) = F;
let is_char_in(c, c:_) = T;
let is_char_in(c, _:cs) = is_char_in(cs);

let digits = "0123456789";
let is_digit(c) = is_char_in(c, Digits);

let parse('#':rest) = parse_bool(rest);
let parse('(':rest) = parse_compound(rest);
let parse('\'':rest) = parse_quoted(rest);
let parse(src@(c:_)) = match is_digit(c) {
  T => parse_nat(src),
  _ => match starts_sym(c) {
    T => parse_sym(src),
  }
};

let parse_nat(src) = _parse_nat(src, Zero);
let _parse_nat(c:cs, n) = match c {
  digits => _parse_nat(cs, plus(digit_to_nat(c), times(N_10, n))),
  _ => parse_result(n, c:cs),
};

let parse_sym(c:cs) = match c {
  sym_follows => match parse_sym(cs) {
    parse_result(text, cs) => parse_result(c:text, cs),
  },
  _ => parse_result('', c:cs)
};

let parse_compound(')':rest) = parse_result(Nil, rest);
let parse_compound(rest) = match parse_expr(rest) {
  parse_result(car, rest) => match parse_compound(rest) {
    parse_result(cdr, rest) => parse_result(Cons(car, cdr), rest),
  },
};

let parse_quoted(rest) = match parse_expr(rest) {
  parse_result(expr, rest) => parse_result(
    // (quote expr)
    Cons(Sym(Quote), Cons(expr, Nil)),
    rest,
  ),
};

// Evaluation.
```

Compile mts -> TypeScript's _type system_.

```shell
$ node mtsc -o out.ts lisp.mts
# out.ts contains no data declarations, only types!
```

## Circular Definitions?

```rust
// Disallow this:
Inf = 0 | Inf
```

## `@` Patterns ("As Patterns")

Stolen from Haskell.
This happens often enough:

```rust
parse(c:rest) = match c {
  digits => parse_nat(c:rest),
  sym_starts => parse_sym(c:rest),
};
```

What about this instead?

```rust
parse(src@(c:_)) = match c {
  digits => parse_nat(src),
  sym_starts => parse_sym(src),
};
```

## Guards?

Do we need these?
Here's an annoying example:

```rust
parse('#':rest) = parse_bool(rest);
parse('(':rest) = parse_compound(rest);
parse('\'':rest) = parse_quoted(rest);
// We need to add a match here.
parse(c:rest) = match c {
  digits => parse_nat(c:rest),
  sym_starts => parse_sym(c:rest),
};
```

What if we could write:

```rust
parse(c:rest) where c in digits = parse_nat(c:rest);
parse(c:rest) where c in sym_starts = parse_sym(c:rest);
```

Doesn't seem _that_ much better (if at all).
