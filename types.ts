
export type VehicleType = "car" | "bus" | "truck";
export type ControlType = "border" | "customs";
export type Direction = "entry" | "exit";
export type RiskLevel = "Low" | "Medium" | "High";
export type VehicleStatus = "waiting_border" | "in_border" | "waiting_customs" | "in_customs" | "cleared";
export type BiometricResult = "Verified" | "Pending" | "Failed";
export type ScannerStatus = "Ready" | "Scanning" | "Error";

export type DeclarationStatus = 'SUBMITTED' | 'RELEASED' | 'INSPECTION' | 'HELD' | 'SEIZED';
export type SelectivityChannel = 'GREEN' | 'YELLOW' | 'RED';

export interface BCP {
  id: string;
  name: string;
  countryA: string;
  countryB: string;
}

export interface Lane {
  id: string;
  bcpId: string;
  name: string;
  direction: Direction;
  vehicleType: VehicleType;
  isOpen: boolean;
  // Service times for each stage
  borderServiceTime: number;
  customsServiceTime: number;
}

export interface BiometricDetail {
    status: BiometricResult;
    confidence: number; // 0-100 score
}

export interface BiometricData {
    face: BiometricDetail;
    iris: BiometricDetail;
    fingerprints: BiometricDetail;
}

export interface Vehicle {
  id: string;
  bcpId: string;
  laneId: string;
  plate: string;
  vehicleType: VehicleType;
  subType: string; // e.g. Oil Tanker, Sedan
  goodsType: string;
  companyName: string; // Logistics for trucks, Private for others
  
  origin: string;
  destination: string;
  
  // Risk Features
  watchlistHit: boolean;
  docAnomaly: boolean;
  bioMismatch: boolean;
  routeRisk: number;
  
  risk: RiskLevel;
  riskScore: number;
  
  status: VehicleStatus;
  arrivalTime: number;
  
  // Timers for each stage
  startBorderTime?: number;
  startCustomsTime?: number;
  
  // Dynamic assigned durations based on risk/queue
  assignedBorderDuration?: number;
  assignedCustomsDuration?: number;
  
  // Statuses
  docStatus: ScannerStatus;
  biometrics: BiometricData;
}

export interface Declaration {
  id: string;
  mrn: string;
  traderName: string;
  aeo: 'NONE' | 'S' | 'F';
  flow: 'IMPORT' | 'EXPORT' | 'TRANSIT';
  hsCode: string;
  goodsDesc: string;
  originCountry: string;
  destinationCountry: string;
  value: number;
  weight: number; // kg
  duties: number;
  vat: number;
  excise: number;
  
  riskScore: number;
  riskBand: RiskLevel;
  riskReasons: string[];
  channel: SelectivityChannel;
  
  status: DeclarationStatus;
  linkedVehicleId?: string;
  vehiclePlate?: string;
  vehicleType?: VehicleType;
  arrivalTime: number;
}

export interface SimulationStats {
    waiting: Vehicle[];
    inControl: Vehicle[];
    cleared: Vehicle[];
    avgWaitSec: number;
    riskCounts: Record<RiskLevel, number>;
    revenue: {
        duties: number;
        vat: number;
        excise: number;
    }
}

export interface Alert {
  id: string;
  timestamp: number;
  type: 'SECURITY' | 'CUSTOMS' | 'SYSTEM';
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}
