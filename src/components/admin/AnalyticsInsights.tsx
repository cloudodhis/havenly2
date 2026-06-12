import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, Home, DollarSign, Activity, 
  Download, FileText, Filter, MapPin, ChevronDown, Sparkles
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const KPICard = ({ title, value, trend, trendValue, icon: Icon }: any) => {
  const isPositive = trend === 'up';
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-gray-50 rounded-xl text-gray-600">
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
          isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
        }`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {trendValue}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  );
};

export function AnalyticsInsights() {
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [locationFilter, setLocationFilter] = useState('All Cities');
  const [propertyType, setPropertyType] = useState('All Types');
  const [hasData, setHasData] = useState(true);
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    newUsers: 0,
    totalListings: 0,
    avgRentPrice: 0,
    conversionRate: 0,
    userGrowthData: [] as any[],
    listingsPerCityData: [] as any[],
    rentPricesData: [] as any[],
    popularLocations: [] as any[],
    funnelData: { views: 0, inquiries: 0, bookings: 0 }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [usersSnap, propsSnap, inqSnap, bookSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'properties')),
          getDocs(collection(db, 'inquiries')),
          getDocs(collection(db, 'bookings'))
        ]);

        const users = usersSnap.docs.map(d => d.data());
        const properties = propsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const inquiries = inqSnap.docs.map(d => d.data());
        const bookings = bookSnap.docs.map(d => d.data());

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let newUsersThisMonth = 0;
        const userGrowthMap = new Map();
        
        users.forEach(user => {
          if (user.createdAt) {
            const date = new Date(user.createdAt);
            if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
              newUsersThisMonth++;
            }
            const monthYear = date.toLocaleString('default', { month: 'short' });
            userGrowthMap.set(monthYear, (userGrowthMap.get(monthYear) || 0) + 1);
          }
        });
        
        const userGrowthData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const month = d.toLocaleString('default', { month: 'short' });
          userGrowthData.push({
            name: month,
            users: userGrowthMap.get(month) || 0
          });
        }
        
        let totalPrice = 0;
        const cityMap = new Map();
        const cityPriceMap = new Map();
        const cityCountMap = new Map();
        
        properties.forEach(prop => {
          if (prop.price) totalPrice += Number(prop.price);
          
          if (prop.location) {
            const city = prop.location.split(',')[0].trim();
            cityMap.set(city, (cityMap.get(city) || 0) + 1);
            cityPriceMap.set(city, (cityPriceMap.get(city) || 0) + Number(prop.price || 0));
            cityCountMap.set(city, (cityCountMap.get(city) || 0) + 1);
          }
        });
        
        const avgRentPrice = properties.length > 0 ? Math.round(totalPrice / properties.length) : 0;
        
        const listingsPerCityData = Array.from(cityMap.entries())
          .map(([name, listings]) => ({ name, listings }))
          .sort((a, b) => b.listings - a.listings)
          .slice(0, 5);
          
        const rentPricesData = Array.from(cityPriceMap.entries())
          .map(([name, total]) => ({
            name,
            price: Math.round(total / cityCountMap.get(name))
          }))
          .sort((a, b) => b.price - a.price)
          .slice(0, 5);
          
        const totalInquiries = inquiries.length;
        const totalBookings = bookings.length;
        const estimatedViews = totalInquiries * 12 + properties.length * 5; 
        
        const conversionRate = totalInquiries > 0 ? ((totalBookings / totalInquiries) * 100).toFixed(1) : 0;
        
        const inquiryLocationMap = new Map();
        inquiries.forEach(inq => {
          const prop = properties.find(p => p.id === inq.propertyId);
          if (prop && prop.location) {
            const city = prop.location.split(',')[0].trim();
            inquiryLocationMap.set(city, (inquiryLocationMap.get(city) || 0) + 1);
          }
        });
        
        const popularLocations = Array.from(inquiryLocationMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name, count], index) => {
            let status = 'Stable';
            let statusColor = 'text-gray-600 bg-gray-100';
            let icon = '•';
            
            if (index === 0) {
              status = 'High Demand';
              statusColor = 'text-orange-600 bg-orange-100';
              icon = '🔥';
            } else if (index === 1) {
              status = 'Trending';
              statusColor = 'text-blue-600 bg-blue-100';
              icon = '↑';
            } else if (index === 2) {
              status = 'Growing';
              statusColor = 'text-green-600 bg-green-100';
              icon = '↗';
            }
            
            return { id: index + 1, name, status, statusColor, icon, count };
          });
          
        setMetrics({
          newUsers: newUsersThisMonth,
          totalListings: properties.length,
          avgRentPrice,
          conversionRate: Number(conversionRate),
          userGrowthData,
          listingsPerCityData,
          rentPricesData,
          popularLocations,
          funnelData: { views: estimatedViews, inquiries: totalInquiries, bookings: totalBookings }
        });
        
        setHasData(properties.length > 0 || users.length > 0);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [dateRange, locationFilter, propertyType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
          <Activity className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No analytics data available yet</h3>
        <p className="text-gray-500 max-w-md mx-auto mb-8">
          Start adding listings and inviting users to see insights, trends, and performance metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Insights</h2>
          <p className="text-gray-500 mt-1">Track platform growth and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 border border-transparent rounded-xl text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm">
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 text-gray-500 mr-2">
          <Filter className="w-5 h-5" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        
        <div className="relative">
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>This Year</option>
            <option>Custom</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option>All Cities</option>
            <option>Nairobi</option>
            <option>Mombasa</option>
            <option>Kisumu</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="relative">
          <select 
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option>All Types</option>
            <option>Apartment</option>
            <option>House</option>
            <option>Studio</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="New Users (This Month)" value={metrics.newUsers.toLocaleString()} trend="up" trendValue="+12%" icon={Users} />
        <KPICard title="Total Listings" value={metrics.totalListings.toLocaleString()} trend="up" trendValue="+8%" icon={Home} />
        <KPICard title="Avg Rent Price" value={`$${metrics.avgRentPrice.toLocaleString()}`} trend="down" trendValue="-3%" icon={DollarSign} />
        <KPICard title="Conversion Rate" value={`${metrics.conversionRate}%`} trend="up" trendValue="+1.2%" icon={Activity} />
      </div>

      {/* Smart Insights Panel */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <Sparkles className="w-24 h-24 text-indigo-600" />
        </div>
        <div className="flex items-start gap-4 relative z-10">
          <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-600 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Smart Insights</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                <strong>{metrics.popularLocations[0]?.name || 'Top location'}</strong> is currently in high demand based on inquiries.
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <strong>Conversion rate</strong> is at {metrics.conversionRate}% from inquiries to bookings.
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                <strong>Average rent</strong> across all properties is ${metrics.avgRentPrice.toLocaleString()}.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">New Users Per Month</h3>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button className="px-3 py-1 text-xs font-medium bg-white shadow-sm rounded-md text-gray-900">Monthly</button>
              <button className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-900">Weekly</button>
              <button className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-900">Daily</button>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.userGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#e5e7eb', strokeWidth: 2, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="users" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Listings Per City */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Listings Per City</h3>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View Map</button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.listingsPerCityData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 13, fontWeight: 500 }} width={80} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="listings" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Conversion Funnel</h3>
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">Property Views (Est.)</span>
                <span className="text-sm font-bold text-gray-900">{metrics.funnelData.views.toLocaleString()}</span>
              </div>
              <div className="h-12 bg-indigo-100 rounded-xl overflow-hidden relative" style={{ width: '100%' }}>
                <div className="absolute inset-y-0 left-0 bg-indigo-500 w-full rounded-xl"></div>
              </div>
            </div>
            
            {/* Drop-off 1 */}
            <div className="flex items-center justify-start pl-4 -my-2 relative z-10">
              <div className="bg-white border border-gray-200 px-3 py-1 rounded-full text-xs font-medium text-gray-500 shadow-sm flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-500" />
                {metrics.funnelData.views > 0 ? ((metrics.funnelData.inquiries / metrics.funnelData.views) * 100).toFixed(1) : 0}% conversion
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">Inquiries</span>
                <span className="text-sm font-bold text-gray-900">{metrics.funnelData.inquiries.toLocaleString()}</span>
              </div>
              <div className="h-12 bg-indigo-100 rounded-xl overflow-hidden relative" style={{ width: `${Math.max(10, metrics.funnelData.views > 0 ? (metrics.funnelData.inquiries / metrics.funnelData.views) * 100 : 0)}%` }}>
                <div className="absolute inset-y-0 left-0 bg-indigo-400 w-full rounded-xl"></div>
              </div>
            </div>

            {/* Drop-off 2 */}
            <div className="flex items-center justify-start pl-4 -my-2 relative z-10">
              <div className="bg-white border border-gray-200 px-3 py-1 rounded-full text-xs font-medium text-gray-500 shadow-sm flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-500" />
                {metrics.funnelData.inquiries > 0 ? ((metrics.funnelData.bookings / metrics.funnelData.inquiries) * 100).toFixed(1) : 0}% conversion
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">Bookings</span>
                <span className="text-sm font-bold text-gray-900">{metrics.funnelData.bookings.toLocaleString()}</span>
              </div>
              <div className="h-12 bg-indigo-100 rounded-xl overflow-hidden relative" style={{ width: `${Math.max(5, metrics.funnelData.views > 0 ? (metrics.funnelData.bookings / metrics.funnelData.views) * 100 : 0)}%` }}>
                <div className="absolute inset-y-0 left-0 bg-indigo-300 w-full rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Popular Locations & Prices */}
        <div className="space-y-6">
          {/* Popular Locations */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Popular Locations</h3>
            {metrics.popularLocations.length > 0 ? (
              <div className="space-y-3">
                {metrics.popularLocations.map((loc, index) => (
                  <div key={loc.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{loc.name}</p>
                      </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${loc.statusColor}`}>
                      <span>{loc.icon}</span>
                      {loc.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No location data available yet.</p>
            )}
          </div>

          {/* Average Rent Prices */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Average Rent Prices (USD)</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.rentPricesData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="price" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
