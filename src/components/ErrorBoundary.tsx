import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Button } from './ui/Button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isPermissionError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
            isPermissionError = true;
            errorMessage = "You don't have permission to perform this action. Please make sure you are logged in with the correct account.";
          }
        }
      } catch (e) {
        // Not a JSON error message
        if (this.state.error?.message.includes('Missing or insufficient permissions')) {
          isPermissionError = true;
          errorMessage = "You don't have permission to perform this action.";
        }
      }

      return (
        <div className="min-h-screen flex flex-col bg-white text-gray-900">
          <Navbar />
          <main className="flex-grow flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-2xl">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => window.location.reload()} 
                  className="w-full bg-purple-600 text-white hover:bg-purple-700"
                >
                  Reload Page
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/'} 
                  className="w-full border-gray-200 text-gray-900 hover:bg-gray-100"
                >
                  Go to Home
                </Button>
              </div>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-8 p-4 bg-white rounded-lg border border-red-500/20 text-left overflow-auto max-h-40">
                  <pre className="text-[10px] text-red-400 font-mono">
                    {this.state.error.stack}
                  </pre>
                </div>
              )}
            </div>
          </main>
          <Footer />
        </div>
      );
    }

    return this.props.children;
  }
}
