import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, ChevronDown, Check, X } from 'lucide-react';
import { Button } from './ui/Button';
import { CURRENCIES } from '../constants';

interface FilterDropdownProps {
  label: string;
  active?: boolean;
  children: React.ReactNode;
  onClear?: () => void;
}

export function FilterDropdown({ label, active, children, onClear }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 border rounded-full text-sm font-medium transition-all whitespace-nowrap ${
          active 
            ? 'bg-purple-600 text-white border-purple-600' 
            : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
        }`}
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${active ? 'text-black' : 'text-gray-500'}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-100 rounded-2xl shadow-xl p-4 z-50 transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</span>
            {active && onClear && (
              <button onClick={onClear} className="text-[10px] font-bold uppercase tracking-widest text-gray-900 hover:underline">Clear</button>
            )}
          </div>
          {children}
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
            <button 
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-purple-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-purple-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  activeFilters: {
    minPrice?: number;
    maxPrice?: number;
    currency?: string;
    type?: string;
    amenities?: string[];
    beds?: number;
    baths?: number;
    guests?: number;
  };
  onFilterChange: (type: string, value: any) => void;
}

export function FilterBar({ activeFilters, onFilterChange }: FilterBarProps) {
  const [showAllFilters, setShowAllFilters] = useState(false);
  const propertyTypes = ['Apartment', 'House', 'Villa', 'Studio', 'Penthouse', 'Loft', 'Land', 'Shop', 'Office'];
  const amenitiesList = ['Wifi', 'Pool', 'Kitchen', 'Parking', 'Gym', 'Air Conditioning', 'Washer', 'Dryer', 'Heating', 'Dedicated workspace', 'TV', 'Hair dryer', 'Iron'];

  const handleAmenityToggle = (amenity: string) => {
    const current = activeFilters.amenities || [];
    if (current.includes(amenity)) {
      onFilterChange('amenities', current.filter(a => a !== amenity));
    } else {
      onFilterChange('amenities', [...current, amenity]);
    }
  };

  const getCurrencySymbol = (currency?: string) => {
    return CURRENCIES.find(c => c.code === currency)?.symbol || '$';
  };

  return (
    <div className="flex items-center gap-3 py-4 px-6 border-b border-gray-200 bg-white relative z-30">
      <button 
        onClick={() => setShowAllFilters(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm font-bold text-black hover:bg-purple-700 transition-colors whitespace-nowrap"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters
      </button>
      
      <div className="h-6 w-[1px] bg-gray-800 mx-2" />
      
      {/* Price Filter */}
      <FilterDropdown 
        label={activeFilters.minPrice || activeFilters.maxPrice ? `Price: ${getCurrencySymbol(activeFilters.currency)}${activeFilters.minPrice || 0} - ${getCurrencySymbol(activeFilters.currency)}${activeFilters.maxPrice || '∞'}` : "Price Range"}
        active={!!(activeFilters.minPrice || activeFilters.maxPrice)}
        onClear={() => { onFilterChange('minPrice', undefined); onFilterChange('maxPrice', undefined); onFilterChange('currency', undefined); }}
      >
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Currency</label>
            <select
              value={activeFilters.currency || 'USD'}
              onChange={(e) => onFilterChange('currency', e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-300"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Min Price</label>
              <input 
                type="number" 
                placeholder="0"
                value={activeFilters.minPrice || ''}
                onChange={(e) => onFilterChange('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-300"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Max Price</label>
              <input 
                type="number" 
                placeholder="Any"
                value={activeFilters.maxPrice || ''}
                onChange={(e) => onFilterChange('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-300"
              />
            </div>
          </div>
        </div>
      </FilterDropdown>

      {/* Property Type Filter */}
      <FilterDropdown 
        label={activeFilters.type ? `Type: ${activeFilters.type}` : "Property Type"}
        active={!!activeFilters.type}
        onClear={() => onFilterChange('type', undefined)}
      >
        <div className="grid grid-cols-2 gap-2">
          {propertyTypes.map(type => (
            <button
              key={type}
              onClick={() => onFilterChange('type', type)}
              className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                activeFilters.type === type ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </FilterDropdown>

      {/* Amenities Filter */}
      <FilterDropdown 
        label={activeFilters.amenities?.length ? `Amenities (${activeFilters.amenities.length})` : "Amenities"}
        active={activeFilters.amenities && activeFilters.amenities.length > 0}
        onClear={() => onFilterChange('amenities', [])}
      >
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          {amenitiesList.slice(0, 8).map(amenity => (
            <label key={amenity} className="flex items-center gap-2 cursor-pointer group">
              <div 
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  activeFilters.amenities?.includes(amenity) ? 'bg-white border-purple-600' : 'bg-white border-gray-200 group-hover:border-purple-600/40'
                }`}
                onClick={() => handleAmenityToggle(amenity)}
              >
                {activeFilters.amenities?.includes(amenity) && <Check className="w-3 h-3 text-black" />}
              </div>
              <span className="text-xs text-gray-500 group-hover:text-gray-900 transition-colors">{amenity}</span>
            </label>
          ))}
        </div>
      </FilterDropdown>

      {/* Rooms Filter */}
      <FilterDropdown 
        label={activeFilters.beds || activeFilters.baths || activeFilters.guests ? `${activeFilters.beds || 0} Beds, ${activeFilters.baths || 0} Baths, ${activeFilters.guests || 0} Guests` : "Rooms & Guests"}
        active={!!(activeFilters.beds || activeFilters.baths || activeFilters.guests)}
        onClear={() => { onFilterChange('beds', undefined); onFilterChange('baths', undefined); onFilterChange('guests', undefined); }}
      >
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Bedrooms</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => onFilterChange('beds', num)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    activeFilters.beds === num ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {num}+
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Bathrooms</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => onFilterChange('baths', num)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    activeFilters.baths === num ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {num}+
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Guests</label>
            <div className="flex gap-2">
              {[1, 2, 4, 6, 8].map(num => (
                <button
                  key={num}
                  onClick={() => onFilterChange('guests', num)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                    activeFilters.guests === num ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {num}+
                </button>
              ))}
            </div>
          </div>
        </div>
      </FilterDropdown>

      {/* More Filters Modal */}
      {showAllFilters && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-2xl font-light tracking-tight">All Filters</h3>
              <button onClick={() => setShowAllFilters(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
              {/* Price Range Section */}
              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Price Range</h4>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">Currency</label>
                    <select
                      value={activeFilters.currency || 'USD'}
                      onChange={(e) => onFilterChange('currency', e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl py-4 px-4 text-gray-900 focus:border-purple-600 transition-colors"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Minimum Price</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{getCurrencySymbol(activeFilters.currency)}</span>
                        <input 
                          type="number" 
                          value={activeFilters.minPrice || ''}
                          onChange={(e) => onFilterChange('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-8 pr-4 text-gray-900 focus:border-purple-600 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Maximum Price</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{getCurrencySymbol(activeFilters.currency)}</span>
                        <input 
                          type="number" 
                          value={activeFilters.maxPrice || ''}
                          onChange={(e) => onFilterChange('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-8 pr-4 text-gray-900 focus:border-purple-600 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Property Type Section */}
              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Property Type</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {propertyTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => onFilterChange('type', activeFilters.type === type ? undefined : type)}
                      className={`p-4 rounded-xl border text-sm font-medium transition-all ${
                        activeFilters.type === type ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-600/30'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </section>

              {/* Rooms Section */}
              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Rooms and Beds</h4>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-xs text-gray-500">Bedrooms</label>
                    <div className="flex flex-wrap gap-3">
                      {['Any', 1, 2, 3, 4, 5].map(num => (
                        <button
                          key={num}
                          onClick={() => onFilterChange('beds', num === 'Any' ? undefined : num)}
                          className={`px-6 py-3 rounded-full border text-sm font-bold transition-all ${
                            (num === 'Any' && !activeFilters.beds) || activeFilters.beds === num 
                              ? 'bg-purple-600 text-white border-purple-600' 
                              : 'bg-white text-gray-500 border-gray-200 hover:border-purple-600/30'
                          }`}
                        >
                          {num}{num !== 'Any' ? '+' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs text-gray-500">Bathrooms</label>
                    <div className="flex flex-wrap gap-3">
                      {['Any', 1, 2, 3, 4].map(num => (
                        <button
                          key={num}
                          onClick={() => onFilterChange('baths', num === 'Any' ? undefined : num)}
                          className={`px-6 py-3 rounded-full border text-sm font-bold transition-all ${
                            (num === 'Any' && !activeFilters.baths) || activeFilters.baths === num 
                              ? 'bg-purple-600 text-white border-purple-600' 
                              : 'bg-white text-gray-500 border-gray-200 hover:border-purple-600/30'
                          }`}
                        >
                          {num}{num !== 'Any' ? '+' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs text-gray-500">Guests</label>
                    <div className="flex flex-wrap gap-3">
                      {['Any', 1, 2, 4, 6, 8, 10].map(num => (
                        <button
                          key={num}
                          onClick={() => onFilterChange('guests', num === 'Any' ? undefined : num)}
                          className={`px-6 py-3 rounded-full border text-sm font-bold transition-all ${
                            (num === 'Any' && !activeFilters.guests) || activeFilters.guests === num 
                              ? 'bg-purple-600 text-white border-purple-600' 
                              : 'bg-white text-gray-500 border-gray-200 hover:border-purple-600/30'
                          }`}
                        >
                          {num}{num !== 'Any' ? '+' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Amenities Section */}
              <section>
                <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Amenities</h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  {amenitiesList.map(amenity => (
                    <label key={amenity} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-500 group-hover:text-gray-900 transition-colors">{amenity}</span>
                      <div 
                        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                          activeFilters.amenities?.includes(amenity) ? 'bg-white border-purple-600' : 'bg-white border-gray-200 group-hover:border-purple-600/30'
                        }`}
                        onClick={() => handleAmenityToggle(amenity)}
                      >
                        {activeFilters.amenities?.includes(amenity) && <Check className="w-4 h-4 text-black" />}
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-between">
              <button 
                onClick={() => {
                  onFilterChange('minPrice', undefined);
                  onFilterChange('maxPrice', undefined);
                  onFilterChange('type', undefined);
                  onFilterChange('amenities', []);
                  onFilterChange('beds', undefined);
                  onFilterChange('baths', undefined);
                  onFilterChange('guests', undefined);
                }}
                className="text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 underline"
              >
                Clear All
              </button>
              <Button onClick={() => setShowAllFilters(false)} className="px-10 bg-purple-600 text-white hover:bg-purple-700">
                Show Results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
