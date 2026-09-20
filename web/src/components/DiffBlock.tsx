import { Link } from 'react-router-dom';

type DiffBlockProps = {
  filename?: string;
  filenameTo?: string;
  children: string;
};

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'diff-line diff-line-file';
  if (line.startsWith('@@')) return 'diff-line diff-line-hunk';
  if (line.startsWith('+')) return 'diff-line diff-line-add';
  if (line.startsWith('-')) return 'diff-line diff-line-del';
  return 'diff-line';
}

function FileName({ name, to }: { name: string; to?: string }) {
  if (!to) return name;
  return <Link to={to}>{name}</Link>;
}

export function DiffBlock({ filename, filenameTo, children }: DiffBlockProps) {
  const lines = children.replace(/\s+$/, '').split('\n');
  return (
    <figure className="code-block diff-block">
      {filename ? (
        <figcaption>
          <FileName name={filename} to={filenameTo} />
        </figcaption>
      ) : null}
      <pre>
        <code>
          {lines.map((line, index) => {
            if (filenameTo && (line.startsWith('+++ ') || line.startsWith('--- '))) {
              return (
                <span key={`${index}:${line}`} className={lineClass(line)}>
                  {line.slice(0, 4)}
                  <Link to={filenameTo}>{line.slice(4)}</Link>
                  {'\n'}
                </span>
              );
            }
            return (
              <span key={`${index}:${line}`} className={lineClass(line)}>
                {line}
                {'\n'}
              </span>
            );
          })}
        </code>
      </pre>
    </figure>
  );
}
