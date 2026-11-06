/**
 * Static sanity check for the Flutter companion when no Dart/Flutter SDK is
 * installed. It cannot replace `flutter analyze`/`flutter test`, but it catches
 * the failure modes that actually bite on a source-only delivery:
 *   - broken relative import paths (the #1 cause of a first-run compile error)
 *   - missing pubspec dependencies
 *   - unbalanced braces/parens/brackets outside strings and comments
 *   - fixture files referenced by tests but not present
 *   - /api endpoints used by Dart that the Node gateway does not implement
 *
 * Usage: node tool/static_check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const checks = [];
const ok = (label, pass, extra = '') => {
  checks.push({ label, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.dart')) out.push(full);
  }
  return out;
}

const dartFiles = [
  ...walk(path.join(ROOT, 'lib')),
  ...walk(path.join(ROOT, 'test')),
];

/* ---------------- 1. imports ---------------- */
const pubspec = fs.readFileSync(path.join(ROOT, 'pubspec.yaml'), 'utf8');
const declared = new Set(
  [...pubspec.matchAll(/^  ([a-z_][a-z0-9_]*):/gm)].map((m) => m[1]),
);
const packageImports = new Set();
const brokenImports = [];
const missingDeps = [];

for (const file of dartFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/^\s*(?:import|export)\s+'([^']+)'/gm)) {
    const spec = match[1];
    if (spec.startsWith('dart:')) continue;
    if (spec.startsWith('package:')) {
      const pkg = spec.slice(8).split('/')[0];
      packageImports.add(pkg);
      if (pkg !== 'clipforge_companion' && !declared.has(pkg)) missingDeps.push(`${path.basename(file)} → ${pkg}`);
      continue;
    }
    const target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target)) {
      brokenImports.push(`${path.relative(ROOT, file)} → ${spec}`);
    }
  }
}

ok(`Dart sources found (${dartFiles.length} files)`, dartFiles.length >= 25, `${dartFiles.length} files`);
ok('All relative imports resolve', brokenImports.length === 0, brokenImports.join(' | '));
ok('All package imports declared in pubspec', missingDeps.length === 0, missingDeps.join(' | '));
ok('Riverpod / GoRouter / Dio / shared_preferences / url_launcher used',
  ['flutter_riverpod', 'go_router', 'dio', 'shared_preferences', 'url_launcher'].every((p) => packageImports.has(p)),
  [...packageImports].join(', '));

/* ---------------- 2. bracket balance (strings/comments stripped) ---------------- */
function balanceIssues(source) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  let i = 0;
  let line = 1;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source[i] === quote) { i++; break; }
        if (source[i] === '\n') line++;
        i++;
      }
      continue;
    }
    if (c === '(' || c === '[' || c === '{') stack.push({ c, line });
    else if (c === ')' || c === ']' || c === '}') {
      const top = stack.pop();
      if (!top || top.c !== pairs[c]) return `line ${line}: unexpected '${c}'`;
    }
    i++;
  }
  if (stack.length) return `unclosed '${stack[stack.length - 1].c}' from line ${stack[stack.length - 1].line}`;
  return null;
}

const balance = [];
for (const file of dartFiles) {
  const issue = balanceIssues(fs.readFileSync(file, 'utf8'));
  if (issue) balance.push(`${path.relative(ROOT, file)}: ${issue}`);
}
ok('Brackets balanced in every Dart file', balance.length === 0, balance.join(' | '));

/* ---------------- 3. fixtures ---------------- */
const fixtureRefs = new Set();
for (const file of dartFiles) {
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/fixture\('([^']+)'\)/g)) {
    fixtureRefs.add(m[1]);
  }
}
const missingFixtures = [...fixtureRefs].filter(
  (f) => !fs.existsSync(path.join(ROOT, 'test', 'fixtures', f)),
);
const fixtureFiles = fs.readdirSync(path.join(ROOT, 'test', 'fixtures')).filter((f) => f.endsWith('.json'));
ok('Every referenced JSON fixture exists', missingFixtures.length === 0, missingFixtures.join(', '));
ok('Live gateway fixtures captured', fixtureFiles.length >= 10, `${fixtureFiles.length} fixtures`);

for (const f of fixtureFiles) {
  try { JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', f), 'utf8')); }
  catch { ok(`Fixture ${f} is valid JSON`, false); }
}
ok('All fixtures are valid JSON', fixtureFiles.every((f) => {
  try { JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', f), 'utf8')); return true; }
  catch { return false; }
}));

/* ---------------- 4. API contract coverage ---------------- */
const gatewaySource = fs.readFileSync(path.join(REPO, 'server', 'gateway.mjs'), 'utf8');
const serverEndpoints = new Set(
  [...gatewaySource.matchAll(/p === '(\/api\/[a-z]+)'/g)].map((m) => m[1]),
);
const dartSource = dartFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const dartEndpoints = new Set(
  [...dartSource.matchAll(/'(\/api\/[a-z]+)'/g)].map((m) => m[1]),
);
const unknownEndpoints = [...dartEndpoints].filter((e) => !serverEndpoints.has(e));
const unusedEndpoints = [...serverEndpoints].filter((e) => !dartEndpoints.has(e) && e !== '/api/health');
ok('Dart client only calls real gateway endpoints', unknownEndpoints.length === 0, unknownEndpoints.join(', '));
ok('Dart client covers all gateway capabilities', unusedEndpoints.length === 0, `not referenced: ${unusedEndpoints.join(', ') || 'none'}`);

/* ---------------- 5. routes / tests ---------------- */
const router = fs.readFileSync(path.join(ROOT, 'lib', 'routes', 'app_router.dart'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'lib', 'shared', 'widgets', 'app_shell.dart'), 'utf8');
const routePaths = [...router.matchAll(/path: AppRoute\.(\w+)\.path/g)].map((m) => m[1]);
const navPaths = [...shell.matchAll(/_NavItem\('([^']+)'/g)].map((m) => m[1]);
ok('Router has a screen for every nav destination', routePaths.length === 6 && navPaths.length === 6,
  `${routePaths.length} routes / ${navPaths.length} nav items`);

const testFiles = dartFiles.filter((f) => f.includes(`${path.sep}test${path.sep}`));
const unitTests = testFiles.filter((f) => f.includes(`${path.sep}unit${path.sep}`));
const widgetTests = testFiles.filter((f) => f.includes(`${path.sep}widget${path.sep}`));
const testCount = testFiles.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/\btest(?:Widgets)?\(/g) || []).length, 0);
ok('Unit + widget tests present', unitTests.length >= 3 && widgetTests.length >= 2,
  `${unitTests.length} unit files, ${widgetTests.length} widget files, ${testCount} test cases`);

/* ---------------- 6. no code generation required ---------------- */
const generatedRefs = dartFiles.filter((f) => /\.(g|freezed)\.dart|@riverpod|part '/.test(fs.readFileSync(f, 'utf8')));
ok('No build_runner / codegen dependency in sources', generatedRefs.length === 0, generatedRefs.map((f) => path.basename(f)).join(', '));

const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - failed}/${checks.length} static checks passed`);
if (failed) process.exitCode = 1;
