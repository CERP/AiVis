import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Headline, Subtitle } from "@/components/ui/typography";

export default function Home() {
  return (
    <AppShell>
      <section className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 py-24">
        <Headline>Turn any dataset into an editorial story.</Headline>
        <Subtitle>
          Upload data, discover insights, and let Aivis recommend publication-quality
          visualizations — then refine every detail in the studio.
        </Subtitle>
        <Button variant="accent" size="lg">
          Upload a dataset
        </Button>
      </section>
    </AppShell>
  );
}
