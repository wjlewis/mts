import Lexer from './Lexer';
import { parseProgram } from './parse';
import { lowerProgram } from './lower';
import { checkProgram } from './check';
import interpret from './interpret';

const source = String.raw`
let in(x, []) = F;
let in(x, x:_) = T;
let in(x, _:xs) = in(x, xs);

let plus(Zero, n) = n;
let plus(Suc(p), n) = Suc(plus(p, n));

let times(Zero, _) = Zero;
let times(Suc(p), n) = plus(n, times(p, n));

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

let to_nat('0') = n_0;
let to_nat('1') = n_1;
let to_nat('2') = n_2;
let to_nat('3') = n_3;
let to_nat('4') = n_4;
let to_nat('5') = n_5;
let to_nat('6') = n_6;
let to_nat('7') = n_7;
let to_nat('8') = n_8;
let to_nat('9') = n_9;

let digits = "0123456789";

let parse_nat("", n) = n;
let parse_nat(rest@(c:cs), n) = match in(c, digits) {
  T => parse_nat(cs, plus(to_nat(c), times(n_10, n))),
  _ => ParseResult(n, rest),
};

print(parse_nat("12", Zero));
`;

const lowered = lowerProgram(parseProgram(new Lexer(source)));

checkProgram(lowered);

interpret(lowered);
