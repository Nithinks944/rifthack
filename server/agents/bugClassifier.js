const bugTypes = [
  'LINTING',
  'SYNTAX',
  'LOGIC',
  'TYPE_ERROR',
  'IMPORT',
  'INDENTATION'
];

function detectType(line) {
  const input = line.toLowerCase();
  if (input.includes('eslint') || input.includes('lint')) return 'LINTING';
  if (input.includes('syntaxerror') || input.includes('unexpected token')) return 'SYNTAX';
  if (input.includes('typeerror') || input.includes('ts')) return 'TYPE_ERROR';
  if (input.includes('cannot find module') || input.includes('module not found')) return 'IMPORT';
  if (input.includes('indent')) return 'INDENTATION';
  return 'LOGIC';
}

function parseLocation(line) {
  // Python style: File "path/to/file.py", line 42
  const pyMatch = line.match(/File "(.+?)", line (\d+)/);
  if (pyMatch) return { file: pyMatch[1], line: Number(pyMatch[2]) };

  // TypeScript style: path/to/file.ts(42,5)
  const tsMatch = line.match(/(.+?)\((\d+),/);
  if (tsMatch) return { file: tsMatch[1], line: Number(tsMatch[2]) };

  // Standard style: path/to/file.js:42:5
  const match = line.match(/([\w./-]+):(\d+)(?::\d+)?/);
  if (!match) return { file: 'unknown', line: null };
  return { file: match[1], line: Number(match[2]) };
}

export function classifyBugs(logs) {
  const lines = String(logs || '').split('\n').filter(Boolean);
  const issues = [];

  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (!/(error|failed|warning|exception|cannot)/.test(normalized)) continue;

    const bugType = detectType(line);
    if (!bugTypes.includes(bugType)) continue;

    const location = parseLocation(line);
    issues.push({
      file: location.file,
      line: location.line,
      bugType,
      status: 'OPEN',
      detail: line.trim()
    });
  }

  if (issues.length === 0) {
    return [
      {
        file: 'pipeline',
        line: null,
        bugType: 'LOGIC',
        status: 'OPEN',
        detail: 'No explicit parser match found, but test command failed.'
      }
    ];
  }

  return issues.slice(0, 30);
}
