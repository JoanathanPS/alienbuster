import { Camera, MapPin, Send, Cpu, Info } from "lucide-react";
import { Page } from "@/components/Page";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    icon: Camera,
    title: "1. Spot & Snap",
    desc: "Observe a suspicious plant or animal in the wild. Capture a clear photo directly through the app or upload from your gallery.",
  },
  {
    icon: MapPin,
    title: "2. Automatic Telemetry & GPS",
    desc: "EXIF metadata and your device geolocation are extracted automatically to anchor the sighting to exact spatial coordinates.",
  },
  {
    icon: Cpu,
    title: "3. BioCLIP AI Multimodal Vision",
    desc: "Our BioCLIP neural classifier processes the sighting against known invasive taxonomy, evaluating biological features in real time.",
  },
  {
    icon: Send,
    title: "4. Satellite Correlation & Response",
    desc: "Sightings fuse with Sentinel-2 NDVI satellite change detection to score regional threat levels and notify conservation authorities.",
  },
];

const exampleSpecies = [
  {
    name: "Kudzu Vine (Pueraria montana)",
    desc: "Aggressive perennial vine native to East Asia. Smothers forest canopies, outcompeting native flora and destabilizing local biodiversity.",
    image: "/images/species/kudzu.jpg",
  },
  {
    name: "Burmese Python (Python bivittatus)",
    desc: "Apex predator native to Southeast Asia, now severely impacting marsh rabbits, wading birds, and deer across wetland ecosystems.",
    image: "/images/species/burmese-python.jpg",
  },
  {
    name: "Red Lionfish (Pterois volitans)",
    desc: "Venomous Indo-Pacific predatory fish invading Atlantic and Caribbean reefs, depleting over 80% of juvenile native fish populations.",
    image: "/images/species/red-lionfish.jpg",
  },
];

const HowItWorks = () => {
  return (
    <Page
      title={
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" aria-hidden="true" />
          How AlienBuster Works
        </div>
      }
      description="Crowdsourced ecological field reports fused with satellite remote sensing and BioCLIP machine learning."
      className="max-w-4xl"
    >
      <div className="space-y-8">
        {/* Step Progression Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map((step) => (
            <Card key={step.title} className="border-border bg-card/60 backdrop-blur-sm transition-all hover:bg-card">
              <CardContent className="flex items-start gap-3.5 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary ab-glow-leaf">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">{step.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Example Species Showcase */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Priority Bio-Threat Species</h2>
            <p className="text-xs text-muted-foreground">Examples of high-risk invasive flora and fauna monitored by the system.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {exampleSpecies.map((s) => (
              <Card key={s.name} className="overflow-hidden border-border bg-card/60 transition-all hover:bg-card">
                <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                  <img
                    src={s.image}
                    alt={s.name}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <CardContent className="p-4 space-y-1.5">
                  <h4 className="text-sm font-semibold text-foreground">{s.name}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
};

export default HowItWorks;
