import React from 'react';

export interface TourStep {
    target: string;
    content: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface GuidedTourProps {
    steps: TourStep[];
    isOpen: boolean;
    onClose: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, onClose }) => {
    // Basic stub to prevent compilation errors
    if (!isOpen) return null;
    return null;
};