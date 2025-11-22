import React, { useEffect, useMemo, useState, useRef } from "react";
import { BCPS, LANES, HS_RISK, ORIGIN_RISK } from "./constants";
import { Vehicle, RiskLevel, Lane, ControlType, Declaration, DeclarationStatus, VehicleStatus, VehicleType, Alert, BiometricDetail } from "./types";
import { randomItem, riskBadgeColor, generateVehicle, generateDeclaration, validateDeclaration, calculateCustomsRisk } from "./utils";

// --- Helper Components ---

const DashboardWidget = ({ 
    title, 
    children, 
    onClose, 
    isVisible, 
    className = "", 
    contentClassName="",
    headerAction 
}: {
    title: string;
    children?: React.ReactNode;
    onClose: () => void;
    isVisible: boolean;
    className?: string;
    contentClassName?: string;
    headerAction?: React.ReactNode;
}) => {
    if (!isVisible) return null;
    return (
         <div className={`bg-[#111623] border border-slate-800/60 rounded-xl flex flex-col shadow-sm overflow-hidden transition-all duration-300 hover:border-slate-700 ${className}`}>
            <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/30 flex justify-between items-center shrink-0 min-h-[48px]">
                <h3 className="text-slate-100 font-medium text-sm tracking-wide flex items-center gap-2 truncate uppercase">
                    {title}
                </h3>
                <div className="flex items-center gap-2">
                    {headerAction}
                    <button 
                        onClick={onClose} 
                        className="text-slate-600 hover:text-slate-400 transition-colors p-1 hover:bg-slate-800 rounded" 
                        title="Hide Widget"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className={`flex-1 min-h-0 ${contentClassName}`}>
                {children}
            </div>
        </div>
    )
}

const TrafficGraph = ({ history }: { history: { time: number, waiting: number, inControl: number }[] }) => {
    if (history.length < 2) return <div className="h-24 flex items-center justify-center text-xs text-slate-600">Initializing Timeline...</div>;

    const height = 80;
    const width = 100; 
    const maxVal = Math.max(...history.map(h => Math.max(h.waiting, h.inControl)), 10);
    
    const getPoints = (key: 'waiting' | 'inControl') => {
        return history.map((h, i) => {
            const x = (i / (history.length - 1)) * width;
            const y = height - (h[key] / maxVal) * height;
            return `${x},${y}`;
        }).join(' ');
    };

    return (
        <div className="h-28 w-full px-2 pt-4 pb-2 relative bg-slate-900/20 rounded border border-slate-800/50">
            <div className="absolute top-2 left-2 flex gap-3 text-[10px] font-bold">
                 <div className="flex items-center gap-1 text-amber-400"><div className="w-2 h-0.5 bg-amber-400"></div> Queue Load</div>
                 <div className="flex items-center gap-1 text-blue-400"><div className="w-2 h-0.5 bg-blue-400"></div> Active Checks</div>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                 <line x1="0" y1={height} x2={width} y2={height} stroke="#334155" strokeWidth="0.5" />
                 <line x1="0" y1="0" x2={width} y2="0" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
                 <polyline fill="none" stroke="#FBBF24" strokeWidth="2" points={getPoints('waiting')} vectorEffect="non-scaling-stroke" className="drop-shadow-md" />
                 <polyline fill="none" stroke="#60A5FA" strokeWidth="2" points={getPoints('inControl')} vectorEffect="non-scaling-stroke" className="drop-shadow-md" />
            </svg>
        </div>
    );
};

const MetricsWidget = ({ 
    revenueHistory, 
    throughputHistory 
}: { 
    revenueHistory: { time: number, amount: number }[], 
    throughputHistory: { time: number, entry: number, exit: number }[] 
}) => {
    if (revenueHistory.length < 2) return <div className="h-32 flex items-center justify-center text-xs text-slate-600">Collecting Agency Data...</div>;

    const height = 100;
    const width = 100;

    // Revenue Chart Helpers (Line)
    const maxRev = Math.max(...revenueHistory.map(h => h.amount), 1000);
    const revPoints = revenueHistory.map((h, i) => {
        const x = (i / (revenueHistory.length - 1)) * width;
        const y = height - (h.amount / maxRev) * height;
        return `${x},${y}`;
    }).join(' ');

    // Throughput Chart Helpers (Bar/Line hybrid for simplicity)
    const maxThru = Math.max(...throughputHistory.map(h => Math.max(h.entry, h.exit)), 5);
    const entryPoints = throughputHistory.map((h, i) => {
        const x = (i / (throughputHistory.length - 1)) * width;
        const y = height - (h.entry / maxThru) * height;
        return `${x},${y}`;
    }).join(' ');
    const exitPoints = throughputHistory.map((h, i) => {
        const x = (i / (throughputHistory.length - 1)) * width;
        const y = height - (h.exit / maxThru) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="grid grid-cols-2 gap-4 h-40">
            {/* Border Control Throughput */}
            <div className="bg-slate-900/20 rounded border border-slate-800/50 p-3 relative flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Border Flux (Veh/min)</span>
                    <div className="flex gap-2 text-[9px]">
                        <span className="text-emerald-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Entry</span>
                        <span className="text-blue-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Exit</span>
                    </div>
                </div>
                <div className="flex-1 w-full relative">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        <line x1="0" y1={height} x2={width} y2={height} stroke="#334155" strokeWidth="1" />
                         {/* Entry Line */}
                        <polyline fill="none" stroke="#10b981" strokeWidth="2" points={entryPoints} vectorEffect="non-scaling-stroke" className="opacity-80" />
                        <polygon points={`${entryPoints} ${width},${height} 0,${height}`} fill="url(#gradEntry)" className="opacity-20" />
                        {/* Exit Line */}
                        <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={exitPoints} vectorEffect="non-scaling-stroke" className="opacity-80" />
                        
                        <defs>
                            <linearGradient id="gradEntry" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            </div>

            {/* Customs Revenue */}
            <div className="bg-slate-900/20 rounded border border-slate-800/50 p-3 relative flex flex-col">
                <div className="flex justify-between items-start mb-2">
                     <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Revenue Velocity (EUR)</span>
                     <span className="text-[9px] font-mono text-indigo-400 font-bold">
                         €{revenueHistory[revenueHistory.length-1]?.amount.toLocaleString() || 0}
                     </span>
                </div>
                <div className="flex-1 w-full relative">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        <line x1="0" y1={height} x2={width} y2={height} stroke="#334155" strokeWidth="1" />
                        <polyline fill="none" stroke="#6366f1" strokeWidth="2" points={revPoints} vectorEffect="non-scaling-stroke" />
                        <polygon points={`${revPoints} ${width},${height} 0,${height}`} fill="url(#gradRev)" className="opacity-20" />
                        <defs>
                            <linearGradient id="gradRev" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            </div>
        </div>
    );
}

const LaneBox: React.FC<{ lane: Lane, vehicles: Vehicle[] }> = ({ lane, vehicles }) => {
    const laneVehicles = vehicles.filter(v => v.laneId === lane.id && v.status !== 'cleared');
    const waitingCount = laneVehicles.filter(v => v.status.startsWith('waiting')).length;
    const hasHighRisk = laneVehicles.some(v => v.risk === 'High');
    
    let bgClass = 'bg-green-500/10 text-green-400 border-green-500/20';
    if (!lane.isOpen) {
         bgClass = 'bg-slate-800/50 text-slate-600 border-slate-700 border-dashed';
    } else if (waitingCount > 5) {
        bgClass = 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse';
    } else if (waitingCount > 2) {
        bgClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }

    return (
        <div className={`h-8 rounded border flex flex-col items-center justify-center relative ${bgClass} transition-all duration-300`}>
            <div className="text-[8px] font-bold uppercase">{lane.name.split('-')[1]}</div>
            {hasHighRisk && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#111623] animate-bounce"></div>
            )}
        </div>
    );
};

const LaneMiniMap = ({ lanes, vehicles }: { lanes: Lane[], vehicles: Vehicle[] }) => {
    const entryLanes = lanes.filter(l => l.direction === 'entry');
    const exitLanes = lanes.filter(l => l.direction === 'exit');

    return (
        <div className="space-y-2 select-none">
             <div className="grid grid-cols-4 gap-1">
                 {entryLanes.map(l => <LaneBox key={l.id} lane={l} vehicles={vehicles} />)}
             </div>
             <div className="w-full h-[1px] bg-slate-800/50 my-1"></div>
             <div className="grid grid-cols-4 gap-1">
                 {exitLanes.map(l => <LaneBox key={l.id} lane={l} vehicles={vehicles} />)}
             </div>
        </div>
    );
};

const AlertFeed = ({ alerts }: { alerts: Alert[] }) => {
    if (alerts.length === 0) return <div className="text-center py-4 text-slate-600 text-xs">No active threats detected.</div>;

    return (
        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 max-h-[200px]">
            {alerts.map(alert => (
                <div key={alert.id} className={`p-2 rounded border-l-2 bg-slate-900/50 border flex flex-col animate-in slide-in-from-right-2 duration-300 ${
                    alert.severity === 'HIGH' ? 'border-l-red-500 border-y-red-500/10 border-r-red-500/10' : 
                    alert.severity === 'MEDIUM' ? 'border-l-amber-500 border-y-amber-500/10 border-r-amber-500/10' : 
                    'border-l-blue-500 border-y-blue-500/10 border-r-blue-500/10'
                }`}>
                    <div className="flex justify-between items-start mb-0.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                            alert.severity === 'HIGH' ? 'text-red-400' : 
                            alert.severity === 'MEDIUM' ? 'text-amber-400' : 'text-blue-400'
                        }`}>
                            {alert.type} ALERT
                        </span>
                        <span className="text-[9px] text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-[10px] font-medium text-slate-200">{alert.title}</div>
                    <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{alert.message}</div>
                </div>
            ))}
        </div>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    let color = "text-slate-500 bg-slate-500/10 border-slate-500/20";
    if (status === "Verified") color = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    if (status === "Failed") color = "text-red-400 bg-red-400/10 border-red-400/20";
    if (status === "Pending") color = "text-amber-400 bg-amber-400/10 border-amber-400/20";

    return (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${color}`}>
            {status}
        </span>
    );
};

// Helper to calculate dynamic service time
const calculateDynamicServiceTime = (baseTime: number, risk: RiskLevel, queueLength: number) => {
    let multiplier = 1.0;
    if (risk === 'High') multiplier *= 2.5;
    else if (risk === 'Medium') multiplier *= 1.5;
    if (risk !== 'High') {
        if (queueLength > 8) multiplier *= 0.6;      
        else if (queueLength > 4) multiplier *= 0.8; 
    }
    const variance = 0.85 + Math.random() * 0.3;
    return Math.max(2, baseTime * multiplier * variance);
};

interface LaneVisualProps {
  lane: Lane;
  vehicles: Vehicle[];
  onVehicleSelect: (id: string) => void;
  selectedVehicleId: string | null;
}

const LaneVisual: React.FC<LaneVisualProps> = ({ lane, vehicles, onVehicleSelect, selectedVehicleId }) => {
  const isEntry = lane.direction === "entry";
  
  const waitingBorder = vehicles.filter(v => v.status === "waiting_border").slice(0, 5);
  const inBorder = vehicles.find(v => v.status === "in_border");
  
  const waitingCustoms = vehicles.filter(v => v.status === "waiting_customs").slice(0, 4);
  const inCustoms = vehicles.find(v => v.status === "in_customs");

  const getDotColor = (risk: RiskLevel) => {
    switch(risk) {
      case 'Low': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] border border-green-400/50';
      case 'Medium': return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] border border-yellow-400/50';
      case 'High': return 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.6)] border border-red-400/50';
    }
  };
  
  const getProgressColor = (risk: RiskLevel) => {
      switch(risk) {
        case 'Low': return 'bg-green-500';
        case 'Medium': return 'bg-yellow-500';
        case 'High': return 'bg-red-500';
      }
  };

  const getVehicleWidth = (type: string) => {
      switch(type) {
          case 'truck': return 'w-10';
          case 'bus': return 'w-8';
          default: return 'w-5';
      }
  };

  const VehicleDot: React.FC<{ v: Vehicle }> = ({ v }) => {
    const isSelected = selectedVehicleId === v.id;
    // Neutral color for queue to hide risk assessment until control point
    const neutralColor = 'bg-slate-600 border border-slate-500/50 shadow-sm';

    return (
        <div 
            onClick={(e) => { e.stopPropagation(); onVehicleSelect(v.id); }}
            className={`h-5 ${getVehicleWidth(v.vehicleType)} rounded-[2px] ${neutralColor} 
            transition-all duration-300 relative group/veh shrink-0 cursor-pointer 
            ${isSelected 
                ? 'ring-2 ring-white scale-125 z-30 shadow-[0_0_12px_rgba(255,255,255,0.6)] bg-slate-500' 
                : 'hover:scale-110 hover:ring-2 hover:ring-white/60 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] z-10'
            }`} 
            title={v.plate}
        >
            <div className={`absolute top-0 bottom-0 w-1 bg-black/30 ${isEntry ? 'right-0 rounded-r-[1px]' : 'left-0 rounded-l-[1px]'}`}></div>
        </div>
    );
  };

  const Booth = ({ type, activeVehicle, label }: { type: 'border' | 'customs', activeVehicle?: Vehicle, label: string }) => {
      let progress = 0;
      if (activeVehicle) {
          const start = type === 'border' ? activeVehicle.startBorderTime : activeVehicle.startCustomsTime;
          const duration = type === 'border' ? (activeVehicle.assignedBorderDuration || 10) : (activeVehicle.assignedCustomsDuration || 10);
          if (start) {
              const elapsed = (Date.now() - start) / 1000;
              progress = Math.min(100, (elapsed / duration) * 100);
          }
      }

      return (
          <div 
            className={`relative h-full w-20 flex flex-col items-center justify-center shrink-0 border-x border-slate-700 ${type === 'border' ? 'bg-blue-950/40' : 'bg-indigo-950/40'}`}
            onClick={(e) => { if(activeVehicle) { e.stopPropagation(); onVehicleSelect(activeVehicle.id); } }}
          >
                <div className="absolute top-1 text-[9px] font-bold text-slate-400 uppercase tracking-tight">{label}</div>
                <div className={`absolute ${isEntry ? 'right-0' : 'left-0'} top-4 bottom-4 w-1 ${activeVehicle ? 'bg-red-500' : 'bg-emerald-500/50'} transition-colors shadow-sm`}></div>
                {activeVehicle ? (
                    <div className={`h-6 ${getVehicleWidth(activeVehicle.vehicleType)} rounded-sm ${getDotColor(activeVehicle.risk)} 
                        ${selectedVehicleId === activeVehicle.id ? 'ring-2 ring-white' : 'animate-pulse'} 
                        z-20 flex items-center justify-center relative overflow-hidden cursor-pointer`}
                    >
                        <div className="w-[60%] h-[1px] bg-white/30"></div>
                    </div>
                ) : (
                    <div className="w-2 h-2 bg-slate-700/50 rounded-full border border-slate-600"></div>
                )}
                {activeVehicle && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/50 w-full">
                        <div 
                            className={`h-full transition-all duration-500 ease-linear ${getProgressColor(activeVehicle.risk)}`} 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                )}
          </div>
      );
  };

  return (
    <div className="flex items-center gap-3 mb-3 w-full select-none">
      <div className="w-10 flex flex-col items-center justify-center shrink-0 bg-slate-800/30 rounded p-1 border border-slate-700/50">
          <div className="text-[10px] font-black text-slate-400 uppercase">{lane.id.split('_')[2]}</div>
          <div className={`text-[8px] font-bold uppercase ${lane.isOpen ? 'text-emerald-500' : 'text-red-500'}`}>{lane.vehicleType.slice(0,3)}</div>
      </div>
      <div className="relative flex-1 h-14 bg-[#0F172A] border border-slate-800 rounded-md overflow-hidden shadow-inner">
        <div className={`w-full h-full flex items-stretch ${isEntry ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className={`flex-1 flex items-center px-3 relative group transition-colors ${isEntry ? 'bg-gradient-to-r from-transparent to-slate-800/40 justify-end' : 'bg-gradient-to-l from-transparent to-slate-800/40 justify-end'}`}>
                <div className={`absolute bottom-1 ${isEntry ? 'right-2' : 'left-2'} text-[9px] font-bold text-slate-600/50 uppercase tracking-widest`}>Immigration Queue</div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-slate-800/50"></div>
                <div className="flex items-center gap-1.5 relative z-10">
                   {waitingBorder.map((v, idx) => <VehicleDot key={v.id} v={v} />)}
                </div>
            </div>
            <Booth type="border" activeVehicle={inBorder} label="Passport" />
            <div className={`w-40 flex items-center px-2 relative border-x border-slate-800 ${isEntry ? 'justify-end' : 'justify-end'}`}>
                 <div className="absolute inset-0 bg-indigo-900/5"></div>
                 <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 10px)' }}></div>
                 <div className={`absolute top-1 ${isEntry ? 'right-2' : 'left-2'} text-[8px] font-bold text-indigo-400/30 uppercase tracking-wider`}>Customs Control</div>
                 <div className="flex items-center gap-1.5 relative z-10">
                     {waitingCustoms.map((v, idx) => <VehicleDot key={v.id} v={v} />)}
                 </div>
            </div>
            <Booth type="customs" activeVehicle={inCustoms} label="Inspection" />
             <div className={`w-12 flex items-center justify-center bg-slate-900/50 ${isEntry ? 'border-l' : 'border-r'} border-slate-800`}>
                 <div className={`p-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-600`}>
                     <svg className={`w-3 h-3 ${isEntry ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                     </svg>
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};

const NetworkPerformanceWidget = ({ 
    bcps, 
    bcpStats, 
    vehicles, 
    onSelectBcp, 
    selectedBcpId 
}: { 
    bcps: typeof BCPS, 
    bcpStats: Record<string, { cleared: number, highRisk: number }>, 
    vehicles: Vehicle[],
    onSelectBcp: (id: string) => void,
    selectedBcpId: string
}) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-800 bg-slate-900/50">
                        <th className="p-2 font-medium">Checkpoint</th>
                        <th className="p-2 font-medium text-right">Traffic Load</th>
                        <th className="p-2 font-medium text-right">Cleared</th>
                        <th className="p-2 font-medium text-right">Avg Wait</th>
                        <th className="p-2 font-medium text-right">Risks</th>
                        <th className="p-2 font-medium text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="text-xs">
                    {bcps.map(bcp => {
                        const bcpVehicles = vehicles.filter(v => v.bcpId === bcp.id);
                        const waiting = bcpVehicles.filter(v => v.status.includes('waiting')).length;
                        const active = bcpVehicles.filter(v => v.status.includes('in_')).length;
                        const cleared = bcpStats[bcp.id]?.cleared || 0;
                        const risks = bcpStats[bcp.id]?.highRisk || 0;
                        
                        const waitingVehicles = bcpVehicles.filter(v => v.status.includes('waiting'));
                        const avgWait = waitingVehicles.length > 0 
                            ? waitingVehicles.reduce((acc, v) => acc + (Date.now() - v.arrivalTime), 0) / waitingVehicles.length / 1000 
                            : 0;

                        const isSelected = bcp.id === selectedBcpId;
                        
                        return (
                            <tr 
                                key={bcp.id} 
                                onClick={() => onSelectBcp(bcp.id)}
                                className={`border-b border-slate-800/50 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-900/10' : 'hover:bg-slate-800/30'}`}
                            >
                                <td className="p-2">
                                    <div className={`font-medium ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>{bcp.name}</div>
                                    <div className="text-[9px] text-slate-600">{bcp.countryA} &rarr; {bcp.countryB}</div>
                                </td>
                                <td className="p-2 text-right">
                                    <div className="text-slate-300">{waiting + active} <span className="text-[9px] text-slate-600">actv</span></div>
                                </td>
                                <td className="p-2 text-right font-mono text-slate-400">{cleared}</td>
                                <td className="p-2 text-right">
                                    <span className={`${avgWait > 60 ? 'text-red-400' : avgWait > 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {avgWait.toFixed(0)}s
                                    </span>
                                </td>
                                <td className="p-2 text-right">
                                    {risks > 0 ? (
                                        <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-500/20">{risks}</span>
                                    ) : <span className="text-slate-600">-</span>}
                                </td>
                                <td className="p-2 text-center">
                                    <div className={`w-2 h-2 rounded-full mx-auto ${waiting > 10 ? 'bg-red-500 animate-pulse' : waiting > 5 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    )
}

const BiometricTypeIcon = ({ type }: { type: 'FACE' | 'IRIS' | 'PRINT' }) => {
    switch (type) {
        case 'FACE':
            return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        case 'IRIS':
            return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
        case 'PRINT':
             return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>;
    }
    return null;
};

const BiometricRow = ({ label, type, data, startTime }: { label: string, type: 'FACE' | 'IRIS' | 'PRINT', data: BiometricDetail, startTime?: number }) => {
    const [expanded, setExpanded] = useState(false);
    const [now, setNow] = useState(Date.now());

    const TIMEOUT_MS = 5000;

    useEffect(() => {
        if (data.status === 'Pending' && startTime) {
            const interval = setInterval(() => setNow(Date.now()), 50);
            return () => clearInterval(interval);
        }
    }, [data.status, startTime]);

    let displayStatus = data.status;
    let displayConfidence = data.confidence;
    let timeLeft = 0;

    if (data.status === 'Pending' && startTime) {
        const elapsed = now - startTime;
        if (elapsed >= TIMEOUT_MS) {
            displayStatus = 'Failed';
            displayConfidence = 15; // Simulate low confidence on timeout
        } else {
            displayStatus = 'Pending';
            timeLeft = Math.max(0, TIMEOUT_MS - elapsed);
        }
    }

    const steps = useMemo(() => {
        if (!startTime) return [];
        const baseStatus = displayStatus === 'Verified' ? 'Success' : displayStatus === 'Failed' ? 'Failure' : 'Pending';
        const sysId = Math.floor(startTime / 1000).toString(16).toUpperCase();
        return [
            { label: 'System Initialization', delay: 0, status: 'Completed', color: 'bg-emerald-500', log: `SYS_INIT_${sysId}_OK` },
            { label: 'Sensor Acquisition', delay: 800, status: 'Completed', color: 'bg-emerald-500', log: 'IMG_QUAL_CHK_PASS' },
            { label: 'Feature Extraction', delay: 2100, status: 'Completed', color: 'bg-emerald-500', log: 'VEC_GEN_256BIT' },
            { label: 'Database Matching (1:N)', delay: 3400, status: 'Completed', color: 'bg-emerald-500', log: 'DB_QUERY_EXEC_0.4s' },
            { label: 'Final Adjudication', delay: 4200, status: baseStatus, color: baseStatus === 'Success' ? 'bg-emerald-500' : baseStatus === 'Failure' ? 'bg-red-500' : 'bg-amber-500', log: `DECISION_${displayStatus.toUpperCase()}` }
        ];
    }, [startTime, displayStatus]);

    return (
        <div className="bg-[#0F1520] p-2.5 rounded border border-slate-800 mb-2 hover:border-slate-700 transition-colors group relative overflow-hidden">
            {displayStatus === 'Failed' && <div className="absolute inset-0 bg-red-500/5 pointer-events-none"></div>}
            
            <div className="flex items-center justify-between mb-2 relative z-10">
                <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded bg-slate-900 border border-slate-800 ${displayStatus === 'Failed' ? 'text-red-400 border-red-500/30' : 'text-slate-400 group-hover:text-blue-400'}`}>
                        <BiometricTypeIcon type={type} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-300 tracking-wider flex items-center gap-1">
                            {label}
                        </span>
                        <span className="text-[9px] text-slate-500">
                            {displayStatus === 'Pending' ? 'Time Remaining' : 'Confidence Score'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button 
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-colors ${expanded ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300 hover:bg-slate-700'}`}
                        title={expanded ? "Hide Audit Log" : "View Audit Log"}
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Audit
                    </button>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                        displayStatus === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        displayStatus === 'Failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                        {displayStatus === 'Verified' && (
                             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                             </svg>
                        )}
                        {displayStatus === 'Failed' && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                        {displayStatus === 'Pending' && (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {displayStatus.toUpperCase()}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3 relative z-10">
                <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 relative">
                    <div 
                        className={`h-full rounded-full ${
                            displayStatus === 'Verified' ? 'bg-emerald-500' : 
                            displayStatus === 'Failed' ? 'bg-red-500' : 
                            'bg-amber-500'
                        } transition-all duration-200 ease-linear`} 
                        style={{ width: `${displayStatus === 'Pending' ? ((1 - timeLeft/TIMEOUT_MS) * 100) : displayConfidence}%` }}
                    />
                </div>
                <span className={`text-[10px] font-mono font-bold w-9 text-right ${
                    displayStatus === 'Verified' ? 'text-emerald-500' : 
                    displayStatus === 'Failed' ? 'text-red-500' : 
                    'text-amber-500'
                }`}>
                    {displayStatus === 'Pending' ? `${(timeLeft/1000).toFixed(1)}s` : `${displayConfidence}%`}
                </span>
            </div>

            {expanded && startTime && (
                <div className="mt-3 pt-2 border-t border-slate-800/50 animate-in slide-in-from-top-1 duration-200">
                    <div className="bg-slate-950/50 rounded p-2 border border-slate-800/30">
                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800/30">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Verification Audit Trail</span>
                            <span className="text-[9px] font-mono text-slate-600">ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
                        </div>
                        <div className="space-y-2 relative">
                            <div className="absolute left-[53px] top-1 bottom-1 w-px bg-slate-800"></div>
                            {steps.map((step, i) => {
                                const stepDone = (now - startTime) > step.delay;
                                const isFuture = !stepDone;
                                let currentStepColor = step.color;
                                if (isFuture) currentStepColor = 'bg-slate-800';

                                return (
                                    <div key={i} className="flex items-center gap-3 text-[9px] relative z-10">
                                        <div className={`w-10 text-right font-mono ${isFuture ? 'text-slate-700' : 'text-slate-500'}`}>
                                            T+{step.delay}ms
                                        </div>
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${currentStepColor} ${!isFuture ? 'shadow-[0_0_5px_rgba(0,0,0,0.5)]' : ''}`}></div>
                                        <div className="flex flex-col">
                                            <div className={`${step.status === 'Failure' && stepDone ? 'text-red-400 font-bold' : step.status === 'Success' && stepDone ? 'text-emerald-400' : isFuture ? 'text-slate-700' : 'text-slate-400'}`}>
                                                {step.label}
                                            </div>
                                            {stepDone && <div className="text-[8px] font-mono text-slate-600">{step.log}</div>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const VehicleHistoryPanel: React.FC<{ vehicle: Vehicle | undefined; declaration?: Declaration; alerts: Alert[] }> = ({ vehicle, declaration, alerts }) => {
    if (!vehicle) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <p className="text-sm">Select a vehicle to access Joint Intelligence File.</p>
            </div>
        );
    }
    
    const relatedAlerts = alerts.filter(a => 
        a.message.includes(vehicle.plate) || 
        a.title.includes(vehicle.plate) ||
        (declaration && a.message.includes(declaration.mrn))
    );
    
    const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h2 className="text-2xl font-mono text-slate-100 tracking-tight">{vehicle.plate}</h2>
                        <div className="text-xs text-blue-400 uppercase font-bold mt-0.5">{vehicle.subType}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-medium mt-1">{vehicle.companyName}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className={`px-2 py-1 rounded border text-xs font-bold uppercase ${
                            vehicle.risk === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            vehicle.risk === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            'bg-green-500/20 text-green-400 border-green-500/30'
                        }`}>
                            {vehicle.risk} Risk
                        </div>
                        <div className="flex items-center text-[10px] text-slate-400 gap-1 font-mono">
                            <span>{vehicle.origin.substring(0,3).toUpperCase()}</span>
                            <span className="text-slate-600">&rarr;</span>
                            <span>{vehicle.destination.substring(0,3).toUpperCase()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                    {vehicle.watchlistHit && <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/20">WATCHLIST</span>}
                    {vehicle.bioMismatch && <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/20">BIO MISMATCH</span>}
                </div>
            </div>

            {relatedAlerts.length > 0 && (
                <div className="px-4 py-3 border-b border-slate-800 bg-red-500/5">
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Active Enforcement Alerts
                    </div>
                    <div className="space-y-2">
                        {relatedAlerts.map(alert => (
                            <div key={alert.id} className={`p-2 rounded border text-xs ${
                                alert.severity === 'HIGH' ? 'bg-red-950/40 border-red-500/30 text-red-200' :
                                'bg-amber-950/40 border-amber-500/30 text-amber-200'
                            }`}>
                                <div className="flex justify-between items-start">
                                    <span className="font-bold">{alert.title}</span>
                                    <span className="text-[9px] opacity-70">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="mt-0.5 opacity-90 leading-tight">{alert.message}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="relative pl-4 border-l border-slate-800 space-y-6">
                    <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-600 ring-4 ring-[#111623]"></div>
                        <div className="text-xs text-slate-500 mb-0.5">{formatTime(vehicle.arrivalTime)}</div>
                        <div className="text-sm text-slate-200">Arrival Detected</div>
                    </div>
                    <div className="relative">
                        <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[#111623] ${vehicle.startBorderTime ? 'bg-blue-500' : 'bg-slate-800'}`}></div>
                        {vehicle.startBorderTime ? (
                            <>
                                <div className="text-xs text-slate-500 mb-0.5">{formatTime(vehicle.startBorderTime)}</div>
                                <div className="text-sm text-slate-200 font-medium">Border Guard Control</div>
                                <div className="mt-2 bg-slate-800/50 p-2 rounded border border-slate-700/50 space-y-2">
                                    <div className="flex justify-between text-xs items-center">
                                        <span className="text-slate-500">Document Status</span>
                                        <StatusBadge status={vehicle.docStatus === 'Error' ? 'Failed' : vehicle.docStatus === 'Scanning' ? 'Pending' : 'Verified'} />
                                    </div>
                                    <div className="pt-2 border-t border-slate-700/30">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="text-[10px] text-slate-500 uppercase">Biometric Analysis</div>
                                            {vehicle.bioMismatch && <span className="text-[9px] font-bold text-red-400 animate-pulse">ANOMALY DETECTED</span>}
                                        </div>
                                        <div className="space-y-1">
                                            <BiometricRow label="FACIAL RECOGNITION" type="FACE" data={vehicle.biometrics.face} startTime={vehicle.startBorderTime} />
                                            <BiometricRow label="IRIS SCAN" type="IRIS" data={vehicle.biometrics.iris} startTime={vehicle.startBorderTime} />
                                            <BiometricRow label="FINGERPRINT MATCH" type="PRINT" data={vehicle.biometrics.fingerprints} startTime={vehicle.startBorderTime} />
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-slate-500">Waiting for Border Guard...</div>
                        )}
                    </div>
                    <div className="relative">
                        <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[#111623] ${vehicle.startCustomsTime ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
                        {vehicle.startCustomsTime ? (
                            <>
                                <div className="text-xs text-slate-500 mb-0.5">{formatTime(vehicle.startCustomsTime)}</div>
                                <div className="text-sm text-slate-200 font-medium">Customs Inspection</div>
                                {declaration && (
                                    <div className="mt-2 bg-slate-800/50 p-2 rounded border border-slate-700/50 space-y-2">
                                        <div className="text-xs text-slate-200 font-medium truncate" title={declaration.goodsDesc}>{declaration.goodsDesc}</div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">HS Code</span>
                                            <span className="text-blue-300 font-mono">{declaration.hsCode}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Destination</span>
                                            <span className="text-slate-300">{declaration.destinationCountry}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-slate-500">Pending Customs Handover...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// NEW: Manual Declaration Form Component with Validation
const DeclarationForm = ({ onClose, onSubmit }: { onClose: () => void, onSubmit: (d: Declaration) => void }) => {
    const [data, setData] = useState<Partial<Declaration>>({
        mrn: `KA${Math.floor(Math.random() * 900000) + 100000}`,
        traderName: '',
        aeo: 'NONE',
        flow: 'IMPORT',
        hsCode: '',
        goodsDesc: '',
        originCountry: '',
        destinationCountry: '',
        value: 0,
        weight: 0,
        vehiclePlate: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const result = validateDeclaration(data);
        if (!result.isValid) {
            setErrors(result.errors);
            return;
        }

        // Calculate Risk based on manual input
        const hsRiskVal = HS_RISK[data.hsCode!] || 0.2;
        const originRiskVal = ORIGIN_RISK[data.originCountry!] || 0.2;
        const aeoMap: Record<string, number> = { "NONE": 0, "S": 1, "F": 2 };
        
        const features = {
            aeo: aeoMap[data.aeo as string] || 0,
            hsRisk: hsRiskVal,
            originRisk: originRiskVal,
            undervalPct: 0,
            pnrHit: false,
            docMismatch: false,
            watchlist: false,
            history: 0.1
        };

        const { score, band, channel, reasons } = calculateCustomsRisk(features);

        // Calculate Taxes
        const val = Number(data.value);
        const duties = Number((val * (0.03 + 0.07 * hsRiskVal)).toFixed(2));
        const vat = Number(((val + duties) * 0.19).toFixed(2));
        
        const finalDecl: Declaration = {
            ...data as any,
            id: `D_MANUAL_${Date.now()}`,
            value: val,
            weight: Number(data.weight),
            duties, 
            vat, 
            excise: 0,
            riskScore: score,
            riskBand: band,
            riskReasons: reasons,
            channel,
            status: 'SUBMITTED',
            vehicleType: 'truck', // Default assumption
            arrivalTime: Date.now()
        };
        onSubmit(finalDecl);
    };

    const Input = ({ label, field, type = "text", placeholder }: any) => (
        <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">{label}</label>
            <input 
                type={type} 
                value={data[field as keyof Declaration] || ''}
                onChange={e => {
                    const val = type === 'number' ? parseFloat(e.target.value) : e.target.value;
                    setData({...data, [field]: val});
                    // clear error
                    if(errors[field]) {
                        const newErrs = {...errors};
                        delete newErrs[field];
                        setErrors(newErrs);
                    }
                }}
                className={`bg-slate-900 border ${errors[field] ? 'border-red-500' : 'border-slate-700'} rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500`}
                placeholder={placeholder}
            />
            {errors[field] && <span className="text-[9px] text-red-400">{errors[field]}</span>}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#111623] border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="bg-blue-500 w-1 h-4 rounded-full"></span>
                        New Customs Declaration
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="MRN" field="mrn" />
                        <Input label="Vehicle Plate (Optional)" field="vehiclePlate" />
                    </div>
                    <Input label="Trader Name" field="traderName" />
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">Flow</label>
                            <select value={data.flow} onChange={e => setData({...data, flow: e.target.value as any})} className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
                                <option value="IMPORT">IMPORT</option>
                                <option value="EXPORT">EXPORT</option>
                                <option value="TRANSIT">TRANSIT</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">AEO Status</label>
                            <select value={data.aeo} onChange={e => setData({...data, aeo: e.target.value as any})} className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
                                <option value="NONE">None</option>
                                <option value="S">AEO-S</option>
                                <option value="F">AEO-F</option>
                            </select>
                        </div>
                         <Input label="HS Code" field="hsCode" placeholder="e.g. 8517" />
                    </div>
                    <Input label="Goods Description" field="goodsDesc" />
                     <div className="grid grid-cols-2 gap-4">
                        <Input label="Origin Country" field="originCountry" />
                        <Input label="Destination Country" field="destinationCountry" />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <Input label="Value (EUR)" field="value" type="number" />
                        <Input label="Weight (KG)" field="weight" type="number" />
                    </div>
                </form>
                <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/30">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-500 shadow-lg shadow-blue-900/20">Submit Declaration</button>
                </div>
            </div>
        </div>
    )
};

const App: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [statsHistory, setStatsHistory] = useState<{ time: number, waiting: number, inControl: number }[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<{time: number, amount: number}[]>([]);
  const [throughputHistory, setThroughputHistory] = useState<{time: number, entry: number, exit: number}[]>([]);
  const [revenue, setRevenue] = useState({ duties: 0, vat: 0, excise: 0 });
  const [selectedBCP, setSelectedBCP] = useState<string>(BCPS[0].id);
  const [selectedDeclId, setSelectedDeclId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showDeclForm, setShowDeclForm] = useState(false);
  
  const [widgets, setWidgets] = useState({
      network: true,
      command: true,
      risk: true,
      entry: true,
      exit: true,
      declarations: true,
      inspection: true,
      analytics: true,
      alerts: true,
  });
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);
  const [minRiskFilter, setMinRiskFilter] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [onlyHighRiskDecls, setOnlyHighRiskDecls] = useState(false);
  const [sortByRisk, setSortByRisk] = useState(false);
  const [declFilters, setDeclFilters] = useState({ trader: '', hs: '', origin: '', destination: '', goods: '' });
  const [declVehicleTypeFilter, setDeclVehicleTypeFilter] = useState<'all' | VehicleType>('all');
  
  const [bcpPerformance, setBcpPerformance] = useState<Record<string, { cleared: number, highRisk: number }>>({});
  
  // Stats accumulator ref to prevent update loops/stale closures
  const bcpStatsRef = useRef<Record<string, { cleared: number, highRisk: number }>>({});

  // Initialize Ref
  useEffect(() => {
      BCPS.forEach(b => {
          if (!bcpStatsRef.current[b.id]) bcpStatsRef.current[b.id] = { cleared: 0, highRisk: 0 };
      });
  }, []);

  const lanesForSelected = useMemo(() => LANES.filter((l) => l.bcpId === selectedBCP), [selectedBCP]);
  const vehiclesForSelected = useMemo(() => vehicles.filter((v) => v.bcpId === selectedBCP), [vehicles, selectedBCP]);
  
  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId), [vehicles, selectedVehicleId]);
  const selectedDeclaration = useMemo(() => {
    if (!selectedVehicle) return undefined;
    return declarations.find(d => d.linkedVehicleId === selectedVehicle.id || d.vehiclePlate === selectedVehicle.plate);
  }, [selectedVehicle, declarations]);

  const now = Date.now();
  const toggleWidget = (key: keyof typeof widgets) => setWidgets(prev => ({ ...prev, [key]: !prev[key] }));

  const handleAddDeclaration = (decl: Declaration) => {
      setDeclarations(prev => [decl, ...prev]);
      setShowDeclForm(false);
  };
  
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const newAlerts: Alert[] = [];

      // 1. GLOBAL TRAFFIC GENERATION (All Lanes, All BCPs)
      // Reduced probability slightly to account for simulating 6 BCPs concurrently
      LANES.forEach((lane) => {
        if (!lane.isOpen) return;
        if (Math.random() < 0.15) {
          const bcp = BCPS.find(b => b.id === lane.bcpId)!;
          const v = generateVehicle(lane, bcp);
          
          // Immediately register new vehicle
          setVehicles(prev => [...prev, v]);
          
          // Track risk immediately
          if (v.risk === 'High') {
              bcpStatsRef.current[lane.bcpId].highRisk++;
          }

          // --- BORDER SECURITY ALERTS ---
          if (v.docAnomaly) {
             const borderIssues = [
                 "False Passport: MRZ Checksum Failure",
                 "False Identity Card: UV Hologram missing",
                 "Counterfeit Driving License detected",
                 "Imposter detected: Facial biometrics mismatch",
                 "Forged Visa / Residence Permit"
             ];
             newAlerts.push({ id: `ALT_${Date.now()}_${Math.random()}`, timestamp: Date.now(), type: 'SECURITY', title: 'Document Verification Alert', message: `Vehicle ${v.plate} (${lane.bcpId.split('_')[1]}): ${randomItem(borderIssues)}`, severity: 'HIGH' });
          } 
          else if (v.watchlistHit) {
             newAlerts.push({ id: `ALT_${Date.now()}_${Math.random()}`, timestamp: Date.now(), type: 'SECURITY', title: 'Intelligence Hit', message: `Vehicle ${v.plate}: Person/Vehicle flagged in INTERPOL/Europol DB.`, severity: 'HIGH' });
          }
          
          // --- CUSTOMS ALERTS & Declarations ---
          // Trucks always have declarations (simulated). 
          // Personal vehicles (cars/buses) occasionally have declarations or smuggling alerts.
          
          if (lane.vehicleType === 'truck') {
               if (Math.random() < 0.85) { // High probability for trucks
                   const d = generateDeclaration(v);
                   setDeclarations(prev => [...prev, d]);
               }
          } else {
               // Personal Vehicles (Car/Bus)
               // Occasional Personal Declaration (Tax Refund, High Value Items, Cash Declaration)
               if (Math.random() < 0.10) {
                   const d = generateDeclaration(v);
                   setDeclarations(prev => [...prev, d]);
               }
               
               // Smuggling Logic
               if ((v.risk === 'High' || v.risk === 'Medium') && Math.random() < 0.4) {
                  const customsIssues = [
                      { title: "Smuggling / Excise Goods", msg: "Concealed Cigarettes (>50 cartons) found in chassis." },
                      { title: "Smuggling / Excise Goods", msg: "Undeclared Alcohol (>50L) found in luggage." },
                      { title: "Cash Control", msg: "Undeclared Cash > 10,000 EUR detected by K9 unit." },
                      { title: "Commercial Fraud", msg: "Undeclared commercial electronics (phones/laptops)." }
                  ];
                  const issue = randomItem(customsIssues);
                  newAlerts.push({ id: `ALT_${Date.now()}_${Math.random()}`, timestamp: Date.now(), type: 'CUSTOMS', title: issue.title, message: `Vehicle ${v.plate}: ${issue.msg}`, severity: v.risk === 'High' ? 'HIGH' : 'MEDIUM' });
              }
          }
        }
      });

      // Random standalone declaration injection (Pre-lodged but vehicle not arrived yet or decoupled)
      if (Math.random() < 0.05) {
        const d = generateDeclaration();
        setDeclarations(prev => [...prev, d]);
        if (d.riskBand === 'High') newAlerts.push({ id: `ALT_${Date.now()}_${Math.random()}`, timestamp: Date.now(), type: 'CUSTOMS', title: 'High Risk Cargo', message: `MRN ${d.mrn}: ${d.riskReasons.join(', ')}`, severity: 'MEDIUM' });
      }

      if (newAlerts.length > 0) {
          setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
      }

      // 2. GLOBAL TRAFFIC PROCESSING (All Lanes)
      let revenueTick = 0;
      let entryClearedTick = 0;
      let exitClearedTick = 0;

      setVehicles((prev) => {
        const updated = [...prev];
        let waitingCountSelected = 0;
        let inControlCountSelected = 0;

        LANES.forEach((lane) => {
          const laneVehicles = updated.filter(v => v.laneId === lane.id && v.status !== 'cleared');
          
          // Tracking stats for selected BCP only for the graph
          if (lane.bcpId === selectedBCP) {
               const w = laneVehicles.filter(v => v.status.startsWith('waiting')).length;
               const c = laneVehicles.filter(v => v.status.startsWith('in_')).length;
               waitingCountSelected += w;
               inControlCountSelected += c;
          }

          const inCustoms = laneVehicles.find(v => v.status === 'in_customs');
          if (inCustoms && inCustoms.startCustomsTime) {
              const duration = inCustoms.assignedCustomsDuration || lane.customsServiceTime;
              if ((currentTime - inCustoms.startCustomsTime) / 1000 >= duration) {
                  inCustoms.status = 'cleared';
                  // Track clearance
                  bcpStatsRef.current[lane.bcpId].cleared++;
                  if (lane.direction === 'entry') entryClearedTick++; else exitClearedTick++;
                  
                  // Simulate Revenue Collection for Truck/High Value
                  if (inCustoms.vehicleType === 'truck') revenueTick += Math.floor(Math.random() * 4500) + 200;
                  if (inCustoms.vehicleType === 'car' && Math.random() < 0.1) revenueTick += Math.floor(Math.random() * 500);
              }
          } else if (!inCustoms) {
              const queue = laneVehicles.filter(v => v.status === 'waiting_customs');
              const nextForCustoms = queue.sort((a,b) => a.arrivalTime - b.arrivalTime)[0];
              if (nextForCustoms) {
                  nextForCustoms.status = 'in_customs';
                  nextForCustoms.startCustomsTime = currentTime;
                  nextForCustoms.assignedCustomsDuration = calculateDynamicServiceTime(lane.customsServiceTime, nextForCustoms.risk, queue.length);
              }
          }
          const inBorder = laneVehicles.find(v => v.status === 'in_border');
          if (inBorder && inBorder.startBorderTime) {
              const duration = inBorder.assignedBorderDuration || lane.borderServiceTime;
              if ((currentTime - inBorder.startBorderTime) / 1000 >= duration) {
                  inBorder.status = 'waiting_customs';
                  inBorder.startBorderTime = undefined;
              }
          } else if (!inBorder) {
              const queue = laneVehicles.filter(v => v.status === 'waiting_border');
              const nextForBorder = queue.sort((a,b) => a.arrivalTime - b.arrivalTime)[0];
              if (nextForBorder) {
                  nextForBorder.status = 'in_border';
                  nextForBorder.startBorderTime = currentTime;
                  nextForBorder.assignedBorderDuration = calculateDynamicServiceTime(lane.borderServiceTime, nextForBorder.risk, queue.length);
              }
          }
        });

        // Sync Ref to State for rendering
        setBcpPerformance({...bcpStatsRef.current});
        
        // Update graph stats for selected
        setStatsHistory(h => [...h, { time: currentTime, waiting: waitingCountSelected, inControl: inControlCountSelected }].slice(-60));
        
        const keepThreshold = currentTime - 15000; 
        return updated.filter(v => v.status !== "cleared" || (v.startCustomsTime && v.startCustomsTime > keepThreshold));
      });
      
      // Update Revenue/Throughput Graphs
      setRevenueHistory(prev => {
          const last = prev[prev.length - 1];
          const total = (last?.amount || 0) + revenueTick;
          return [...prev, { time: currentTime, amount: total }].slice(-60);
      });
      setThroughputHistory(prev => [...prev, { time: currentTime, entry: entryClearedTick, exit: exitClearedTick }].slice(-60));

    }, 1000);
    return () => clearInterval(interval);
  }, [selectedBCP]);

  const stats = useMemo(() => {
    const waiting = vehiclesForSelected.filter(v => v.status === "waiting_border" || v.status === "waiting_customs");
    const inControl = vehiclesForSelected.filter(v => v.status === "in_border" || v.status === "in_customs");
    const avgWaitSec = waiting.length > 0 ? waiting.reduce((acc, v) => acc + (now - v.arrivalTime), 0) / waiting.length / 1000 : 0;
    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    vehiclesForSelected.forEach(v => riskCounts[v.risk]++);
    return { waiting, inControl, avgWaitSec, riskCounts };
  }, [vehiclesForSelected, now]);

  const checkRiskVisibility = (risk: RiskLevel) => {
      if (minRiskFilter === 'Low') return true;
      if (minRiskFilter === 'Medium') return risk === 'Medium' || risk === 'High';
      if (minRiskFilter === 'High') return risk === 'High';
      return true;
  };

  const activeDeclarations = declarations.filter(d => d.status === 'SUBMITTED' || d.status === 'INSPECTION');
  const displayedDeclarations = activeDeclarations.filter(d => {
      const matchesRisk = checkRiskVisibility(d.riskBand);
      const matchesHighRiskToggle = onlyHighRiskDecls ? d.channel === 'RED' : true;
      const matchesTrader = d.traderName.toLowerCase().includes(declFilters.trader.toLowerCase());
      const matchesOrigin = d.originCountry.toLowerCase().includes(declFilters.origin.toLowerCase()); 
      const matchesDestination = d.destinationCountry.toLowerCase().includes(declFilters.destination.toLowerCase());
      const matchesHS = d.hsCode.includes(declFilters.hs);
      const matchesGoods = d.goodsDesc.toLowerCase().includes(declFilters.goods.toLowerCase());
      const matchesVehicleType = declVehicleTypeFilter === 'all' || d.vehicleType === declVehicleTypeFilter;
      return matchesRisk && matchesHighRiskToggle && matchesTrader && matchesVehicleType && matchesOrigin && matchesGoods && matchesDestination && matchesHS;
  }).sort((a, b) => sortByRisk ? b.riskScore - a.riskScore : 0);

  const declRiskStats = { Low: 0, Medium: 0, High: 0 };
  displayedDeclarations.forEach(d => declRiskStats[d.riskBand]++);
  const totalDecls = displayedDeclarations.length || 1;

  const leftActive = widgets.command || widgets.risk || widgets.alerts || widgets.network;
  const rightActive = widgets.declarations;
  const centerColSpan = (leftActive && rightActive) ? "col-span-12 xl:col-span-6" : (leftActive || rightActive) ? "col-span-12 xl:col-span-9" : "col-span-12";

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-300 p-4 md:p-6 font-sans selection:bg-blue-500/30 flex flex-col">
      {showDeclForm && <DeclarationForm onClose={() => setShowDeclForm(false)} onSubmit={handleAddDeclaration} />}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 shrink-0 relative">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center shadow-lg shadow-blue-900/20">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div>
                <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Operational Management Directorate</h1>
                <p className="text-xs text-slate-500 font-medium">Joint Command & Control: Border Guard + Customs</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={() => setShowWidgetMenu(!showWidgetMenu)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200">
                 Layout
            </button>
            {showWidgetMenu && (
                <div className="absolute right-20 top-12 w-56 bg-slate-800 border border-slate-700 shadow-xl rounded-lg z-50 p-2">
                    {Object.entries(widgets).map(([key, active]) => (
                        <button key={key} onClick={() => toggleWidget(key as keyof typeof widgets)} className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700/50 rounded">
                            <span className="capitalize">{key}</span>
                            <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500' : 'bg-slate-600'}`} />
                        </button>
                    ))}
                </div>
            )}
            <select value={selectedBCP} onChange={e => setSelectedBCP(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-md px-3 py-1.5">
                {BCPS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {leftActive && (
            <div className="col-span-12 xl:col-span-3 flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pr-1">
                <DashboardWidget title="Global Network Performance" isVisible={widgets.network} onClose={() => toggleWidget('network')}>
                    <NetworkPerformanceWidget 
                        bcps={BCPS} 
                        bcpStats={bcpPerformance} 
                        vehicles={vehicles} 
                        onSelectBcp={setSelectedBCP} 
                        selectedBcpId={selectedBCP} 
                    />
                </DashboardWidget>

                <DashboardWidget title="Joint Command: Active BCP Status" isVisible={widgets.command} onClose={() => toggleWidget('command')}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                             <div className="bg-slate-900/30 p-2 rounded border border-slate-800/50">
                                <div className="text-[9px] text-slate-500 uppercase mb-1">Pending Interventions</div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-light text-slate-200">{stats.waiting.length}</span>
                                    <span className="text-[9px] text-slate-500">Units</span>
                                </div>
                            </div>
                             <div className="bg-slate-900/30 p-2 rounded border border-slate-800/50">
                                <div className="text-[9px] text-slate-500 uppercase mb-1">Control Latency</div>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-xl font-light ${stats.avgWaitSec > 120 ? 'text-red-400' : 'text-emerald-400'}`}>{stats.avgWaitSec.toFixed(0)}</span>
                                    <span className="text-[9px] text-slate-500">sec</span>
                                </div>
                            </div>
                        </div>
                        <div className="pt-1">
                             <div className="text-[9px] text-slate-500 uppercase mb-2 font-bold tracking-wider">Enforcement Timeline</div>
                             <TrafficGraph history={statsHistory} />
                        </div>
                        <div className="pt-2 border-t border-slate-800/60">
                            <div className="text-[9px] text-slate-500 uppercase mb-2 font-bold tracking-wider">Tactical Map</div>
                            <LaneMiniMap lanes={lanesForSelected} vehicles={vehiclesForSelected} />
                        </div>
                    </div>
                </DashboardWidget>

                <DashboardWidget title="Intelligence-Led Risk Indicators" isVisible={widgets.risk} onClose={() => toggleWidget('risk')}>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">High Priority Threats</span>
                            <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">{stats.riskCounts.High}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${(stats.riskCounts.High / vehiclesForSelected.length) * 100}%`}}></div></div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-400">Medium Priority</span>
                            <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">{stats.riskCounts.Medium}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-yellow-500" style={{ width: `${(stats.riskCounts.Medium / vehiclesForSelected.length) * 100}%`}}></div></div>
                    </div>
                </DashboardWidget>

                <DashboardWidget title="Operational Alerts" isVisible={widgets.alerts} onClose={() => toggleWidget('alerts')} className="max-h-[300px]">
                    <AlertFeed alerts={alerts} />
                </DashboardWidget>
            </div>
        )}

        <div className={`${centerColSpan} flex flex-col gap-4 h-full overflow-y-auto pr-1 custom-scrollbar`}>
             <DashboardWidget title="Entry Control Points" isVisible={widgets.entry} onClose={() => toggleWidget('entry')}>
                <div className="space-y-1">
                    {lanesForSelected.filter(l => l.direction === "entry").map(lane => (
                        <LaneVisual key={lane.id} lane={lane} vehicles={vehiclesForSelected.filter(v => v.laneId === lane.id && v.status !== 'cleared')} onVehicleSelect={setSelectedVehicleId} selectedVehicleId={selectedVehicleId} />
                    ))}
                </div>
            </DashboardWidget>
            <DashboardWidget title="Exit Control Points" isVisible={widgets.exit} onClose={() => toggleWidget('exit')}>
                <div className="space-y-1">
                    {lanesForSelected.filter(l => l.direction === "exit").map(lane => (
                        <LaneVisual key={lane.id} lane={lane} vehicles={vehiclesForSelected.filter(v => v.laneId === lane.id && v.status !== 'cleared')} onVehicleSelect={setSelectedVehicleId} selectedVehicleId={selectedVehicleId} />
                    ))}
                </div>
            </DashboardWidget>
            <DashboardWidget title="Live Inspection & Enforcement Log" isVisible={widgets.inspection} onClose={() => toggleWidget('inspection')} className="h-[600px] shrink-0" contentClassName="overflow-hidden flex flex-col">
                <div className="flex-1 overflow-hidden"><VehicleHistoryPanel vehicle={selectedVehicle} declaration={selectedDeclaration} alerts={alerts} /></div>
             </DashboardWidget>
             <DashboardWidget title="Agency Performance Metrics" isVisible={widgets.analytics} onClose={() => toggleWidget('analytics')}>
                <MetricsWidget revenueHistory={revenueHistory} throughputHistory={throughputHistory} />
             </DashboardWidget>
        </div>

        {rightActive && (
            <div className="col-span-12 xl:col-span-3 flex flex-col gap-4 h-full overflow-hidden">
                 <DashboardWidget 
                    title="Trade Intelligence & Declarations" 
                    isVisible={widgets.declarations} 
                    onClose={() => toggleWidget('declarations')} 
                    className="flex-1 min-h-[300px]" 
                    contentClassName="overflow-hidden flex flex-col"
                >
                    <div className="px-3 py-2 border-b border-slate-800/50 bg-slate-900/20 flex flex-col gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-[1.5]">
                                <input 
                                    type="text" 
                                    placeholder="Search Trader..." 
                                    value={declFilters.trader}
                                    onChange={(e) => setDeclFilters(prev => ({ ...prev, trader: e.target.value }))}
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-300 focus:border-blue-500/50 focus:outline-none pl-6 placeholder:text-slate-600"
                                />
                                <svg className="w-3 h-3 text-slate-600 absolute left-1.5 top-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                             <div className="relative flex-[1.5]">
                                 <input 
                                    type="text" 
                                    placeholder="Goods Desc." 
                                    value={declFilters.goods}
                                    onChange={(e) => setDeclFilters(prev => ({ ...prev, goods: e.target.value }))}
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-300 focus:border-blue-500/50 focus:outline-none placeholder:text-slate-600"
                                />
                            </div>
                            <div className="relative w-24">
                                 <input 
                                    type="text" 
                                    placeholder="HS Code" 
                                    value={declFilters.hs}
                                    onChange={(e) => setDeclFilters(prev => ({ ...prev, hs: e.target.value }))}
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-300 focus:border-blue-500/50 focus:outline-none placeholder:text-slate-600"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="relative flex-1">
                                 <input 
                                    type="text" 
                                    placeholder="Origin" 
                                    value={declFilters.origin}
                                    onChange={(e) => setDeclFilters(prev => ({ ...prev, origin: e.target.value }))}
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-300 focus:border-blue-500/50 focus:outline-none placeholder:text-slate-600"
                                />
                            </div>
                             <div className="relative flex-1">
                                 <input 
                                    type="text" 
                                    placeholder="Destination" 
                                    value={declFilters.destination}
                                    onChange={(e) => setDeclFilters(prev => ({ ...prev, destination: e.target.value }))}
                                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-300 focus:border-blue-500/50 focus:outline-none placeholder:text-slate-600"
                                />
                            </div>
                            <div className="flex bg-slate-950/50 rounded border border-slate-700/50 p-0.5 gap-0.5 shrink-0">
                                {(['all', 'truck', 'car', 'bus'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setDeclVehicleTypeFilter(type)}
                                        className={`px-2 py-1 rounded-[2px] text-[9px] font-bold uppercase transition-all ${
                                            declVehicleTypeFilter === type 
                                            ? 'bg-slate-700 text-slate-100 shadow-sm ring-1 ring-slate-600' 
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                        }`}
                                    >
                                        {type === 'all' ? 'All' : type}
                                    </button>
                                ))}
                            </div>
                            <button 
                                onClick={() => setOnlyHighRiskDecls(!onlyHighRiskDecls)}
                                className={`px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase transition-all flex items-center gap-2 whitespace-nowrap shadow-sm ${
                                    onlyHighRiskDecls 
                                    ? 'bg-red-600 border-red-500 text-white shadow-red-900/20 ring-1 ring-red-500/50' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                }`}
                            >
                                 <div className={`w-2 h-2 rounded-full ${onlyHighRiskDecls ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                                Red Channel
                            </button>
                        </div>
                    </div>
                    
                    {/* Replaced simple bar with Donut Chart & Detailed Legend */}
                    <div className="px-3 py-2 bg-slate-900/10 border-b border-slate-800/50 flex flex-col gap-2">
                        <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                            <span>Risk Distribution Analysis</span>
                        </div>
                        
                        <div className="flex items-center gap-6 px-2">
                            {/* Donut Chart */}
                            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#1e293b" strokeWidth="3" />
                                    {(() => {
                                        let offset = 0;
                                        const total = displayedDeclarations.length || 1;
                                        if (displayedDeclarations.length === 0) return null;
                                        
                                        return [
                                            { val: declRiskStats.High, color: '#ef4444' },
                                            { val: declRiskStats.Medium, color: '#f59e0b' },
                                            { val: declRiskStats.Low, color: '#10b981' }
                                        ].map((seg, i) => {
                                            const pct = (seg.val / total) * 100;
                                            const dashArray = `${pct}, 100`;
                                            const dashOffset = -offset;
                                            offset += pct;
                                            return (
                                                <circle 
                                                    key={i}
                                                    cx="18" cy="18" r="15.9155" 
                                                    fill="none" 
                                                    stroke={seg.color} 
                                                    strokeWidth="3" 
                                                    strokeDasharray={dashArray} 
                                                    strokeDashoffset={dashOffset}
                                                    className="transition-all duration-500"
                                                />
                                            );
                                        });
                                    })()}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xs font-bold text-slate-200">{displayedDeclarations.length}</span>
                                    <span className="text-[8px] text-slate-500 uppercase">Total</span>
                                </div>
                            </div>

                            {/* Legend / Stats */}
                            <div className="flex-1 grid grid-cols-1 gap-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                        High Risk
                                    </div>
                                    <span className="font-bold text-slate-200">{declRiskStats.High}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                        Medium Risk
                                    </div>
                                    <span className="font-bold text-slate-200">{declRiskStats.Medium}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        Low Risk
                                    </div>
                                    <span className="font-bold text-slate-200">{declRiskStats.Low}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                        {displayedDeclarations.map(d => {
                            // Find linked vehicle subType if possible, otherwise default based on declaration vehicleType
                            const linkedV = vehicles.find(v => v.id === d.linkedVehicleId);
                            const subType = linkedV ? linkedV.subType : (d.vehicleType === 'truck' ? 'Heavy Goods' : 'Personal');

                            return (
                            <div key={d.id} onClick={() => setSelectedDeclId(d.id === selectedDeclId ? null : d.id)} className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 relative ${
                                d.id === selectedDeclId ? 'border-blue-500/60 bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 
                                d.riskBand === 'High' ? 'border-red-500/50 bg-red-950/30 hover:bg-red-900/20' :
                                d.riskBand === 'Medium' ? 'border-amber-500/40 bg-amber-950/30 hover:bg-amber-900/20' :
                                'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50'
                            }`}>
                                <div className="flex items-center justify-between mb-2 relative z-10">
                                    <div className="flex items-center gap-2">
                                        {d.riskBand === 'High' && <svg className="w-4 h-4 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                                        {d.riskBand === 'Medium' && <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                        <span className={`font-mono text-xs tracking-tight ${d.riskBand === 'High' ? 'text-red-200 font-bold' : d.riskBand === 'Medium' ? 'text-amber-200' : 'text-slate-400'}`}>{d.mrn}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 rounded ${d.channel === 'RED' ? 'bg-red-500/20 text-red-400' : d.channel === 'YELLOW' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{d.channel}</span>
                                </div>
                                <div className="text-xs text-slate-200 font-medium mb-1">{d.traderName}</div>
                                
                                {/* New Route & Vehicle Info Line */}
                                <div className="flex items-center justify-between mt-2 mb-2 bg-slate-900/50 p-1.5 rounded border border-slate-700/30 text-[9px] text-slate-400">
                                    <div className="flex items-center gap-1 font-mono">
                                        <span>{d.originCountry.substring(0,3).toUpperCase()}</span>
                                        <span>&rarr;</span>
                                        <span>{d.destinationCountry.substring(0,3).toUpperCase()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">{subType}</span>
                                        {d.vehiclePlate && <span className="font-mono text-slate-300 bg-slate-800 px-1 rounded border border-slate-700">{d.vehiclePlate}</span>}
                                    </div>
                                </div>

                                <div className="text-[10px] text-slate-400 mb-1 truncate">GOODS: {d.goodsDesc}</div>
                                {d.riskReasons.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {d.riskReasons.map(reason => <span key={reason} className="text-[9px] text-red-300 bg-red-500/10 px-1 rounded">{reason}</span>)}
                                    </div>
                                )}
                            </div>
                        )})}
                    </div>
                 </DashboardWidget>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;