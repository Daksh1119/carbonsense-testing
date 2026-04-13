import { useCallback, useEffect, useState } from 'react';
import { fetchEmissionsUploadsScoped } from '@/lib/emissions-api';
import { getCurrentUserContext, getLatestTEMERun } from '@/lib/recommendations-api';
import { getPolicyAlerts } from '@/services/policyService';

interface DashboardData {
  totalEmissions: number;
  totalEmissionsHasData: boolean;
  totalEmissionsMonth: number;
  totalEmissionsYear: number;
  reductionAchieved: number;
  reductionFormula: string;
  reductionBaselineLabel: string;
  totalEmissionsMeta: string;
  timeDebtStatus: string;
  timeDebtYears: number | null;
  timeDebtConfidence: number | null;
  timeDebtMeta: string;
  policyAlerts: number;
  policyCriticalAlerts: number;
  policyMeta: string;
  latestPeriodLabel: string;
  refreshedAtLabel: string;
  carbonPath: {
    historical: { date: string; value: number }[];
    projected: { date: string; value: number }[];
  };
  forecastQuality: {
    method: string;
    confidenceScore: number;
    reliabilityLabel: string;
    mape: number | null;
    mae: number | null;
    rmse: number | null;
    trainingMonths: number;
    backtestMonths: number;
    volatility: number;
    caveat: string;
  };
  strategies: {
    name: string;
    impact: number;
    certainty: number;
  }[];
}

interface UseDashboardDataReturn {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * useDashboardData Hook
 * Fetches and manages dashboard summary data
 */
export const useDashboardData = (): UseDashboardDataReturn => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatPeriodLabel = (periodStart: string | null | undefined): string => {
    if (!periodStart) return 'Latest';
    return new Date(periodStart).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const parseSortableDate = (value: string | null | undefined): number => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const getPeriodDate = (
    periodStart: string | null | undefined,
    periodEnd: string | null | undefined,
    createdAt: string | null | undefined
  ): Date | null => {
    const candidate = periodEnd || periodStart || createdAt;
    if (!candidate) return null;

    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const getMonthKey = (value: Date): string => (
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
  );

  const extractTimeDebtYears = (temeRun: unknown): number | null => {
    if (!temeRun || typeof temeRun !== 'object') return null;

    const run = temeRun as {
      time_to_neutral_years?: number;
      result?: { time_to_neutral_years?: number };
    };

    if (typeof run.time_to_neutral_years === 'number') {
      return run.time_to_neutral_years;
    }

    if (typeof run.result?.time_to_neutral_years === 'number') {
      return run.result.time_to_neutral_years;
    }

    return null;
  };

  const extractTimeDebtConfidence = (temeRun: unknown): number | null => {
    if (!temeRun || typeof temeRun !== 'object') return null;

    const run = temeRun as {
      confidence_score?: number;
      result?: { confidence_score?: number };
    };

    if (typeof run.confidence_score === 'number') {
      return run.confidence_score <= 1
        ? Number((run.confidence_score * 100).toFixed(0))
        : Number(run.confidence_score.toFixed(0));
    }

    if (typeof run.result?.confidence_score === 'number') {
      return run.result.confidence_score <= 1
        ? Number((run.result.confidence_score * 100).toFixed(0))
        : Number(run.result.confidence_score.toFixed(0));
    }

    return null;
  };

  const createFallbackDashboardData = (): DashboardData => ({
    totalEmissions: 1.24,
    totalEmissionsHasData: false,
    totalEmissionsMonth: new Date().getMonth() + 1,
    totalEmissionsYear: new Date().getFullYear(),
    reductionAchieved: 0,
    reductionFormula: '(Prev - Current) / Prev x 100',
    reductionBaselineLabel: 'Need at least 2 uploads',
    totalEmissionsMeta: 'No verified period available',
    timeDebtStatus: '15 Years',
    timeDebtYears: 15,
    timeDebtConfidence: null,
    timeDebtMeta: 'Deterministic estimate from latest TEME model',
    policyAlerts: 2,
    policyCriticalAlerts: 1,
    policyMeta: '1 critical, 1 warning',
    latestPeriodLabel: 'Latest',
    refreshedAtLabel: 'now',
    carbonPath: {
      historical: [
        { date: '2024-01-01', value: 1100 },
        { date: '2024-02-01', value: 1150 },
        { date: '2024-03-01', value: 1200 },
        { date: '2024-04-01', value: 1180 },
        { date: '2024-05-01', value: 1220 },
        { date: '2024-06-01', value: 1240 },
      ],
      projected: [
        { date: '2024-07-01', value: 1200 },
        { date: '2024-08-01', value: 1150 },
        { date: '2024-09-01', value: 1100 },
        { date: '2024-10-01', value: 1050 },
        { date: '2024-11-01', value: 1000 },
        { date: '2024-12-01', value: 950 },
      ],
    },
    forecastQuality: {
      method: 'Ensemble (weighted moving average + trend + seasonal) with rolling backtest',
      confidenceScore: 45,
      reliabilityLabel: 'Low confidence',
      mape: null,
      mae: null,
      rmse: null,
      trainingMonths: 0,
      backtestMonths: 0,
      volatility: 0,
      caveat: 'Need at least 6 monthly uploads for stable model diagnostics.',
    },
    strategies: [
      { name: 'Immediate Reduction', impact: 95, certainty: 98 },
      { name: 'Tree Planting (15 years)', impact: 70, certainty: 75 },
    ],
  });

  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

  const getStdDev = (values: number[]): number => {
    if (values.length <= 1) return 0;
    const mean = values.reduce((sum, current) => sum + current, 0) / values.length;
    const variance = values.reduce((sum, current) => sum + ((current - mean) ** 2), 0) / values.length;
    return Math.sqrt(variance);
  };

  const getWeightedMovingAverage = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sample = values.slice(-6);
    const weights = sample.map((_, index) => index + 1);
    const weightedSum = sample.reduce((sum, current, index) => sum + (current * weights[index]), 0);
    const weightTotal = weights.reduce((sum, current) => sum + current, 0);
    return weightedSum / weightTotal;
  };

  const getTrendProjection = (values: number[]): number => {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];

    const points = values.map((value, index) => ({ x: index, y: value, w: index + 1 }));
    const wSum = points.reduce((sum, point) => sum + point.w, 0);
    const xMean = points.reduce((sum, point) => sum + (point.x * point.w), 0) / wSum;
    const yMean = points.reduce((sum, point) => sum + (point.y * point.w), 0) / wSum;
    const numerator = points.reduce((sum, point) => sum + (point.w * (point.x - xMean) * (point.y - yMean)), 0);
    const denominator = points.reduce((sum, point) => sum + (point.w * ((point.x - xMean) ** 2)), 0);
    const slope = denominator === 0 ? 0 : numerator / denominator;
    return Math.max(0, values[values.length - 1] + slope);
  };

  const getSeasonalProjection = (timeline: { date: string; value: number }[], targetDate: Date): number | null => {
    const targetMonth = targetDate.getMonth();
    const sameMonthValues = timeline
      .filter((point) => new Date(point.date).getMonth() === targetMonth)
      .map((point) => point.value);

    if (sameMonthValues.length === 0) {
      return null;
    }

    return sameMonthValues.reduce((sum, value) => sum + value, 0) / sameMonthValues.length;
  };

  const getModelWeights = (maeByModel: Record<string, number | null>): Record<string, number> => {
    const entries = Object.entries(maeByModel).filter(([, mae]) => mae !== null && Number.isFinite(mae));
    if (entries.length === 0) {
      return { wma: 0.5, trend: 0.5, seasonal: 0 };
    }

    const inverse = entries.map(([name, mae]) => ({
      name,
      score: 1 / ((mae || 0) + 1e-6),
    }));
    const total = inverse.reduce((sum, item) => sum + item.score, 0) || 1;

    const output: Record<string, number> = { wma: 0, trend: 0, seasonal: 0 };
    for (const item of inverse) {
      output[item.name] = item.score / total;
    }

    return output;
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { organizationId, userId } = getCurrentUserContext();
      if (!organizationId && !userId) {
        throw new Error('Missing organization/user context.');
      }

      const [uploadsResult, latestTemeRunResult, policyAlertsResult] = await Promise.allSettled([
        fetchEmissionsUploadsScoped({ organizationId, userId }),
        getLatestTEMERun(userId),
        getPolicyAlerts(),
      ]);

      if (uploadsResult.status !== 'fulfilled') {
        throw uploadsResult.reason;
      }

      const uploads = uploadsResult.value;
      const latestTemeRun = latestTemeRunResult.status === 'fulfilled'
        ? latestTemeRunResult.value
        : null;
      const policyAlertsResponse = policyAlertsResult.status === 'fulfilled'
        ? policyAlertsResult.value
        : [];

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const currentYearUploads = uploads.filter((upload) => {
        const periodDate = getPeriodDate(upload.period_start, upload.period_end, upload.created_at);
        if (!periodDate) return false;
        return periodDate.getFullYear() === currentYear;
      });

      const currentYearTotalKg = currentYearUploads.reduce(
        (sum, upload) => sum + (upload.total_emissions_kg ?? 0),
        0
      );

      const totalEmissionsHasData = currentYearUploads.length > 0;

      const monthlyBuckets = new Map<string, { date: string; value: number }>();
      for (const upload of uploads) {
        const periodDate = getPeriodDate(upload.period_start, upload.period_end, upload.created_at);
        if (!periodDate) continue;

        const monthStart = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
        const monthKey = getMonthKey(monthStart);
        const existing = monthlyBuckets.get(monthKey) || {
          date: `${monthKey}-01`,
          value: 0,
        };

        existing.value += Number((upload.total_emissions_kg || 0) / 1000);
        monthlyBuckets.set(monthKey, existing);
      }

      const historical = Array.from(monthlyBuckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, bucket]) => ({
          date: bucket.date,
          value: Number(bucket.value.toFixed(2)),
        }));

      const latestByPeriod = [...uploads].sort((a, b) => {
        const left = parseSortableDate(a.period_start || a.created_at);
        const right = parseSortableDate(b.period_start || b.created_at);
        return right - left;
      });

      const latestUpload = latestByPeriod[0];
      const previousUpload = latestByPeriod.length > 1 ? latestByPeriod[1] : null;

      const latestTotalKg = latestUpload?.total_emissions_kg ?? 0;
      const latestPeriodLabel = formatPeriodLabel(latestUpload?.period_start);
      const previousTotalKg = previousUpload?.total_emissions_kg ?? null;

      const reductionAchieved = previousTotalKg && previousTotalKg > 0
        ? Number((((previousTotalKg - latestTotalKg) / previousTotalKg) * 100).toFixed(1))
        : 0;

      const previousTotalTco2e = previousTotalKg && previousTotalKg > 0
        ? Number((previousTotalKg / 1000).toFixed(2))
        : null;
      const latestTotalTco2e = Number((latestTotalKg / 1000).toFixed(2));

      const reductionFormula = previousTotalTco2e
        ? `((${previousTotalTco2e} - ${latestTotalTco2e}) / ${previousTotalTco2e}) x 100`
        : '(Prev - Current) / Prev x 100';

      const reductionBaselineLabel = previousUpload?.period_start
        ? `Baseline: ${formatPeriodLabel(previousUpload.period_start)}`
        : 'Need at least 2 uploads';

      const totalEmissionsMeta = totalEmissionsHasData
        ? `${currentYearUploads.length} uploads aggregated for ${currentYear}`
        : `No uploads recorded for ${currentYear}`;

      const timeDebtYears = extractTimeDebtYears(latestTemeRun);
      const timeDebtConfidence = extractTimeDebtConfidence(latestTemeRun);
      const timeDebtStatus = timeDebtYears !== null ? `${timeDebtYears} Years` : 'Run TEME';
      const timeDebtMeta = timeDebtConfidence !== null
        ? `Confidence score: ${timeDebtConfidence}%`
        : timeDebtYears !== null
          ? 'From latest deterministic TEME run'
          : 'No TEME run available for this org context';

      const activePolicyAlerts = policyAlertsResponse.filter(
        (alert) => alert.status !== 'completed'
      );
      const criticalPolicyAlerts = activePolicyAlerts.filter(
        (alert) => alert.urgency === 'critical' || alert.urgency === 'urgent'
      );

      const policyMeta = `${criticalPolicyAlerts.length} critical, ${activePolicyAlerts.length} active`;

      const refreshedAtLabel = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const projectionStart = historical.length > 0
        ? new Date(String(historical[historical.length - 1].date))
        : new Date('2024-06-01T00:00:00');

      const historicalValues = historical.map((point) => point.value);
      const trainingMonths = historicalValues.length;

      const backtestAbsoluteErrors: number[] = [];
      const backtestSquaredErrors: number[] = [];
      const backtestAbsolutePctErrors: number[] = [];
      const modelErrorBuckets: Record<'wma' | 'trend' | 'seasonal', number[]> = {
        wma: [],
        trend: [],
        seasonal: [],
      };

      const minTrainingForBacktest = 6;
      for (let index = minTrainingForBacktest; index < historical.length; index += 1) {
        const train = historical.slice(0, index);
        const trainValues = train.map((point) => point.value);
        const actual = historical[index].value;
        const targetDate = new Date(historical[index].date);

        const wmaPrediction = getWeightedMovingAverage(trainValues);
        const trendPrediction = getTrendProjection(trainValues);
        const seasonalPrediction = getSeasonalProjection(train, targetDate);

        const modelPredictions = [
          { name: 'wma' as const, value: wmaPrediction },
          { name: 'trend' as const, value: trendPrediction },
          { name: 'seasonal' as const, value: seasonalPrediction },
        ].filter((model) => model.value !== null && Number.isFinite(model.value));

        if (modelPredictions.length === 0) continue;

        const ensemble = modelPredictions.reduce((sum, model) => sum + Number(model.value || 0), 0) / modelPredictions.length;
        const absError = Math.abs(actual - ensemble);
        backtestAbsoluteErrors.push(absError);
        backtestSquaredErrors.push(absError ** 2);
        if (actual > 0) {
          backtestAbsolutePctErrors.push((absError / actual) * 100);
        }

        for (const model of modelPredictions) {
          modelErrorBuckets[model.name].push(Math.abs(actual - Number(model.value || 0)));
        }
      }

      const maeByModel: Record<string, number | null> = {
        wma: modelErrorBuckets.wma.length > 0
          ? modelErrorBuckets.wma.reduce((sum, value) => sum + value, 0) / modelErrorBuckets.wma.length
          : null,
        trend: modelErrorBuckets.trend.length > 0
          ? modelErrorBuckets.trend.reduce((sum, value) => sum + value, 0) / modelErrorBuckets.trend.length
          : null,
        seasonal: modelErrorBuckets.seasonal.length > 0
          ? modelErrorBuckets.seasonal.reduce((sum, value) => sum + value, 0) / modelErrorBuckets.seasonal.length
          : null,
      };

      const modelWeights = getModelWeights(maeByModel);
      const projected: { date: string; value: number }[] = [];
      const timelineForPrediction = [...historical];

      for (let step = 1; step <= 6; step += 1) {
        const nextDate = new Date(projectionStart.getFullYear(), projectionStart.getMonth() + step, 1);
        const timelineValues = timelineForPrediction.map((point) => point.value);

        const wmaPrediction = getWeightedMovingAverage(timelineValues);
        const trendPrediction = getTrendProjection(timelineValues);
        const seasonalPrediction = getSeasonalProjection(timelineForPrediction, nextDate);

        const candidates = [
          { key: 'wma', value: wmaPrediction },
          { key: 'trend', value: trendPrediction },
          { key: 'seasonal', value: seasonalPrediction },
        ].filter((candidate) => candidate.value !== null && Number.isFinite(candidate.value));

        const usableWeight = candidates.reduce((sum, candidate) => sum + (modelWeights[candidate.key] || 0), 0);
        const weightedFallback = candidates.reduce((sum, candidate) => sum + Number(candidate.value || 0), 0) / Math.max(candidates.length, 1);

        const weightedProjection = usableWeight > 0
          ? candidates.reduce(
              (sum, candidate) => sum + (Number(candidate.value || 0) * (modelWeights[candidate.key] || 0)),
              0
            ) / usableWeight
          : weightedFallback;

        const projectedPoint = {
          date: `${getMonthKey(nextDate)}-01`,
          value: Number(Math.max(0, weightedProjection).toFixed(2)),
        };

        projected.push(projectedPoint);
        timelineForPrediction.push(projectedPoint);
      }

      const mae = backtestAbsoluteErrors.length > 0
        ? Number((backtestAbsoluteErrors.reduce((sum, value) => sum + value, 0) / backtestAbsoluteErrors.length).toFixed(2))
        : null;
      const rmse = backtestSquaredErrors.length > 0
        ? Number((Math.sqrt(backtestSquaredErrors.reduce((sum, value) => sum + value, 0) / backtestSquaredErrors.length)).toFixed(2))
        : null;
      const mape = backtestAbsolutePctErrors.length > 0
        ? Number((backtestAbsolutePctErrors.reduce((sum, value) => sum + value, 0) / backtestAbsolutePctErrors.length).toFixed(2))
        : null;

      const monthToMonthPctChanges = historicalValues.slice(1).map((value, index) => {
        const previous = historicalValues[index];
        if (previous === 0) return 0;
        return ((value - previous) / previous) * 100;
      });
      const volatility = Number(getStdDev(monthToMonthPctChanges).toFixed(2));

      const confidenceFromError = mape === null ? 45 : 100 - (mape * 1.35);
      const confidenceFromVolatility = 100 - (volatility * 1.75);
      const confidenceFromSample = Math.min(100, 55 + (trainingMonths * 3));
      const confidenceScore = Number(
        clamp(
          (confidenceFromError * 0.5) + (confidenceFromVolatility * 0.25) + (confidenceFromSample * 0.25),
          35,
          95
        ).toFixed(0)
      );

      const reliabilityLabel = confidenceScore >= 80
        ? 'High confidence'
        : confidenceScore >= 65
          ? 'Moderate confidence'
          : 'Low confidence';

      const forecastCaveat = trainingMonths < 6
        ? 'Need at least 6 monthly uploads for stable backtesting diagnostics.'
        : mape !== null && mape > 20
          ? 'Forecast uncertainty is elevated due to recent volatility; treat as directional.'
          : 'Backtesting error is within operational tolerance for directional planning.';

      const dashboardData: DashboardData = {
        totalEmissions: Number(((currentYearTotalKg || 0) / 1000).toFixed(2)),
        totalEmissionsHasData,
        totalEmissionsMonth: currentMonth,
        totalEmissionsYear: currentYear,
        reductionAchieved,
        reductionFormula,
        reductionBaselineLabel,
        totalEmissionsMeta,
        timeDebtStatus,
        timeDebtYears,
        timeDebtConfidence,
        timeDebtMeta,
        policyAlerts: activePolicyAlerts.length,
        policyCriticalAlerts: criticalPolicyAlerts.length,
        policyMeta,
        latestPeriodLabel,
        refreshedAtLabel,
        carbonPath: {
          historical: historical.length > 0 ? historical : createFallbackDashboardData().carbonPath.historical,
          projected: projected.length > 0 ? projected : createFallbackDashboardData().carbonPath.projected,
        },
        forecastQuality: {
          method: 'Ensemble: weighted moving average + weighted trend + seasonal analog, tuned by rolling backtest MAE',
          confidenceScore,
          reliabilityLabel,
          mape,
          mae,
          rmse,
          trainingMonths,
          backtestMonths: backtestAbsoluteErrors.length,
          volatility,
          caveat: forecastCaveat,
        },
        strategies: createFallbackDashboardData().strategies,
      };

      setData(dashboardData);
    } catch (err) {
      setData(createFallbackDashboardData());
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const refreshIntervalMs = 60_000;
    const intervalId = window.setInterval(() => {
      fetchData();
    }, refreshIntervalMs);

    const refreshOnFocus = () => {
      fetchData();
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
};
