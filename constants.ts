
import { BCP, Lane, VehicleType, ControlType, Direction } from "./types";

export const BCPS: BCP[] = [
  { id: "BCP_VERMILLION", name: "Port of Vermillion (North)", countryA: "Republic of KA", countryB: "State NB" },
  { id: "BCP_INDIGO", name: "Indigo Pass (East)",  countryA: "Republic of KA", countryB: "State ZT" },
  { id: "BCP_CRIMSON", name: "Crimson Bridge (South)", countryA: "Republic of KA", countryB: "State XY" },
  { id: "BCP_AZURE", name: "Azure Terminal (West)",  countryA: "Republic of KA", countryB: "State QR" },
  { id: "BCP_GOLDEN", name: "Golden Gate (North-East)",  countryA: "Republic of KA", countryB: "State NB" },
  { id: "BCP_SILVER", name: "Silver Line Crossing (South-West)",  countryA: "Republic of KA", countryB: "State XY" },
];

export const GOODS_TYPES = [
  "General cargo",
  "Electronics",
  "Food products",
  "Textiles",
  "Pharmaceuticals",
  "Chemicals",
  "Agricultural goods",
  "Machinery Parts",
  "Construction Mat.",
];

export const TRUCK_SUBTYPES = [
  "Tautliner", 
  "Refrigerated (Reefer)", 
  "Oil Tanker", 
  "Livestock Carrier", 
  "Flatbed", 
  "Container Carrier",
  "Box Truck",
  "Dump Truck"
];

export const CAR_SUBTYPES = [
  "Sedan", 
  "SUV", 
  "Estate", 
  "Hatchback", 
  "Minivan",
  "Luxury Saloon"
];

export const BUS_SUBTYPES = [
  "Tour Coach", 
  "Intercity Bus", 
  "Minibus",
  "Shuttle"
];

export const PLATES_PREFIXES = ["KA", "NB", "ZT", "XY", "QR"];

// Additional countries for routing simulation beyond the immediate neighbors
export const ROUTING_COUNTRIES = [
  "Germany", "France", "Poland", "Turkey", "Ukraine", "Italy", "Austria", "Romania"
];

// Synthetic Data for Customs Simulation
export const TRADERS = [
  { eori: "KA0001", name: "Alpha Trade Corp",     aeo: "F",    history: 0.0 },
  { eori: "KA0002", name: "Borderline Logistics", aeo: "S",    history: 0.1 },
  { eori: "KA0003", name: "Nistru Demo Cargo",    aeo: "NONE", history: 0.4 },
  { eori: "KA0004", name: "Delta Freight Union",  aeo: "S",    history: 0.2 },
  { eori: "KA0005", name: "Echo Supplies Ltd",    aeo: "NONE", history: 0.1 },
  { eori: "KA0006", name: "Foxtrot Imports",      aeo: "F",    history: 0.05 },
];

export const HS_RISK: Record<string, number> = {
  "2203": 0.2,  // beverages
  "2402": 0.7,  // tobacco
  "2710": 0.6,  // fuels
  "3004": 0.4,  // pharma
  "6403": 0.3,  // footwear
  "8517": 0.5,  // phones
  "8703": 0.2,  // vehicles
  "0102": 0.1,  // live animals
};

export const ORIGIN_RISK: Record<string, number> = { 
    "KA": 0.3, "NB": 0.4, "ZT": 0.6, "XY": 0.2, "QR": 0.5 
};

export const createLanes = (): Lane[] => {
  const lanes: Lane[] = [];

  const addLanes = (
    bcpId: string,
    entryCount: number,
    exitCount: number,
    namePrefix: string
  ) => {
    const makeLane = (i: number, direction: Direction) => {
      // Distribute types
      let vType: VehicleType = "car";
      if (i % 4 === 1) vType = "truck";
      if (i % 4 === 2) vType = "car";
      if (i % 4 === 3) vType = "bus";

      // Define service times for both stages
      // Border checks: Cars (15s), Bus (40s), Truck (25s)
      const borderTime = vType === "car" ? 15 : vType === "bus" ? 40 : 25;
      
      // Customs checks: Cars (10s), Bus (30s), Truck (60s)
      const customsTime = vType === "car" ? 10 : vType === "bus" ? 30 : 60;

      return {
        id: `${bcpId}_${direction}_${i}`,
        bcpId,
        name: `${namePrefix}-${direction === "entry" ? "EN" : "EX"}${i + 1}`,
        direction,
        vehicleType: vType,
        isOpen: true,
        borderServiceTime: borderTime,
        customsServiceTime: customsTime,
      } as Lane;
    };

    for (let i = 0; i < entryCount; i++) lanes.push(makeLane(i, "entry"));
    for (let i = 0; i < exitCount; i++) lanes.push(makeLane(i, "exit"));
  };

  // Symmetrical lane configuration for all 6 BCPs
  addLanes("BCP_VERMILLION", 4, 4, "VER"); 
  addLanes("BCP_INDIGO", 3, 3, "IND"); 
  addLanes("BCP_CRIMSON", 5, 5, "CRI"); 
  addLanes("BCP_AZURE", 3, 3, "AZU"); 
  addLanes("BCP_GOLDEN", 2, 2, "GLD");
  addLanes("BCP_SILVER", 4, 4, "SIL");

  return lanes;
};

export const LANES: Lane[] = createLanes();
