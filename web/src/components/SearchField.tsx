type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
  return (
    <input
      className="search"
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
