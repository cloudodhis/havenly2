import React, { useState, useEffect } from 'react';
import { Star, Edit2, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, query, where, getDocs, doc } from 'firebase/firestore';

export interface Property {
  id: string;
  title: string;
  location: string;
  lat?: number;
  lng?: number;
  price: number;
  currency?: string;
  rating: number;
  imageUrl: string;
  imageUrls?: string[];
  beds: number;
  baths: number;
  sqft: number;
  guests?: number;
  type?: string;
  listingType?: 'rent' | 'sale';
  isAIRecommended?: boolean;
  isFeatured?: boolean;
  priority?: 'Top' | 'High' | 'Normal';
  landlordId?: string;
  amenities?: string[];
  createdAt?: string;
}

interface PropertyCardProps {
  property: Property;
  className?: string;
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
}

export function PropertyCard({ property, className, onClick, onEdit }: PropertyCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'JPY': return '¥';
      default: return '$';
    }
  };

  useEffect(() => {
    if (user) {
      const checkSavedStatus = async () => {
        const q = query(
          collection(db, 'savedProperties'), 
          where('userId', '==', user.uid),
          where('propertyId', '==', property.id)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setIsSaved(true);
          setSavedDocId(snapshot.docs[0].id);
        }
      };
      checkSavedStatus();
    }
  }, [user, property.id]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal('renter');
      return;
    }

    try {
      if (isSaved && savedDocId) {
        await deleteDoc(doc(db, 'savedProperties', savedDocId));
        setIsSaved(false);
        setSavedDocId(null);
      } else {
        const docRef = await addDoc(collection(db, 'savedProperties'), {
          userId: user.uid,
          propertyId: property.id,
          createdAt: new Date().toISOString()
        });
        setIsSaved(true);
        setSavedDocId(docRef.id);
      }
    } catch (error) {
      console.error("Error toggling saved property:", error);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/property/${property.id}`);
    }
  };

  return (
    <div
      className={cn(
        "group cursor-pointer flex flex-col gap-4",
        className
      )}
      onClick={handleClick}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
        <img
          src={property.imageUrls?.[0] || property.imageUrl}
          alt={property.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <button
          onClick={handleSave}
          className="absolute right-4 top-4 z-10 p-2.5 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 transition-colors"
        >
          <Pin
            className={cn("h-5 w-5 transition-colors", isSaved ? "fill-purple-600 text-purple-600" : "text-white")}
          />
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="absolute left-4 top-4 z-10 p-2.5 rounded-full bg-white/90 backdrop-blur-md text-gray-900 hover:bg-white transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {property.type || 'STAY'} • {property.location.split(',')[0]}
            </span>
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-gray-200 transition-colors">
              {property.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
            <Star className="w-3.5 h-3.5 fill-purple-600" />
            <span>{property.rating.toFixed(2)}</span>
          </div>
        </div>
        
        <p className="text-sm text-gray-500">
          {property.guests || 4} guests • {property.beds} bedrooms • {property.baths} baths
        </p>
        
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-lg font-bold text-gray-900">{getCurrencySymbol(property.currency)}{property.price.toLocaleString()}</span>
          <span className="text-sm text-gray-500">
            {property.listingType === 'sale' ? '' : '/ night'}
          </span>
          {property.price > 1000 && (
            <span className="ml-auto text-xs text-gray-600 line-through">
              {getCurrencySymbol(property.currency)}{(property.price * 1.2).toLocaleString()} total
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
