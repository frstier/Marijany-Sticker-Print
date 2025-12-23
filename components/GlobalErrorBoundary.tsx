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
                <div
                    className="p-8 bg-red-50 h-screen flex flex-col items-center justify-center text-red-900 overflow-auto"
                    style={{ padding: '2rem', backgroundColor: '#fef2f2', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#7f1d1d', overflow: 'auto' }}
                >
                    <h1 className="text-2xl font-bold mb-4" style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Something went wrong</h1>
                    <div
                        className="bg-white p-4 rounded shadow-lg max-w-full w-full overflow-auto border border-red-200"
                        style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '0.25rem', padding: '1rem', border: '1px solid #fecaca', width: '100%' }}
                    >
                        <h2 className="text-lg font-semibold mb-2" style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{this.state.error?.toString()}</h2>
                        <details className="text-xs font-mono whitespace-pre-wrap text-slate-600" style={{ fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#475569' }}>
                            <summary className="cursor-pointer text-blue-600 mb-2" style={{ cursor: 'pointer', color: '#2563eb', marginBottom: '0.5rem' }}>View Stack Trace</summary>
                            {this.state.errorInfo?.componentStack}
                        </details>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold"
                        style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', backgroundColor: '#dc2626', color: 'white', borderRadius: '0.25rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        Reload App
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
