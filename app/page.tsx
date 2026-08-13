import ClickSpark from "@/components/landing/click-spark";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FlavorCarousel } from "@/components/landing/flavor-carousel";
import { BentoGrid } from "@/components/landing/bento-grid";
import { ActivationsSection } from "@/components/landing/activations-section";
import { SocialSection } from "@/components/landing/social-section";
import { Footer } from "@/components/landing/footer";
import { LenisProvider } from "@/components/landing/lenis-provider";

export default function Home() {
  return (
    <ClickSpark
      sparkColor="#E89BFF"
      sparkSize={12}
      sparkRadius={20}
      sparkCount={8}
      duration={400}
      easing="ease-out"
    >
      <LenisProvider>
        <main className="min-h-screen bg-background">
          <Navigation />
          <HeroSection />
          <FlavorCarousel />
          <BentoGrid />
          <ActivationsSection />
          <SocialSection />
          <Footer />
        </main>
      </LenisProvider>
    </ClickSpark>
  );
}
