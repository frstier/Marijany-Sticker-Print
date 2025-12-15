import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-50 h-screen flex flex-col items-center justify-center text-red-900 overflow-auto">
                    <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
                    <div className="bg-white p-4 rounded shadow-lg max-w-full w-full overflow-auto border border-red-200">
                        <h2 className="text-lg font-semibold mb-2">{this.state.error?.toString()}</h2>
                        <details className="text-xs font-mono whitespace-pre-wrap text-slate-600">
                            <summary className="cursor-pointer text-blue-600 mb-2">View Stack Trace</summary>
                            {this.state.errorInfo?.componentStack}
                        </details>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold"
                    >
                        Reload App
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
