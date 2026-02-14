"use client";

import { useState, useRef, useEffect, useMemo } from "react";

interface DateTimePickerProps {
    value: string; // format: "YYYY-MM-DDTHH:mm"
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    error?: boolean;
    minDate?: Date;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateTimePicker({
    value,
    onChange,
    disabled = false,
    className = "",
    error = false,
    minDate = new Date(),
}: DateTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<"calendar" | "time">("calendar");
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse current value
    const parsedValue = useMemo(() => {
        if (!value) return null;
        const [datePart, timePart] = value.split("T");
        if (!datePart) return null;
        const [year, month, day] = datePart.split("-").map(Number);
        const [hours, minutes] = timePart ? timePart.split(":").map(Number) : [12, 0];
        return { year, month, day, hours, minutes };
    }, [value]);

    // Calendar state
    const [viewYear, setViewYear] = useState(parsedValue?.year || new Date().getFullYear());
    const [viewMonth, setViewMonth] = useState(parsedValue?.month || new Date().getMonth() + 1);
    const [selectedHours, setSelectedHours] = useState(parsedValue?.hours ?? 12);
    const [selectedMinutes, setSelectedMinutes] = useState(parsedValue?.minutes ?? 0);

    // Update view when value changes
    useEffect(() => {
        if (parsedValue) {
            setViewYear(parsedValue.year);
            setViewMonth(parsedValue.month);
            setSelectedHours(parsedValue.hours);
            setSelectedMinutes(parsedValue.minutes);
        }
    }, [parsedValue]);


    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setView("calendar");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

        const days: { day: number; month: number; year: number; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const month = viewMonth === 1 ? 12 : viewMonth - 1;
            const year = viewMonth === 1 ? viewYear - 1 : viewYear;
            const date = new Date(year, month - 1, day);
            days.push({ day, month, year, isCurrentMonth: false, isDisabled: date < new Date(minDate.setHours(0, 0, 0, 0)) });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(viewYear, viewMonth - 1, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            days.push({ day, month: viewMonth, year: viewYear, isCurrentMonth: true, isDisabled: date < today });
        }

        // Next month days
        const remaining = 42 - days.length;
        for (let day = 1; day <= remaining; day++) {
            const month = viewMonth === 12 ? 1 : viewMonth + 1;
            const year = viewMonth === 12 ? viewYear + 1 : viewYear;
            days.push({ day, month, year, isCurrentMonth: false, isDisabled: false });
        }

        return days;
    }, [viewYear, viewMonth, minDate]);

    const handleDayClick = (day: { day: number; month: number; year: number; isDisabled: boolean }) => {
        if (day.isDisabled) return;
        const dateStr = `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
        const timeStr = `${String(selectedHours).padStart(2, "0")}:${String(selectedMinutes).padStart(2, "0")}`;
        onChange(`${dateStr}T${timeStr}`);
        setView("time");
    };

    const handleTimeChange = (hours: number, minutes: number) => {
        setSelectedHours(hours);
        setSelectedMinutes(minutes);
        if (parsedValue) {
            const dateStr = `${parsedValue.year}-${String(parsedValue.month).padStart(2, "0")}-${String(parsedValue.day).padStart(2, "0")}`;
            const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
            onChange(`${dateStr}T${timeStr}`);
        }
    };

    const prevMonth = () => {
        if (viewMonth === 1) {
            setViewMonth(12);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const nextMonth = () => {
        if (viewMonth === 12) {
            setViewMonth(1);
            setViewYear(viewYear + 1);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    const formatDisplayValue = () => {
        if (!parsedValue) return "";
        const { year, month, day, hours, minutes } = parsedValue;
        const date = new Date(year, month - 1, day);
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const period = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12;
        return `${dateStr} at ${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
    };

    const isSelectedDay = (day: { day: number; month: number; year: number }) => {
        return parsedValue && day.day === parsedValue.day && day.month === parsedValue.month && day.year === parsedValue.year;
    };

    const isToday = (day: { day: number; month: number; year: number }) => {
        const today = new Date();
        return day.day === today.getDate() && day.month === today.getMonth() + 1 && day.year === today.getFullYear();
    };


    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 cursor-pointer flex items-center justify-between ${error ? "border-red-500" : "border-white/10"
                    }`}
            >
                <span className={parsedValue ? "text-white" : "text-gray-500"}>
                    {parsedValue ? formatDisplayValue() : "Select date and time"}
                </span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden w-[300px]">
                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        <button
                            type="button"
                            onClick={() => setView("calendar")}
                            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${view === "calendar" ? "text-purple-400 bg-purple-500/10" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Date
                        </button>
                        <button
                            type="button"
                            onClick={() => setView("time")}
                            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${view === "time" ? "text-purple-400 bg-purple-500/10" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Time
                        </button>
                    </div>

                    {view === "calendar" ? (
                        <div className="p-3">
                            {/* Month/Year Header */}
                            <div className="flex items-center justify-between mb-3">
                                <button type="button" onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded transition-colors cursor-pointer">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <span className="text-white font-medium">
                                    {MONTHS[viewMonth - 1]} {viewYear}
                                </span>
                                <button type="button" onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded transition-colors cursor-pointer">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 gap-1 mb-1">
                                {DAYS.map((day) => (
                                    <div key={day} className="text-center text-xs text-gray-500 py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {calendarDays.map((day, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleDayClick(day)}
                                        disabled={day.isDisabled}
                                        className={`p-2 text-sm rounded transition-colors cursor-pointer ${isSelectedDay(day)
                                            ? "bg-purple-600 text-white"
                                            : isToday(day)
                                                ? "bg-purple-500/20 text-purple-300"
                                                : day.isDisabled
                                                    ? "text-gray-600 cursor-not-allowed"
                                                    : day.isCurrentMonth
                                                        ? "text-white hover:bg-slate-700"
                                                        : "text-gray-500 hover:bg-slate-700"
                                            }`}
                                    >
                                        {day.day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-4">
                            <div className="flex items-center justify-center gap-2">
                                {/* Hours */}
                                <div className="flex flex-col items-center">
                                    <button
                                        type="button"
                                        onClick={() => handleTimeChange((selectedHours + 1) % 24, selectedMinutes)}
                                        className="p-1 hover:bg-slate-700 rounded cursor-pointer"
                                    >
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                    </button>
                                    <div className="w-16 py-2 text-center text-2xl font-mono text-white bg-slate-700/50 rounded">
                                        {String(selectedHours % 12 || 12).padStart(2, "0")}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleTimeChange((selectedHours - 1 + 24) % 24, selectedMinutes)}
                                        className="p-1 hover:bg-slate-700 rounded cursor-pointer"
                                    >
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>

                                <span className="text-2xl text-white font-mono">:</span>

                                {/* Minutes */}
                                <div className="flex flex-col items-center">
                                    <button
                                        type="button"
                                        onClick={() => handleTimeChange(selectedHours, (selectedMinutes + 5) % 60)}
                                        className="p-1 hover:bg-slate-700 rounded cursor-pointer"
                                    >
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                    </button>
                                    <div className="w-16 py-2 text-center text-2xl font-mono text-white bg-slate-700/50 rounded">
                                        {String(selectedMinutes).padStart(2, "0")}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleTimeChange(selectedHours, (selectedMinutes - 5 + 60) % 60)}
                                        className="p-1 hover:bg-slate-700 rounded cursor-pointer"
                                    >
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>

                                {/* AM/PM */}
                                <div className="flex flex-col gap-1 ml-2">
                                    <button
                                        type="button"
                                        onClick={() => handleTimeChange(selectedHours < 12 ? selectedHours : selectedHours - 12, selectedMinutes)}
                                        className={`px-3 py-1.5 text-sm rounded transition-colors cursor-pointer ${selectedHours < 12 ? "bg-purple-600 text-white" : "bg-slate-700 text-gray-400 hover:text-white"
                                            }`}
                                    >
                                        AM
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTimeChange(selectedHours >= 12 ? selectedHours : selectedHours + 12, selectedMinutes)}
                                        className={`px-3 py-1.5 text-sm rounded transition-colors cursor-pointer ${selectedHours >= 12 ? "bg-purple-600 text-white" : "bg-slate-700 text-gray-400 hover:text-white"
                                            }`}
                                    >
                                        PM
                                    </button>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-full mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
