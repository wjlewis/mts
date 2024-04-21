import Lexer from './Lexer';
import { parseProgram } from './parse';
import { lowerProgram } from './lower';
import { checkProgram } from './check';
import interpret from './interpret';

const source = String.raw`
fn in(x, []) = F;
fn in(x, x:_) = T;
fn in(x, _:xs) = in(x, xs);

fn plus(Zero, n) = n;
fn plus(Suc(p), n) = Suc(plus(p, n));

fn times(Zero, _) = Zero;
fn times(Suc(p), n) = plus(n, times(p, n));

let n_0 = Zero;
let n_1 = Suc(n_0);
let n_2 = Suc(n_1);
let n_3 = Suc(n_2);
let n_4 = Suc(n_3);
let n_5 = Suc(n_4);
let n_6 = Suc(n_5);
let n_7 = Suc(n_6);
let n_8 = Suc(n_7);
let n_9 = Suc(n_8);
let n_10 = Suc(n_9);
 
fn to_nat('0') = n_0;
fn to_nat('1') = n_1;
fn to_nat('2') = n_2;
fn to_nat('3') = n_3;
fn to_nat('4') = n_4;
fn to_nat('5') = n_5;
fn to_nat('6') = n_6;
fn to_nat('7') = n_7;
fn to_nat('8') = n_8;
fn to_nat('9') = n_9;

let ws = " \t\n\r";
let digits = "0123456789";
let sym_starts = "abcdefghijklmnopqrstuvwxyz_+-*/^";

fn trim_to("") = "";
fn trim_to(src@(c:cs)) = match in(c, ws) {
  T => trim_to(cs),
  _ => src,
};

fn parse(src) = match parse_expr(trim_to(src)) {
  ParseResult(expr, "") => expr,
  _ => Fail,
};

fn parse_expr(src) = trim_after(_parse_expr(src));

fn trim_after(ParseResult(x, rest1)) = ParseResult(x, trim_to(rest1));
fn trim_after(x) = x;

fn _parse_expr("") = Fail;
fn _parse_expr(src@(c:cs)) = match in(c, digits) {
  T => parse_nat(src),
  _ => match in(c, sym_starts) {
    T => parse_sym(src),
    _ => match c {
      '(' => parse_parend(cs),
      '\'' => parse_quoted(cs),
    },
  },
};

fn parse_nat(src) = _parse_nat(src, Zero);
fn _parse_nat(rest@(c:cs), n) = match in(c, digits) {
  T => _parse_nat(cs, plus(to_nat(c), times(n_10, n))),
  _ => ParseResult(n, rest),
};

fn append([], ys) = ys;
fn append(x:xs, ys) = x:append(xs, ys);

let sym_follows = append(sym_starts, digits);

fn parse_sym("") = Fail;
fn parse_sym(c:cs) = match in(c, sym_follows) {
  T => match parse_sym(cs) {
    ParseResult(Sym(text), rest) => ParseResult(Sym(c:text), rest),
    Fail => ParseResult(Sym([c]), cs),
  },
  _ => Fail,
};

fn parse_parend("") = Fail;
fn parse_parend(')':rest) = ParseResult(Nil, rest);
fn parse_parend(src) = match parse_expr(src) {
  ParseResult(car, rest) => match parse_parend(rest) {
    ParseResult(cdr, rest) => ParseResult(Cons(car, cdr), rest),
    _ => Fail,
  },
  _ => Fail,
};

fn parse_quoted("") = Fail;
fn parse_quoted(rest) = Fail;

print(parse("(lambda (x) x)"));
`;

const lowered = lowerProgram(parseProgram(new Lexer(source)));

checkProgram(lowered);

interpret(lowered);
