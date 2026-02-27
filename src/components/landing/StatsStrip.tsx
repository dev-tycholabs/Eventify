"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
    { value: 10000, suffix: "+", label: "Tickets Secured" },
    { value: 500, suffix: "+", label: "Events Hosted" },
    { value: 7, suffix: "", label: "Networks Live" },
    { value: 0, suffix: "%", label: "Fraud Rate", displayValue: "0" },
];

function AnimatedNumber({
    target,
    suffix,
    displayValue,
}: {
    target: number;
    suffix: string;
    displayValue?: string;
}) {
    const [count, setCount] = useState(0);
    const [hasAnimated, setHasAnimated] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated) {
                    setHasAnimated(true);
                    const duration = 2000;
                    const steps = 60;
                    const increment = target / steps;
                    let current = 0;
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            setCount(target);
                            clearInterval(timer);
                        } else {
                            setCount(Math.floor(current));
                        }
                    }, duration / steps);
                }
            },
            { threshold: 0.5 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target, hasAnimated]);

    return (
        <span ref={ref}>
            {displayValue !== undefined && hasAnimated
                ? displayValue
                : count.toLocaleString()}
            {suffix}
        </span>
    );
}

export function StatsStrip() {
    return (
        <section className="relative py-16 bg-slate-900">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-900" />
            <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {stats.map((stat, i) => (
                        <div key={i} className="text-center">
                            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                                <AnimatedNumber
                                    target={stat.value}
                                    suffix={stat.suffix}
                                    displayValue={stat.displayValue}
                                />
                            </div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
