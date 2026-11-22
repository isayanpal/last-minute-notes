import { defineLesson } from '../define';
import type { FlowNode, FlowState, Packet } from '../engines/flow';

/*
 * Follows the Java notes on the platform: javac makes portable bytecode, the JVM loads and verifies it,
 * interprets it, and the JIT compiles hot methods to native code. JDK, JRE and JVM are nested layers.
 */

const hop = (from: string, to: string, label: string, delay: number, tone: Packet['tone'] = 'req'): Packet => ({ from, to, label, delay, tone, dur: 0.6 });

// Step 1: one bytecode file, a JVM per operating system.
const portable = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'src', label: 'Hello.java', sub: 'source', kind: 'client', x: 0.1, y: 1.7 },
    { id: 'jc', label: 'javac', sub: 'compiler', kind: 'worker', x: 1.8, y: 1.7, status: 'active' },
    { id: 'bc', label: 'Hello.class', sub: 'bytecode', kind: 'storage', x: 3.5, y: 1.7, status: phase === 1 ? 'active' : 'normal' },
    { id: 'l', label: 'JVM: Linux', kind: 'service', x: 5.4, y: 0.3, status: phase === 1 ? 'active' : 'dim' },
    { id: 'm', label: 'JVM: macOS', kind: 'service', x: 5.4, y: 1.7, status: phase === 1 ? 'active' : 'dim' },
    { id: 'w', label: 'JVM: Windows', kind: 'service', x: 5.4, y: 3.1, status: phase === 1 ? 'active' : 'dim' },
  ],
  links: [{ from: 'src', to: 'jc' }, { from: 'jc', to: 'bc' }, { from: 'bc', to: 'l', dashed: true }, { from: 'bc', to: 'm', dashed: true }, { from: 'bc', to: 'w', dashed: true }],
  packets: phase === 0 ? [hop('src', 'jc', 'source', 0, 'req'), hop('jc', 'bc', 'bytecode', 0.7, 'data')] : [hop('bc', 'l', '.class', 0, 'data'), hop('bc', 'm', '.class', 0.1, 'data'), hop('bc', 'w', '.class', 0.2, 'data')],
  stats: [
    { label: 'Compiled once', value: phase === 0 ? 'to bytecode' : 'done', tone: 'ok' },
    { label: 'Runs on', value: phase === 1 ? 'any OS' : '-', tone: phase === 1 ? 'ok' : 'neutral' },
    { label: 'Per OS', value: 'its own JVM' },
  ],
  note: phase === 0 ? { text: 'javac turns source into platform-independent bytecode', tone: 'accent' } : { text: 'the same .class file runs on every OS that has a JVM', tone: 'ok' },
});

// Step 2: the two commands.
const commands = (phase: 0 | 1): FlowState => ({
  nodes: [
    { id: 'src', label: 'Hello.java', sub: 'source', kind: 'client', x: 0.1, y: 1.7, status: phase === 0 ? 'active' : 'normal' },
    { id: 'jc', label: 'javac', sub: 'javac Hello.java', kind: 'worker', x: 1.9, y: 1.7, status: phase === 0 ? 'active' : 'normal' },
    { id: 'bc', label: 'Hello.class', sub: 'bytecode', kind: 'storage', x: 3.7, y: 1.7, status: 'normal' },
    { id: 'jvm', label: 'JVM', sub: 'java Hello', kind: 'service', x: 5.5, y: 1.7, status: phase === 1 ? 'active' : 'dim', items: phase === 1 ? ['main()'] : undefined },
  ],
  links: [{ from: 'src', to: 'jc' }, { from: 'jc', to: 'bc' }, { from: 'bc', to: 'jvm' }],
  packets: phase === 0 ? [hop('src', 'jc', 'source', 0, 'req'), hop('jc', 'bc', '.class', 0.7, 'data')] : [hop('bc', 'jvm', 'load', 0, 'data')],
  stats: [
    { label: 'Compile', value: 'javac' },
    { label: 'Run', value: 'java' },
    { label: 'Entry point', value: 'main', tone: 'ok' },
  ],
  note: phase === 0 ? { text: 'javac produces Hello.class, one file per class', tone: 'accent' } : { text: 'java loads the class and calls public static void main', tone: 'ok' },
});

// Step 3: interpret first, compile the hot method.
const runtime = (phase: 0 | 1 | 2): FlowState => ({
  nodes: [
    { id: 'bc', label: 'Hello.class', sub: 'bytecode', kind: 'storage', x: 0.1, y: 1.7 },
    { id: 'ld', label: 'Load, verify', sub: 'class loader', kind: 'gateway', x: 1.6, y: 1.7 },
    { id: 'in', label: 'Interpreter', sub: 'runs bytecode', kind: 'worker', x: 3.1, y: 1.7, status: phase === 2 ? 'normal' : 'active', items: phase >= 1 ? ['sum() hot'] : ['sum()'] },
    { id: 'jit', label: 'JIT compiler', sub: 'hot methods', kind: 'cache', x: 4.6, y: 1.7, status: phase === 0 ? 'dim' : 'active' },
    { id: 'nat', label: 'Native code', sub: 'machine code', kind: 'service', x: 6.0, y: 1.7, status: phase === 2 ? 'active' : 'dim', items: phase === 2 ? ['sum()'] : undefined },
  ],
  links: [{ from: 'bc', to: 'ld' }, { from: 'ld', to: 'in' }, { from: 'in', to: 'jit', label: 'hot' }, { from: 'jit', to: 'nat' }],
  packets: phase === 0 ? [hop('bc', 'ld', '.class', 0, 'data'), hop('ld', 'in', 'verified', 0.7, 'ok')] : phase === 1 ? [hop('in', 'jit', 'sum() hot', 0, 'bad')] : [hop('jit', 'nat', 'compiled', 0, 'ok')],
  stats: [
    { label: 'Start', value: 'interpret' },
    { label: 'sum()', value: phase === 0 ? 'cold' : phase === 1 ? 'hot' : 'native', tone: phase === 2 ? 'ok' : phase === 1 ? 'bad' : 'neutral' },
    { label: 'Speed', value: phase === 2 ? 'fast' : 'warming up', tone: phase === 2 ? 'ok' : 'neutral' },
  ],
  note: phase === 0 ? { text: 'the JVM starts by interpreting bytecode', tone: 'accent' } : phase === 1 ? { text: 'the JVM notices sum() is called often and sends it to the JIT', tone: 'accent' } : { text: 'hot code now runs as native machine code', tone: 'ok' },
});

// Step 4: JVM inside JRE inside JDK.
const layers = (phase: 0 | 1 | 2): FlowState => {
  const jvm: FlowNode[] = [
    { id: 'ld', label: 'Class loader', kind: 'gateway', x: 5.3, y: 0.3, status: 'active' },
    { id: 'jit', label: 'JIT compiler', kind: 'cache', x: 5.3, y: 1.6, status: 'active' },
    { id: 'gc', label: 'GC', sub: 'garbage collector', kind: 'worker', x: 5.3, y: 2.9, status: 'active' },
  ];
  const libs: FlowNode = { id: 'lib', label: 'Class libraries', sub: 'java.lang, java.util', kind: 'storage', x: 2.8, y: 1.6, status: phase >= 1 ? 'active' : 'dim' };
  const tools: FlowNode[] = [
    { id: 'jc', label: 'javac', kind: 'worker', x: 0.3, y: 0.6, status: phase === 2 ? 'active' : 'dim' },
    { id: 'jar', label: 'jar, jshell', kind: 'worker', x: 0.3, y: 2.6, status: phase === 2 ? 'active' : 'dim' },
  ];
  return {
    nodes: [...tools, libs, ...jvm],
    groups: [
      { label: 'JDK: tools', nodes: ['jc', 'jar'], tone: phase === 2 ? 'accent' : undefined },
      { label: 'JRE: libraries', nodes: ['lib'], tone: phase === 1 ? 'accent' : undefined },
      { label: 'JVM', nodes: ['ld', 'jit', 'gc'], tone: phase === 0 ? 'accent' : undefined },
    ],
    stats: [
      { label: 'JVM', value: 'runs bytecode', tone: phase === 0 ? 'ok' : 'neutral' },
      { label: 'JRE', value: 'JVM + libs', tone: phase === 1 ? 'ok' : 'neutral' },
      { label: 'JDK', value: 'JRE + tools', tone: phase === 2 ? 'ok' : 'neutral' },
    ],
    note: phase === 0 ? { text: 'the JVM loads, verifies and runs bytecode, with a JIT and a GC', tone: 'accent' } : phase === 1 ? { text: 'the JRE adds the standard class libraries needed to run programs', tone: 'accent' } : { text: 'the JDK adds developer tools such as javac, jar and jshell', tone: 'ok' },
  };
};

export default defineLesson('flow', {
  slug: 'java-jvm-flow',
  objectives: [
    { text: 'Why Java source compiles to portable bytecode', step: 1 },
    { text: 'What javac and java each do', step: 2 },
    { text: 'How the JVM interprets first and the JIT compiles hot code', step: 3 },
    { text: 'How JVM, JRE and JDK nest', step: 4 },
  ],
  steps: [
    {
      label: 'Portable',
      title: 'Write once, run anywhere',
      tag: 'problem',
      body: ['`javac` compiles source into **bytecode**, a `.class` file that is not tied to any CPU or OS.', 'Each operating system has its own JVM that executes that same bytecode.'],
      keyIdea: 'The bytecode is portable, the JVM is platform specific.',
      frames: [{ state: portable(0), hold: 2800 }, { state: portable(1), hold: 3400 }],
    },
    {
      label: 'Commands',
      title: 'javac, then java',
      tag: 'concept',
      body: ['`javac Hello.java` produces `Hello.class`. `java Hello` starts a JVM, loads the class and runs `main`.', 'Since Java 11, `java Hello.java` compiles in memory and runs a single file.'],
      keyIdea: 'The entry point is `public static void main(String[] args)`.',
      frames: [{ state: commands(0), hold: 2800 }, { state: commands(1), hold: 3200 }],
    },
    {
      label: 'JIT',
      title: 'Interpret first, compile the hot code',
      tag: 'technique',
      body: ['The JVM **interprets** bytecode at first. The **JIT compiler** watches for hot methods and compiles them to native machine code at runtime.', 'That is why Java is slower during warm-up and then very fast.'],
      keyIdea: 'Microbenchmarks need a warm-up phase, or they measure the interpreter.',
      frames: [{ state: runtime(0), hold: 2600 }, { state: runtime(1), hold: 2600 }, { state: runtime(2), hold: 3400 }],
    },
    {
      label: 'JDK/JRE/JVM',
      title: 'Three nested layers',
      tag: 'concept',
      body: ['The **JVM** loads, verifies and runs bytecode and includes the JIT and garbage collector.', 'The **JRE** is the JVM plus the class libraries. The **JDK** adds the developer tools. Since Java 11 you install a JDK.'],
      keyIdea: 'JDK contains JRE contains JVM.',
      frames: [{ state: layers(0), hold: 2800 }, { state: layers(1), hold: 2800 }, { state: layers(2), hold: 3400 }],
    },
    {
      label: 'Recap',
      title: 'From source to running code',
      tag: 'recap',
      body: [
        '- **javac:** source to portable bytecode.',
        '- **java:** a JVM loads, verifies and runs it.',
        '- **Interpreter then JIT:** hot methods become native code.',
        '- **JVM, JRE, JDK:** run, plus libraries, plus tools.',
        '- **Warm-up:** expect slower code at start.',
      ],
      keyIdea: 'Bytecode portability and the JIT are why Java is both portable and fast.',
      frames: [{ state: runtime(2) }],
    },
  ],
});
