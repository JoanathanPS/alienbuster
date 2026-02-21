import { Camera, MapPin, Send, Search } from "lucide-react";

const steps = [
  { icon: Camera, title: "1. Spot & Snap", desc: "See something unusual? Take a photo using the app's camera." },
  { icon: MapPin, title: "2. Tag Location", desc: "Your GPS coordinates are captured automatically for precise tracking." },
  { icon: Send, title: "3. Submit Report", desc: "Add a description and submit. Your report is saved to our database." },
  { icon: Search, title: "4. AI Analysis (Coming Soon)", desc: "Our BioCLIP-powered AI will analyze photos to identify invasive species." },
];

const exampleSpecies = [
  {
    name: "Kudzu Vine",
    desc: "A fast-growing vine from Japan that smothers native vegetation across the southeastern US.",
    emoji: "🌿",
  },
  {
    name: "Burmese Python",
    desc: "Non-native constrictor threatening native wildlife in Florida's Everglades.",
    emoji: "🐍",
  },
  {
    name: "Lionfish",
    desc: "Venomous Indo-Pacific fish invading Atlantic and Caribbean reefs, devastating local fish populations.",
    emoji: "🐟",
  },
];

const HowItWorks = () => {
  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h2 className="mb-2 text-xl font-bold text-foreground">How It Works</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Alien Buster empowers citizens to report invasive species sightings, helping scientists protect local ecosystems.
      </p>

      {/* Steps */}
      <div className="mb-8 space-y-4">
        {steps.map((step) => (
          <div key={step.title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <step.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Example species */}
      <h3 className="mb-3 text-lg font-bold text-foreground">Common Invasive Species</h3>
      <div className="space-y-3">
        {exampleSpecies.map((s) => (
          <div key={s.name} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl">{s.emoji}</span>
              <span className="text-sm font-semibold text-foreground">{s.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HowItWorks;
