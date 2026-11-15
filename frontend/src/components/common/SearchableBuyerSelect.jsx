import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, User } from 'lucide-react';
import { formatBalance } from '../../utils/formatters';

export default function SearchableBuyerSelect({
  buyers = [],
  value = '',
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Type to search customer...',
  autoFocus = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Find currently selected buyer
  const selectedBuyer = useMemo(() => {
    if (!value) return null;
    return buyers.find((b) => String(b._id) === String(value)) || null;
  }, [buyers, value]);

  // Sync search input display when buyer changes externally
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedBuyer?.name || '');
    }
  }, [selectedBuyer, isOpen]);

  // Case-insensitive, partial-match filtering across name, phone, and address
  const filteredBuyers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((b) => {
      const nameMatch = (b.name || '').toLowerCase().includes(q);
      const phoneMatch = (b.phone || '').toLowerCase().includes(q);
      const addrMatch = (b.address || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch || addrMatch;
    });
  }, [buyers, searchTerm]);

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredBuyers.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm(selectedBuyer?.name || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [selectedBuyer]);

  const handleSelect = (buyer) => {
    setIsOpen(false);
    setSearchTerm(buyer ? buyer.name : '');
    if (onChange) {
      onChange(buyer ? buyer._id : '', buyer || null);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSearchTerm('');
    if (onChange) {
      onChange('', null);
    }
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % (filteredBuyers.length || 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + filteredBuyers.length) % (filteredBuyers.length || 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredBuyers.length > 0 && filteredBuyers[highlightedIndex]) {
          handleSelect(filteredBuyers[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm(selectedBuyer?.name || '');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm(selectedBuyer?.name || '');
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden native input for required form validation if needed */}
      {required && (
        <input
          tabIndex={-1}
          required={required}
          value={value || ''}
          onChange={() => {}}
          className="sr-only"
          aria-hidden="true"
        />
      )}

      {/* Input container */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`relative flex items-center w-full min-h-[44px] h-11 bg-white border rounded-xl px-3 transition-all cursor-text ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isOpen
            ? 'border-red-500 ring-2 ring-red-500/20'
            : selectedBuyer
            ? 'border-slate-300 hover:border-slate-400 shadow-2xs'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0 pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          autoFocus={autoFocus}
          value={searchTerm}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-transparent text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0"
        />

        {/* Clear button if search or buyer is selected */}
        {(value || searchTerm) && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors mr-1 cursor-pointer shrink-0"
            title="Clear customer selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(!isOpen);
          }}
          className="p-1 text-slate-400 hover:text-slate-600 transition-transform cursor-pointer shrink-0"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Customers ({filteredBuyers.length})</span>
            {searchTerm && <span className="lowercase font-normal">matches "{searchTerm}"</span>}
          </div>

          <div
            ref={listRef}
            className="max-h-56 sm:max-h-64 overflow-y-auto divide-y divide-slate-100 overscroll-contain"
          >
            {filteredBuyers.length === 0 ? (
              <div className="p-4 text-center">
                <User className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-700">No matching customer found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Check the spelling or add a new buyer from Buyers & Tally.
                </p>
              </div>
            ) : (
              filteredBuyers.map((b, index) => {
                const isSelected = String(b._id) === String(value);
                const isHighlighted = index === highlightedIndex;
                const bal = formatBalance(b.currentBalance);

                return (
                  <div
                    key={b._id}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(b)}
                    className={`px-3 py-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                      isHighlighted
                        ? 'bg-red-50/80 text-red-950'
                        : isSelected
                        ? 'bg-slate-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-extrabold truncate ${isSelected ? 'text-red-700' : 'text-slate-900'}`}>
                          {b.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {b.phone && <span className="font-mono">{b.phone}</span>}
                        {b.phone && b.address && <span>•</span>}
                        {b.address && <span className="truncate">{b.address}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`inline-block text-[11px] font-mono font-black px-2 py-0.5 rounded-md border ${bal.color}`}>
                        {bal.text}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
