export type EmissionsCategory = "transport" | "energy" | "waste" | "purchases";

export interface SubCategoryOption {
  label: string;
  value: string;
  factorKgPerUnit: number;
}

export interface ActivityCategoryConfig {
  value: string;
  label: string;
  unit: string;
  subCategoryLabel: string;
  subOptions: SubCategoryOption[];
}

// ---------------------------------------------------------------------------
// 1. TRANSPORT CATEGORIES & DEPENDENT SUB-OPTIONS
// ---------------------------------------------------------------------------
export const TRANSPORT_CONFIGS: ActivityCategoryConfig[] = [
  {
    value: "business_road",
    label: "Business Travel (Road)",
    unit: "KM",
    subCategoryLabel: "Fuel / Vehicle Type",
    subOptions: [
      { label: "Petrol (Gasoline)", value: "petrol", factorKgPerUnit: 0.142 },
      { label: "Diesel", value: "diesel", factorKgPerUnit: 0.165 },
      { label: "CNG (Compressed Natural Gas)", value: "cng", factorKgPerUnit: 0.098 },
      { label: "Hybrid (Petrol/Electric)", value: "hybrid", factorKgPerUnit: 0.085 },
      { label: "Electric Vehicle (EV)", value: "ev", factorKgPerUnit: 0.045 },
      { label: "LPG (Liquefied Petroleum Gas)", value: "lpg", factorKgPerUnit: 0.120 },
    ],
  },
  {
    value: "business_air",
    label: "Business Travel (Air)",
    unit: "KM",
    subCategoryLabel: "Flight Class & Distance",
    subOptions: [
      { label: "Economy Class (Domestic)", value: "domestic_economy", factorKgPerUnit: 0.245 },
      { label: "Economy Class (Short-haul International)", value: "shorthaul_economy", factorKgPerUnit: 0.156 },
      { label: "Economy Class (Long-haul International)", value: "longhaul_economy", factorKgPerUnit: 0.193 },
      { label: "Business / First Class (Long-haul)", value: "business_first", factorKgPerUnit: 0.298 },
    ],
  },
  {
    value: "employee_commute",
    label: "Employee Commute",
    unit: "KM",
    subCategoryLabel: "Commute Transport Mode",
    subOptions: [
      { label: "Two-Wheeler (Petrol Bike/Scooter)", value: "twowheeler_petrol", factorKgPerUnit: 0.052 },
      { label: "Two-Wheeler (Electric Scooter)", value: "twowheeler_electric", factorKgPerUnit: 0.018 },
      { label: "Private Passenger Car (Petrol/Diesel)", value: "private_car", factorKgPerUnit: 0.124 },
      { label: "Public Bus (City / Intercity)", value: "public_bus", factorKgPerUnit: 0.042 },
      { label: "Metro / Suburban Rail", value: "metro_rail", factorKgPerUnit: 0.028 },
      { label: "Shared Auto-Rickshaw / Cab", value: "shared_cab", factorKgPerUnit: 0.068 },
    ],
  },
  {
    value: "freight_logistics",
    label: "Freight & Logistics",
    unit: "KM",
    subCategoryLabel: "Commercial Vehicle Specification",
    subOptions: [
      { label: "Diesel Light Commercial Vehicle (LCV)", value: "lcv_diesel", factorKgPerUnit: 0.210 },
      { label: "Diesel Heavy Duty Truck (HCV)", value: "hcv_diesel", factorKgPerUnit: 0.480 },
      { label: "CNG Commercial Truck", value: "truck_cng", factorKgPerUnit: 0.320 },
      { label: "Electric Cargo Van", value: "van_electric", factorKgPerUnit: 0.085 },
      { label: "Rail Freight (Electric/Diesel)", value: "rail_freight", factorKgPerUnit: 0.025 },
    ],
  },
  {
    value: "company_fleet",
    label: "Company Fleet Operations",
    unit: "KM",
    subCategoryLabel: "Fleet Vehicle Specification",
    subOptions: [
      { label: "Corporate Fleet Car (Petrol)", value: "fleet_petrol", factorKgPerUnit: 0.135 },
      { label: "Corporate Fleet Car (Diesel)", value: "fleet_diesel", factorKgPerUnit: 0.155 },
      { label: "Corporate Utility Van (Diesel)", value: "fleet_van_diesel", factorKgPerUnit: 0.220 },
      { label: "Electric Fleet Vehicle", value: "fleet_ev", factorKgPerUnit: 0.038 },
    ],
  },
  {
    value: "rail_travel",
    label: "Rail Travel",
    unit: "KM",
    subCategoryLabel: "Train Service Type",
    subOptions: [
      { label: "Electric Train (Express/Intercity)", value: "train_electric", factorKgPerUnit: 0.035 },
      { label: "Diesel Passenger Train", value: "train_diesel", factorKgPerUnit: 0.065 },
      { label: "Metro / Rapid Transit", value: "metro_train", factorKgPerUnit: 0.028 },
    ],
  },
  {
    value: "direct_fuel_purchase",
    label: "Direct Fuel Purchase",
    unit: "liter",
    subCategoryLabel: "Fuel Specification",
    subOptions: [
      { label: "High Speed Diesel (HSD)", value: "hsd_diesel", factorKgPerUnit: 2.680 },
      { label: "Petrol / Motor Spirit (MS)", value: "ms_petrol", factorKgPerUnit: 2.310 },
      { label: "Bio-Diesel Blend (B20)", value: "biodiesel_b20", factorKgPerUnit: 2.140 },
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. ENERGY CATEGORIES & DEPENDENT SUB-OPTIONS
// ---------------------------------------------------------------------------
export const ENERGY_CONFIGS: ActivityCategoryConfig[] = [
  {
    value: "grid_electricity",
    label: "Grid Electricity",
    unit: "kWh",
    subCategoryLabel: "Grid Tariff & Supply Type",
    subOptions: [
      { label: "National Grid Mix (India Average)", value: "grid_national_mix", factorKgPerUnit: 0.716 },
      { label: "Commercial High Tension (HT) Tariff", value: "grid_ht_tariff", factorKgPerUnit: 0.750 },
      { label: "Low Tension (LT) Industrial Tariff", value: "grid_lt_tariff", factorKgPerUnit: 0.720 },
    ],
  },
  {
    value: "renewable_energy",
    label: "Renewable Energy",
    unit: "kWh",
    subCategoryLabel: "Renewable Generation Source",
    subOptions: [
      { label: "On-site Rooftop Solar PV System", value: "solar_onsite", factorKgPerUnit: 0.005 },
      { label: "Off-site Wind Power Purchase (PPA)", value: "wind_ppa", factorKgPerUnit: 0.011 },
      { label: "Small Hydro Power Supply", value: "hydro_power", factorKgPerUnit: 0.018 },
      { label: "Green Energy Utility Contract", value: "green_contract", factorKgPerUnit: 0.015 },
    ],
  },
  {
    value: "natural_gas",
    label: "Natural Gas & PNG",
    unit: "kWh",
    subCategoryLabel: "Gas Format & Specification",
    subOptions: [
      { label: "Piped Natural Gas (PNG - Industrial)", value: "png_industrial", factorKgPerUnit: 0.201 },
      { label: "Commercial CNG Cylinders", value: "cng_commercial", factorKgPerUnit: 0.210 },
      { label: "Liquefied Natural Gas (LNG)", value: "lng_bulk", factorKgPerUnit: 0.225 },
    ],
  },
  {
    value: "generator_oils",
    label: "Generator & Thermal Fuel Oils",
    unit: "liter",
    subCategoryLabel: "Oil Specification",
    subOptions: [
      { label: "High Speed Diesel (HSD Generator)", value: "generator_hsd", factorKgPerUnit: 2.680 },
      { label: "Light Diesel Oil (LDO Boiler)", value: "boiler_ldo", factorKgPerUnit: 2.740 },
      { label: "Furnace Oil (FO Heavy Thermal)", value: "boiler_fo", factorKgPerUnit: 3.120 },
    ],
  },
  {
    value: "district_thermal",
    label: "District Heating & Cooling",
    unit: "kWh",
    subCategoryLabel: "Thermal Media",
    subOptions: [
      { label: "Purchased Industrial Steam", value: "purchased_steam", factorKgPerUnit: 0.190 },
      { label: "District Chilled Water System", value: "chilled_water", factorKgPerUnit: 0.150 },
      { label: "District Hot Water", value: "district_hot_water", factorKgPerUnit: 0.180 },
    ],
  },
];

// ---------------------------------------------------------------------------
// 3. WASTE CATEGORIES & DEPENDENT SUB-OPTIONS
// ---------------------------------------------------------------------------
export const WASTE_CONFIGS: ActivityCategoryConfig[] = [
  {
    value: "general_waste",
    label: "General Solid Waste",
    unit: "KG",
    subCategoryLabel: "Disposal Method",
    subOptions: [
      { label: "Municipal Landfill (Unmanaged)", value: "landfill_unmanaged", factorKgPerUnit: 0.584 },
      { label: "Sanitary Landfill (With Gas Recovery)", value: "landfill_gas_recovery", factorKgPerUnit: 0.310 },
      { label: "Controlled Incineration", value: "incineration", factorKgPerUnit: 0.420 },
    ],
  },
  {
    value: "organic_waste",
    label: "Organic & Food Waste",
    unit: "KG",
    subCategoryLabel: "Processing Method",
    subOptions: [
      { label: "On-site Composting", value: "composting_onsite", factorKgPerUnit: 0.080 },
      { label: "Anaerobic Digestion (Biogas Plant)", value: "anaerobic_digestion", factorKgPerUnit: 0.045 },
      { label: "Municipal Landfill (Uncontrolled)", value: "organic_landfill", factorKgPerUnit: 0.620 },
    ],
  },
  {
    value: "plastic_waste",
    label: "Plastic Waste",
    unit: "KG",
    subCategoryLabel: "Recycling / Disposal Channel",
    subOptions: [
      { label: "Authorized Plastic Recycling Facility", value: "plastic_recycling", factorKgPerUnit: 0.050 },
      { label: "Co-processing in Cement Kilns", value: "cement_coprocessing", factorKgPerUnit: 0.850 },
      { label: "Landfill Disposal", value: "plastic_landfill", factorKgPerUnit: 1.980 },
    ],
  },
  {
    value: "paper_cardboard",
    label: "Paper & Cardboard Waste",
    unit: "KG",
    subCategoryLabel: "Processing Method",
    subOptions: [
      { label: "Paper Recycling Mill", value: "paper_recycling", factorKgPerUnit: 0.060 },
      { label: "Shredding & Composting", value: "paper_compost", factorKgPerUnit: 0.120 },
      { label: "Landfill Disposal", value: "paper_landfill", factorKgPerUnit: 0.520 },
    ],
  },
  {
    value: "metal_waste",
    label: "Metal Scrap",
    unit: "KG",
    subCategoryLabel: "Recycling Process",
    subOptions: [
      { label: "Secondary Smelting / Recycling", value: "metal_recycling", factorKgPerUnit: 0.040 },
      { label: "Scrap Yard Salvage", value: "metal_salvage", factorKgPerUnit: 0.090 },
    ],
  },
  {
    value: "glass_waste",
    label: "Glass Waste",
    unit: "KG",
    subCategoryLabel: "Processing Method",
    subOptions: [
      { label: "Cullet Recycling / Remelting", value: "glass_recycling", factorKgPerUnit: 0.035 },
      { label: "Landfill Disposal", value: "glass_landfill", factorKgPerUnit: 0.290 },
    ],
  },
  {
    value: "electronic_waste",
    label: "Electronic Waste (E-Waste)",
    unit: "KG",
    subCategoryLabel: "Treatment Channel",
    subOptions: [
      { label: "Authorized E-Waste Recycler", value: "ewaste_authorized", factorKgPerUnit: 0.150 },
      { label: "Refurbishment & Component Reuse", value: "ewaste_refurbish", factorKgPerUnit: 0.050 },
      { label: "Unsorted Landfill", value: "ewaste_landfill", factorKgPerUnit: 1.200 },
    ],
  },
  {
    value: "hazardous_waste",
    label: "Hazardous Waste",
    unit: "KG",
    subCategoryLabel: "Treatment Process",
    subOptions: [
      { label: "Authorized TSDF Facility", value: "tsdf_facility", factorKgPerUnit: 0.450 },
      { label: "High Temperature Incineration", value: "hazardous_incineration", factorKgPerUnit: 2.100 },
    ],
  },
];

// ---------------------------------------------------------------------------
// 4. PURCHASES CATEGORIES & DEPENDENT SUB-OPTIONS
// ---------------------------------------------------------------------------
export const PURCHASES_CONFIGS: ActivityCategoryConfig[] = [
  {
    value: "raw_materials",
    label: "Raw Materials & Supplies",
    unit: "INR",
    subCategoryLabel: "Material Sub-Category",
    subOptions: [
      { label: "Metals & Steel Products", value: "raw_metals", factorKgPerUnit: 0.00052 },
      { label: "Chemicals & Polymers", value: "raw_chemicals", factorKgPerUnit: 0.00048 },
      { label: "Packaging Materials (Corrugated/Plastic)", value: "raw_packaging", factorKgPerUnit: 0.00042 },
      { label: "General Office & Production Supplies", value: "raw_office_supplies", factorKgPerUnit: 0.00035 },
    ],
  },
  {
    value: "it_hardware",
    label: "IT Hardware & Equipment",
    unit: "INR",
    subCategoryLabel: "Equipment Category",
    subOptions: [
      { label: "Laptops & Desktop PCs", value: "it_laptops", factorKgPerUnit: 0.00038 },
      { label: "Enterprise Servers & Networking", value: "it_servers", factorKgPerUnit: 0.00045 },
      { label: "Printers & Office Peripherals", value: "it_printers", factorKgPerUnit: 0.00032 },
      { label: "Monitors & Displays", value: "it_monitors", factorKgPerUnit: 0.00036 },
    ],
  },
  {
    value: "travel_lodging",
    label: "Business Travel & Lodging Spend",
    unit: "INR",
    subCategoryLabel: "Spend Category",
    subOptions: [
      { label: "Hotel & Accommodation Spend", value: "spend_hotel", factorKgPerUnit: 0.00040 },
      { label: "Airfare & Commercial Flight Spend", value: "spend_airfare", factorKgPerUnit: 0.00062 },
      { label: "Car Rental & Taxi Spend", value: "spend_cab", factorKgPerUnit: 0.00048 },
    ],
  },
  {
    value: "facilities_services",
    label: "Facilities & Professional Services",
    unit: "INR",
    subCategoryLabel: "Service Type",
    subOptions: [
      { label: "Facility Maintenance & Security", value: "service_maintenance", factorKgPerUnit: 0.00028 },
      { label: "Consulting & Legal Services", value: "service_consulting", factorKgPerUnit: 0.00018 },
      { label: "Cloud Hosting & Data Center Services", value: "service_cloud", factorKgPerUnit: 0.00031 },
    ],
  },
  {
    value: "marketing_events",
    label: "Marketing, Events & Logistics",
    unit: "INR",
    subCategoryLabel: "Commercial Expense Category",
    subOptions: [
      { label: "Events, Expos & Trade Shows", value: "spend_events", factorKgPerUnit: 0.00047 },
      { label: "Print & Outdoor Media", value: "spend_media", factorKgPerUnit: 0.00039 },
      { label: "Courier & Freight Services Spend", value: "spend_courier", factorKgPerUnit: 0.00055 },
    ],
  },
];

// Backward compatibility helpers
export interface EmissionsFactorOption {
  label: string;
  value: string;
  unit: string;
  factorKgPerUnit: number;
}

export const transportFactors: EmissionsFactorOption[] = TRANSPORT_CONFIGS.map((cfg) => ({
  label: cfg.label,
  value: cfg.value,
  unit: cfg.unit,
  factorKgPerUnit: cfg.subOptions[0].factorKgPerUnit,
}));

export const energyFactors: EmissionsFactorOption[] = ENERGY_CONFIGS.map((cfg) => ({
  label: cfg.label,
  value: cfg.value,
  unit: cfg.unit,
  factorKgPerUnit: cfg.subOptions[0].factorKgPerUnit,
}));

export const wasteFactors: EmissionsFactorOption[] = WASTE_CONFIGS.map((cfg) => ({
  label: cfg.label,
  value: cfg.value,
  unit: cfg.unit,
  factorKgPerUnit: cfg.subOptions[0].factorKgPerUnit,
}));

export const purchasesFactors: EmissionsFactorOption[] = PURCHASES_CONFIGS.map((cfg) => ({
  label: cfg.label,
  value: cfg.value,
  unit: cfg.unit,
  factorKgPerUnit: cfg.subOptions[0].factorKgPerUnit,
}));

export function getFactorOption(options: EmissionsFactorOption[], value: string): EmissionsFactorOption {
  return options.find((option) => option.value === value) || options[0];
}
