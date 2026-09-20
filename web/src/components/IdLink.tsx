import { Link } from 'react-router-dom';

type IdLinkProps = {
  to: string;
  children: string;
};

export function IdLink({ to, children }: IdLinkProps) {
  return (
    <Link className="chip" to={to}>
      {children}
    </Link>
  );
}
