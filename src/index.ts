import Lexer from './Lexer';
import { parsePattern, parseProgram, parseTerm } from './parse';

const source = String.raw`
let _quux = 't':'e':'s':'t':[];
`;

console.log(JSON.stringify(parseProgram(new Lexer(source)), null, 2));
