export type EmissionsCategory = "transport" | "energy" | "waste" | "purchases";

export interface EmissionsFactorOption {
  label: string;
  value: string;
  unit: string;
  factorKgPerUnit: number;
}

export const transportFactors: EmissionsFactorOption[] = [
  { label: "Business Travel (Road)", value: "travel_road_km", unit: "KM", factorKgPerUnit: 0.124 },
  { label: "Business Travel (Air)", value: "flight_km", unit: "KM", factorKgPerUnit: 0.168 },
  { label: "Business Travel (Air - Economy)", value: "flight_km_economy", unit: "KM", factorKgPerUnit: 0.168 },
  { label: "Employee Commute", value: "commute_km", unit: "KM", factorKgPerUnit: 0.092 },
  { label: "Freight Transport", value: "freight_km", unit: "KM", factorKgPerUnit: 0.185 },
  { label: "Company Fleet", value: "fleet_km", unit: "KM", factorKgPerUnit: 0.135 },
  { label: "Rail Travel", value: "rail_km", unit: "KM", factorKgPerUnit: 0.041 },
  { label: "Diesel Fuel", value: "diesel_liter", unit: "liter", factorKgPerUnit: 2.68 },
  { label: "Petrol Fuel", value: "petrol_liter", unit: "liter", factorKgPerUnit: 2.31 },
];

export const energyFactors: EmissionsFactorOption[] = [
  { label: "Grid Electricity", value: "grid_kwh", unit: "kWh", factorKgPerUnit: 0.233 },
  { label: "Grid Electricity", value: "electricity_grid_kwh", unit: "kWh", factorKgPerUnit: 0.233 },
  { label: "Renewable Energy", value: "renewable_kwh", unit: "kWh", factorKgPerUnit: 0.015 },
  { label: "Natural Gas", value: "natural_gas_kwh", unit: "kWh", factorKgPerUnit: 0.201 },
  { label: "Heating Oil", value: "heating_oil_liter", unit: "liter", factorKgPerUnit: 2.68 },
  { label: "District Heating", value: "district_heat_kwh", unit: "kWh", factorKgPerUnit: 0.19 },
];

export const wasteFactors: EmissionsFactorOption[] = [
  { label: "General Waste", value: "general_waste_kg", unit: "KG", factorKgPerUnit: 0.584 },
  { label: "Landfill Waste", value: "landfill_waste_kg", unit: "KG", factorKgPerUnit: 0.584 },
  { label: "Organic Waste", value: "organic_waste_kg", unit: "KG", factorKgPerUnit: 0.22 },
  { label: "Recycled Waste", value: "recycled_waste_kg", unit: "KG", factorKgPerUnit: 0.22 },
  { label: "Plastic Waste", value: "plastic_waste_kg", unit: "KG", factorKgPerUnit: 1.98 },
  { label: "Paper & Cardboard", value: "paper_waste_kg", unit: "KG", factorKgPerUnit: 0.52 },
  { label: "Paper", value: "paper_kg", unit: "KG", factorKgPerUnit: 0.52 },
  { label: "Metal Waste", value: "metal_waste_kg", unit: "KG", factorKgPerUnit: 0.34 },
  { label: "Glass", value: "glass_waste_kg", unit: "KG", factorKgPerUnit: 0.29 },
  { label: "Electronic Waste", value: "ewaste_kg", unit: "KG", factorKgPerUnit: 1.2 },
];

export const purchasesFactors: EmissionsFactorOption[] = [
  { label: "Purchased Goods", value: "purchased_goods_inr", unit: "INR", factorKgPerUnit: 0.00042 },
  { label: "Business Travel Spend", value: "travel_spend_inr", unit: "INR", factorKgPerUnit: 0.0005 },
  { label: "IT & Equipment", value: "it_spend_inr", unit: "INR", factorKgPerUnit: 0.00038 },
  { label: "Facilities & Services", value: "facilities_spend_inr", unit: "INR", factorKgPerUnit: 0.00031 },
  { label: "Marketing & Events", value: "marketing_spend_inr", unit: "INR", factorKgPerUnit: 0.00047 },
  { label: "Hotel Nights", value: "hotel_night", unit: "night", factorKgPerUnit: 15 },
];

export function getFactorOption(options: EmissionsFactorOption[], value: string): EmissionsFactorOption {
  return options.find((option) => option.value === value) || options[0];
}
