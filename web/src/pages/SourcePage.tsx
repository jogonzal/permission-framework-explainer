import { Link, useParams } from 'react-router-dom';
import { CodeBlock } from '../components/CodeBlock';
import { useLoadedInstance } from '../instance';
import { sourcePath } from '../paths';

export function SourceList() {
  const { meta } = useLoadedInstance();
  return (
    <article>
      <header className="detail-head">
        <h1 className="page-title">YAML</h1>
        <p className="lede">The YAML that defines {meta.title}.</p>
      </header>
      {meta.files.map((file) => (
        <CodeBlock key={file.name} filename={file.name}>
          {file.text}
        </CodeBlock>
      ))}
    </article>
  );
}

export function SourceFile() {
  const params = useParams();
  const filename = params['*'] ?? '';
  const { meta } = useLoadedInstance();
  const file = meta.files.find((item) => item.name === filename);

  if (!file) {
    return (
      <article className="not-found">
        <h1>Source file not found</h1>
        <p className="muted">
          <code>{filename || '(empty)'}</code> is not part of {meta.title}.
        </p>
        <p>
          <Link to={sourcePath(meta.id)}>Back to YAML</Link>
        </p>
      </article>
    );
  }

  return (
    <article>
      <header className="detail-head">
        <p className="crumb">
          <Link to={sourcePath(meta.id)}>YAML</Link>
        </p>
        <h1>{file.name}</h1>
        <p className="lede">YAML source for {meta.title}.</p>
      </header>
      <CodeBlock filename={file.name}>{file.text}</CodeBlock>
    </article>
  );
}
