import {
  HeroSection,
  StatsStrip,
  FeaturedEvents,
  FeaturesGrid,
  HowItWorks,
  CTASection,
  Footer,
} from "@/components/landing";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900">
      <HeroSection />
      <StatsStrip />
      <FeaturedEvents />
      <FeaturesGrid />
      <section id="how-it-works">
        <HowItWorks />
      </section>
      <CTASection />
      <Footer />
    </main>
  );
}
