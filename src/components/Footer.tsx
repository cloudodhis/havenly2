import React from 'react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 pt-12 pb-28 md:pb-12 mt-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className="font-semibold mb-4 text-gray-900">Support</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>Help Center</li>
              <li>Safety information</li>
              <li>Cancellation options</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-gray-900">Community</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>Havenly.org: disaster relief housing</li>
              <li>Support Afghan refugees</li>
              <li>Combating discrimination</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-gray-900">Hosting</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>Try hosting</li>
              <li>AirCover for Hosts</li>
              <li>Explore hosting resources</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-gray-900">About</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li>Newsroom</li>
              <li>Learn about new features</li>
              <li>Letter from our founders</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
          <p>© 2026 Havenly, Inc. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <span className="hover:text-gray-900 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-gray-900 cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-gray-900 cursor-pointer transition-colors">Sitemap</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
