
import { RiskLevel, VehicleType, Vehicle, BiometricData, BiometricDetail, BiometricResult, ScannerStatus, Declaration, SelectivityChannel, DeclarationStatus, Lane, BCP } from "./types";
import { TRADERS, HS_RISK, ORIGIN_RISK, PLATES_PREFIXES, GOODS_TYPES, TRUCK_SUBTYPES, CAR_SUBTYPES, BUS_SUBTYPES, ROUTING_COUNTRIES } from "./constants";

export const randomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const randomPlate = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const prefix = randomItem(PLATES_PREFIXES);
  const mid = Math.floor(Math.random() * 90 + 10);
  const suffix =
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)];
  return `${prefix}-${mid}-${suffix}`;
};

// --- Border Risk Engine ---
export const calculateBorderRisk = (features: {
    watchlistHit: boolean;
    docAnomaly: boolean;
    bioMismatch: boolean;
    routeRisk: number;
    goodsFlag: boolean;
}): { score: number, band: RiskLevel } => {
    const w = {
        watchlist: 40,
        doc_anomaly: 20,
        bio_mismatch: 15,
        route_risk: 10,
        goods_flag: 10,
        random: 5,
    };

    const score = (
        w.watchlist * (features.watchlistHit ? 1 : 0) +
        w.doc_anomaly * (features.docAnomaly ? 1 : 0) +
        w.bio_mismatch * (features.bioMismatch ? 1 : 0) +
        w.route_risk * features.routeRisk +
        w.goods_flag * (features.goodsFlag ? 1 : 0) +
        w.random * Math.random()
    );
    
    const clamped = Math.max(0, Math.min(100, score));
    
    let band: RiskLevel = "Low";
    if (clamped >= 70) band = "High";
    else if (clamped >= 30) band = "Medium";
    
    return { score: clamped, band };
};

// --- Customs Risk Engine ---
export const calculateCustomsRisk = (features: {
    aeo: number; // 0=NONE, 1=AEO-S, 2=AEO-F
    hsRisk: number;
    originRisk: number;
    undervalPct: number;
    pnrHit: boolean;
    docMismatch: boolean;
    watchlist: boolean;
    history: number;
}): { score: number, band: RiskLevel, channel: SelectivityChannel, reasons: string[] } => {
    const w = { pnr: 35, watch: 25, doc: 15, hs: 10, origin: 5, underval: 5, history: 5, aeo: -10 };
    
    const score = (
        w.pnr * (features.pnrHit ? 1 : 0) +
        w.watch * (features.watchlist ? 1 : 0) +
        w.doc * (features.docMismatch ? 1 : 0) +
        w.hs * features.hsRisk +
        w.origin * features.originRisk +
        w.underval * Math.min(1, Math.max(0, features.undervalPct / 30)) +
        w.history * features.history +
        w.aeo * features.aeo
    );

    const reasons: string[] = [];
    if (features.pnrHit) reasons.push("PNR Intelligence Hit");
    if (features.watchlist) reasons.push("Trader Watchlist");
    if (features.docMismatch) reasons.push("Doc Discrepancy");
    if (features.hsRisk > 0.5) reasons.push("High Risk Commodity");
    if (features.originRisk > 0.5) reasons.push("High Risk Origin");
    if (features.undervalPct > 30) reasons.push("Potential Undervaluation");

    const clamped = Math.max(0, Math.min(100, score));
    let band: RiskLevel = "Low";
    if (clamped >= 70) band = "High";
    else if (clamped >= 30) band = "Medium";

    let channel: SelectivityChannel = "GREEN";
    if (band === "High" || features.pnrHit || features.watchlist) {
        channel = "RED";
    } else if (band === "Medium" || features.docMismatch || features.hsRisk > 0.5) {
        channel = "YELLOW";
    }

    return { score: clamped, band, channel, reasons };
};

// --- Generators ---

export const generateVehicle = (lane: Lane, bcp: BCP): Vehicle => {
    const now = Date.now();
    
    // Calculate route risk first
    const routeRisk = Number((Math.random() * 0.7).toFixed(2));

    // Increase probability of hits/mismatches if route risk is high (> 0.5)
    const watchlistHit = Math.random() < (routeRisk > 0.5 ? 0.10 : 0.03);
    const docAnomaly = Math.random() < 0.08;
    const goodsFlag = lane.vehicleType === "truck" && Math.random() < 0.15;

    // Biometrics Generation Logic
    // Higher risk routes have higher probability of biometric failure or low confidence
    const bioRiskFactor = routeRisk > 0.5 ? 0.15 : 0.02;

    const generateBioDetail = (failProb: number): BiometricDetail => {
        const r = Math.random();
        if (r < failProb) {
            // Failed match
            return { status: "Failed", confidence: Math.floor(Math.random() * 30) + 10 }; // 10-40%
        }
        if (r < failProb + 0.05) {
            // Pending / Error
            return { status: "Pending", confidence: 0 };
        }
        // Verified
        return { status: "Verified", confidence: Math.floor(Math.random() * 15) + 85 }; // 85-99%
    };

    const bio: BiometricData = {
        face: generateBioDetail(bioRiskFactor),
        iris: generateBioDetail(bioRiskFactor),
        fingerprints: generateBioDetail(bioRiskFactor)
    };

    // Calculated actual mismatch based on the data generated
    const bioMismatch = bio.face.status === 'Failed' || bio.iris.status === 'Failed' || bio.fingerprints.status === 'Failed';

    const { score, band } = calculateBorderRisk({ watchlistHit, docAnomaly, bioMismatch, routeRisk, goodsFlag });

    let subType = "Car";
    let companyName = "Private";
    let goodsType = "Personal Effects";
    
    if (lane.vehicleType === 'truck') {
        subType = randomItem(TRUCK_SUBTYPES);
        companyName = randomItem(TRADERS).name;
        goodsType = randomItem(GOODS_TYPES);
    } else if (lane.vehicleType === 'bus') {
        subType = randomItem(BUS_SUBTYPES);
        companyName = "Private"; // Bus Operator often private but not "Logistics"
        goodsType = "Passengers & Luggage";
    } else {
        subType = randomItem(CAR_SUBTYPES);
    }

    // Routing Logic
    // If entry: Coming from Neighbor (B) or Transit to Home (A)
    // If exit: Leaving Home (A) to Neighbor (B) or Transit
    const isEntry = lane.direction === 'entry';
    const neighbor = bcp.countryB;
    const home = bcp.countryA;
    const farAway = randomItem(ROUTING_COUNTRIES);

    let origin = isEntry ? neighbor : home;
    let destination = isEntry ? home : neighbor;

    // Add some transit randomness
    if (Math.random() < 0.3) {
        if (isEntry) origin = farAway; 
        else destination = farAway;
    }

    return {
        id: `V_${now.toString(36)}_${Math.random().toString(36).substring(2,6)}`,
        bcpId: bcp.id,
        laneId: lane.id,
        plate: randomPlate(),
        vehicleType: lane.vehicleType,
        subType,
        goodsType,
        companyName,
        origin,
        destination,
        
        watchlistHit,
        docAnomaly,
        bioMismatch,
        routeRisk,
        
        risk: band,
        riskScore: score,
        
        status: "waiting_border", 
        arrivalTime: now,
        
        docStatus: (Math.random() < 0.2 ? randomItem<ScannerStatus>(["Ready", "Scanning", "Error"]) : "Ready"),
        biometrics: bio
    };
};

export const generateDeclaration = (linkedVehicle?: Vehicle): Declaration => {
    const tr = linkedVehicle && linkedVehicle.vehicleType === 'truck' 
        ? TRADERS.find(t => t.name === linkedVehicle.companyName) || randomItem(TRADERS) 
        : randomItem(TRADERS);

    const hsCode = randomItem(Object.keys(HS_RISK));
    const val = Number((Math.random() * (80000 - 2000) + 2000).toFixed(2));
    const origin = linkedVehicle ? linkedVehicle.origin : randomItem(Object.keys(ORIGIN_RISK));
    const destination = linkedVehicle ? linkedVehicle.destination : randomItem(ROUTING_COUNTRIES);

    const weight = Math.floor(Math.random() * (24000 - 1000) + 1000); 
    
    const aeoMap = { "NONE": 0, "S": 1, "F": 2 };
    // @ts-ignore
    const aeoCode = aeoMap[tr.aeo];

    const hsRiskVal = HS_RISK[hsCode];
    const originRiskVal = ORIGIN_RISK[origin] || 0.3;

    const features = {
        aeo: aeoCode,
        hsRisk: hsRiskVal,
        originRisk: originRiskVal,
        undervalPct: Math.random() * 60,
        pnrHit: ["2402", "2710"].includes(hsCode) && Math.random() < 0.2,
        docMismatch: Math.random() < 0.1,
        watchlist: Math.random() < 0.05,
        history: tr.history
    };

    const { score, band, channel, reasons } = calculateCustomsRisk(features);

    // Tax Calc
    const duties = Number((val * (0.03 + 0.07 * hsRiskVal)).toFixed(2));
    const vat = Number(((val + duties) * 0.19).toFixed(2));
    const excise = ["2402", "2710"].includes(hsCode) ? Number((val * 0.12).toFixed(2)) : 0;
    
    // If linked to a specific vehicle (even car/bus), use its type
    const vType = linkedVehicle?.vehicleType || randomItem<VehicleType>(["truck", "truck", "truck", "car", "bus"]);
    const traderName = linkedVehicle?.vehicleType === 'car' || linkedVehicle?.vehicleType === 'bus' ? 'Individual / Private' : tr.name;

    return {
        id: `D_${Math.random().toString(36).substring(2,8).toUpperCase()}`,
        mrn: `KA${Math.floor(Math.random() * 899999 + 100000)}`,
        traderName,
        // @ts-ignore
        aeo: tr.aeo,
        flow: randomItem(["IMPORT", "EXPORT", "TRANSIT"]),
        hsCode,
        goodsDesc: linkedVehicle?.goodsType || `${randomItem(GOODS_TYPES)} (HS ${hsCode})`,
        originCountry: origin,
        destinationCountry: destination,
        value: val,
        weight,
        duties,
        vat,
        excise,
        riskScore: score,
        riskBand: band,
        riskReasons: reasons,
        channel,
        status: "SUBMITTED",
        linkedVehicleId: linkedVehicle?.id,
        vehiclePlate: linkedVehicle?.plate,
        vehicleType: vType,
        arrivalTime: Date.now()
    };
};

export const riskBadgeColor = (risk: RiskLevel) => {
    switch (risk) {
      case "Low":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "Medium":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "High":
        return "bg-red-500/10 text-red-500 border-red-500/20";
    }
};

export interface ValidationResult {
    isValid: boolean;
    errors: Record<string, string>;
}

export const validateDeclaration = (data: Partial<Declaration>): ValidationResult => {
    const errors: Record<string, string> = {};

    if (!data.mrn) errors.mrn = "MRN is required";
    else if (!/^KA\d{6}$/.test(data.mrn)) errors.mrn = "Format: KA + 6 digits";

    if (!data.traderName || data.traderName.trim().length < 2) errors.traderName = "Name too short (min 2)";
    
    if (!data.hsCode) errors.hsCode = "Required";
    else if (!/^\d{4,10}$/.test(data.hsCode)) errors.hsCode = "4-10 digits required";

    if (!data.originCountry) errors.originCountry = "Required";
    if (!data.destinationCountry) errors.destinationCountry = "Required";
    if (!data.goodsDesc || data.goodsDesc.length < 3) errors.goodsDesc = "Description required";

    if (data.value === undefined || data.value === null) errors.value = "Required";
    else if (data.value <= 0) errors.value = "Must be > 0";
    else if (data.value > 100000000) errors.value = "Max limit 100M";

    if (data.weight === undefined || data.weight === null) errors.weight = "Required";
    else if (data.weight <= 0) errors.weight = "Must be > 0";
    else if (data.weight > 100000) errors.weight = "Max limit 100T";
    
    const validFlows = ['IMPORT', 'EXPORT', 'TRANSIT'];
    if (data.flow && !validFlows.includes(data.flow)) errors.flow = "Invalid Selection";

    const validAeo = ['NONE', 'S', 'F'];
    if (data.aeo && !validAeo.includes(data.aeo)) errors.aeo = "Invalid Selection";

    return { isValid: Object.keys(errors).length === 0, errors };
};
