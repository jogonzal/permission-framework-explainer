import { IdLink } from './IdLink';

type ChipListProps = {
  items: readonly string[];
  to: (id: string) => string;
  empty?: string;
};

export function ChipList({ items, to, empty = 'None' }: ChipListProps) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="chip-list">
      {items.map((id) => (
        <li key={id}>
          <IdLink to={to(id)}>{id}</IdLink>
        </li>
      ))}
    </ul>
  );
}
