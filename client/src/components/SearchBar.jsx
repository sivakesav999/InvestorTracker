import { useRef } from "react";

export default function SearchBar({ value, onChange, onSearch, onClear, onAdd }) {
  const inputRef = useRef(null);
  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch();
    }

    if (event.key === "Escape") {
      onClear();
    }
  }

  return (
    <section className="toolbar">
      <div className="search-wrap">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search investor name, ID or phone..."
          autoComplete="off"
          aria-label="Search investor name, ID or phone"
        />

        <button
          className="search-clear"
          type="button"
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          title="Clear search"
          style={{ display: value.trim() ? "block" : "none" }}
        >
          ×
        </button>
      </div>

      <button className="btn" type="button" onClick={onSearch}>
        Search
      </button>

      <button className="btn primary" type="button" onClick={onAdd}>
        + Add Investor
      </button>
    </section>
  );
}
