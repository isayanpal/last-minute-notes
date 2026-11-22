import { defineLesson } from '../define';
import type { ArrayState } from '../engines/array';
import type { ItemState } from '../engines/common';

/*
 * Follows the Computer Fundamentals notes on compiler phases with the notes' own statement: total = price * 2;
 * A real tiny lexer, recursive-descent parser, type checker, IR generator, peephole optimiser (fmul x, 2.0 becomes fadd x, x)
 * and code generator produce every line shown, so the pipeline is executed, not drawn.
 */

type Tok = { kind: string; text: string };
const lex = (src: string): Tok[] => {
  const out: Tok[] = [];
  const re = /\s*(?:([A-Za-z_]\w*)|(\d+)|(=)|(\*)|(;))/y;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1]) out.push({ kind: 'IDENT', text: m[1] });
    else if (m[2]) out.push({ kind: 'INT', text: m[2] });
    else if (m[3]) out.push({ kind: 'EQ', text: '=' });
    else if (m[4]) out.push({ kind: 'STAR', text: '*' });
    else out.push({ kind: 'SEMI', text: ';' });
    if (re.lastIndex >= src.length) break;
  }
  return out;
};

type Node = { type: 'Assign'; target: string; value: Node } | { type: 'Mul'; left: Node; right: Node } | { type: 'Ident'; name: string } | { type: 'Int'; value: number };
const parse = (toks: Tok[]): Node => {
  let i = 0;
  const expect = (k: string) => {
    if (toks[i]?.kind !== k) throw new Error(`expected ${k}`);
    return toks[i++];
  };
  const factor = (): Node => (toks[i].kind === 'INT' ? { type: 'Int', value: Number(toks[i++].text) } : { type: 'Ident', name: expect('IDENT').text });
  const term = (): Node => {
    let left = factor();
    while (toks[i]?.kind === 'STAR') {
      i++;
      left = { type: 'Mul', left, right: factor() };
    }
    return left;
  };
  const target = expect('IDENT').text;
  expect('EQ');
  const value = term();
  expect('SEMI');
  return { type: 'Assign', target, value };
};
const show = (n: Node, depth = 0): string[] => {
  const pad = '  '.repeat(depth);
  if (n.type === 'Assign') return [`${pad}Assign`, `${pad}  ${n.target}`, ...show(n.value, depth + 1)];
  if (n.type === 'Mul') return [`${pad}Mul`, ...show(n.left, depth + 1), ...show(n.right, depth + 1)];
  return [`${pad}${n.type === 'Ident' ? n.name : n.value}`];
};

const SOURCE = 'total = price * 2;';
const TOKENS = lex(SOURCE);
const AST = parse(TOKENS);
const SYMBOLS: Record<string, string> = { price: 'double', total: 'double' };
const typeOf = (n: Node): string => (n.type === 'Assign' ? typeOf(n.value) : n.type === 'Ident' ? SYMBOLS[n.name] : n.type === 'Int' ? 'int' : typeOf(n.left) === 'double' || typeOf(n.right) === 'double' ? 'double' : 'int');
const ROOT_TYPE = typeOf((AST as Extract<Node, { type: 'Assign' }>).value);
const CONVERTED = (AST as Extract<Node, { type: 'Assign' }>).value.type === 'Mul' && ROOT_TYPE === 'double';

type Ir = { op: string; a: string; b: string };
const toIr = (n: Node): Ir => {
  const mul = (n as Extract<Node, { type: 'Assign' }>).value as Extract<Node, { type: 'Mul' }>;
  const name = (x: Node) => (x.type === 'Ident' ? x.name : `${(x as Extract<Node, { type: 'Int' }>).value}.0`); // int constant converted to double
  return { op: 'fmul', a: name(mul.left), b: name(mul.right) };
};
const IR = toIr(AST);
const optimise = (ir: Ir): Ir => (ir.op === 'fmul' && ir.b === '2.0' ? { op: 'fadd', a: ir.a, b: ir.a } : ir); // x * 2 = x + x
const OPT = optimise(IR);
const fmt = (ir: Ir) => `${ir.op} ${ir.a},${ir.b}`;
const codegen = (ir: Ir) => (ir.op === 'fadd' && ir.a === ir.b ? 'addsd xmm0, xmm0' : 'mulsd xmm0, xmm1');
const ASM = codegen(OPT);

const PHASES = ['lex', 'parse', 'sem', 'IR', 'opt', 'gen'];
const paint = (n: number, f: (k: number) => ItemState): Record<number, ItemState> => Object.fromEntries(Array.from({ length: n }, (_, k) => [k, f(k)])) as Record<number, ItemState>;

const view = (phase: number, panels: ArrayState['panels'], note: ArrayState['note'], stats: ArrayState['stats']): ArrayState => ({
  rows: [{ label: 'phase', cells: PHASES, states: paint(6, (i) => (i === phase ? 'active' : i < phase ? 'done' : 'normal')), showIndex: false }],
  panels,
  stats,
  note,
});

export default defineLesson('array', {
  slug: 'cf-compiler-phases',
  objectives: [
    { text: 'What each compiler phase takes in and gives out', step: 1 },
    { text: 'How a lexer and parser build a tree', step: 2 },
    { text: 'What semantic analysis checks', step: 3 },
    { text: 'How the optimiser rewrites the IR', step: 4 },
  ],
  steps: [
    {
      label: 'Phases',
      title: 'Six steps from text to code',
      tag: 'problem',
      body: ['A compiler turns `total = price * 2;` into machine code in phases: lexing, parsing, semantic analysis, IR generation, optimisation and code generation.', 'The front end is language specific, the back end is target specific.'],
      keyIdea: 'LLVM lets many front ends share one optimiser and many back ends.',
      frames: [{ state: view(-1, [{ title: 'source', kind: 'list', items: [SOURCE] }], { text: 'each phase consumes the output of the previous one', tone: 'accent' }, [{ label: 'Front end', value: 'lex to sem' }, { label: 'Middle', value: 'IR, opt' }, { label: 'Back end', value: 'gen' }]), hold: 4200 }],
    },
    {
      label: 'Lex, parse',
      title: 'Tokens, then a tree',
      tag: 'concept',
      body: ['The **lexer** turns characters into tokens. The **parser** follows the grammar and builds an abstract syntax tree.', 'Here the tree is `Assign(total, Mul(price, 2))`.'],
      keyIdea: 'Most hand-written compilers use recursive descent (LL) parsing.',
      frames: [{ state: view(0, [{ title: 'tokens', kind: 'list', items: TOKENS.map((t) => (t.kind === 'IDENT' || t.kind === 'INT' ? `${t.kind}(${t.text})` : t.kind)) }], { text: `${TOKENS.length} tokens from ${SOURCE.length} characters`, tone: 'accent' }, [{ label: 'Input', value: `${SOURCE.length} chars` }, { label: 'Tokens', value: String(TOKENS.length), tone: 'ok' }, { label: 'Catches', value: 'bad characters' }]), hold: 3800 }, { state: view(1, [{ title: 'AST', kind: 'list', items: show(AST) }], { text: 'the tree makes the structure explicit: the multiplication happens before the assignment', tone: 'ok' }, [{ label: 'Nodes', value: String(show(AST).length) }, { label: 'Root', value: 'Assign' }, { label: 'Catches', value: 'syntax errors' }]), hold: 4200 }],
    },
    {
      label: 'Semantics',
      title: 'Names and types',
      tag: 'technique',
      body: ['Semantic analysis checks that names are declared and types fit. `price` is a `double`, so the integer `2` is converted to `2.0`.', 'A type mismatch or an undefined variable is reported here.'],
      keyIdea: 'Errors come from different phases: lexical, syntax, semantic.',
      frames: [{ state: view(2, [{ title: 'symbol table', kind: 'list', items: Object.entries(SYMBOLS).map(([k, v]) => `${k}: ${v}`) }, { title: 'conversions', kind: 'list', items: [CONVERTED ? '2 -> 2.0 (double)' : 'none'] }], { text: `the product has type ${ROOT_TYPE}, so the constant is widened`, tone: 'ok' }, [{ label: 'price', value: SYMBOLS.price }, { label: 'Expression', value: ROOT_TYPE, tone: 'ok' }, { label: 'Conversion', value: 'int to double' }]), hold: 4400 }],
    },
    {
      label: 'Optimise',
      title: 'Rewrite the IR',
      tag: 'in practice',
      body: ['The IR is language independent. The optimiser runs many passes, and one rewrites `fmul x, 2.0` as `fadd x, x`.', 'Code generation then picks an instruction: `addsd xmm0, xmm0`.'],
      keyIdea: 'Multiplying by 2 and adding a value to itself are the same, and the add is cheaper.',
      frames: [{ state: view(3, [{ title: 'IR', kind: 'list', items: [fmt(IR)] }], { text: 'IR generation: a floating-point multiply by the converted constant', tone: 'accent' }, [{ label: 'Op', value: IR.op }, { label: 'Operands', value: `${IR.a}, ${IR.b}` }, { label: 'Style', value: 'SSA' }]), hold: 3000 }, { state: view(4, [{ title: 'IR before', kind: 'list', items: [fmt(IR)] }, { title: 'IR after', kind: 'list', items: [fmt(OPT)] }], { text: `${fmt(IR)} became ${fmt(OPT)}`, tone: 'ok' }, [{ label: 'Rewrite', value: 'x*2 to x+x', tone: 'ok' }, { label: 'Before', value: IR.op }, { label: 'After', value: OPT.op, tone: 'ok' }]), hold: 4400 }, { state: view(5, [{ title: 'assembly', kind: 'list', items: [ASM] }], { text: `code generation chooses ${ASM}`, tone: 'ok' }, [{ label: 'Target', value: 'x86-64' }, { label: 'Instruction', value: 'addsd' }, { label: 'Register', value: 'xmm0' }]), hold: 4200 }],
    },
    {
      label: 'Recap',
      title: 'Compiler phases',
      tag: 'recap',
      body: [
        '- **Lex:** characters to tokens.',
        '- **Parse:** tokens to a syntax tree.',
        '- **Semantic analysis:** names, types, conversions.',
        '- **IR and optimise:** portable form, many rewrites.',
        '- **Code generation:** instructions and registers.',
      ],
      keyIdea: 'SSA gives every variable exactly one assignment, which simplifies optimisation.',
      frames: [{ state: view(5, [{ title: 'assembly', kind: 'list', items: [ASM] }], { text: 'six phases turned one line of source into one instruction', tone: 'accent' }, [{ label: 'Source', value: '1 line' }, { label: 'Phases', value: '6' }, { label: 'Output', value: ASM.split(' ')[0], tone: 'ok' }]) }],
    },
  ],
});
