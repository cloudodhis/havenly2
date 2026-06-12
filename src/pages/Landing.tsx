import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { ArrowUpRight, Search, MapPin, User, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { motion } from 'motion/react';

export function Landing() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  return (
    <div className="min-h-screen bg-[#e5e7eb] p-4 md:p-6 lg:p-8 flex items-center justify-center font-sans">
      <div className="max-w-[1600px] w-full bg-white rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl h-auto min-h-[90vh]">
        
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center p-6 pb-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
            </div>
            <span className="font-bold text-xl tracking-tight">Havenly</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-grow">
          {/* Left Panel */}
          <div className="w-full lg:w-[45%] p-6 md:p-12 lg:p-16 flex flex-col justify-between relative order-2 lg:order-1">
            {/* Desktop Header */}
            <div className="hidden lg:flex items-center justify-between mb-8 md:mb-12">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
                </div>
                <span className="font-bold text-xl tracking-tight">Havenly</span>
              </div>
              <nav className="flex items-center gap-8 text-sm font-medium text-gray-500">
                <a href="#" className="text-black">Home</a>
                <a href="#" className="hover:text-black transition-colors">Rent</a>
                <a href="#" className="hover:text-black transition-colors">Buy</a>
              </nav>
            </div>

          {/* Main Content */}
          <div className="flex-grow flex flex-col justify-center">
            <div className="relative mb-6">
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-medium leading-[1.1] tracking-tight text-black">
                Find Your<br />Perfect Home
              </h1>
              {/* Decorative avatars */}
              <div className="absolute top-0 right-0 hidden md:flex flex-col gap-2 translate-x-4 -translate-y-4">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="Avatar" className="w-12 h-12 rounded-full border-2 border-white object-cover" referrerPolicy="no-referrer" />
                <div className="flex gap-2">
                  <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80" alt="Avatar" className="w-10 h-10 rounded-full border-2 border-white object-cover" referrerPolicy="no-referrer" />
                  <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" alt="Avatar" className="w-14 h-14 rounded-full border-2 border-white object-cover" referrerPolicy="no-referrer" />
                </div>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-8">Your next chapter starts here.</h3>

            <div className="flex flex-col gap-8 items-start mb-12">
              <p className="text-gray-500 text-sm leading-relaxed max-w-md flex gap-4">
                <span className="font-bold text-black">05</span>
                Whether you're a renter searching for your perfect home, or a property owner looking to list your premium space, we connect exceptional properties with the right people.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <button 
                  onClick={() => navigate('/search')}
                  className="bg-black text-white px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors whitespace-nowrap"
                >
                  Explore Properties <ArrowUpRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => user ? navigate('/dashboard') : openAuthModal('renter')}
                  className="bg-gray-100 text-black px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors whitespace-nowrap font-medium"
                >
                  {user ? 'Dashboard' : 'Sign Up'}
                </button>
              </div>
            </div>

            {/* Property Card */}
            <div className="relative rounded-3xl overflow-hidden h-48 w-full max-w-md group cursor-pointer" onClick={() => navigate('/search')}>
              <img 
                src="https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=800&q=80" 
                alt="Vancouver Cabin" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium">
                Vancouver, Canada
              </div>
              
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                <div>
                  <div className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-3 py-1 rounded-full text-xs mb-2 inline-block">
                    Popular
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors">
                    <ArrowUp className="w-3 h-3" />
                  </div>
                  <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors">
                    <ArrowDown className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
          <div className="w-full lg:w-[55%] relative p-4 lg:p-6 h-[400px] md:h-[500px] lg:h-auto order-1 lg:order-2">
            <div className="w-full h-full rounded-[2rem] overflow-hidden relative">
            <img 
              src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80" 
              alt="Modern Villa" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            
            {/* Top Right Actions */}
            <div className="absolute top-6 right-6 hidden lg:flex gap-3">
              <button className="bg-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors">
                Contact Us
              </button>
            </div>

            {/* Floating Card Top Left */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="absolute top-6 left-6 md:top-12 md:left-12 bg-white p-2 rounded-2xl hidden lg:flex items-center gap-4 shadow-xl max-w-[280px]"
            >
              <div className="pl-3 py-2">
                <p className="text-sm font-medium leading-tight mb-2">San Francisco,<br/>California</p>
                <button className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors">
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
              <img 
                src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=200&q=80" 
                alt="Melbourne Villa" 
                className="w-20 h-20 rounded-xl object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>

            {/* Bottom Content */}
            <div className="absolute bottom-6 left-6 right-6 md:bottom-12 md:left-12 md:right-12 hidden lg:block">
              <p className="text-white text-base md:text-lg font-medium max-w-xl mb-6 md:mb-8 leading-relaxed drop-shadow-md">
                Discover premium homes and apartments with breathtaking views, modern amenities, and easy access to vibrant city life.
              </p>

              {/* Search Bar */}
              <div className="bg-white rounded-3xl md:rounded-full p-2 flex flex-col md:flex-row items-center justify-between shadow-2xl max-w-2xl">
                <div className="flex flex-col md:flex-row items-start md:items-center divide-y md:divide-y-0 md:divide-x divide-gray-200 w-full flex-grow">
                  <div className="px-6 py-3 md:py-2 w-full flex-1 cursor-pointer hover:bg-gray-50 rounded-t-2xl md:rounded-t-none md:rounded-l-full transition-colors">
                    <p className="text-xs text-gray-500 font-medium mb-0.5">Select Type</p>
                    <p className="text-sm font-medium">Apartment</p>
                  </div>
                  <div className="px-6 py-3 md:py-2 w-full flex-1 cursor-pointer hover:bg-gray-50 transition-colors">
                    <p className="text-xs text-gray-500 font-medium mb-0.5">Location</p>
                    <p className="text-sm font-medium">San Francisco</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/search')}
                  className="w-full md:w-auto bg-black text-white px-8 py-4 rounded-2xl md:rounded-full text-sm font-medium hover:bg-gray-800 transition-colors mt-2 md:mt-0 md:ml-2"
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}
