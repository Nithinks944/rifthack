export function formatJudgeOutput(issue, fixDescription) {
  return `${issue.bugType} error in ${issue.file} line ${issue.line} → Fix: ${fixDescription}`;
}
