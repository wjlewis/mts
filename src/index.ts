import * as fs from 'fs/promises';
import Lexer from './Lexer';
import { parseProgram } from './parse';
import { lowerProgram } from './lower';
import { checkProgram } from './check';
import interpret from './interpret';

async function main() {
  const filename = process.argv[2];
  const source = await fs.readFile(filename, 'utf-8');

  const lowered = lowerProgram(parseProgram(new Lexer(source)));
  checkProgram(lowered);
  interpret(lowered);
}

main();
