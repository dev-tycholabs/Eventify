"use client";

import { useState, useMemo } from "react";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface EventCalendarFilterProps {
    /** Dates that have events (YYYY-MM-DD strings) */
    eventDates: Set<string>;
    /** Currently selected date (YYYY-MM-DD) or null */
    selectedDate: string | null;
    /** Called when a date is selected or cleared */
    onDateChange: (date: string | null) => void;
    /** Called when the viewed month changes (year, month 1-12) */
    onMonthChange?: (year: number, month: number) => void;
}

export function EventCalendarFilter({ eventDates, selectedDate, onDateChange, onMonthChange }: EventCalendarFilterProps) {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
        const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

        const days: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const month = viewMonth === 1 ? 12 : viewMonth - 1;
            const year = viewMonth === 1 ? viewYear - 1 : viewYear;
            days.push({ day, month, year, isCurrentMonth: false });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            days.push({ day, month: viewMonth, year: viewYear, isCurrentMonth: true });
        }

        const remaining = 42 - days.length;
        for (let day = 1; day <= remaining; day++) {
            const month = viewMonth === 12 ? 1 : viewMonth + 1;
            const year = viewMonth === 12 ? viewYear + 1 : viewYear;
            days.push({ day, month, year, isCurrentMonth: false });
        }

        return days;
    }, [viewYear, viewMonth]);

    const toDateStr = (d: { day: number; month: number; year: number }) =>
        `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

    const isToday = (d: { day: number; month: number; year: number }) =>
        d.day === today.getDate() && d.month === today.getMonth() + 1 && d.year === today.getFullYear();

    const isSelected = (d: { day: number; month: number; year: number }) =>
        selectedDate === toDateStr(d);

    const hasEvents = (d: { day: number; month: number; year: number }) =>
        eventDates.has(toDateStr(d));

    const prevMonth = () => {
        const newMonth = viewMonth === 1 ? 12 : viewMonth - 1;
        const newYear = viewMonth === 1 ? viewYear - 1 : viewYear;
        setViewMonth(newMonth);
        setViewYear(newYear);
        onMonthChange?.(newYear, newMonth);
    };

    const nextMonth = () => {
        const newMonth = viewMonth === 12 ? 1 : viewMonth + 1;
        const newYear = viewMonth === 12 ? viewYear + 1 : viewYear;
        setViewMonth(newMonth);
        setViewYear(newYear);
        onMonthChange?.(newYear, newMonth);
    };

    const handleDayClick = (d: { day: number; month: number; year: number }) => {
        const dateStr = toDateStr(d);
        onDateChange(selectedDate === dateStr ? null : dateStr);
    };

    return (
        <div className="bg-slate-800/50 border border-white/10 rounded-lg overflow-hidden">
            {/* Month/Year Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <button type="button" onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded transition-colors cursor-pointer">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="text-white font-medium text-sm">
                    {MONTHS[viewMonth - 1]} {viewYear}
                </span>
                <button type="button" onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded transition-colors cursor-pointer">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            <div className="p-3">
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
                            className={`relative p-2 text-sm rounded transition-colors cursor-pointer ${isSelected(day)
                                ? "bg-purple-600 text-white"
                                : isToday(day)
                                    ? "bg-purple-500/20 text-purple-300"
                                    : day.isCurrentMonth
                                        ? "text-white hover:bg-slate-700"
                                        : "text-gray-600 hover:bg-slate-700/50"
                                }`}
                        >
                            {day.day}
                            {hasEvents(day) && (
                                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected(day) ? "bg-white" : "bg-purple-400"
                                    }`} />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected date indicator / clear */}
            {selectedDate && (
                <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                        Filtering: {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <button
                        type="button"
                        onClick={() => onDateChange(null)}
                        className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
}
