import { Page } from "@/components/Page";
import { Card, CardContent } from "@/components/ui/card";

export default function FontPreview() {
  return (
    <Page title="Typography Preview" description="Visual verification of Inter + Space Grotesk">
      <div className="space-y-8">
        <Card>
          <CardContent className="p-8 space-y-8">
            
            {/* Space Grotesk Headings */}
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Display / Headings (Space Grotesk)</div>
              <div className="space-y-2">
                <h1 className="text-5xl font-bold tracking-tight font-display">Heading 1 - Bold 700</h1>
                <h2 className="text-4xl font-semibold tracking-tight font-display">Heading 2 - SemiBold 600</h2>
                <h3 className="text-3xl font-medium tracking-tight font-display">Heading 3 - Medium 500</h3>
                <h4 className="text-2xl font-normal tracking-tight font-display">Heading 4 - Regular 400</h4>
              </div>
            </div>

            <hr className="border-white/10" />

            {/* Inter Body */}
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Body / UI (Inter)</div>
              <div className="grid gap-4 max-w-2xl">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Regular 400</div>
                  <p className="text-base leading-relaxed font-normal">
                    The quick brown fox jumps over the lazy dog. Invasive species threaten local ecosystems by outcompeting native flora and fauna. Early detection is our best defense against rapid spread.
                  </p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Medium 500</div>
                  <p className="text-base leading-relaxed font-medium">
                    The quick brown fox jumps over the lazy dog. Invasive species threaten local ecosystems by outcompeting native flora and fauna. Early detection is our best defense against rapid spread.
                  </p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">SemiBold 600</div>
                  <p className="text-base leading-relaxed font-semibold">
                    The quick brown fox jumps over the lazy dog. Invasive species threaten local ecosystems by outcompeting native flora and fauna. Early detection is our best defense against rapid spread.
                  </p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Bold 700</div>
                  <p className="text-base leading-relaxed font-bold">
                    The quick brown fox jumps over the lazy dog. Invasive species threaten local ecosystems by outcompeting native flora and fauna. Early detection is our best defense against rapid spread.
                  </p>
                </div>
              </div>
            </div>

            <hr className="border-white/10" />

            {/* UI Components */}
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">UI Components</div>
              <div className="flex flex-wrap gap-4">
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">Primary Button</button>
                <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium">Secondary Button</button>
                <button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-lg text-sm font-medium">Outline Button</button>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
