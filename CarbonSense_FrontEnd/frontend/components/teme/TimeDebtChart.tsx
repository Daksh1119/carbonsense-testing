"use client";

import {
	Line,
	LineChart,
	CartesianGrid,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
} from "recharts";

interface TimeDebtChartProps {
	mean_curve?: number[];
	p5_curve?: number[];
	p95_curve?: number[];
}

export default function TimeDebtChart({ mean_curve, p5_curve, p95_curve }: TimeDebtChartProps) {
	const maxLength = Math.max(
		mean_curve?.length || 0,
		p5_curve?.length || 0,
		p95_curve?.length || 0
	);

	const chartData = Array.from({ length: maxLength }).map((_, index) => ({
		year: `Y${index + 1}`,
		expected: mean_curve?.[index] ?? null,
		worst: p5_curve?.[index] ?? null,
		best: p95_curve?.[index] ?? null,
	}));

	if (maxLength === 0) {
		return (
			<div className="h-[320px] w-full flex items-center justify-center text-sm text-slate-400">
				Monte Carlo curve data unavailable for this run.
			</div>
		);
	}

	return (
		<ResponsiveContainer width="100%" height={320}>
			<LineChart data={chartData}>
				<CartesianGrid strokeDasharray="3 3" stroke="#1e3a3a" />
				<XAxis dataKey="year" stroke="#64748b" fontSize={12} tickLine={false} />
				<YAxis stroke="#64748b" fontSize={12} tickLine={false} />
				<Tooltip
					contentStyle={{
						backgroundColor: "#16252d",
						border: "1px solid #1e3a3a",
						borderRadius: "0.5rem",
						color: "#fff",
					}}
				/>
				<Line
					type="monotone"
					dataKey="expected"
					stroke="#10b981"
					strokeWidth={2}
					dot={false}
					name="Expected absorption"
					connectNulls
				/>
				<Line
					type="monotone"
					dataKey="worst"
					stroke="#f59e0b"
					strokeWidth={2}
					strokeDasharray="6 4"
					dot={false}
					name="Worst case"
					connectNulls
				/>
				<Line
					type="monotone"
					dataKey="best"
					stroke="#0bd5b0"
					strokeWidth={2}
					strokeDasharray="4 4"
					dot={false}
					name="Best case"
					connectNulls
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}
