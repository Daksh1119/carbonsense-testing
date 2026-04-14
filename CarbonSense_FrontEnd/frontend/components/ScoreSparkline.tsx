"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { fetchComplianceScoreHistory } from "@/lib/policy-compliance-api";

export default function ScoreSparkline({ currentScore = 0 }: { currentScore?: number }) {
  const [data, setData] = useState<Array<{ snapshot_date: string; total_score: number }>>([]);

  useEffect(() => {
    fetchComplianceScoreHistory(180).then((history) => {
      const mapped = (history || []).map((item) => ({ snapshot_date: String(item.snapshot_date || ""), total_score: Number(item.total_score || 0) }));
      if (mapped.length >= 2) {
        setData(mapped);
        return;
      }

      const today = new Date();
      const fallback = Array.from({ length: 7 }).map((_, index) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - index));
        return {
          snapshot_date: d.toISOString().slice(0, 10),
          total_score: Number(currentScore || 0),
        };
      });
      setData(fallback);
    }).catch(() => {
      const today = new Date();
      const fallback = Array.from({ length: 7 }).map((_, index) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - index));
        return {
          snapshot_date: d.toISOString().slice(0, 10),
          total_score: Number(currentScore || 0),
        };
      });
      setData(fallback);
    });
  }, [currentScore]);

  return (
    <div className="h-56 w-full rounded-xl border border-navy-border bg-navy-muted/20 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="snapshot_date" hide />
          <YAxis domain={[0, 100]} hide />
          <Tooltip />
          <Line type="monotone" dataKey="total_score" stroke="#14b8a6" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
