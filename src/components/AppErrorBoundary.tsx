import React, { Component, ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Sentry } from '@/lib/sentry';
import { logger } from '@/lib/logger';

interface Props {
    children?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class AppErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('AppErrorBoundary', 'Uncaught application error', error, { componentStack: errorInfo.componentStack });
        Sentry?.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
                            <p className="text-gray-500">
                                An unexpected error occurred. Our team has been notified.
                            </p>
                        </div>

                        {import.meta.env?.DEV && this.state.error && (
                            <div className="bg-red-50 p-4 rounded text-left overflow-auto text-sm text-red-800 font-mono">
                                {this.state.error.message}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-4">
                            <Button onClick={this.handleReset} className="w-full" size="lg">
                                <RefreshCcw className="w-4 h-4 mr-2" />
                                Reload Application
                            </Button>
                            <Button variant="outline" onClick={() => window.location.href = '/'} className="w-full" size="lg">
                                <Home className="w-4 h-4 mr-2" />
                                Return to Home
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
