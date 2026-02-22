import { MapPin, Radar, PlusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Page } from "@/components/Page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GeoMap } from "@/components/GeoMap";

export default function Outbreaks() {
  return (
    <Page
      title={
        <span className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" /> Outbreaks
        </span>
      }
      description="Spatiotemporal clusters of high-risk invasive reports."
    >
      <div className="flex justify-end mb-4">
        <Button asChild variant="outline" size="sm">
          <Link to="/dataset">
            <PlusCircle className="mr-2 h-4 w-4" />
            Ingest Dataset
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-1">
        <Card className="overflow-hidden border-white/10 bg-card/25">
          <CardHeader className="pb-3 border-b border-white/5">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" /> Outbreak map
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[600px]">
            <GeoMap showReports={false} showOutbreaks={true} height="100%" />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
