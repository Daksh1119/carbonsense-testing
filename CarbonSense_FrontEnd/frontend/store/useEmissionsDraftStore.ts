import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { EmissionsCategory } from "@/lib/emissions-factors";

export interface EmissionsDraftEntry {
  category: EmissionsCategory;
  activityType: string;
  detail: string;
  amount: number;
  unit: string;
  date: string;
  estimatedCo2Kg: number;
  meta?: Record<string, string>;
}

interface EmissionsDraftState {
  entries: Record<EmissionsCategory, EmissionsDraftEntry | null>;
  setEntry: (category: EmissionsCategory, entry: EmissionsDraftEntry) => void;
  clearEntry: (category: EmissionsCategory) => void;
  clearAll: () => void;
}

const emptyEntries: Record<EmissionsCategory, EmissionsDraftEntry | null> = {
  transport: null,
  energy: null,
  waste: null,
  purchases: null,
};

export const useEmissionsDraftStore = create<EmissionsDraftState>()(
  persist(
    (set) => ({
      entries: { ...emptyEntries },
      setEntry: (category, entry) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [category]: entry,
          },
        })),
      clearEntry: (category) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [category]: null,
          },
        })),
      clearAll: () => set({ entries: { ...emptyEntries } }),
    }),
    {
      name: "carbonsense-emissions-draft",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
