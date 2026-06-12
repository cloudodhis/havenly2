import React, { useState, useCallback, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { UploadCloud, CheckCircle2, ChevronRight, ChevronLeft, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, StandaloneSearchBox } from '@react-google-maps/api';

const libraries: any[] = ['places', 'geometry'];

const defaultCenter = {
  lat: 20,
  lng: 0 // More central global view
};

export function AddProperty() {
  const { id } = useParams<{ id: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [originalProperty, setOriginalProperty] = useState<any>(null);
  const [step, setStep] = useState(1);
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [publishedPropertyId, setPublishedPropertyId] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  const [map, setMap] = useState<any>(null);
  const [searchBox, setSearchBox] = useState<any>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempLocation, setTempLocation] = useState('');
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [customAmenity, setCustomAmenity] = useState('');
  const [amenities, setAmenities] = useState(['Wifi', 'Pool', 'Kitchen', 'Parking', 'Gym', 'Air Conditioning', 'Washer', 'Dryer', 'Heating', 'Dedicated workspace', 'TV', 'Hair dryer', 'Iron']);
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    lat: defaultCenter.lat,
    lng: defaultCenter.lng,
    price: '',
    currency: 'USD',
    beds: '',
    baths: '',
    guests: '',
    sqft: '',
    securityDeposit: '',
    firstMonthRent: '',
    moveInDate: '',
    term: '12 months',
    type: 'Apartment',
    listingType: 'rent' as 'rent' | 'sale',
    amenities: [] as string[],
    imageUrl: 'https://picsum.photos/seed/newprop/800/600', // Default placeholder
    imageUrls: [] as string[],
    status: 'pending' as 'pending' | 'active' | 'reported' | 'expired' | 'removed',
  });

  useEffect(() => {
    if (map) {
      google.maps.event.trigger(map, 'resize');
      map.setCenter({ lat: formData.lat, lng: formData.lng });
    }
  }, [isMapModalOpen, map, formData.lat, formData.lng]);

  useEffect(() => {
    if (id) {
      setIsEditing(true);
      const fetchProperty = async () => {
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
            const data = docSnap.data();
            if (user && (data.landlordId !== user.uid || user.role !== 'landlord')) {
              alert("You do not have permission to edit this property.");
              navigate('/dashboard');
              return;
            }
            setOriginalProperty(data);
              setFormData({
                title: data.title || '',
                location: data.location || '',
                lat: data.lat || defaultCenter.lat,
                lng: data.lng || defaultCenter.lng,
                price: data.price ? data.price.toString() : '',
                currency: data.currency || 'USD',
                beds: data.beds ? data.beds.toString() : '',
                baths: data.baths ? data.baths.toString() : '',
                guests: data.guests ? data.guests.toString() : '',
                sqft: data.sqft ? data.sqft.toString() : '',
                securityDeposit: data.securityDeposit ? data.securityDeposit.toString() : '',
                firstMonthRent: data.firstMonthRent ? data.firstMonthRent.toString() : '',
                moveInDate: data.moveInDate || '',
                term: data.term || '12 months',
                type: data.type || 'Apartment',
                listingType: data.listingType || 'rent',
                amenities: data.amenities || [],
                imageUrl: data.imageUrl || 'https://picsum.photos/seed/newprop/800/600',
                imageUrls: data.imageUrls || [],
                status: data.status || 'pending',
              });
          } else {
            alert("Property not found.");
            navigate('/dashboard');
          }
        } catch (error) {
          console.error("Error fetching property:", error);
        }
      };
      fetchProperty();
    }
  }, [id, user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onLoadMap = useCallback(function callback(map: any) {
    setMap(map);
  }, []);

  const onUnmountMap = useCallback(function callback(map: any) {
    setMap(null);
  }, []);

  const onLoadSearchBox = (ref: any) => {
    setSearchBox(ref);
  };

  const onPlacesChanged = () => {
    if (searchBox) {
      const places = searchBox.getPlaces();
      if (places && places.length > 0) {
        const place = places[0];
        const location = place.geometry?.location;
        if (location) {
          const newLat = location.lat();
          const newLng = location.lng();
          setFormData(prev => ({ 
            ...prev, 
            location: place.formatted_address || place.name || '',
            lat: newLat,
            lng: newLng
          }));
          map?.panTo({ lat: newLat, lng: newLng });
          map?.setZoom(15);
        }
      }
    }
  };

  const onMapClick = (e: any) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setFormData(prev => ({
      ...prev,
      lat,
      lng
    }));

    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          setTempLocation(results[0].formatted_address);
          setShowLocationModal(true);
        } else if (status === 'REQUEST_DENIED') {
          console.error("Geocoding API is not enabled. Please enable it in Google Cloud Console.");
          setTempLocation(`Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          setShowLocationModal(true);
        } else {
          setTempLocation('');
          setShowLocationModal(true);
        }
      });
    } else {
      setTempLocation('');
      setShowLocationModal(true);
    }
  };

  const handleConfirmLocation = () => {
    setFormData(prev => ({
      ...prev,
      location: tempLocation
    }));
    setShowLocationModal(false);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const maxWidth = 800;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (formData.imageUrls.length + files.length > 5) {
      alert("You can upload a maximum of 5 photos.");
      return;
    }

    setIsSubmitting(true);
    try {
      const compressedImages = await Promise.all(files.map(compressImage));
      setFormData(prev => ({
        ...prev,
        imageUrls: [...prev.imageUrls, ...compressedImages]
      }));
    } catch (error) {
      console.error("Error compressing images:", error);
      alert("Failed to process images. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!user) {
      openAuthModal('landlord');
      return;
    }

    if (user.role !== 'landlord') {
      alert("You must be a landlord to publish a listing. Please switch your role to landlord.");
      return;
    }

    setIsSubmitting(true);
    try {
      const propertyData = {
        title: formData.title || 'Beautiful New Listing',
        location: formData.location || 'Unknown Location',
        lat: formData.lat,
        lng: formData.lng,
        price: Number(formData.price) || 1000,
        currency: formData.currency,
        beds: Number(formData.beds) || 1,
        baths: Number(formData.baths) || 1,
        guests: Number(formData.guests) || 4,
        sqft: Number(formData.sqft) || 500,
        securityDeposit: Number(formData.securityDeposit) || 0,
        firstMonthRent: Number(formData.firstMonthRent) || 0,
        moveInDate: formData.moveInDate,
        term: formData.term,
        type: formData.type,
        listingType: formData.listingType,
        amenities: formData.amenities,
        imageUrl: formData.imageUrls.length > 0 ? formData.imageUrls[0] : 'https://picsum.photos/seed/newprop/800/600',
        imageUrls: formData.imageUrls.length > 0 ? formData.imageUrls : ['https://picsum.photos/seed/newprop/800/600'],
        rating: isEditing && originalProperty ? originalProperty.rating : 0,
        isAIRecommended: isEditing && originalProperty ? originalProperty.isAIRecommended : false,
        landlordId: isEditing && originalProperty ? originalProperty.landlordId : user.uid,
        createdAt: isEditing && originalProperty ? originalProperty.createdAt : new Date().toISOString(),
        status: formData.status,
      };

      if (isEditing && id) {
        const docRef = doc(db, 'properties', id);
        try {
          await updateDoc(docRef, propertyData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `properties/${id}`);
        }
        setPublishedPropertyId(id);
      } else {
        try {
          const docRef = await addDoc(collection(db, 'properties'), propertyData);
          setPublishedPropertyId(docRef.id);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'properties');
        }
      }
      setIsPublished(true);
    } catch (error) {
      console.error("Error saving property: ", error);
      alert("Failed to save listing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPublished && publishedPropertyId) {
    return (
      <div className="min-h-screen flex flex-col bg-white text-gray-900">
        <Navbar />
        <main className="flex-grow flex items-center justify-center py-12 px-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-gray-200 overflow-hidden p-8 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-3xl font-bold mb-4">{isEditing ? 'Updated!' : 'Published!'}</h2>
            <p className="text-gray-500 mb-8">{isEditing ? 'Your property has been successfully updated.' : 'Your property has been successfully listed and is now visible to renters.'}</p>
            <div className="space-y-3">
              <Button onClick={() => navigate(`/property/${publishedPropertyId}`)} className="w-full bg-purple-600 text-white hover:bg-purple-700">
                View Listing
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full border-gray-200 text-gray-900 hover:bg-gray-100">
                Go to Dashboard
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center py-12 px-4">
        <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          
          {/* Progress Bar */}
          <div className="h-1 bg-gray-100 w-full">
            <div 
              className="h-full bg-purple-600 transition-all duration-500 ease-in-out"
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>

          <div className="p-8 md:p-12">
            <div className="mb-8">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-[0.2em]">Step {step} of 4</p>
              <h1 className="text-4xl font-bold mb-2 tracking-tight">
                {step === 1 && "The Basics"}
                {step === 2 && "The Space"}
                {step === 3 && "Amenities"}
                {step === 4 && "Photos"}
              </h1>
              <p className="text-gray-500">
                {step === 1 && "What kind of place are you listing?"}
                {step === 2 && "Share the details that make your place unique."}
                {step === 3 && "Renters love knowing what's included."}
                {step === 4 && "High-quality photos make your listing stand out."}
              </p>
            </div>

            {/* Step 1: Basics */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Property Title</label>
                  <Input 
                    name="title" 
                    value={formData.title} 
                    onChange={handleChange} 
                    placeholder="e.g. Modern Loft in Downtown" 
                    className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Location</label>
                  {isLoaded ? (
                    <div className="space-y-4">
                      <StandaloneSearchBox
                        onLoad={onLoadSearchBox}
                        onPlacesChanged={onPlacesChanged}
                      >
                        <Input 
                          name="location" 
                          value={formData.location} 
                          onChange={handleChange} 
                          placeholder="Search for an address or neighborhood" 
                          className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                        />
                      </StandaloneSearchBox>
                      <div className="h-[300px] w-full rounded-xl border border-gray-200 overflow-hidden relative">
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          center={defaultCenter}
                          zoom={formData.location ? 15 : 4}
                          onLoad={(m) => {
                            onLoadMap(m);
                            if (formData.lat !== defaultCenter.lat || formData.lng !== defaultCenter.lng) {
                              m.panTo({ lat: formData.lat, lng: formData.lng });
                            }
                          }}
                          onUnmount={onUnmountMap}
                          onClick={onMapClick}
                          options={{ gestureHandling: "greedy" }}
                        >
                           <Marker 
                             position={{ lat: formData.lat, lng: formData.lng }} 
                             draggable={true}
                             onDragEnd={onMapClick}
                           />
                           <button 
                             onClick={() => setIsMapModalOpen(true)}
                             className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-md z-10 text-gray-700 hover:bg-gray-100"
                           >
                             View Full Map
                           </button>
                         </GoogleMap>
                      </div>
                      <Modal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} title="Property Location">
                        <div className="h-[500px] w-full relative">
                          <div className="absolute top-4 left-4 z-10 w-full max-w-sm">
                            <StandaloneSearchBox
                              onLoad={onLoadSearchBox}
                              onPlacesChanged={onPlacesChanged}
                            >
                              <Input 
                                placeholder="Search for an address" 
                                className="bg-white border-gray-200 text-gray-900 py-6 shadow-md" 
                              />
                            </StandaloneSearchBox>
                          </div>
                          <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={defaultCenter}
                            zoom={formData.location ? 15 : 4}
                            onLoad={(m) => {
                              onLoadMap(m);
                              if (formData.lat !== defaultCenter.lat || formData.lng !== defaultCenter.lng) {
                                m.panTo({ lat: formData.lat, lng: formData.lng });
                              }
                            }}
                            onUnmount={onUnmountMap}
                            onClick={onMapClick}
                            options={{ gestureHandling: "greedy" }}
                          >
                             <Marker 
                               position={{ lat: formData.lat, lng: formData.lng }} 
                               draggable={true}
                               onDragEnd={onMapClick}
                             />
                          </GoogleMap>
                        </div>
                       </Modal>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Drag the pin or click on the map to set the exact location.
                      </p>
                    </div>
                  ) : (
                    <div className="h-[300px] w-full rounded-xl bg-white flex items-center justify-center border border-gray-200">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-700" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Listing Type</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, listingType: 'rent' })}
                      className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${
                        formData.listingType === 'rent'
                          ? 'border-purple-600 bg-purple-50 text-purple-600'
                          : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      For Rent
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, listingType: 'sale' })}
                      className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${
                        formData.listingType === 'sale'
                          ? 'border-purple-600 bg-purple-50 text-purple-600'
                          : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                    >
                      For Sale
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Property Type</label>
                  <select 
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full h-14 rounded-lg border border-gray-200 bg-white text-gray-900 px-4 py-2 text-lg focus:border-purple-600 outline-none transition-colors appearance-none"
                  >
                    <option value="Apartment">Apartment</option>
                    <option value="House">House</option>
                    <option value="Villa">Villa</option>
                    <option value="Studio">Studio</option>
                    <option value="Penthouse">Penthouse</option>
                    <option value="Loft">Loft</option>
                    <option value="Land">Land</option>
                    <option value="Shop">Shop</option>
                    <option value="Office">Office</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Property Status</label>
                  <Input 
                    name="status" 
                    value={formData.status} 
                    disabled
                    className="bg-gray-100 border-gray-200 text-gray-900 text-lg py-6 cursor-not-allowed" 
                  />
                </div>
              </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      {formData.listingType === 'rent' ? 'Monthly Rent' : 'Sale Price'}
                    </label>
                    <Input 
                      name="price" 
                      value={formData.price} 
                      onChange={handleChange} 
                      type="number" 
                      placeholder="0" 
                      className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                    />
                  </div>
                  <div className="max-w-xs">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Currency</label>
                    <select
                      name="currency"
                      value={formData.currency || 'USD'}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-[1.125rem] text-gray-900 focus:outline-none focus:border-purple-600 transition-colors"
                    >
                      <option value="AED">AED (United Arab Emirates Dirham)</option>
                      <option value="AFN">AFN (Afghan Afghani)</option>
                      <option value="ALL">ALL (Albanian Lek)</option>
                      <option value="AMD">AMD (Armenian Dram)</option>
                      <option value="ANG">ANG (Netherlands Antillean Guilder)</option>
                      <option value="AOA">AOA (Angolan Kwanza)</option>
                      <option value="ARS">ARS (Argentine Peso)</option>
                      <option value="AUD">AUD (Australian Dollar)</option>
                      <option value="AWG">AWG (Aruban Florin)</option>
                      <option value="AZN">AZN (Azerbaijani Manat)</option>
                      <option value="BAM">BAM (Bosnia-Herzegovina Convertible Mark)</option>
                      <option value="BBD">BBD (Barbadian Dollar)</option>
                      <option value="BDT">BDT (Bangladeshi Taka)</option>
                      <option value="BGN">BGN (Bulgarian Lev)</option>
                      <option value="BHD">BHD (Bahraini Dinar)</option>
                      <option value="BIF">BIF (Burundian Franc)</option>
                      <option value="BMD">BMD (Bermudan Dollar)</option>
                      <option value="BND">BND (Brunei Dollar)</option>
                      <option value="BOB">BOB (Bolivian Boliviano)</option>
                      <option value="BRL">BRL (Brazilian Real)</option>
                      <option value="BSD">BSD (Bahamian Dollar)</option>
                      <option value="BTN">BTN (Bhutanese Ngultrum)</option>
                      <option value="BWP">BWP (Botswanan Pula)</option>
                      <option value="BYN">BYN (Belarusian Ruble)</option>
                      <option value="BZD">BZD (Belize Dollar)</option>
                      <option value="CAD">CAD (Canadian Dollar)</option>
                      <option value="CDF">CDF (Congolese Franc)</option>
                      <option value="CHF">CHF (Swiss Franc)</option>
                      <option value="CLP">CLP (Chilean Peso)</option>
                      <option value="CNY">CNY (Chinese Yuan)</option>
                      <option value="COP">COP (Colombian Peso)</option>
                      <option value="CRC">CRC (Costa Rican Colón)</option>
                      <option value="CUP">CUP (Cuban Peso)</option>
                      <option value="CVE">CVE (Cape Verdean Escudo)</option>
                      <option value="CZK">CZK (Czech Republic Koruna)</option>
                      <option value="DJF">DJF (Djiboutian Franc)</option>
                      <option value="DKK">DKK (Danish Krone)</option>
                      <option value="DOP">DOP (Dominican Peso)</option>
                      <option value="DZD">DZD (Algerian Dinar)</option>
                      <option value="EGP">EGP (Egyptian Pound)</option>
                      <option value="ERN">ERN (Eritrean Nakfa)</option>
                      <option value="ETB">ETB (Ethiopian Birr)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="FJD">FJD (Fijian Dollar)</option>
                      <option value="FKP">FKP (Falkland Islands Pound)</option>
                      <option value="GBP">GBP (British Pound Sterling)</option>
                      <option value="GEL">GEL (Georgian Lari)</option>
                      <option value="GHS">GHS (Ghanaian Cedi)</option>
                      <option value="GIP">GIP (Gibraltar Pound)</option>
                      <option value="GMD">GMD (Gambian Dalasi)</option>
                      <option value="GNF">GNF (Guinean Franc)</option>
                      <option value="GTQ">GTQ (Guatemalan Quetzal)</option>
                      <option value="GYD">GYD (Guyanese Dollar)</option>
                      <option value="HKD">HKD (Hong Kong Dollar)</option>
                      <option value="HNL">HNL (Honduran Lempira)</option>
                      <option value="HRK">HRK (Croatian Kuna)</option>
                      <option value="HTG">HTG (Haitian Gourde)</option>
                      <option value="HUF">HUF (Hungarian Forint)</option>
                      <option value="IDR">IDR (Indonesian Rupiah)</option>
                      <option value="ILS">ILS (Israeli New Sheqel)</option>
                      <option value="INR">INR (Indian Rupee)</option>
                      <option value="IQD">IQD (Iraqi Dinar)</option>
                      <option value="IRR">IRR (Iranian Rial)</option>
                      <option value="ISK">ISK (Icelandic Króna)</option>
                      <option value="JMD">JMD (Jamaican Dollar)</option>
                      <option value="JOD">JOD (Jordanian Dinar)</option>
                      <option value="JPY">JPY (Japanese Yen)</option>
                      <option value="KES">KES (Kenyan Shilling)</option>
                      <option value="KGS">KGS (Kyrgystani Som)</option>
                      <option value="KHR">KHR (Cambodian Riel)</option>
                      <option value="KMF">KMF (Comorian Franc)</option>
                      <option value="KPW">KPW (North Korean Won)</option>
                      <option value="KRW">KRW (South Korean Won)</option>
                      <option value="KWD">KWD (Kuwaiti Dinar)</option>
                      <option value="KYD">KYD (Cayman Islands Dollar)</option>
                      <option value="KZT">KZT (Kazakhstani Tenge)</option>
                      <option value="LAK">LAK (Laotian Kip)</option>
                      <option value="LBP">LBP (Lebanese Pound)</option>
                      <option value="LKR">LKR (Sri Lankan Rupee)</option>
                      <option value="LRD">LRD (Liberian Dollar)</option>
                      <option value="LSL">LSL (Lesotho Loti)</option>
                      <option value="LYD">LYD (Libyan Dinar)</option>
                      <option value="MAD">MAD (Moroccan Dirham)</option>
                      <option value="MDL">MDL (Moldovan Leu)</option>
                      <option value="MGA">MGA (Malagasy Ariary)</option>
                      <option value="MKD">MKD (Macedonian Denar)</option>
                      <option value="MMK">MMK (Myanma Kyat)</option>
                      <option value="MNT">MNT (Mongolian Tugrik)</option>
                      <option value="MOP">MOP (Macanese Pataca)</option>
                      <option value="MRU">MRU (Mauritanian Ouguiya)</option>
                      <option value="MUR">MUR (Mauritian Rupee)</option>
                      <option value="MVR">MVR (Maldivian Rufiyaa)</option>
                      <option value="MWK">MWK (Malawian Kwacha)</option>
                      <option value="MXN">MXN (Mexican Peso)</option>
                      <option value="MYR">MYR (Malaysian Ringgit)</option>
                      <option value="MZN">MZN (Mozambican Metical)</option>
                      <option value="NAD">NAD (Namibian Dollar)</option>
                      <option value="NGN">NGN (Nigerian Naira)</option>
                      <option value="NIO">NIO (Nicaraguan Córdoba)</option>
                      <option value="NOK">NOK (Norwegian Krone)</option>
                      <option value="NPR">NPR (Nepalese Rupee)</option>
                      <option value="NZD">NZD (New Zealand Dollar)</option>
                      <option value="OMR">OMR (Omani Rial)</option>
                      <option value="PAB">PAB (Panamanian Balboa)</option>
                      <option value="PEN">PEN (Peruvian Nuevo Sol)</option>
                      <option value="PGK">PGK (Papua New Guinean Kina)</option>
                      <option value="PHP">PHP (Philippine Peso)</option>
                      <option value="PKR">PKR (Pakistani Rupee)</option>
                      <option value="PLN">PLN (Polish Zloty)</option>
                      <option value="PYG">PYG (Paraguayan Guarani)</option>
                      <option value="QAR">QAR (Qatari Rial)</option>
                      <option value="RON">RON (Romanian Leu)</option>
                      <option value="RSD">RSD (Serbian Dinar)</option>
                      <option value="RUB">RUB (Russian Ruble)</option>
                      <option value="RWF">RWF (Rwandan Franc)</option>
                      <option value="SAR">SAR (Saudi Riyal)</option>
                      <option value="SBD">SBD (Solomon Islands Dollar)</option>
                      <option value="SCR">SCR (Seychellois Rupee)</option>
                      <option value="SDG">SDG (Sudanese Pound)</option>
                      <option value="SEK">SEK (Swedish Krona)</option>
                      <option value="SGD">SGD (Singapore Dollar)</option>
                      <option value="SHP">SHP (Saint Helena Pound)</option>
                      <option value="SLL">SLL (Sierra Leonean Leone)</option>
                      <option value="SOS">SOS (Somali Shilling)</option>
                      <option value="SRD">SRD (Surinamese Dollar)</option>
                      <option value="SSP">SSP (South Sudanese Pound)</option>
                      <option value="STN">STN (São Tomé and Príncipe Dobra)</option>
                      <option value="SYP">SYP (Syrian Pound)</option>
                      <option value="SZL">SZL (Swazi Lilangeni)</option>
                      <option value="THB">THB (Thai Baht)</option>
                      <option value="TJS">TJS (Tajikistani Somoni)</option>
                      <option value="TMT">TMT (Turkmenistani Manat)</option>
                      <option value="TND">TND (Tunisian Dinar)</option>
                      <option value="TOP">TOP (Tongan Paʻanga)</option>
                      <option value="TRY">TRY (Turkish Lira)</option>
                      <option value="TTD">TTD (Trinidad and Tobago Dollar)</option>
                      <option value="TWD">TWD (New Taiwan Dollar)</option>
                      <option value="TZS">TZS (Tanzanian Shilling)</option>
                      <option value="UAH">UAH (Ukrainian Hryvnia)</option>
                      <option value="UGX">UGX (Ugandan Shilling)</option>
                      <option value="USD">USD (United States Dollar)</option>
                      <option value="UYU">UYU (Uruguayan Peso)</option>
                      <option value="UZS">UZS (Uzbekistan Som)</option>
                      <option value="VES">VES (Venezuelan Bolívar)</option>
                      <option value="VND">VND (Vietnamese Dong)</option>
                      <option value="VUV">VUV (Vanuatu Vatu)</option>
                      <option value="WST">WST (Samoan Tala)</option>
                      <option value="XAF">XAF (CFA Franc BEAC)</option>
                      <option value="XCD">XCD (East Caribbean Dollar)</option>
                      <option value="XOF">XOF (CFA Franc BCEAO)</option>
                      <option value="XPF">XPF (CFP Franc)</option>
                      <option value="YER">YER (Yemeni Rial)</option>
                      <option value="ZAR">ZAR (South African Rand)</option>
                      <option value="ZMW">ZMW (Zambian Kwacha)</option>
                      <option value="ZWL">ZWL (Zimbabwean Dollar)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Bedrooms</label>
                    <Input 
                      name="beds" 
                      value={formData.beds} 
                      onChange={handleChange} 
                      type="number" 
                      placeholder="1" 
                      className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Bathrooms</label>
                    <Input 
                      name="baths" 
                      value={formData.baths} 
                      onChange={handleChange} 
                      type="number" 
                      placeholder="1" 
                      className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Guests</label>
                    <Input 
                      name="guests" 
                      value={formData.guests} 
                      onChange={handleChange} 
                      type="number" 
                      placeholder="4" 
                      className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Square Footage</label>
                  <Input 
                    name="sqft" 
                    value={formData.sqft} 
                    onChange={handleChange} 
                    type="number" 
                    placeholder="e.g. 850" 
                    className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Security Deposit</label>
                    <Input 
                      name="securityDeposit" 
                      value={formData.securityDeposit} 
                      onChange={handleChange} 
                      type="number" 
                      placeholder="0" 
                      className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">First Month's Rent</label>
                    <Input 
                      name="firstMonthRent" 
                      value={formData.firstMonthRent} 
                      onChange={handleChange} 
                      type="number" 
                      placeholder="0" 
                      className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Move-in Date</label>
                    <Input 
                      name="moveInDate" 
                      value={formData.moveInDate} 
                      onChange={handleChange} 
                      type="date" 
                      className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Term</label>
                    <Input 
                      name="term" 
                      value={formData.term} 
                      onChange={handleChange} 
                      type="text" 
                      placeholder="e.g. 12 months" 
                      className="bg-white border-gray-200 text-gray-900 text-lg py-6 focus:border-purple-600 transition-colors" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Amenities */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  {amenities.map((amenity) => (
                    <label key={amenity} className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={formData.amenities.includes(amenity)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            amenities: checked 
                              ? [...prev.amenities, amenity]
                              : prev.amenities.filter(a => a !== amenity)
                          }));
                        }}
                        className="w-5 h-5 rounded border-gray-300 bg-white text-purple-600 focus:ring-purple-600" 
                      />
                      <span className="font-medium text-gray-600 group-hover:text-gray-900 transition-colors">{amenity}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-6 flex gap-2">
                  <Input 
                    value={customAmenity}
                    onChange={(e) => setCustomAmenity(e.target.value)}
                    placeholder="Add custom facility"
                    className="flex-grow"
                  />
                  <Button onClick={() => {
                    if (customAmenity && !amenities.includes(customAmenity)) {
                      setAmenities([...amenities, customAmenity]);
                      setCustomAmenity('');
                    }
                  }}>Add</Button>
                </div>
              </div>
            )}

            {/* Step 4: Photos */}
            {step === 4 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {formData.imageUrls.map((url, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                      <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-gray-900 border-purple-600 hover:bg-gray-300" 
                          onClick={() => {
                            const newUrls = [...formData.imageUrls];
                            newUrls.splice(index, 1);
                            setFormData({...formData, imageUrls: newUrls});
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {formData.imageUrls.length < 5 && (
                    <label className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center hover:bg-gray-100 transition-colors cursor-pointer aspect-square">
                      <div className="w-12 h-12 bg-gray-100 text-gray-900 rounded-full flex items-center justify-center mb-2">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <span className="font-medium text-sm">Upload Photo</span>
                      <span className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Max 5 photos</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple
                        className="hidden" 
                        onChange={handleImageUpload}
                        disabled={isSubmitting}
                      />
                    </label>
                  )}
                </div>
                {formData.imageUrls.length === 0 && (
                  <p className="text-center text-gray-500 text-xs mt-4 uppercase tracking-widest">Upload photos to make your listing stand out.</p>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-12 pt-6 border-t border-gray-200">
              <Button 
                variant="ghost" 
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1 || isSubmitting}
                className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              
              {step === 4 ? (
                <Button onClick={handlePublish} disabled={isSubmitting} className="px-8 bg-purple-600 text-white hover:bg-purple-700">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center gap-2">{isEditing ? 'Save Changes' : 'Publish Listing'} <CheckCircle2 className="w-4 h-4" /></span>}
                </Button>
              ) : (
                <Button onClick={() => setStep(Math.min(4, step + 1))} className="px-8 bg-purple-600 text-white hover:bg-purple-700">
                  <span className="flex items-center gap-2">Next <ChevronRight className="w-4 h-4" /></span>
                </Button>
              )}
            </div>

          </div>
        </div>
      </main>
      
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-200">
            <h3 className="text-2xl font-bold mb-2 tracking-tight">Confirm Location</h3>
            <p className="text-sm text-gray-500 mb-6">Please verify or edit the name of this place.</p>
            <Input 
              value={tempLocation} 
              onChange={(e) => setTempLocation(e.target.value)} 
              className="bg-white border-gray-200 text-gray-900 mb-8 py-6"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="border-gray-200 text-gray-900 hover:bg-gray-100" onClick={() => setShowLocationModal(false)}>Cancel</Button>
              <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={handleConfirmLocation}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
