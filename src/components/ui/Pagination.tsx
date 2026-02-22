"use client";

import { useState, useRef, useEffect } from "react";

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48];

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

interface PageSizeSelectorProps {
    pageSize: number;
    onPageSizeChange: (size: number) => void;
}

export function PageSizeSelector({ pageSize, onPageSizeChange }: PageSizeSelectorProps) {
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

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50"
            >
                {pageSize}
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 right-0 min-w-[100px] bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                        <button
                            key={size}
                            type="button"
                            onClick={() => { onPageSizeChange(size); setIsOpen(false); }}
                            className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer flex items-center justify-between ${pageSize === size ? "bg-purple-500/20 text-purple-300" : "text-white hover:bg-slate-700"
                                }`}
                        >
                            <span>{size}</span>
                            {pageSize === size && (
                                <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages: (number | "...")[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push("...");
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-1 mt-8">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {getPageNumbers().map((page, i) =>
                page === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-gray-500">…</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => onPageChange(page)}
                        aria-current={page === currentPage ? "page" : undefined}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${page === currentPage
                            ? "bg-purple-600 text-white"
                            : "text-gray-400 hover:text-white hover:bg-slate-800/50"
                            }`}
                    >
                        {page}
                    </button>
                )
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </nav>
    );
}
