"use client";

import { useState, useRef, useEffect } from "react";

interface SelectOption {
    value: string;
    label: string;
}

interface StyledSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    label?: string;
}

export function StyledSelect({ value, onChange, options, label }: StyledSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

    return (
        <div className="flex items-center gap-2">
            {label && <span className="text-sm text-gray-400">{label}</span>}
            <div ref={containerRef} className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${value && value !== options[0]?.value
                            ? "bg-purple-600 text-white"
                            : "bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50"
                        }`}
                >
                    {selectedLabel}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isOpen && (
                    <div className="absolute z-50 mt-2 right-0 min-w-[200px] bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => { onChange(option.value); setIsOpen(false); }}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer flex items-center justify-between ${value === option.value
                                        ? "bg-purple-500/20 text-purple-300"
                                        : "text-white hover:bg-slate-700"
                                    }`}
                            >
                                <span>{option.label}</span>
                                {value === option.value && (
                                    <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
