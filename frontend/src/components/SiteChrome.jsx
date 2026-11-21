import { useEffect, useState } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";

/** Sticky and transparent; it blurs only once the page has scrolled. */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 0);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[backdrop-filter,background-color] duration-300",
        scrolled ? "bg-background/60 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-6 py-5 sm:px-12">
        <a
          href="/"
          className="font-onest text-xl font-medium tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          AI Review
        </a>
        <ThemeSwitcher />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-16 px-6 font-montserrat sm:px-12 before:absolute before:top-0 before:left-1/2 before:h-px before:w-full before:max-w-[1440px] before:-translate-x-1/2 before:bg-amber-600 before:opacity-10 before:[mask-image:linear-gradient(90deg,transparent_0%,black_40%,black_60%,transparent_100%)] dark:before:bg-orange-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p className="max-w-2xl leading-relaxed">
          Code you submit is sent to Groq and Google for review. On the free tier Google may use it to improve its
          models, so leave secrets out. This server keeps results in memory for up to an hour and writes nothing to disk.
        </p>
        <p className="shrink-0">Runs on the Groq and Gemini free tiers</p>
      </div>
    </footer>
  );
}
