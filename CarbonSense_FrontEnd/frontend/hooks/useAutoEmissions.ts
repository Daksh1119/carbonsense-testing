import { useMemo } from "react";

export interface ActivityBreakdown {
	transport: number;
	food: number;
	energy: number;
	shopping: number;
	other: number;
}

export function useAutoEmissions(activity: ActivityBreakdown) {
	const totalEmissionKg = useMemo(() => {
		return Object.values(activity).reduce(
			(sum, value) => sum + (Number(value) || 0),
			0
		);
	}, [activity]);

	return {
		totalEmissionKg,
	};
}
