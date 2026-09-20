type DiffBlockProps = {
  filename?: string;
  children: string;
};

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'diff-line diff-line-file';
  if (line.startsWith('@@')) return 'diff-line diff-line-hunk';
  if (line.startsWith('+')) return 'diff-line diff-line-add';
  if (line.startsWith('-')) return 'diff-line diff-line-del';
  return 'diff-line';
}

export function DiffBlock({ filename, children }: DiffBlockProps) {
  const lines = children.replace(/\s+$/, '').split('\n');
  return (
    <figure className="code-block diff-block">
      {filename ? <figcaption>{filename}</figcaption> : null}
      <pre>
        <code>
          {lines.map((line, index) => (
            <span key={`${index}:${line}`} className={lineClass(line)}>
              {line}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
