import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Property, PublicProfile } from '../types';
import { MapPin, Star, Building, Globe, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { BottomNav } from '../components/BottomNav';

export function LandlordProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchProfileAndProperties() {
      if (!id) return;
      try {
        setLoading(true);
        // Fetch profile
        const profileDoc = await getDoc(doc(db, 'public_profiles', id));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as PublicProfile);
        } else {
          // If no public profile, try to get basic user info if possible, or just show empty
          setError('Profile not found.');
        }

        // Fetch properties
        const q = query(collection(db, 'properties'), where('landlordId', '==', id));
        const querySnapshot = await getDocs(q);
        const fetchedProperties = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Property[];
        
        // Filter active properties unless it's the owner or admin viewing
        const visibleProperties = fetchedProperties.filter(p => 
          p.status === 'active' || p.landlordId === user?.uid || user?.role === 'admin'
        );
        
        setProperties(visibleProperties);
      } catch (err) {
        console.error("Error fetching landlord profile:", err);
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    }

    fetchProfileAndProperties();
  }, [id, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Profile Not Found</h2>
            <p className="mt-2 text-gray-600">The landlord profile you are looking for does not exist or has been removed.</p>
            <Link to="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
              Return to Home
            </Link>
          </div>
        </div>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  const isOwner = user?.uid === id;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-grow pb-12">
        {/* Header / Cover */}
      <div className="h-48 bg-indigo-600 w-full relative">
        {isOwner && (
          <div className="absolute top-4 right-4">
            <Link
              to="/edit-profile"
              className="bg-white text-indigo-600 px-4 py-2 rounded-md font-medium shadow-sm hover:bg-gray-50"
            >
              Edit Profile
            </Link>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 md:flex md:items-start md:space-x-8">
            {/* Avatar */}
            <div className="flex-shrink-0 mb-6 md:mb-0">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="w-32 h-32 rounded-full border-4 border-white shadow-md object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-32 h-32 rounded-full border-4 border-white shadow-md bg-indigo-100 flex items-center justify-center text-indigo-600 text-4xl font-bold">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold text-gray-900">{profile.businessName || profile.name}</h1>
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              </div>
              
              {profile.businessName && (
                <p className="text-lg text-gray-600 mt-1">Managed by {profile.name}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                {profile.website && (
                  <div className="flex items-center">
                    <Globe className="h-4 w-4 mr-2 text-gray-400" />
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
                      {profile.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                {profile.contactEmail && (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    <a href={`mailto:${profile.contactEmail}`} className="hover:text-indigo-600">
                      {profile.contactEmail}
                    </a>
                  </div>
                )}
                {profile.contactPhone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    <a href={`tel:${profile.contactPhone}`} className="hover:text-indigo-600">
                      {profile.contactPhone}
                    </a>
                  </div>
                )}
                <div className="flex items-center">
                  <Building className="h-4 w-4 mr-2 text-gray-400" />
                  <span>Member since {new Date(profile.createdAt).getFullYear()}</span>
                </div>
              </div>

              {profile.businessDescription && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900">About</h3>
                  <p className="mt-2 text-gray-600 whitespace-pre-wrap">{profile.businessDescription}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Listings */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Properties by {profile.businessName || profile.name}</h2>
            <div className="flex items-center gap-4">
              <span className="bg-indigo-100 text-indigo-800 text-sm font-medium px-3 py-1 rounded-full">
                {properties.length} {properties.length === 1 ? 'Listing' : 'Listings'}
              </span>
              {isOwner && (
                <Link
                  to="/add-property"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Post Listing
                </Link>
              )}
            </div>
          </div>

          {properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <Link key={property.id} to={`/property/${property.id}`} className="group block">
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 transition-shadow duration-200 group-hover:shadow-md">
                    <div className="relative h-48">
                      <img
                        src={property.imageUrl || property.imageUrls?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'}
                        alt={property.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4 bg-white px-2 py-1 rounded-md text-sm font-bold text-gray-900 shadow-sm">
                        ${property.price.toLocaleString()}
                        {property.listingType === 'sale' ? '' : '/mo'}
                      </div>
                      {property.status !== 'active' && isOwner && (
                        <div className="absolute top-4 left-4 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md text-xs font-bold shadow-sm uppercase tracking-wider">
                          {property.status}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {property.title}
                          </h3>
                          <p className="text-sm text-gray-500 flex items-center mt-1">
                            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span className="line-clamp-1">{property.location}</span>
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-gray-600 border-t border-gray-100 pt-4">
                        <div className="flex space-x-4">
                          <span><strong>{property.beds}</strong> beds</span>
                          <span><strong>{property.baths}</strong> baths</span>
                          <span><strong>{property.sqft}</strong> sqft</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
              <Building className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No properties</h3>
              <p className="mt-1 text-sm text-gray-500">This landlord doesn't have any active listings right now.</p>
            </div>
          )}
        </div>
      </div>
      </div>
      <Footer />
      <BottomNav />
    </div>
  );
}
