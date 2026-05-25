"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchText?: string; // Custom text for searching (e.g., owner name)
}

interface SearchableSelectProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  error?: string;
  disabled?: boolean;
  maxHeight?: string;
  inputTestId?: string;
  optionTestId?: string;
}

export function SearchableSelect({
  label,
  placeholder = "Suchen...",
  value,
  onChange,
  options,
  error,
  disabled = false,
  maxHeight = "300px",
  inputTestId,
  optionTestId,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter options based on search
  const filteredOptions = options.filter((opt) => {
    const searchStr = search.toLowerCase();
    const label = opt.label.toLowerCase();
    const searchText = (opt.searchText ?? "").toLowerCase();
    return label.includes(searchStr) || searchText.includes(searchStr);
  });

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => (i < filteredOptions.length - 1 ? i + 1 : i));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => (i > 0 ? i - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(0);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-fg)" }}>
        {label}
      </label>

      <div
        className="relative"
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: error ? "#dc2626" : isOpen ? "var(--color-accent)" : "var(--color-border)",
            color: "var(--color-fg)",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Search size={16} style={{ color: "var(--color-muted)" }} />
          {!isOpen && selectedOption ? (
            <span className="flex-1 text-sm font-medium" style={{ color: "var(--color-fg)" }}>
              {selectedOption.label}
            </span>
          ) : (
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={isOpen ? search : ""}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => !disabled && setIsOpen(true)}
              onClick={(e) => e.stopPropagation()}
              disabled={disabled}
              className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-50"
              style={{ color: "var(--color-fg)" }}
              data-testid={inputTestId}
            />
          )}
          {value && !isOpen && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:opacity-70 transition"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-lg z-50 overflow-y-auto"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            maxHeight,
          }}
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2.5 text-sm" style={{ color: "var(--color-muted)" }}>
              Keine Ergebnisse gefunden
            </li>
          ) : (
            filteredOptions.map((opt, idx) => (
              <li
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className="px-3 py-2.5 text-sm cursor-pointer transition-colors"
                data-testid={optionTestId}
                style={{
                  backgroundColor: idx === highlightedIndex ? "var(--color-bg)" : "transparent",
                  color: idx === highlightedIndex ? "var(--color-fg)" : "var(--color-fg)",
                }}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}

      {error && <p className="text-xs mt-1" style={{ color: "#dc2626" }}>{error}</p>}
    </div>
  );
}
