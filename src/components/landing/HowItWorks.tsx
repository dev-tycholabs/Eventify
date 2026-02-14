"use client";

const steps = [
    {
        number: 1,
        title: "Connect Your Wallet",
        description: "Link your blockchain wallet (like MetaMask) to access the platform and manage your tickets securely.",
    },
    {
        number: 2,
        title: "Browse & Purchase",
        description: "Explore upcoming events and purchase NFT tickets directly. Your ticket is minted to your wallet instantly.",
    },
    {
        number: 3,
        title: "Attend or Trade",
        description: "Use your ticket for event entry with QR verification, or list it on our marketplace for secure resale.",
    },
    {
        number: 4,
        title: "Verify & Enter",
        description: "Event organizers verify tickets on-chain in real-time. No more fake tickets or entry fraud.",
    },
];

export function HowItWorks() {
    return (
        <section className="py-20 bg-slate-950">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                        How It Works
                    </h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Get started in minutes with our simple four-step process.
                    </p>
                </div>

                <div className="relative">
                    {/* Connector Line - Hidden on mobile */}
                    <div className="hidden lg:block absolute top-16 left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {steps.map((step, index) => (
                            <div key={index} className="relative flex flex-col items-center text-center">
                                {/* Step Number */}
                                <div className="relative z-10 w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-6 shadow-lg shadow-purple-500/30">
                                    {step.number}
                                </div>

                                {/* Mobile Connector */}
                                {index < steps.length - 1 && (
                                    <div className="lg:hidden absolute top-14 left-1/2 w-0.5 h-8 bg-gradient-to-b from-purple-500 to-pink-500 -translate-x-1/2 hidden sm:block" />
                                )}

                                <h3 className="text-xl font-semibold text-white mb-3">
                                    {step.title}
                                </h3>
                                <p className="text-gray-400 leading-relaxed">
                                    {step.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
