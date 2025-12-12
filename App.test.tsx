import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import React from 'react';

describe('App', () => {
    it('renders without crashing', () => {
        render(<App />);
        expect(screen.getByText(/Marijany Sticker Print/i)).toBeInTheDocument();
    });
});
