import React from 'react';
import { AlertTriangle, CheckCircle2, Layers, ListOrdered, Ruler } from 'lucide-react';
import { ResultSummary } from '../utils/resultSummary';

export type StepTab = 'material' | 'pieces' | 'result';

const TABS: { id: StepTab; label: string; icon: React.ElementType }[] = [
  { id: 'material', label: 'Material', icon: Ruler },
  { id: 'pieces', label: 'Piezas', icon: ListOrdered },
  { id: 'result', label: 'Resultado', icon: Layers },
];

interface StepTabsProps {
  activeTab: StepTab;
  onChange: (tab: StepTab) => void;
  summary: ResultSummary;
}

/** Step navigation plus a live summary of the optimization; clicking the summary opens the result. */
export const StepTabs: React.FC<StepTabsProps> = ({ activeTab, onChange, summary }) => (
  <nav aria-label="Pasos" className="bg-white border-b border-stone-200 shadow-xs">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2">
      <div role="tablist" className="flex">
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`step-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive ? 'border-amber-600 text-amber-700' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                  isActive ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-600'
                }`}
              >
                {index + 1}
              </span>
              <Icon className="w-4 h-4 hidden sm:block" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {!summary.isEmpty && (
        <button
          id="step-tabs-summary"
          type="button"
          onClick={() => onChange('result')}
          title="Ver resultado"
          className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
            summary.hasUnplaced
              ? 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100'
              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
          }`}
        >
          <span className="font-semibold">{summary.efficiencyLabel}</span>
          <span aria-hidden>·</span>
          <span>{summary.sheetsLabel}</span>
          <span aria-hidden>·</span>
          <span>{summary.placedLabel}</span>
          {summary.hasUnplaced ? (
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          )}
        </button>
      )}
    </div>
  </nav>
);
