import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pin, Share, Star, Wifi, Coffee, Car, ShieldCheck, Calendar as CalendarIcon, Loader2, Send, MapPin, Edit, Maximize2, X, ChevronLeft, ChevronRight, Plus, Home, AlertTriangle, CheckCircle, ArrowRight, Bed, Bath } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import DatePicker from 'react-datepicker';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker, OverlayView } from '@react-google-maps/api';
import { useSearchParams } from 'react-router-dom';
import { moderateMessage } from '../lib/moderation';
import ReviewModal from '../components/ReviewModal';

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

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '1rem',
};

const mapOptions = {
  styles: mapStyles,
  disableDefaultUI: false,
  zoomControl: false,
  mapTypeControl: true,
  streetViewControl: true,
  fullscreenControl: false,
  gestureHandling: "greedy"
};

const modalMapOptions = {
  styles: mapStyles,
  disableDefaultUI: false,
  zoomControl: false,
  mapTypeControl: true,
  streetViewControl: true,
  gestureHandling: "greedy"
};

const directionsOptions = {
  preserveViewport: true,
  polylineOptions: {
    strokeColor: '#9333ea',
    strokeWeight: 5,
  },
};

const modalDirectionsOptions = {
  preserveViewport: true,
  polylineOptions: {
    strokeColor: '#9333ea',
    strokeWeight: 6,
  },
};

const UserLocationMarker = React.memo(({ position }: { position: { lat: number, lng: number, heading: number | null } }) => {
  const prevHeadingRef = useRef<number>(0);
  const cumulativeHeadingRef = useRef<number>(0);

  let displayHeading = cumulativeHeadingRef.current;
  
  if (position.heading !== null) {
    let diff = position.heading - prevHeadingRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    cumulativeHeadingRef.current += diff;
    prevHeadingRef.current = position.heading;
    displayHeading = cumulativeHeadingRef.current;
  }

  return (
    <OverlayView
      position={{ lat: position.lat, lng: position.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div 
        className="flex items-center justify-center w-8 h-8 transform -translate-x-1/2 -translate-y-1/2"
        style={{
          transition: 'transform 0.5s ease-out',
          transform: `translate(-50%, -50%) rotate(${displayHeading}deg)`
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' }}>
          <path d="M12 2L22 20L12 17L2 20L12 2Z" fill="#9333ea" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
    </OverlayView>
  );
});

export function PropertyDetail() {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [isFullScreenGalleryOpen, setIsFullScreenGalleryOpen] = useState(false);
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState(0);

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<any>(null);

  // Keyboard navigation for full screen gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullScreenGalleryOpen || !property) return;
      
      const images = [property.imageUrl, ...(property.imageUrls || [])].filter(Boolean);
      if (e.key === 'Escape') setIsFullScreenGalleryOpen(false);
      if (e.key === 'ArrowLeft') setFullScreenImageIndex(prev => Math.max(0, prev - 1));
      if (e.key === 'ArrowRight') setFullScreenImageIndex(prev => Math.min(images.length - 1, prev + 1));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreenGalleryOpen, property]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [hostReviews, setHostReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const { user, openAuthModal } = useAuth();
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [lastSentMessage, setLastSentMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [viewingDate, setViewingDate] = useState<Date | null>(null);
  const [bookingViewing, setBookingViewing] = useState(false);
  const [viewingBooked, setViewingBooked] = useState(false);
  const [showViewingPicker, setShowViewingPicker] = useState(false);
  const [searchParams] = useSearchParams();
  const [showDirections, setShowDirections] = useState(false);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [calculatingDirections, setCalculatingDirections] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [userPosition, setUserPosition] = useState<{lat: number, lng: number, heading: number | null} | null>(null);
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);
  const [mapZoom, setMapZoom] = useState(15);
  const [modalMapCenter, setModalMapCenter] = useState<{lat: number, lng: number} | null>(null);
  const [modalMapZoom, setModalMapZoom] = useState(14);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'listing' | 'user'>('listing');
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);
  
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState('');
  const [reviewTargetName, setReviewTargetName] = useState('');
  const [reviewTargetType, setReviewTargetType] = useState<'property' | 'landlord' | 'renter'>('property');

  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [landlordProfile, setLandlordProfile] = useState<any>(null);
  const [otherListings, setOtherListings] = useState<any[]>([]);
  const [loadingOtherListings, setLoadingOtherListings] = useState(true);
  const [applicationData, setApplicationData] = useState({
    moveInDate: new Date(),
    occupants: 1,
    employmentStatus: 'Employed',
    monthlyIncome: '',
    message: ''
  });
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const modalMapRef = useRef<google.maps.Map | null>(null);

  const snappedUserPosition = useMemo(() => {
    if (!userPosition || !directionsResponse || !directionsResponse.routes[0]) {
      return userPosition;
    }
    
    try {
      const path = directionsResponse.routes[0].overview_path;
      if (!path || path.length === 0) return userPosition;

      const userLatLng = new google.maps.LatLng(userPosition.lat, userPosition.lng);
      let minDistance = Infinity;
      let closestPoint = null;
      let segmentHeading = userPosition.heading;

      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        
        const x0 = userLatLng.lng();
        const y0 = userLatLng.lat();
        const x1 = p1.lng();
        const y1 = p1.lat();
        const x2 = p2.lng();
        const y2 = p2.lat();

        const dx = x2 - x1;
        const dy = y2 - y1;

        let t = 0;
        if (dx !== 0 || dy !== 0) {
          t = ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy);
          t = Math.max(0, Math.min(1, t));
        }

        const closest = new google.maps.LatLng(y1 + t * dy, x1 + t * dx);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(userLatLng, closest);

        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = closest;
          segmentHeading = google.maps.geometry.spherical.computeHeading(p1, p2);
        }
      }

      // Only snap if within 50 meters of the route
      if (minDistance < 50 && closestPoint) {
        let finalHeading = segmentHeading;
        if (userPosition.heading !== null) {
          let diff = userPosition.heading - segmentHeading;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          
          if (Math.abs(diff) > 90) {
            finalHeading = segmentHeading + 180;
            while (finalHeading > 360) finalHeading -= 360;
          }
        }

        return {
          lat: closestPoint.lat(),
          lng: closestPoint.lng(),
          heading: finalHeading
        };
      }
    } catch (e) {
      console.error("Error snapping to route:", e);
    }
    
    return userPosition;
  }, [userPosition, directionsResponse]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showDirections && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setUserPosition(null);
    }
  }, [showDirections]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  const handleGetDirections = async () => {
    if (showDirections) {
      setShowDirections(false);
      return;
    }

    if (!isLoaded) {
      alert("Google Maps is still loading. Please try again in a moment.");
      return;
    }

    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      alert("Google Maps API key is missing. Please configure it in the settings.");
      return;
    }

    setCalculatingDirections(true);
    
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setCalculatingDirections(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const origin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading
        });

        const destination = property.lat && property.lng 
          ? { lat: property.lat, lng: property.lng }
          : property.location;

        const directionsService = new google.maps.DirectionsService();
        
        try {
          const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
            directionsService.route(
              {
                origin: origin,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING,
              },
              (result, status) => {
                if (status === google.maps.DirectionsStatus.OK && result) {
                  resolve(result);
                } else {
                  reject({ message: `Directions request failed with status: ${status}`, code: status });
                }
              }
            );
          });
          
          setDirectionsResponse(result);
          setShowDirections(true);
          
          if (mapRef.current) {
            mapRef.current.panTo({ lat: origin.lat, lng: origin.lng });
            mapRef.current.setZoom(16);
          }
          
          if (modalMapRef.current) {
            modalMapRef.current.panTo({ lat: origin.lat, lng: origin.lng });
            modalMapRef.current.setZoom(16);
          }
          
          // Scroll to map
          setTimeout(() => {
            mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);

          // Start watching position
          if (watchIdRef.current === null) {
            let lastUpdate = 0;
            watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => {
                const now = Date.now();
                if (now - lastUpdate > 500) {
                  lastUpdate = now;
                  setUserPosition((prev) => ({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    heading: pos.coords.heading !== null ? pos.coords.heading : (prev?.heading || null)
                  }));
                }
              },
              (err) => console.error("Error watching position:", err),
              { enableHighAccuracy: true, maximumAge: 500, timeout: 5000 }
            );
          }
        } catch (error: any) {
          console.error("Error calculating directions:", error);
          
          // Handle specific Google Maps error codes
          const errorMessage = error?.message || String(error);
          const errorCode = error?.code || '';
          
          if (errorCode === 'REQUEST_DENIED' || errorMessage.includes('REQUEST_DENIED')) {
            alert("Access Denied: Please ensure the 'Directions API' and 'Geocoding API' are enabled in your Google Cloud Console. Also, check if your API key has 'HTTP Referrer' restrictions that might be blocking this domain.");
          } else if (errorCode === 'ZERO_RESULTS' || errorMessage.includes('ZERO_RESULTS')) {
            alert("No route could be found between your location and the property. This might happen if the property address is incomplete or across an ocean.");
          } else if (errorCode === 'NOT_FOUND' || errorMessage.includes('NOT_FOUND')) {
            alert("One of the locations (your position or the property address) could not be geocoded. Please check the property address.");
          } else {
            alert(`Could not calculate directions: ${errorMessage}. Please ensure your location services are enabled.`);
          }
        } finally {
          setCalculatingDirections(false);
        }
      },
      (error) => {
        console.error("Error getting user location:", error);
        alert("Could not get your location. Please enable location services.");
        setCalculatingDirections(false);
      }
    );
  };

  const defaultCenter = useMemo(() => ({ lat: property?.lat || 0, lng: property?.lng || 0 }), [property?.lat, property?.lng]);

  useEffect(() => {
    if (property && searchParams.get('directions') === 'true' && isLoaded) {
      handleGetDirections();
    }
  }, [property, isLoaded, searchParams]);

  useEffect(() => {
    const fetchProperty = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'properties', id);
        let docSnap;
        try {
          docSnap = await getDoc(docRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `properties/${id}`);
          return;
        }

        if (docSnap.exists()) {
          const propData = { id: docSnap.id, ...docSnap.data() };
          setProperty(propData);
          
          // Fetch reviews
          try {
            const reviewsRef = collection(db, 'reviews');
            
            // Property reviews
            const propReviewsQuery = query(reviewsRef, where('targetId', '==', id), where('targetType', '==', 'property'));
            const propReviewsSnap = await getDocs(propReviewsQuery);
            setReviews(propReviewsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            
            // Host reviews
            if (propData.landlordId) {
              // Fetch landlord profile
              try {
                const profileRef = doc(db, 'users', propData.landlordId);
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) {
                  setLandlordProfile({ id: profileSnap.id, ...profileSnap.data() });
                }
              } catch (e) {
                console.error("Error fetching landlord profile:", e);
              }

              const hostReviewsQuery = query(reviewsRef, where('targetId', '==', propData.landlordId), where('targetType', '==', 'landlord'));
              const hostReviewsSnap = await getDocs(hostReviewsQuery);
              setHostReviews(hostReviewsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

              // Fetch other listings from the same landlord
              try {
                const otherListingsQuery = query(
                  collection(db, 'properties'),
                  where('landlordId', '==', propData.landlordId),
                  where('status', '==', 'active'),
                  limit(5)
                );
                const otherListingsSnap = await getDocs(otherListingsQuery);
                const listings = otherListingsSnap.docs
                  .map(d => ({ id: d.id, ...d.data() }))
                  .filter(p => p.id !== id);
                setOtherListings(listings);
              } catch (e) {
                console.error("Error fetching other listings:", e);
              } finally {
                setLoadingOtherListings(false);
              }
            }
          } catch (e) {
            console.error("Error fetching reviews:", e);
          } finally {
            setLoadingReviews(false);
          }
        } else {
          setError('Property not found');
          setLoadingReviews(false);
        }
      } catch (err) {
        console.error("Error fetching property:", err);
        setError('Failed to load property details');
        setLoadingReviews(false);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

  useEffect(() => {
    const checkSavedStatus = async () => {
      if (!user || !id) return;
      try {
        const q = query(
          collection(db, 'savedProperties'),
          where('userId', '==', user.uid),
          where('propertyId', '==', id)
        );
        const querySnapshot = await getDocs(q);
        setIsSaved(!querySnapshot.empty);
      } catch (error) {
        console.error("Error checking saved status:", error);
      }
    };

    checkSavedStatus();
  }, [user, id]);

  const handleToggleSave = async () => {
    if (!user) {
      openAuthModal('renter');
      return;
    }

    setSavingProperty(true);
    try {
      if (isSaved) {
        // Remove from saved
        const q = query(
          collection(db, 'savedProperties'),
          where('userId', '==', user.uid),
          where('propertyId', '==', id)
        );
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      } else {
        // Add to saved
        await addDoc(collection(db, 'savedProperties'), {
          userId: user.uid,
          propertyId: id,
          createdAt: new Date().toISOString()
        });
      }
      setIsSaved(!isSaved);
    } catch (error) {
      console.error("Error toggling save:", error);
      alert("Failed to update saved properties. Please try again.");
    } finally {
      setSavingProperty(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: property?.title || 'Havenly Property',
      text: `Check out this property on Havenly: ${property?.title}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleSendInquiry = async () => {
    if (!user) {
      openAuthModal('renter');
      return;
    }
    if (!inquiryMessage.trim()) return;

    setSendingInquiry(true);
    try {
      const now = new Date().toISOString();
      
      try {
        // 1. Create the inquiry (for legacy dashboard view)
        await addDoc(collection(db, 'inquiries'), {
          propertyId: property.id,
          renterId: user.uid,
          landlordId: property.landlordId,
          message: inquiryMessage,
          status: 'pending',
          createdAt: now
        });

        // 2. Check if a conversation already exists between this renter and landlord for this property
        const convsRef = collection(db, 'conversations');
        const q = query(
          convsRef,
          where('renterId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        
        // Filter in memory to avoid needing a composite index
        const existingConv = querySnapshot.docs.find(doc => 
          doc.data().propertyId === property.id && 
          doc.data().landlordId === property.landlordId
        );
        
        let conversationId = '';
        
        if (!existingConv) {
          // Create new conversation
          const newConvRef = await addDoc(convsRef, {
            propertyId: property.id,
            renterId: user.uid,
            landlordId: property.landlordId,
            lastMessage: inquiryMessage,
            lastMessageAt: now,
            createdAt: now
          });
          conversationId = newConvRef.id;
        } else {
          // Update existing conversation
          conversationId = existingConv.id;
          await updateDoc(doc(db, 'conversations', conversationId), {
            lastMessage: inquiryMessage,
            lastMessageAt: now
          });
        }

        // 3. Add the message to the conversation
        const messageRef = await addDoc(collection(db, 'messages'), {
          conversationId,
          senderId: user.uid,
          text: inquiryMessage,
          createdAt: now
        });

        // Run AI moderation asynchronously
        moderateMessage(inquiryMessage).then(async (moderationResult) => {
          if (moderationResult.isFlagged) {
            await updateDoc(doc(db, 'messages', messageRef.id), {
              isFlagged: true,
              flagReason: moderationResult.reason
            });
            await updateDoc(doc(db, 'conversations', conversationId), {
              isFlagged: true,
              flagReason: moderationResult.reason
            });
          }
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'inquiries/conversations');
      }
      setLastSentMessage(inquiryMessage);
      setInquirySent(true);
      setInquiryMessage('');
    } catch (err) {
      console.error("Error sending inquiry:", err);
      alert("Failed to send inquiry. Please try again.");
    } finally {
      setSendingInquiry(false);
    }
  };

  const handleApply = async () => {
    if (!user) {
      openAuthModal('renter');
      return;
    }
    
    setSubmittingApplication(true);
    try {
      await addDoc(collection(db, 'applications'), {
        propertyId: property.id,
        tenantId: user.uid,
        landlordId: property.landlordId,
        status: 'pending',
        moveInDate: applicationData.moveInDate.toISOString(),
        occupants: applicationData.occupants,
        employmentStatus: applicationData.employmentStatus,
        monthlyIncome: Number(applicationData.monthlyIncome),
        message: applicationData.message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        propertyTitle: property.title,
        tenantName: user.name || user.email,
        landlordName: property.landlordName || 'Landlord'
      });
      
      setApplicationSubmitted(true);
      setTimeout(() => {
        setIsApplicationModalOpen(false);
        setApplicationSubmitted(false);
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'applications');
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleBookViewing = async () => {
    if (!user) {
      openAuthModal('renter');
      return;
    }
    if (!viewingDate) return;

    setBookingViewing(true);
    try {
      try {
        await addDoc(collection(db, 'viewings'), {
          propertyId: property.id,
          renterId: user.uid,
          landlordId: property.landlordId,
          date: viewingDate.toISOString(),
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'viewings');
      }
      setViewingBooked(true);
      setShowViewingPicker(false);
    } catch (err) {
      console.error("Error booking viewing:", err);
      alert("Failed to book viewing. Please try again.");
    } finally {
      setBookingViewing(false);
    }
  };

  const handleReport = async () => {
    if (!user) {
      openAuthModal('renter');
      return;
    }
    if (!reportReason.trim()) {
      alert("Please provide a reason for reporting.");
      return;
    }

    setSubmittingReport(true);
    try {
      await addDoc(collection(db, 'reports'), {
        type: reportType,
        reportedItemId: reportType === 'listing' ? property.id : property.landlordId,
        reportedItemName: reportType === 'listing' ? property.title : 'Landlord',
        landlordId: property.landlordId,
        reportedBy: user.uid,
        reportedByName: user.name || user.email,
        reason: reportReason,
        status: 'pending',
        priority: 'medium',
        createdAt: new Date().toISOString()
      });
      setIsReportModalOpen(false);
      setReportReason('');
      alert("Report submitted successfully. Our team will review it shortly.");
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Failed to submit report. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white text-gray-900">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen flex flex-col bg-white text-gray-900">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Oops!</h2>
            <p className="text-gray-500">{error || 'Property not found'}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 overflow-x-hidden pb-24 lg:pb-0">
      <div className="hidden lg:block">
        <Navbar />
      </div>
      
      {/* Header Overlay */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg pointer-events-auto hover:bg-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex gap-3 pointer-events-auto">
          <button 
            className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-colors" 
            onClick={() => { setReportType('listing'); setIsReportModalOpen(true); }}
          >
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </button>
          <button 
            className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-colors" 
            onClick={handleShare}
          >
            <Share className="w-5 h-5 text-gray-900" />
          </button>
          <button 
            onClick={handleToggleSave}
            disabled={savingProperty}
            className="p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-colors"
          >
            <Pin className={`w-5 h-5 ${isSaved ? 'fill-purple-600 text-purple-600' : 'text-gray-900'}`} />
          </button>
        </div>
      </div>

      {/* Main Gallery Grid (Image 1 Style) */}
      <section className="bg-[#121212] p-4 lg:p-8 pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 aspect-[16/10] md:aspect-[21/9] lg:aspect-[21/8]">
            {/* Large Featured Image */}
            <div className="md:col-span-2 relative group cursor-pointer overflow-hidden rounded-2xl" onClick={() => setIsGalleryModalOpen(true)}>
              <img 
                src={property.imageUrl} 
                alt={property.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 transition-opacity" />
              
              {/* Badges on Image */}
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] font-bold tracking-widest uppercase rounded-lg shadow-sm">
                  Popular
                </span>
                <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md text-gray-900 text-[10px] font-bold tracking-widest uppercase rounded-lg shadow-sm flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" />
                  {property.location?.split(',')[0] || 'Migosi'}
                </span>
              </div>

              <div className="absolute bottom-4 left-4">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold tracking-widest uppercase rounded-full">
                  Premium Selection
                </span>
              </div>

              {/* Thumbnails Overlay (Image 2 Style) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-1 bg-black/20 backdrop-blur-md rounded-xl border border-white/10">
                {[property.imageUrl, ...(property.imageUrls || [])].slice(0, 3).map((url, i) => (
                  <div key={i} className={`w-10 h-10 rounded-lg overflow-hidden border-2 ${i === 0 ? 'border-white' : 'border-transparent opacity-60'}`}>
                    <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Grid (2x2) */}
            <div className="hidden md:grid grid-cols-2 grid-rows-2 gap-4 md:col-span-2">
              {[...(property.imageUrls || [])].slice(0, 4).map((url, index) => (
                <div 
                  key={index} 
                  className="relative group cursor-pointer overflow-hidden rounded-2xl"
                  onClick={() => {
                    setFullScreenImageIndex(index + 1);
                    setIsFullScreenGalleryOpen(true);
                  }}
                >
                  <img 
                    src={url} 
                    alt={`${property.title} ${index + 2}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {index === 3 && (property.imageUrls?.length > 4) && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        View All {property.imageUrls.length + 1} Photos
                      </span>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Fallback if not enough images */}
              {Array.from({ length: Math.max(0, 4 - (property.imageUrls?.length || 0)) }).map((_, i) => (
                <div key={`fallback-${i}`} className="bg-gray-800 rounded-2xl flex items-center justify-center">
                  <Home className="w-8 h-8 text-gray-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Property Info Section */}
      <div className="max-w-7xl mx-auto w-full px-4 pt-12">
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{property.title}</h1>
            <p className="text-gray-500 flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5" />
              {property.location}
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleShare}
              className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all active:scale-95"
            >
              <Share className="w-6 h-6 text-gray-900" />
            </button>
            <button 
              onClick={handleToggleSave}
              disabled={savingProperty}
              className="p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all active:scale-95"
            >
              {savingProperty ? (
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              ) : (
                <Pin className={`w-6 h-6 ${isSaved ? 'fill-purple-600 text-purple-600' : 'text-gray-400'}`} />
              )}
            </button>
          </div>
        </div>

        <main className="flex-grow pb-32 lg:pb-12">
          <div className="container mx-auto mt-12">
            <div className="flex flex-col lg:flex-row gap-12 relative">
            {/* Left Column: Main Content */}
            <div className="lg:w-2/3">
              {/* Property Summary */}
              <div className="mb-12">
                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-500 mb-8">
                  <div className="flex items-center gap-1 text-gray-900">
                    <Star className="w-4 h-4 fill-purple-600 text-purple-600" />
                    <span className="font-bold">{property.rating || 'New'}</span>
                    <span className="text-gray-400">({reviews.length} reviews)</span>
                  </div>
                  <span>·</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span className="underline cursor-pointer hover:text-gray-900 transition-colors">{property.location}</span>
                  </div>
                  <span>·</span>
                  <div className="flex items-center gap-2">
                    <img src={landlordProfile?.photoUrl || "https://picsum.photos/seed/host/40/40"} alt="Host" className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                    <span>Hosted by <Link to={`/landlord/${property.landlordId}`} className="font-bold text-gray-900 hover:text-purple-600 underline">{landlordProfile?.name || property.landlordName || 'Landlord'}</Link></span>
                  </div>
                </div>

                {/* Quick Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Type</span>
                    <span className="text-gray-900 font-bold">{property.type || 'Apartment'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Bedrooms</span>
                    <span className="text-gray-900 font-bold">{property.beds} Rooms</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Bathrooms</span>
                    <span className="text-gray-900 font-bold">{property.baths} Baths</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Size</span>
                    <span className="text-gray-900 font-bold">{property.sqft} sqft</span>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="mb-12 pb-12 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight">About this property</h2>
                <div className={`text-gray-600 leading-relaxed text-lg ${!showFullDescription ? 'line-clamp-4' : ''}`}>
                  {property.description || `Experience the true lifestyle in this stunning space. Featuring ${property.sqft} sqft of living area, this space perfectly blends historic charm with modern luxury. Located in the heart of ${property.location}, you're just steps away from the best cafes, restaurants, and boutique shops the neighborhood has to offer.`}
                </div>
                <button 
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="mt-4 text-purple-600 font-bold underline hover:text-purple-700 transition-colors"
                >
                  {showFullDescription ? 'Read less' : 'Read more'}
                </button>
              </div>

              {/* Amenities Section */}
              <div className="mb-12 pb-12 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 tracking-tight">What this place offers</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6">
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="p-3 bg-gray-50 rounded-xl"><Wifi className="w-6 h-6 text-gray-900" /></div>
                    <span className="text-lg font-medium">High-speed Wi-Fi</span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="p-3 bg-gray-50 rounded-xl"><Car className="w-6 h-6 text-gray-900" /></div>
                    <span className="text-lg font-medium">Free on-site parking</span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="p-3 bg-gray-50 rounded-xl"><ShieldCheck className="w-6 h-6 text-gray-900" /></div>
                    <span className="text-lg font-medium">24/7 Security</span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-600">
                    <div className="p-3 bg-gray-50 rounded-xl"><Coffee className="w-6 h-6 text-gray-900" /></div>
                    <span className="text-lg font-medium">Coffee & Tea station</span>
                  </div>
                </div>
                <Button variant="outline" className="mt-10 border-gray-200 text-gray-900 hover:bg-gray-100 px-8 py-6 rounded-xl font-bold">
                  Show all 24 amenities
                </Button>
              </div>

              {/* Location Map Section */}
              <div className="mb-12 pb-12 border-b border-gray-100">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Location</h2>
                    <p className="text-gray-500 font-medium">{property.location}</p>
                  </div>
                  <Button 
                    onClick={handleGetDirections}
                    disabled={calculatingDirections}
                    className="flex items-center gap-2 rounded-2xl shadow-lg hover:scale-105 transition-transform bg-purple-600 hover:bg-purple-700 text-white border-none"
                  >
                    {calculatingDirections ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                    {showDirections ? 'Hide directions' : 'Get directions'}
                  </Button>
                </div>
                
                <div className="h-[400px] rounded-3xl overflow-hidden border border-gray-100 relative shadow-inner">
                  {isLoaded ? (
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={mapCenter || defaultCenter}
                      zoom={mapZoom}
                      onLoad={(map) => { mapRef.current = map; }}
                      options={mapOptions}
                    >
                      {showDirections && directionsResponse ? (
                        <>
                          <DirectionsRenderer directions={directionsResponse} options={directionsOptions} />
                          {snappedUserPosition && <UserLocationMarker position={snappedUserPosition} />}
                        </>
                      ) : (
                        property.lat && property.lng && (
                          <OverlayView position={{ lat: property.lat, lng: property.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 border-4 border-white shadow-2xl transform -translate-x-1/2 -translate-y-1/2 scale-110">
                              <Home className="w-5 h-5 text-white" />
                            </div>
                          </OverlayView>
                        )
                      )}
                    </GoogleMap>
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                    </div>
                  )}
                  <button 
                    onClick={() => setIsMapModalOpen(true)}
                    className="absolute bottom-6 right-6 p-4 bg-white rounded-2xl shadow-2xl hover:bg-gray-50 transition-all"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Reviews Section */}
              <div className="mb-12 pb-12 border-b border-gray-100">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                    <Star className="w-6 h-6 fill-purple-600 text-purple-600" />
                    {property.rating || 'New'} · {reviews.length} reviews
                  </h2>
                  <button 
                    onClick={() => {
                      setReviewTargetId(property.id);
                      setReviewTargetName(property.title);
                      setReviewTargetType('property');
                      setReviewModalOpen(true);
                    }}
                    className="text-sm font-bold text-purple-600 hover:underline"
                  >
                    Write a review
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {reviews.slice(0, 4).map((review) => (
                    <div key={review.id} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <img src={`https://picsum.photos/seed/${review.userId}/100/100`} alt="User" className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                        <div>
                          <div className="font-bold text-gray-900">{review.userName || 'Verified Renter'}</div>
                          <div className="text-xs text-gray-400 font-medium">{new Date(review.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                        </div>
                      </div>
                      <p className="text-gray-600 leading-relaxed line-clamp-3">{review.comment}</p>
                    </div>
                  ))}
                </div>
                {reviews.length > 4 && (
                  <Button variant="outline" className="mt-10 border-gray-200 text-gray-900 hover:bg-gray-100 px-8 py-6 rounded-xl font-bold">
                    Show all {reviews.length} reviews
                  </Button>
                )}
              </div>

              {/* Landlord Profile Section */}
              <div className="mb-12 p-8 bg-gray-50 rounded-3xl border border-gray-100">
                <div className="flex items-center gap-6 mb-8">
                  <img src={landlordProfile?.photoUrl || "https://picsum.photos/seed/host/150/150"} alt="Host" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl" referrerPolicy="no-referrer" />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Hosted by {landlordProfile?.name || property.landlordName || 'Landlord'}</h2>
                    <p className="text-gray-500 font-medium">Joined in {landlordProfile?.createdAt ? new Date(landlordProfile.createdAt).getFullYear() : new Date(property.createdAt).getFullYear()}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Response Rate</span>
                    <span className="text-gray-900 font-bold">100%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Response Time</span>
                    <span className="text-gray-900 font-bold">Within an hour</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Identity</span>
                    <span className="text-emerald-500 font-bold flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Verified</span>
                  </div>
                </div>

                <p className="text-gray-600 leading-relaxed mb-8">
                  To protect your payment, never transfer money or communicate outside of the Havenly website or app.
                </p>

                <Button 
                  onClick={() => {
                    setInquirySent(false);
                    setInquiryMessage('Hi, I have a question about your property...');
                    // Scroll to booking panel
                    document.getElementById('booking-panel')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-gray-900 text-white hover:bg-black px-8 py-4 rounded-xl font-bold"
                >
                  Contact Landlord
                </Button>
              </div>
            </div>

            {/* Right Column: Sticky Booking Panel */}
            <div className="lg:w-1/3">
              <div id="booking-panel" className="lg:sticky lg:top-28 bg-white rounded-3xl border border-gray-200 shadow-2xl p-8">
                <div className="flex items-end justify-between mb-8">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900 tracking-tight">${property.price}</span>
                    <span className="text-gray-500 mb-1.5 font-medium">
                      {property.listingType === 'sale' ? '' : '/ month'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                    <Star className="w-4 h-4 fill-purple-600 text-purple-600" />
                    {property.rating || 'New'}
                  </div>
                </div>

                {/* Booking Form */}
                <div className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="p-4 border-r border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Move-in</div>
                      <div className="text-sm font-bold text-gray-900">{property.moveInDate || 'Flexible'}</div>
                    </div>
                    <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Term</div>
                      <div className="text-sm font-bold text-gray-900">{property.term || '12 Months'}</div>
                    </div>
                  </div>

                  {inquirySent ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-emerald-900 mb-1">Inquiry Sent!</h3>
                      <p className="text-xs text-emerald-700 mb-4">The landlord will be notified immediately.</p>
                      <Button 
                        variant="outline" 
                        onClick={() => setInquirySent(false)}
                        className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      >
                        Send another message
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <textarea 
                        value={inquiryMessage}
                        onChange={(e) => setInquiryMessage(e.target.value)}
                        placeholder="Ask the landlord a question..."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-600 outline-none transition-all resize-none h-32 text-sm"
                      />
                      <Button 
                        onClick={handleSendInquiry}
                        disabled={sendingInquiry || !inquiryMessage.trim()}
                        className="w-full py-6 bg-purple-600 text-white hover:bg-purple-700 rounded-2xl font-bold text-lg shadow-xl shadow-purple-200"
                      >
                        {sendingInquiry ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Contact Landlord'}
                      </Button>
                    </div>
                  )}

                  <Button 
                    onClick={() => setIsApplicationModalOpen(true)}
                    className="w-full py-6 bg-gray-900 text-white hover:bg-black rounded-2xl font-bold text-lg"
                  >
                    Apply Now
                  </Button>
                  
                  <button 
                    onClick={() => setShowViewingPicker(true)}
                    className="w-full py-4 text-gray-500 font-bold hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                  >
                    <CalendarIcon className="w-4 h-4" /> Schedule a Viewing
                  </button>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-4 pt-8 border-t border-gray-100">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-500">{property.listingType === 'sale' ? 'Sale Price' : 'Monthly Rent'}</span>
                    <span className="text-gray-900 font-bold">${property.price}</span>
                  </div>
                  {property.listingType !== 'sale' && (
                    <>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-500">Security Deposit</span>
                        <span className="text-gray-900 font-bold">${property.securityDeposit || property.price}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-500">Service Fee</span>
                        <span className="text-gray-900 font-bold">$150</span>
                      </div>
                      <div className="flex justify-between pt-4 border-t border-gray-100">
                        <span className="text-lg font-bold text-gray-900">Total Due at Move-in</span>
                        <span className="text-lg font-bold text-gray-900">${(property.price * 2) + 150}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4" /> Havenly Secure Payment
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Other Listings from Landlord */}
        {otherListings.length > 0 && (
          <div className="mt-24 pt-16 border-t border-gray-100 px-4 md:px-0 bg-gray-50/50 -mx-4 md:-mx-0 pb-24">
            <div className="container mx-auto px-4 md:px-0">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                <div className="max-w-xl">
                  <div className="text-[10px] font-bold text-purple-600 uppercase tracking-[0.2em] mb-3">Curated Selection</div>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
                    More from {landlordProfile?.name || 'this host'}
                  </h2>
                  <p className="text-gray-500 mt-3 text-lg font-medium">
                    Discover other premium properties managed by the same landlord in this neighborhood.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="hidden md:flex gap-2 rounded-2xl border-gray-200 hover:border-purple-600 hover:text-purple-600 px-6 py-6 font-bold transition-all"
                  onClick={() => navigate('/search')}
                >
                  View all listings <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Horizontal Scroll on Mobile, Grid on Desktop */}
              <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-8 overflow-x-auto pb-8 md:pb-0 no-scrollbar snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
                {otherListings.map((listing, idx) => (
                  <motion.div
                    key={listing.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -12 }}
                    className="min-w-[280px] md:min-w-0 snap-start group cursor-pointer"
                    onClick={() => {
                      navigate(`/property/${listing.id}`);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <div className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden mb-6 shadow-sm group-hover:shadow-2xl transition-all duration-700">
                      <img
                        src={listing.imageUrl}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      {/* Top Badges */}
                      <div className="absolute top-5 left-5 right-5 flex justify-between items-start">
                        <div className="px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold text-gray-900 uppercase tracking-widest shadow-lg">
                          {listing.type || 'Apartment'}
                        </div>
                        <button className="p-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-colors">
                          <Pin className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
                        </button>
                      </div>

                      {/* Bottom Info Overlay (Visible on Hover) */}
                      <div className="absolute bottom-6 left-6 right-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                        <div className="flex items-center gap-4 text-white text-[10px] font-bold uppercase tracking-widest">
                          <span className="flex items-center gap-1.5"><Bed className="w-4 h-4" /> {listing.beds} Beds</span>
                          <span className="flex items-center gap-1.5"><Bath className="w-4 h-4" /> {listing.baths} Baths</span>
                          {listing.sqft && <span className="flex items-center gap-1.5"><Maximize2 className="w-4 h-4" /> {listing.sqft} ft²</span>}
                        </div>
                      </div>

                      {/* Price Tag (Always Visible) */}
                      <div className="absolute bottom-6 right-6 px-4 py-2 bg-purple-600 text-white rounded-2xl font-bold shadow-xl group-hover:scale-110 transition-transform duration-500">
                        ${listing.price}
                        <span className="text-[10px] font-medium opacity-80 ml-1">/mo</span>
                      </div>
                    </div>

                    <div className="px-2">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-1 mb-2">
                        {listing.title}
                      </h3>
                      <div className="flex items-center gap-2 text-gray-500 font-medium">
                        <MapPin className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">{listing.location}</span>
                      </div>
                      
                      {/* Subtle Divider & Rating */}
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-purple-600 text-purple-600" />
                          <span className="text-xs font-bold text-gray-900">{listing.rating || 'New'}</span>
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Verified Listing
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Button 
                variant="outline" 
                className="w-full mt-8 md:hidden gap-2 rounded-2xl py-6 font-bold border-gray-200"
                onClick={() => navigate('/search')}
              >
                View all listings <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>

      {/* Sticky Bottom Bar (Image 2 Style) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-4 py-4 lg:px-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">${property.price}</span>
              <span className="text-gray-500 text-sm font-medium">
                {property.listingType === 'sale' ? '' : '/ month'}
              </span>
            </div>
            <button className="text-purple-600 text-xs font-bold underline underline-offset-4 hover:text-purple-700 transition-colors text-left">
              Price Details
            </button>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => {
                if (!user) openAuthModal('renter');
                else {
                  const el = document.getElementById('inquiry-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="px-6 py-3.5 bg-white border border-gray-200 text-gray-900 font-bold rounded-2xl hover:bg-gray-50 transition-all active:scale-95 text-sm md:text-base"
            >
              Inquire
            </button>
            <button 
              onClick={() => {
                if (!user) openAuthModal('renter');
                else setIsApplicationModalOpen(true);
              }}
              className="px-8 py-3.5 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all active:scale-95 text-sm md:text-base"
            >
              {property.listingType === 'sale' ? 'Make Offer' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      <Footer />

      {/* Map Modal */}
      {isMapModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full h-full max-w-6xl bg-gray-50 rounded-3xl overflow-hidden border border-gray-200"
          >
            <div className="absolute top-6 right-6 z-[110] flex gap-4">
              <button 
                onClick={() => setIsMapModalOpen(false)}
                className="p-3 bg-purple-600 text-white rounded-full shadow-xl hover:bg-purple-700 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="w-full h-full relative">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={modalMapCenter || (directionsResponse ? directionsResponse.routes[0].legs[0].start_location : defaultCenter)}
                zoom={modalMapZoom}
                onLoad={(map) => { modalMapRef.current = map; }}
                onDragEnd={() => {
                  if (modalMapRef.current) {
                    const center = modalMapRef.current.getCenter();
                    if (center) {
                      setModalMapCenter({ lat: center.lat(), lng: center.lng() });
                    }
                  }
                }}
                onZoomChanged={() => {
                  if (modalMapRef.current) {
                    setModalMapZoom(modalMapRef.current.getZoom() || 14);
                  }
                }}
                options={modalMapOptions}
              >
                {directionsResponse ? (
                  <DirectionsRenderer 
                    directions={directionsResponse}
                    options={modalDirectionsOptions}
                  />
                ) : (
                  property.lat && property.lng && (
                    <OverlayView
                      position={{ lat: property.lat, lng: property.lng }}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 border border-purple-600 shadow-md transform -translate-x-1/2 -translate-y-1/2 scale-125 z-10 text-white">
                        <Home className="w-5 h-5" strokeWidth={1.5} fill="none" />
                      </div>
                    </OverlayView>
                  )
                )}
                {snappedUserPosition && <UserLocationMarker position={snappedUserPosition} />}
              </GoogleMap>
              
              {/* Locate Me Button */}
              <>
                <button
                  onClick={() => {
                    if (snappedUserPosition && modalMapRef.current) {
                      modalMapRef.current.panTo({ lat: snappedUserPosition.lat, lng: snappedUserPosition.lng });
                      modalMapRef.current.setZoom(16);
                    }
                  }}
                  className="absolute bottom-32 right-6 z-10 p-3 bg-purple-600 text-white rounded-full shadow-xl hover:bg-purple-700 transition-all"
                  title="Locate Me"
                >
                  <MapPin className="w-6 h-6" />
                </button>
              </>
            </div>
            
            <div className="absolute bottom-8 left-8 right-8 bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-gray-200 pointer-events-none">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{property.title}</h3>
              <p className="text-gray-500">{property.location}</p>
              {directionsResponse && (
                <div className="flex gap-6 mt-4 text-sm font-bold text-gray-900">
                  <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {directionsResponse.routes[0].legs[0].distance?.text}</span>
                  <span className="flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> {directionsResponse.routes[0].legs[0].duration?.text}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <Modal
        isOpen={showViewingPicker}
        onClose={() => setShowViewingPicker(false)}
        title="Schedule a Viewing"
      >
        <div className="space-y-6">
          {viewingBooked ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Viewing Scheduled!</h3>
              <p className="text-gray-500">The landlord has been notified. You'll receive a confirmation soon.</p>
              <Button 
                className="mt-6 w-full"
                onClick={() => {
                  setViewingBooked(false);
                  setShowViewingPicker(false);
                }}
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Select a date and time that works for you. The landlord will review your request.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date & Time</label>
                <DatePicker
                  selected={viewingDate}
                  onChange={(date) => setViewingDate(date)}
                  showTimeSelect
                  dateFormat="MMMM d, yyyy h:mm aa"
                  minDate={new Date()}
                  className="w-full p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-purple-600 outline-none"
                  placeholderText="Click to select date and time"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowViewingPicker(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                  onClick={handleBookViewing}
                  disabled={bookingViewing || !viewingDate}
                >
                  {bookingViewing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirm Request'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title={reportType === 'listing' ? "Report Listing" : "Report Host"}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Please provide a reason for reporting this {reportType === 'listing' ? 'listing' : 'host'}. Our moderation team will review it.
          </p>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="e.g., Inaccurate description, inappropriate content, scam..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReport} 
              disabled={submittingReport || !reportReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submittingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isApplicationModalOpen}
        onClose={() => setIsApplicationModalOpen(false)}
        title="Apply for Property"
      >
        {applicationSubmitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h3>
            <p className="text-gray-500">The landlord will review your application and get back to you soon.</p>
          </div>
        ) : (
        <div className="space-y-6 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-2 no-scrollbar">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Intended Move-in Date</label>
              <DatePicker
                selected={applicationData.moveInDate}
                onChange={(date) => setApplicationData({ ...applicationData, moveInDate: date || new Date() })}
                minDate={new Date()}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Occupants</label>
                <input
                  type="number"
                  min="1"
                  value={applicationData.occupants}
                  onChange={(e) => setApplicationData({ ...applicationData, occupants: parseInt(e.target.value) || 1 })}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employment Status</label>
                <select
                  value={applicationData.employmentStatus}
                  onChange={(e) => setApplicationData({ ...applicationData, employmentStatus: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="Employed">Employed</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Student">Student</option>
                  <option value="Unemployed">Unemployed</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Income ($)</label>
              <input
                type="number"
                min="0"
                value={applicationData.monthlyIncome}
                onChange={(e) => setApplicationData({ ...applicationData, monthlyIncome: e.target.value })}
                placeholder="e.g. 5000"
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message to Landlord (Optional)</label>
              <textarea
                value={applicationData.message}
                onChange={(e) => setApplicationData({ ...applicationData, message: e.target.value })}
                placeholder="Tell the landlord a bit about yourself..."
                className="w-full h-24 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none resize-none"
              />
            </div>

            <Button 
              onClick={handleApply} 
              disabled={submittingApplication || !applicationData.monthlyIncome}
              className="w-full py-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold"
            >
              {submittingApplication ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Application'}
            </Button>
          </div>
        )}
      </Modal>

      {/* Gallery Modal */}
      <Modal
        isOpen={isGalleryModalOpen}
        onClose={() => setIsGalleryModalOpen(false)}
        title="Property Gallery"
        maxWidth="max-w-7xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[property.imageUrl, ...(property.imageUrls || [])].filter(Boolean).map((url, idx) => (
            <div 
              key={`gallery-img-${idx}`} 
              className="aspect-video rounded-2xl overflow-hidden border border-gray-100 cursor-pointer group relative"
              onClick={() => {
                setFullScreenImageIndex(idx);
                setIsFullScreenGalleryOpen(true);
              }}
            >
              <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Full Screen Gallery */}
      <AnimatePresence>
        {isFullScreenGalleryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
              <div className="text-white font-medium">
                {fullScreenImageIndex + 1} / {[property.imageUrl, ...(property.imageUrls || [])].filter(Boolean).length}
              </div>
              <button 
                onClick={() => setIsFullScreenGalleryOpen(false)}
                className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Main Image */}
            <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12">
              <AnimatePresence mode="wait">
                <motion.img
                  key={fullScreenImageIndex}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  src={[property.imageUrl, ...(property.imageUrls || [])].filter(Boolean)[fullScreenImageIndex]}
                  alt="Full screen view"
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>

              {/* Navigation Arrows */}
              <div className="absolute inset-y-0 left-4 right-4 flex items-center justify-between pointer-events-none">
                <button 
                  onClick={() => setFullScreenImageIndex(prev => Math.max(0, prev - 1))}
                  className={`p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all pointer-events-auto ${fullScreenImageIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                  disabled={fullScreenImageIndex === 0}
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button 
                  onClick={() => setFullScreenImageIndex(prev => Math.min([property.imageUrl, ...(property.imageUrls || [])].filter(Boolean).length - 1, prev + 1))}
                  className={`p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all pointer-events-auto ${fullScreenImageIndex === [property.imageUrl, ...(property.imageUrls || [])].filter(Boolean).length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                  disabled={fullScreenImageIndex === [property.imageUrl, ...(property.imageUrls || [])].filter(Boolean).length - 1}
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Thumbnails (Desktop) */}
            <div className="absolute bottom-8 left-0 right-0 hidden md:flex justify-center gap-2 px-4 overflow-x-auto no-scrollbar">
              {[property.imageUrl, ...(property.imageUrls || [])].filter(Boolean).map((url, idx) => (
                <button
                  key={`fs-thumb-${idx}`}
                  onClick={() => setFullScreenImageIndex(idx)}
                  className={`w-20 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${fullScreenImageIndex === idx ? 'border-white scale-110 shadow-xl' : 'border-transparent opacity-40 hover:opacity-100'}`}
                >
                  <img src={url} alt={`Thumb ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        targetId={reviewTargetId}
        targetName={reviewTargetName}
        targetType={reviewTargetType}
        onSuccess={() => {
          // Optional: show a success toast
        }}
      />
    </div>
  );
}
