import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type SiteHeaderProps = {
  children?: ReactNode;
};

export function SiteHeader({ children }: SiteHeaderProps) {
  return (
    <header className="app-header">
      <Link className="brand" to="/">
        <span className="brand-prompt">$</span>
        <span className="brand-name">PermCTL</span>
      </Link>
      {children}
    </header>
  );
}
