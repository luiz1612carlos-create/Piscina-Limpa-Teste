import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReviewSlide } from '../types';

interface ReviewSliderProps {
    slides: ReviewSlide[];
}

export const ReviewSlider: React.FC<ReviewSliderProps> = ({ slides }) => {
    const activeSlides = slides?.filter(s => s.active && s.imageUrl) || [];
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (activeSlides.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [activeSlides.length]);

    if (activeSlides.length === 0) return null;

    const currentSlide = activeSlides[currentIndex];

    return (
        <div className="relative w-full h-48 md:h-64 overflow-hidden rounded-2xl bg-black shadow-2xl border border-white/10 group">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentSlide.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => currentSlide.linkUrl && window.open(currentSlide.linkUrl, '_blank')}
                >
                    {/* Background Layer - Sharp and covering (Point 5 & 6) */}
                    <div className="absolute inset-0">
                        <img 
                            src={currentSlide.imageUrl} 
                            alt=""
                            className="w-full h-full object-cover opacity-40"
                            referrerPolicy="no-referrer"
                        />
                    </div>

                    {/* Main Image Layer - Complete and without cuts (Point 7) */}
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                         <img 
                            src={currentSlide.imageUrl} 
                            alt={currentSlide.text}
                            className="max-w-full max-h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
                            referrerPolicy="no-referrer"
                        />
                    </div>

                    {/* Text Overlay - Positioned lower (Point 8 & 9) */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                        <div className="max-w-4xl mx-auto">
                            <motion.p 
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-white text-center font-black text-sm md:text-lg uppercase tracking-wider drop-shadow-lg"
                            >
                                {currentSlide.text}
                            </motion.p>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Navigation Dots */}
            {activeSlides.length > 1 && (
                <div className="absolute bottom-4 right-6 flex gap-2 z-20">
                    {activeSlides.map((_, idx) => (
                        <button 
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(idx);
                            }}
                            className={`h-1.5 transition-all duration-300 rounded-full ${idx === currentIndex ? 'bg-primary-500 w-8' : 'bg-white/20 w-4 hover:bg-white/40'}`}
                        />
                    ))}
                </div>
            )}

            {/* External Link Icon Overlay */}
            {currentSlide.linkUrl && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-white/10 backdrop-blur-md p-2 rounded-full border border-white/20">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};
