import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Property } from '../components/PropertyCard';
import { Button } from '../components/ui/Button';
import { SlidersHorizontal, MapPin, Search as SearchIcon, ChevronRight, Plus, Minus, Target, Star, Home, X, Check, Circle as CircleIcon, Pin } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Navbar } from '../components/Navbar';
import { db } from '../firebase';
import { handleFirestoreError, OperationType, cn } from '../lib/utils';
import { collection, query, getDocs, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { CURRENCIES, EXCHANGE_RATES } from '../constants';
import { GoogleMap, useJsApiLoader, OverlayView, DirectionsRenderer, Circle, Autocomplete } from '@react-google-maps/api';
import { FilterDropdown } from '../components/FilterBar';
import { motion } from 'motion/react';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 20,
  lng: 0 // More central global view
};

const libraries: any[] = ['places', 'geometry'];

const mapStyles = [
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#e9e9e9" }, { lightness: 17 }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }, { lightness: 20 }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }, { lightness: 17 }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#ffffff" }, { lightness: 29 }, { weight: 0.2 }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }, { lightness: 18 }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#ffffff" }, { lightness: 16 }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#f5f5f5" }, { lightness: 21 }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dedede" }, { lightness: 21 }] },
  { elementType: "labels.text.stroke", stylers: [{ visibility: "on" }, { color: "#ffffff" }, { lightness: 16 }] },
  { elementType: "labels.text.fill", stylers: [{ saturation: 36 }, { color: "#333333" }, { lightness: 40 }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#f2f2f2" }, { lightness: 19 }] },
  { featureType: "administrative", elementType: "geometry.fill", stylers: [{ color: "#fefefe" }, { lightness: 20 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#fefefe" }, { lightness: 17 }, { weight: 1.2 }] }
];

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';
  
  const [aiQuery, setAiQuery] = useState(initialQuery);
  const [currencySearch, setCurrencySearch] = useState('');
  const [mapTypeId, setMapTypeId] = useState('roadmap');
  const [showFilters, setShowFilters] = useState(false);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const onLoadAutocomplete = useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        setAiQuery(place.formatted_address);
        setSearchParams({ q: place.formatted_address });
      } else if (place.name) {
        setAiQuery(place.name);
        setSearchParams({ q: place.name });
      }
    }
  }, [autocomplete, setSearchParams]);
  
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [activePropertyIndex, setActivePropertyIndex] = useState(0);
  const carouselRef = React.useRef<HTMLDivElement>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  const [map, setMap] = useState<any>(null);
  const [mapBounds, setMapBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [zoomLevel, setZoomLevel] = useState(12);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const isProgrammaticScroll = React.useRef(false);
  const hasInitializedLocation = React.useRef(false);
  const pendingFitBounds = React.useRef<{pos: {lat: number, lng: number}, viewport: any} | null>(null);
  const scrollTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const [searchLocation, setSearchLocation] = useState<{lat: number, lng: number} | null>(null);
  const [filters, setFilters] = useState({
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    currency: undefined as string | undefined,
    type: undefined as string | undefined,
    listingType: undefined as 'rent' | 'sale' | undefined,
    amenities: [] as string[],
    beds: undefined as number | undefined,
    baths: undefined as number | undefined,
    guests: undefined as number | undefined
  });

  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [savedPropertyIds, setSavedPropertyIds] = useState<Record<string, string>>({});
  const { user, openAuthModal } = useAuth();

  useEffect(() => {
    if (user) {
      const fetchSavedProperties = async () => {
        try {
          const q = query(collection(db, 'savedProperties'), where('userId', '==', user.uid));
          const snapshot = await getDocs(q);
          const saved: Record<string, string> = {};
          snapshot.forEach(doc => {
            saved[doc.data().propertyId] = doc.id;
          });
          setSavedPropertyIds(saved);
        } catch (error) {
          console.error("Error fetching saved properties:", error);
        }
      };
      fetchSavedProperties();
    } else {
      setSavedPropertyIds({});
    }
  }, [user]);

  const toggleSaveProperty = async (e: React.MouseEvent | React.TouchEvent, propertyId: string) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal('renter');
      return;
    }

    try {
      const savedDocId = savedPropertyIds[propertyId];
      if (savedDocId) {
        await deleteDoc(doc(db, 'savedProperties', savedDocId));
        setSavedPropertyIds(prev => {
          const next = { ...prev };
          delete next[propertyId];
          return next;
        });
      } else {
        const docRef = await addDoc(collection(db, 'savedProperties'), {
          userId: user.uid,
          propertyId: propertyId,
          createdAt: new Date().toISOString()
        });
        setSavedPropertyIds(prev => ({ ...prev, [propertyId]: docRef.id }));
      }
    } catch (error) {
      console.error("Error toggling saved property:", error);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const propertyTypes = ['Apartment', 'House', 'Villa', 'Studio', 'Penthouse', 'Loft', 'Land', 'Shop', 'Office'];
  const amenitiesList = ['Wifi', 'Pool', 'Kitchen', 'Parking', 'Gym', 'Air Conditioning', 'Washer', 'Dryer', 'Heating', 'Dedicated workspace', 'TV', 'Hair dryer', 'Iron'];

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleAmenityToggle = (amenity: string) => {
    const current = filters.amenities || [];
    if (current.includes(amenity)) {
      handleFilterChange('amenities', current.filter(a => a !== amenity));
    } else {
      handleFilterChange('amenities', [...current, amenity]);
    }
  };

  const getCurrencySymbol = (currency?: string) => {
    return CURRENCIES.find(c => c.code === currency)?.symbol || '$';
  };

  const convertPrice = (price: number, fromCurrency: string, toCurrency: string) => {
    const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
    const toRate = EXCHANGE_RATES[toCurrency] || 1;
    return (price / fromRate) * toRate;
  };

  const onLoad = useCallback(function callback(map: any) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: any) {
    setMap(null);
  }, []);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const q = query(collection(db, 'properties'));
        let querySnapshot;
        try {
          querySnapshot = await getDocs(q);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'properties');
          return;
        }
        const fetchedProperties: Property[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const status = data.status || 'active';
          if (status === 'active') {
            fetchedProperties.push({ id: doc.id, ...data, status } as Property);
          }
        });
        console.log("Fetched properties:", fetchedProperties.length);
        
        // Sort client-side to handle missing createdAt fields
        fetchedProperties.sort((a, b) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        setAllProperties(fetchedProperties);
      } catch (error) {
        console.error("Error fetching properties:", error);
      } finally {
        setLoadingProperties(false);
      }
    };

    fetchProperties();
  }, []);

  // Get user location for directions, and set as initial center if no query
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(pos);
          if (!initialQuery && !hasInitializedLocation.current) {
            setSearchLocation(pos);
          }
        },
        () => {
          console.log("Geolocation denied or failed");
          if (!initialQuery && !hasInitializedLocation.current) {
            setSearchLocation(defaultCenter);
          }
        }
      );
    } else {
      if (!initialQuery && !hasInitializedLocation.current) {
        setSearchLocation(defaultCenter);
      }
    }
  }, [initialQuery]);

  // Fit bounds to properties if no initial query
  useEffect(() => {
    if (!initialQuery && map && !hasInitializedLocation.current && window.google && allProperties.length > 0) {
      hasInitializedLocation.current = true;
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidCoords = false;
      allProperties.forEach(p => {
        if (p.lat && p.lng) {
          bounds.extend(new window.google.maps.LatLng(p.lat, p.lng));
          hasValidCoords = true;
        }
      });
      if (hasValidCoords) {
        map.fitBounds(bounds);
        const listener = window.google.maps.event.addListener(map, 'idle', () => {
          // Default to a zoomed out view (level 4-6) to show the whole country/region
          if (map.getZoom() > 6) map.setZoom(6);
          window.google.maps.event.removeListener(listener);
        });
      }
    }
  }, [map, initialQuery, allProperties]);

  const flyToLocation = useCallback((pos: {lat: number, lng: number}, targetZoom: number = 6) => {
    if (!map) return;
    map.panTo(pos);
    map.setZoom(targetZoom);
  }, [map]);

  // Geocode initialQuery to pan map
  useEffect(() => {
    if (initialQuery && map && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: initialQuery }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          const pos = { lat: loc.lat(), lng: loc.lng() };
          
          setSearchLocation(pos);
          pendingFitBounds.current = {
            pos,
            viewport: results[0].geometry.viewport
          };
          console.log("Geocoded location:", pos);
        } else if (status === 'REQUEST_DENIED') {
          console.error("Geocoding API is not enabled. Please enable it in Google Cloud Console.");
        }
      });
    }
  }, [initialQuery, map]);

  // Fit bounds to search location when search completes
  useEffect(() => {
    if (pendingFitBounds.current && map && window.google && !loadingProperties) {
      if (pendingFitBounds.current.viewport) {
        map.fitBounds(pendingFitBounds.current.viewport);
      } else {
        flyToLocation(pendingFitBounds.current.pos, 12);
      }
      pendingFitBounds.current = null;
    }
  }, [map, loadingProperties, flyToLocation, searchLocation]);


  useEffect(() => {
    console.log("Filtering properties. allProperties length:", allProperties.length, "initialQuery:", initialQuery, "filters:", filters, "searchLocation:", searchLocation, "mapBounds:", mapBounds);
    let filtered = allProperties;
    
    // Apply filters
    filtered = filtered.filter(property => {
      const priceInSelectedCurrency = filters.currency ? convertPrice(property.price, property.currency || 'USD', filters.currency) : property.price;
      if (filters.minPrice !== undefined && priceInSelectedCurrency < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && priceInSelectedCurrency > filters.maxPrice) return false;
      if (filters.type && property.type !== filters.type) return false;
      if (filters.listingType && property.listingType !== filters.listingType) return false;
      if (filters.beds !== undefined && property.beds < filters.beds) return false;
      if (filters.baths !== undefined && property.baths < filters.baths) return false;
      if (filters.guests !== undefined && (property.guests || 0) < filters.guests) return false;
      if (filters.amenities.length > 0) {
        const propAmenities = (property as any).amenities || [];
        if (!filters.amenities.every(a => propAmenities.includes(a))) return false;
      }
      
      // Apply map bounds filter if available
      if (mapBounds && window.google) {
        if (!property.lat || !property.lng) return false;
        const latLng = new window.google.maps.LatLng(property.lat, property.lng);
        if (!mapBounds.contains(latLng)) return false;
      } else if (searchLocation) {
        if (!property.lat || !property.lng) return false;
        
        // Calculate distance using Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = (property.lat - searchLocation.lat) * Math.PI / 180;
        const dLng = (property.lng - searchLocation.lng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(searchLocation.lat * Math.PI / 180) * Math.cos(property.lat * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        // Fallback to 50km radius if map bounds are not yet available
        if (distance > 50) return false;
      }
      
      return true;
    });

    // Sort properties: Featured first, then by priority (Top > High > Normal), then by rating
    filtered.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      
      if (a.isFeatured && b.isFeatured) {
        const priorityScore = { 'Top': 3, 'High': 2, 'Normal': 1 };
        const scoreA = priorityScore[a.priority as keyof typeof priorityScore] || 0;
        const scoreB = priorityScore[b.priority as keyof typeof priorityScore] || 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      
      return (b.rating || 0) - (a.rating || 0);
    });

    console.log("Filtered properties length:", filtered.length);
    setFilteredCount(filtered.length);
    setProperties(filtered.slice(0, 50));
  }, [filters, allProperties, initialQuery, searchLocation, mapBounds]);

  useEffect(() => {
    if (properties.length > 0) {
      if (isProgrammaticScroll.current) {
        if (window.innerWidth < 768 && carouselRef.current) {
          const scrollAmount = activePropertyIndex * (260 + 12); // 260px width + 12px gap
          carouselRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
        } else if (window.innerWidth >= 768) {
          const cardItem = document.getElementById(`desktop-card-${activePropertyIndex}`);
          if (cardItem) {
            cardItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }
      
      // Only pan if we are programmatically scrolling (e.g., clicking a pin or sidebar item)
      if (isProgrammaticScroll.current) {
        const activeProp = properties[activePropertyIndex];
        if (activeProp?.lat && activeProp?.lng && map) {
          map.panTo({ lat: activeProp.lat, lng: activeProp.lng });
        }
      }
    }
  }, [activePropertyIndex, properties, map]);

  const handleCarouselScroll = () => {
    if (isProgrammaticScroll.current) return;
    
    if (carouselRef.current && window.innerWidth < 768) {
      const scrollLeft = carouselRef.current.scrollLeft;
      const itemWidth = 260 + 12; // 260px width + 12px gap
      const index = Math.round(scrollLeft / itemWidth);
      if (index !== activePropertyIndex && index >= 0 && index < properties.length) {
        setActivePropertyIndex(index);
      }
    }
  };

  const handlePinClick = (index: number, property: Property) => {
    isProgrammaticScroll.current = true;
    setActivePropertyIndex(index);
    setSelectedProperty(property);
    
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 800);
  };

  const handleSidebarHover = (index: number) => {
    if (activePropertyIndex === index) return;
    isProgrammaticScroll.current = true;
    setActivePropertyIndex(index);
    
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 800);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-white overflow-hidden">
      <div className="z-50 relative">
        <Navbar />
      </div>
      
      {/* Floating Header (All breakpoints) */}
      <div className="absolute top-16 left-0 right-0 z-40 p-4 md:p-6 pointer-events-none flex justify-center">
        <div className="flex flex-col gap-3 w-full max-w-2xl">
          {/* Top row: Search Bar and Controls */}
          <div className="flex flex-col md:flex-row gap-3 pointer-events-auto">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 z-10" />
              {isLoaded ? (
                <Autocomplete
                  onLoad={onLoadAutocomplete}
                  onPlaceChanged={onPlaceChanged}
                  className="w-full"
                >
                  <input 
                    type="text" 
                    placeholder="Where to?" 
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSearchParams({ q: aiQuery });
                      }
                    }}
                    className="w-full h-12 pl-10 pr-3 bg-white/80 backdrop-blur-md border border-gray-300 rounded-xl shadow-sm text-gray-900 placeholder:text-gray-600 text-sm font-medium focus:outline-none"
                  />
                </Autocomplete>
              ) : (
                <input 
                  type="text" 
                  placeholder="Where to?" 
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSearchParams({ q: aiQuery });
                    }
                  }}
                  className="w-full h-12 pl-10 pr-3 bg-white/80 backdrop-blur-md border border-gray-300 rounded-xl shadow-sm text-gray-900 placeholder:text-gray-600 text-sm font-medium focus:outline-none"
                />
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              <div className="text-xs font-medium text-gray-500 bg-white/80 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-300 shadow-sm h-12 flex items-center">
                {filteredCount} found
              </div>
              <button 
                onClick={() => setShowFiltersModal(true)}
                className="w-12 h-12 bg-white/80 backdrop-blur-md border border-gray-300 rounded-xl shadow-sm flex items-center justify-center shrink-0 hover:bg-gray-100/80 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 text-gray-900" />
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden w-12 h-12 bg-white/80 backdrop-blur-md border border-gray-300 rounded-xl shadow-sm flex items-center justify-center shrink-0 hover:bg-gray-100/80 transition-colors"
              >
                <span className="text-[10px] font-bold text-gray-900">{showFilters ? 'Hide' : 'Show'}</span>
              </button>
            </div>
          </div>
          
          <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-wrap gap-2 pb-2 pointer-events-auto`}>
            <FilterDropdown
              label="Price"
              active={!!(filters.minPrice || filters.maxPrice)}
              onClear={() => {
                handleFilterChange('minPrice', undefined);
                handleFilterChange('maxPrice', undefined);
                handleFilterChange('currency', undefined);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Currency</label>
                  <input
                    type="text"
                    placeholder="Search currency..."
                    value={currencySearch}
                    onChange={(e) => setCurrencySearch(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-300 mb-2"
                  />
                  <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg">
                    {CURRENCIES.filter(c => c.name.toLowerCase().includes(currencySearch.toLowerCase()) || c.code.toLowerCase().includes(currencySearch.toLowerCase())).map(c => (
                      <button
                        key={c.code}
                        onClick={() => handleFilterChange('currency', c.code)}
                        className={`w-full text-left px-3 py-2 text-sm ${filters.currency === c.code ? 'bg-purple-600 text-white' : 'text-gray-900 hover:bg-gray-100'}`}
                      >
                        {c.code} - {c.name} ({c.symbol})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Min Price</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={filters.minPrice || ''}
                      onChange={(e) => handleFilterChange('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Max Price</label>
                    <input 
                      type="number" 
                      placeholder="Any"
                      value={filters.maxPrice || ''}
                      onChange={(e) => handleFilterChange('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-300"
                    />
                  </div>
                </div>
              </div>
            </FilterDropdown>
            <FilterDropdown
              label="Listing Type"
              active={!!filters.listingType}
              onClear={() => handleFilterChange('listingType', undefined)}
            >
              <div className="flex gap-2">
                <button
                  onClick={() => handleFilterChange('listingType', filters.listingType === 'rent' ? undefined : 'rent')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                    filters.listingType === 'rent' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  For Rent
                </button>
                <button
                  onClick={() => handleFilterChange('listingType', filters.listingType === 'sale' ? undefined : 'sale')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                    filters.listingType === 'sale' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  For Sale
                </button>
              </div>
            </FilterDropdown>
            <FilterDropdown
              label="Type"
              active={!!filters.type}
              onClear={() => handleFilterChange('type', undefined)}
            >
              <div className="grid grid-cols-2 gap-2">
                {propertyTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => handleFilterChange('type', filters.type === type ? undefined : type)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                      filters.type === type ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </FilterDropdown>
            <FilterDropdown
              label="Amenities"
              active={filters.amenities.length > 0}
              onClear={() => handleFilterChange('amenities', [])}
            >
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                {['Wifi', 'Pool', 'Kitchen', 'Parking', 'Gym', 'Air Conditioning', 'Washer', 'Dryer', 'Heating', 'Dedicated workspace', 'TV', 'Hair dryer', 'Iron'].slice(0, 8).map(amenity => (
                  <label key={amenity} className="flex items-center gap-2 cursor-pointer group">
                    <div 
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        filters.amenities.includes(amenity) ? 'bg-white border-purple-600' : 'bg-white border-gray-200 group-hover:border-purple-600/40'
                      }`}
                      onClick={() => {
                        const current = filters.amenities || [];
                        if (current.includes(amenity)) {
                          handleFilterChange('amenities', current.filter(a => a !== amenity));
                        } else {
                          handleFilterChange('amenities', [...current, amenity]);
                        }
                      }}
                    >
                      {filters.amenities.includes(amenity) && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <span className="text-xs text-gray-500 group-hover:text-gray-900 transition-colors">{amenity}</span>
                  </label>
                ))}
              </div>
            </FilterDropdown>
            <FilterDropdown
              label="Rooms & Guests"
              active={!!(filters.beds || filters.baths || filters.guests)}
              onClear={() => {
                handleFilterChange('beds', undefined);
                handleFilterChange('baths', undefined);
                handleFilterChange('guests', undefined);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Bedrooms</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        onClick={() => handleFilterChange('beds', num)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          filters.beds === num ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
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
                        onClick={() => handleFilterChange('baths', num)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          filters.baths === num ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
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
                        onClick={() => handleFilterChange('guests', num)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          filters.guests === num ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {num}+
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </FilterDropdown>
          </div>
        </div>
      </div>

      <main className="flex-grow relative z-0 h-full w-full overflow-hidden">
        {/* View Toggle (Mobile Only) */}
        {isMobile && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60]">
            <button 
              onClick={() => setViewMode(prev => prev === 'map' ? 'list' : 'map')}
              className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm tracking-tight active:scale-95 transition-transform"
            >
              {viewMode === 'map' ? (
                <>
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Show List</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>Show Map</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* List View (Mobile) */}
        {isMobile && viewMode === 'list' && (
          <div className="absolute inset-0 z-50 bg-white overflow-y-auto p-4 pt-4 pb-40 space-y-4 no-scrollbar">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                {filteredCount} Properties Found
              </h2>
              <button 
                onClick={() => setShowFiltersModal(true)}
                className="p-2 bg-gray-100 rounded-full"
              >
                <SlidersHorizontal className="w-4 h-4 text-gray-900" />
              </button>
            </div>

            {/* Featured Section (Mobile List) */}
            {properties.filter(p => p.isFeatured).length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <Star className="w-4 h-4 fill-purple-600 text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Featured Listings</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar snap-x snap-mandatory">
                  {properties.filter(p => p.isFeatured).map((property, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={`mobile-featured-${property.id}`}
                      className="w-[85vw] max-w-[320px] shrink-0 snap-center bg-white rounded-2xl overflow-hidden border-2 border-purple-100 shadow-md"
                      onClick={() => navigate(`/property/${property.id}`)}
                    >
                      <div className="aspect-[16/10] relative">
                        <img 
                          src={property.imageUrl} 
                          alt={property.title} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm border border-gray-200 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-purple-600 text-purple-600" />
                          <span className="text-[10px] font-bold text-gray-900 uppercase tracking-wider">Featured</span>
                        </div>
                        <div className="absolute top-3 right-3">
                          <button 
                            onClick={(e) => toggleSaveProperty(e, property.id)}
                            className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg"
                          >
                            <Pin className={cn("w-4 h-4 transition-colors", savedPropertyIds[property.id] ? "fill-purple-600 text-purple-600" : "text-gray-900")} />
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-gray-900 truncate pr-2">{property.title}</h3>
                          <div className="flex items-center gap-1 text-sm font-bold text-gray-900 shrink-0">
                            <Star className="w-3.5 h-3.5 fill-[#FACC15] text-[#FACC15]" />
                            <span>{property.rating}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-4 truncate">{property.location}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-gray-900">
                              {getCurrencySymbol(filters.currency || property.currency)}
                              {convertPrice(property.price, property.currency || 'USD', filters.currency || property.currency || 'USD').toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500">
                              {property.listingType === 'sale' ? '' : '/ night'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* All Properties (Mobile List) */}
            {properties.filter(p => !p.isFeatured).map((property, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={`mobile-list-${property.id}`}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
                onClick={() => navigate(`/property/${property.id}`)}
              >
                <div className="aspect-[16/10] relative">
                  <img 
                    src={property.imageUrl} 
                    alt={property.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3">
                    <button 
                      onClick={(e) => toggleSaveProperty(e, property.id)}
                      className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg"
                    >
                      <Pin className={cn("w-4 h-4 transition-colors", savedPropertyIds[property.id] ? "fill-purple-600 text-purple-600" : "text-gray-900")} />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-900">{property.title}</h3>
                    <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                      <Star className="w-3.5 h-3.5 fill-[#FACC15] text-[#FACC15]" />
                      <span>{property.rating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{property.location}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-gray-900">
                          {getCurrencySymbol(filters.currency || property.currency)}
                          {convertPrice(property.price, property.currency || 'USD', filters.currency || property.currency || 'USD').toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {property.listingType === 'sale' ? '' : '/ night'}
                        </span>
                      </div>
                    </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Map View (Always visible on desktop, toggleable on mobile) */}
        <div className={cn(
          "absolute inset-0 z-0",
          isMobile && viewMode === 'list' ? "hidden" : "block"
        )}>
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={searchLocation || defaultCenter}
              zoom={4}
              mapTypeId={mapTypeId}
              options={{
                styles: mapStyles,
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
              }}
              onLoad={onLoad}
              onUnmount={onUnmount}
              onClick={() => setSelectedProperty(null)}
              onIdle={() => {
                if (map) {
                  setMapBounds(map.getBounds());
                  setZoomLevel(map.getZoom());
                }
              }}
              onZoomChanged={() => {
                if (map) {
                  const zoom = map.getZoom();
                  setZoomLevel(zoom);
                }
              }}
              options={{
                gestureHandling: "greedy",
                disableDefaultUI: false,
                zoomControl: false,
                mapTypeControl: true,
                streetViewControl: true,
                styles: [
                  {
                    "featureType": "water",
                    "elementType": "geometry",
                    "stylers": [{"color": "#a2daf2"}]
                  },
                  {
                    "featureType": "landscape",
                    "elementType": "geometry",
                    "stylers": [{"color": "#f7f1df"}]
                  },
                  {
                    "featureType": "poi",
                    "elementType": "geometry",
                    "stylers": [{"color": "#d5e8d4"}]
                  },
                  {
                    "featureType": "road",
                    "elementType": "geometry",
                    "stylers": [{"color": "#ffffff"}]
                  },
                  {
                    "featureType": "road",
                    "elementType": "labels.text.fill",
                    "stylers": [{"color": "#767676"}]
                  }
                ]
              }}
            >
              {zoomLevel >= 4 && properties.map((property) => {
                if (!property.lat || !property.lng) return null;
                return (
                  <OverlayView
                    key={`price-${property.id}`}
                    position={{ lat: property.lat, lng: property.lng }}
                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                  >
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const index = properties.findIndex(p => p.id === property.id);
                        if (index !== -1) {
                          handlePinClick(index, property);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200 shadow-md transition-all transform -translate-x-1/2 -translate-y-1/2 whitespace-nowrap",
                        properties[activePropertyIndex]?.id === property.id 
                          ? "border-purple-600 bg-purple-600 text-white scale-125 z-10 shadow-lg" 
                          : "text-gray-900 hover:scale-110 hover:border-purple-400 hover:bg-gray-50 hover:shadow-lg"
                      )}
                    >
                      <Home className="w-4 h-4 shrink-0" strokeWidth={2} />
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-bold">{property.type || 'Home'}</span>
                        <span className={cn(
                          "text-[10px] truncate max-w-[120px]",
                          properties[activePropertyIndex]?.id === property.id ? "text-white/90" : "text-gray-500"
                        )}>{property.location}</span>
                      </div>
                      <span className={cn(
                        "text-xs font-bold ml-1",
                        properties[activePropertyIndex]?.id === property.id ? "text-white" : "text-purple-600"
                      )}>{getCurrencySymbol(filters.currency || property.currency)}{convertPrice(property.price, property.currency || 'USD', filters.currency || property.currency || 'USD').toLocaleString()}</span>
                    </button>
                  </OverlayView>
                );
              })}

              {/* Radius Circle Removed */}

              {selectedProperty && selectedProperty.lat && selectedProperty.lng && (
                <OverlayView
                  position={{
                    lat: selectedProperty.lat,
                    lng: selectedProperty.lng,
                  }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-4 z-50">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="relative w-[280px] bg-white rounded-2xl shadow-2xl border border-gray-100 cursor-pointer group" 
                      ref={(el) => {
                        if (el) {
                          // Prevent touch/pointer events from reaching the map container
                          // which causes the map to close the popup on mobile before click fires
                          el.ontouchstart = (e) => e.stopPropagation();
                          el.ontouchend = (e) => e.stopPropagation();
                          el.onpointerdown = (e) => e.stopPropagation();
                          el.onpointerup = (e) => e.stopPropagation();
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/property/${selectedProperty.id}`);
                      }}
                    >
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProperty(null);
                        }}
                        className="absolute top-2 right-2 z-10 w-7 h-7 bg-gray-300 hover:bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center text-gray-900 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      
                      <div className="flex flex-row p-2 gap-3">
                        <div className="h-24 w-24 shrink-0 overflow-hidden relative rounded-xl">
                          <img 
                            src={selectedProperty.imageUrls?.[0] || selectedProperty.imageUrl || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80"} 
                            alt={selectedProperty.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            onClick={(e) => toggleSaveProperty(e, selectedProperty.id)}
                            className="absolute bottom-1 right-1 p-1 bg-white/90 backdrop-blur-md rounded-full shadow-sm hover:bg-white transition-colors"
                          >
                            <Pin className={cn("w-3 h-3 transition-colors", savedPropertyIds[selectedProperty.id] ? "fill-purple-600 text-purple-600" : "text-gray-900")} />
                          </button>
                        </div>
                        
                        <div className="flex flex-col justify-center flex-1 min-w-0 py-1">
                          <div className="text-sm font-bold text-gray-900 mb-1">
                            ${selectedProperty.price.toLocaleString()}
                            <span className="font-normal text-gray-600 text-xs">
                              {selectedProperty.listingType === 'sale' ? '' : '/mo'}
                            </span>
                          </div>
                          <h4 className="font-semibold text-xs text-gray-900 truncate mb-1">
                            {selectedProperty.title}
                          </h4>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{selectedProperty.location}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-[10px] text-gray-600">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-gray-900">{selectedProperty.beds}</span> beds
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-gray-900">{selectedProperty.baths}</span> baths
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Tail pointing down */}
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-gray-100"></div>
                    </motion.div>
                  </div>
                </OverlayView>
              )}
            </GoogleMap>
          )}
          
          {/* Right Side Controls Container */}
          <div className="absolute right-4 top-36 flex flex-col gap-4 z-40 pointer-events-none">
            {/* Map Controls */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col gap-2 pointer-events-auto"
            >
              <button 
                onClick={() => setMapTypeId(prev => prev === 'roadmap' ? 'satellite' : 'roadmap')}
                className={`w-12 h-12 flex items-center justify-center transition-colors bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl shadow-lg ${mapTypeId === 'satellite' ? 'bg-purple-100 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}
                title="Toggle Satellite"
              >
                {mapTypeId === 'roadmap' ? 'Sat' : 'Map'}
              </button>
              <button 
                onClick={() => {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setSearchLocation(location);
                    pendingFitBounds.current = { pos: location, viewport: null };
                  });
                }}
                className="w-12 h-12 bg-white/90 backdrop-blur-md border border-gray-300 rounded-xl shadow-lg flex items-center justify-center text-gray-900 pointer-events-auto hover:bg-purple-50 hover:text-purple-600 transition-colors"
              >
                <Target className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Property Sidebar (Desktop) */}
          <div className="absolute left-4 top-36 bottom-24 w-72 z-10 hidden md:flex flex-col overflow-y-auto no-scrollbar pointer-events-none">
            <div className="pointer-events-auto flex flex-col gap-3 pb-4">
              {/* Featured Properties Section */}
              {properties.filter(p => p.isFeatured).length > 0 && (
                <div className="flex flex-col gap-3 mb-2">
                  <div className="flex items-center gap-1.5 px-1 pt-1">
                    <Star className="w-4 h-4 fill-purple-600 text-purple-600" />
                    <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">Featured Listings</span>
                  </div>
                  {properties.filter(p => p.isFeatured).map((property) => {
                    const idx = properties.findIndex(p => p.id === property.id);
                    return (
                      <div 
                        key={`sidebar-featured-${property.id}`}
                        id={`sidebar-item-${idx}`}
                        className={cn(
                          "bg-white/95 backdrop-blur-md rounded-xl overflow-hidden shadow-lg border transition-all cursor-pointer flex h-24 relative",
                          activePropertyIndex === idx ? "border-purple-600 shadow-xl scale-[1.02]" : "border-gray-200 hover:border-purple-600/30"
                        )}
                        onClick={() => navigate(`/property/${property.id}`)}
                        onMouseEnter={() => handleSidebarHover(idx)}
                      >
                        <div className="w-24 shrink-0 relative">
                          <img 
                            src={property.imageUrl} 
                            alt={property.title} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="p-2.5 flex flex-col justify-between flex-1 min-w-0">
                          <div>
                            <div className="flex justify-between items-start mb-0.5">
                              <h3 className="text-sm font-bold text-gray-900 truncate pr-2">{property.title}</h3>
                              <div className="flex items-center gap-0.5 text-gray-900 font-bold text-xs shrink-0">
                                <Star className="w-3 h-3 fill-[#FACC15] text-[#FACC15]" />
                                <span>{property.rating}</span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{property.location}</p>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-gray-900">{getCurrencySymbol(filters.currency || property.currency)}{convertPrice(property.price, property.currency || 'USD', filters.currency || property.currency || 'USD').toLocaleString()}</span>
                            <span className="text-[10px] text-gray-500">
                              {property.listingType === 'sale' ? '' : '/ night'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="h-px bg-gray-200 my-1 mx-2" />
                </div>
              )}

              {/* All Other Properties */}
              {properties.filter(p => !p.isFeatured).map((property) => {
                const idx = properties.findIndex(p => p.id === property.id);
                return (
                  <div 
                    key={`sidebar-regular-${property.id}`}
                    id={`sidebar-item-${idx}`}
                    className={cn(
                      "bg-white/95 backdrop-blur-md rounded-xl overflow-hidden shadow-lg border transition-all cursor-pointer flex h-24 relative",
                      activePropertyIndex === idx ? "border-purple-600 shadow-xl scale-[1.02]" : "border-gray-200 hover:border-purple-600/30"
                    )}
                    onClick={() => navigate(`/property/${property.id}`)}
                    onMouseEnter={() => handleSidebarHover(idx)}
                  >
                    <div className="w-24 shrink-0 relative">
                      <img 
                        src={property.imageUrl} 
                        alt={property.title} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-2.5 flex flex-col justify-between flex-1 min-w-0">
                      <div>
                        <div className="flex justify-between items-start mb-0.5">
                          <h3 className="text-sm font-bold text-gray-900 truncate pr-2">{property.title}</h3>
                          <div className="flex items-center gap-0.5 text-gray-900 font-bold text-xs shrink-0">
                            <Star className="w-3 h-3 fill-[#FACC15] text-[#FACC15]" />
                            <span>{property.rating}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{property.location}</p>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-gray-900">{getCurrencySymbol(filters.currency || property.currency)}{convertPrice(property.price, property.currency || 'USD', filters.currency || property.currency || 'USD').toLocaleString()}</span>
                        <span className="text-[10px] text-gray-500">
                          {property.listingType === 'sale' ? '' : '/ night'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Property Carousel (Mobile) */}
          {selectedProperty && (
            <div className="absolute bottom-28 left-0 right-0 z-10 md:hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
              <div 
                ref={carouselRef}
                onScroll={handleCarouselScroll}
                className="flex gap-4 overflow-x-auto px-6 pb-4 no-scrollbar snap-x snap-mandatory pointer-events-auto"
              >
                {properties.map((property, idx) => {
                  if (property.id !== selectedProperty.id) return null;
                  return (
                    <div 
                      key={`carousel-${property.id}`}
                      className="w-[85vw] max-w-[320px] shrink-0 snap-center"
                      onClick={() => navigate(`/property/${property.id}`)}
                    >
                      <div className={cn(
                        "bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border transition-all cursor-pointer flex h-28 p-2 gap-3",
                        activePropertyIndex === idx ? "border-purple-600 ring-2 ring-purple-600/20" : "border-gray-100"
                      )}>
                        <div className="w-24 shrink-0 relative rounded-2xl overflow-hidden">
                          <img 
                            src={property.imageUrl} 
                            alt={property.title} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            onClick={(e) => toggleSaveProperty(e, property.id)}
                            className="absolute top-1 right-1 p-1.5 bg-white/90 backdrop-blur-md rounded-full shadow-sm hover:bg-white transition-colors"
                          >
                            <Pin className={cn("w-3 h-3 transition-colors", savedPropertyIds[property.id] ? "fill-purple-600 text-purple-600" : "text-gray-900")} />
                          </button>
                        </div>
                        <div className="flex flex-col justify-between flex-1 min-w-0 py-1 pr-2">
                          <div>
                            <div className="flex justify-between items-start mb-0.5">
                              <h3 className="text-sm font-bold text-gray-900 truncate pr-2">{property.title}</h3>
                              <div className="flex items-center gap-0.5 text-gray-900 font-bold text-xs shrink-0">
                                <Star className="w-3 h-3 fill-[#FACC15] text-[#FACC15]" />
                                <span>{property.rating}</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-500 truncate uppercase tracking-wider font-bold">{property.type}</p>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-bold text-gray-900">{getCurrencySymbol(filters.currency || property.currency)}{convertPrice(property.price, property.currency || 'USD', filters.currency || property.currency || 'USD').toLocaleString()}</span>
                            <span className="text-[10px] text-gray-500">
                              {property.listingType === 'sale' ? '' : '/ night'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


        </div>
      </main>

      <BottomNav />

      {/* Filters Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-2xl font-light tracking-tight text-gray-900">Filters</h3>
              <button onClick={() => setShowFiltersModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-900">
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
                      value={filters.currency || 'USD'}
                      onChange={(e) => handleFilterChange('currency', e.target.value)}
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
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{getCurrencySymbol(filters.currency)}</span>
                        <input 
                          type="number" 
                          value={filters.minPrice || ''}
                          onChange={(e) => handleFilterChange('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-8 pr-4 text-gray-900 focus:border-purple-600 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Maximum Price</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{getCurrencySymbol(filters.currency)}</span>
                        <input 
                          type="number" 
                          value={filters.maxPrice || ''}
                          onChange={(e) => handleFilterChange('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
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
                      onClick={() => handleFilterChange('type', filters.type === type ? undefined : type)}
                      className={`p-4 rounded-xl border text-sm font-medium transition-all ${
                        filters.type === type ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-600/30'
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
                          onClick={() => handleFilterChange('beds', num === 'Any' ? undefined : num)}
                          className={`px-6 py-3 rounded-full border text-sm font-bold transition-all ${
                            (num === 'Any' && !filters.beds) || filters.beds === num 
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
                          onClick={() => handleFilterChange('baths', num === 'Any' ? undefined : num)}
                          className={`px-6 py-3 rounded-full border text-sm font-bold transition-all ${
                            (num === 'Any' && !filters.baths) || filters.baths === num 
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
                          onClick={() => handleFilterChange('guests', num === 'Any' ? undefined : num)}
                          className={`px-6 py-3 rounded-full border text-sm font-bold transition-all ${
                            (num === 'Any' && !filters.guests) || filters.guests === num 
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
                          filters.amenities?.includes(amenity) ? 'bg-white border-purple-600' : 'bg-white border-gray-200 group-hover:border-purple-600/30'
                        }`}
                        onClick={() => handleAmenityToggle(amenity)}
                      >
                        {filters.amenities?.includes(amenity) && <Check className="w-4 h-4 text-black" />}
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-between pb-24 md:pb-6">
              <button 
                onClick={() => {
                  handleFilterChange('minPrice', undefined);
                  handleFilterChange('maxPrice', undefined);
                  handleFilterChange('type', undefined);
                  handleFilterChange('amenities', []);
                  handleFilterChange('beds', undefined);
                  handleFilterChange('baths', undefined);
                  handleFilterChange('guests', undefined);
                }}
                className="text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 underline"
              >
                Clear All
              </button>
              <Button onClick={() => setShowFiltersModal(false)} className="px-10 bg-purple-600 text-white hover:bg-purple-700">
                Show Results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


