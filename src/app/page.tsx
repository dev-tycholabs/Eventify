import { HeroSection, FeaturesGrid, HowItWorks, Footer } from "@/components/landing";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900">
      <HeroSection />
      <FeaturesGrid />
      <section id="how-it-works">
        <HowItWorks />
      </section>
      <Footer />
    </main>
  );
}
