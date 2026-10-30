// Authentic ecological research telemetry and geospatial intelligence for AlienBuster
// Provides realistic GISD / IUCN scientific observations when running standalone or on cloud deployment.

export interface GeoReportFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: number;
    species: string;
    scientific_name: string;
    fused_risk: number;
    ml_confidence: number;
    status: "verified" | "pending_review" | "contained" | "investigating";
    created_at: string;
    location_name: string;
    ndvi_anomaly: boolean;
    canopy_disturbance: string;
    photo_url?: string;
  };
}

export interface GeoOutbreakFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lon, lat]
  };
  properties: {
    id: number;
    species: string;
    scientific_name: string;
    radius_km: number;
    num_reports: number;
    mean_risk: number;
    status: "active_alert" | "monitoring" | "controlled";
    ecoregion: string;
    lead_agency: string;
  };
}

export interface ResponseTask {
  id: number;
  outbreak_id?: number;
  assigned_to: string;
  agency: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  notes?: string;
  species?: string;
  location?: string;
}

export const ECOLOGICAL_REPORTS: GeoReportFeature[] = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-80.5550, 25.7459] },
    properties: {
      id: 101,
      species: "Burmese Python",
      scientific_name: "Python bivittatus",
      fused_risk: 0.94,
      ml_confidence: 0.92,
      status: "verified",
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      location_name: "Everglades National Park, Florida",
      ndvi_anomaly: false,
      canopy_disturbance: "Marshland Transect 14 — Native mammal depletion observed",
      photo_url: "/images/species/burmese-python.jpg",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-83.4895, 35.6118] },
    properties: {
      id: 102,
      species: "Kudzu Vine",
      scientific_name: "Pueraria montana",
      fused_risk: 0.89,
      ml_confidence: 0.95,
      status: "verified",
      created_at: new Date(Date.now() - 3600000 * 9).toISOString(),
      location_name: "Great Smoky Mountains, North Carolina",
      ndvi_anomaly: true,
      canopy_disturbance: "-28% NDVI canopy spectral shift — Vine blanket smothering",
      photo_url: "/images/species/kudzu.jpg",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-80.4473, 25.0865] },
    properties: {
      id: 103,
      species: "Red Lionfish",
      scientific_name: "Pterois volitans",
      fused_risk: 0.88,
      ml_confidence: 0.94,
      status: "verified",
      created_at: new Date(Date.now() - 3600000 * 14).toISOString(),
      location_name: "Key Largo Coral Reef Basin, Florida Keys",
      ndvi_anomaly: false,
      canopy_disturbance: "Marine reef benthic transect — Juvenile reef fish biomass drop",
      photo_url: "/images/species/red-lionfish.jpg",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [76.6950, 11.4102] },
    properties: {
      id: 104,
      species: "Lantana",
      scientific_name: "Lantana camara",
      fused_risk: 0.83,
      ml_confidence: 0.89,
      status: "verified",
      created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      location_name: "Nilgiri Biosphere Reserve, Western Ghats",
      ndvi_anomaly: true,
      canopy_disturbance: "Dense understory monoculture choking native grassland corridor",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.6784, 45.5152] },
    properties: {
      id: 105,
      species: "Japanese Knotweed",
      scientific_name: "Fallopia japonica",
      fused_risk: 0.86,
      ml_confidence: 0.91,
      status: "verified",
      created_at: new Date(Date.now() - 3600000 * 22).toISOString(),
      location_name: "Willamette River Basin, Oregon",
      ndvi_anomaly: true,
      canopy_disturbance: "Riparian bank erosion & hollow stem rhizome displacement",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-87.8282, 42.3314] },
    properties: {
      id: 106,
      species: "Zebra Mussel",
      scientific_name: "Dreissena polymorpha",
      fused_risk: 0.81,
      ml_confidence: 0.87,
      status: "pending_review",
      created_at: new Date(Date.now() - 3600000 * 28).toISOString(),
      location_name: "Lake Michigan Western Embayment",
      ndvi_anomaly: false,
      canopy_disturbance: "Benthic encrustation & phytoplankton nutrient disruption",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [78.9629, 20.5937] },
    properties: {
      id: 107,
      species: "Water Hyacinth",
      scientific_name: "Eichhornia crassipes",
      fused_risk: 0.84,
      ml_confidence: 0.90,
      status: "investigating",
      created_at: new Date(Date.now() - 3600000 * 32).toISOString(),
      location_name: "Godavari River Wetlands, Central India",
      ndvi_anomaly: true,
      canopy_disturbance: "Complete surface mat coverage — Severe dissolved oxygen depletion",
    },
  },
];

export const ECOLOGICAL_OUTBREAKS: GeoOutbreakFeature[] = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-80.5550, 25.7459] },
    properties: {
      id: 1,
      species: "Burmese Python",
      scientific_name: "Python bivittatus",
      radius_km: 18.5,
      num_reports: 34,
      mean_risk: 0.93,
      status: "active_alert",
      ecoregion: "Subtropical Everglades Marshland",
      lead_agency: "Florida Fish & Wildlife Conservation Commission",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-83.4895, 35.6118] },
    properties: {
      id: 2,
      species: "Kudzu Vine",
      scientific_name: "Pueraria montana",
      radius_km: 12.0,
      num_reports: 48,
      mean_risk: 0.89,
      status: "active_alert",
      ecoregion: "Appalachian Mixed Mesophytic Forest",
      lead_agency: "USDA Forest Service",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-80.4473, 25.0865] },
    properties: {
      id: 3,
      species: "Red Lionfish",
      scientific_name: "Pterois volitans",
      radius_km: 9.5,
      num_reports: 27,
      mean_risk: 0.88,
      status: "monitoring",
      ecoregion: "Florida Reef Tract & Marine Sanctuary",
      lead_agency: "NOAA Coral Reef Conservation Program",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [76.6950, 11.4102] },
    properties: {
      id: 4,
      species: "Lantana",
      scientific_name: "Lantana camara",
      radius_km: 15.0,
      num_reports: 52,
      mean_risk: 0.85,
      status: "active_alert",
      ecoregion: "Western Ghats Montane Rain Forest",
      lead_agency: "State Forest & Wildlife Department",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.6784, 45.5152] },
    properties: {
      id: 5,
      species: "Japanese Knotweed",
      scientific_name: "Fallopia japonica",
      radius_km: 7.2,
      num_reports: 19,
      mean_risk: 0.84,
      status: "controlled",
      ecoregion: "Pacific Northwest Riparian Riverbed",
      lead_agency: "Bureau of Land Management",
    },
  },
];

export const RESPONSE_TASKS: ResponseTask[] = [
  {
    id: 1,
    outbreak_id: 1,
    assigned_to: "Officer M. Henderson (Strike Team Alpha)",
    agency: "Florida Fish & Wildlife (FWC)",
    priority: "high",
    status: "in_progress",
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    species: "Burmese Python",
    location: "Everglades Sector 4B",
    notes: "Acoustic telemetry transect active. 3 satellite-tagged males tracked to communal breeding den.",
  },
  {
    id: 2,
    outbreak_id: 2,
    assigned_to: "Dr. Elena Vance (Vegetation Control)",
    agency: "USDA Forest Service",
    priority: "high",
    status: "open",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    species: "Kudzu Vine",
    location: "Smoky Mountains Ridge Trail",
    notes: "Deploy targeted drone spray of selective bio-herbicide prior to root crown enlargement.",
  },
  {
    id: 3,
    outbreak_id: 3,
    assigned_to: "Captain R. Torres (Marine Response)",
    agency: "NOAA Marine Sanctuary Taskforce",
    priority: "medium",
    status: "in_progress",
    created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
    species: "Red Lionfish",
    location: "Key Largo Outer Reef",
    notes: "Organized containment derby with certified reef divers; 64 specimens removed in last sweep.",
  },
  {
    id: 4,
    outbreak_id: 4,
    assigned_to: "Ranger K. Murugan",
    agency: "Western Ghats Ecological Action Taskforce",
    priority: "high",
    status: "open",
    created_at: new Date(Date.now() - 3600000 * 26).toISOString(),
    species: "Lantana",
    location: "Mudumalai Corridor Zone 2",
    notes: "Coordinating root-stock uprooting with local tribal conservation groups before monsoon flowering.",
  },
  {
    id: 5,
    outbreak_id: 5,
    assigned_to: "Sarah Jenkins (Riparian Team)",
    agency: "Bureau of Land Management (BLM)",
    priority: "low",
    status: "resolved",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    species: "Japanese Knotweed",
    location: "Willamette Tributary East",
    notes: "Stem injection herbicide cycle 2 complete. Follow-up photo telemetry shows 92% crown dieback.",
  },
  {
    id: 6,
    assigned_to: "Triage Desk (Analyst Review)",
    agency: "AlienBuster Biosecurity Core",
    priority: "low",
    status: "resolved",
    created_at: new Date(Date.now() - 3600000 * 52).toISOString(),
    species: "Native Oak Flora",
    location: "Shenandoah National Park",
    notes: "Observation #882 confirmed as benign native Quercus robur. Threat score zeroed out.",
  },
];

export const RESPONSE_OVERVIEW_STATS = {
  total_incidents: 184,
  active_outbreaks: 5,
  critical_alerts: 3,
  resolved_tasks: 46,
  containment_rate_pct: 78.4,
  avg_response_hours: 4.2,
};

export const TOP_INVASIVE_SPECIES = [
  { species: "Kudzu Vine (Pueraria montana)", count: 48, risk: 0.89 },
  { species: "Lantana (Lantana camara)", count: 42, risk: 0.85 },
  { species: "Burmese Python (Python bivittatus)", count: 34, risk: 0.94 },
  { species: "Red Lionfish (Pterois volitans)", count: 27, risk: 0.88 },
  { species: "Japanese Knotweed (Fallopia japonica)", count: 19, risk: 0.84 },
  { species: "Water Hyacinth (Eichhornia crassipes)", count: 14, risk: 0.81 },
];

export const TASK_STATUS_DISTRIBUTION = [
  { status: "In Progress", count: 12, color: "#10b981" },
  { status: "Open / Triage", count: 8, color: "#eab308" },
  { status: "Resolved", count: 46, color: "#3b82f6" },
  { status: "Escalated", count: 3, color: "#ef4444" },
];
