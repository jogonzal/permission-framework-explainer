type CodeBlockProps = {
  filename?: string;
  children: string;
};

export function CodeBlock({ filename, children }: CodeBlockProps) {
  return (
    <figure className="code-block">
      {filename ? <figcaption>{filename}</figcaption> : null}
      <pre>
        <code>{children.trimEnd()}</code>
      </pre>
    </figure>
  );
}
