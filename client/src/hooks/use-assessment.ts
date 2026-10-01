import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { AssessmentData, emptyAssessmentData } from "@/lib/types";

export interface AssessmentRecord {
  id: string;
  clientName: string;
  targetJobTitle: string;
  currentSession: number;
  status: string;
  overallRiskScore: number | null;
  riskBand: string | null;
}

interface UseAssessmentResult {
  loading: boolean;
  error: string | null;
  record: AssessmentRecord | null;
  data: AssessmentData;
  setData: (updater: (prev: AssessmentData) => AssessmentData) => void;
  save: (opts?: {
    currentSession?: number;
    status?: string;
    overallRiskScore?: number;
    riskBand?: string;
    dataOverride?: AssessmentData;
  }) => Promise<void>;
  saving: boolean;
}

export function useAssessment(id: string | undefined): UseAssessmentResult {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<AssessmentRecord | null>(null);
  const [data, setDataState] = useState<AssessmentData>(emptyAssessmentData());
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest("GET", `/api/assessments/${id}`);
        const json = await res.json();
        if (cancelled) return;
        setRecord({
          id: json.id,
          clientName: json.clientName,
          targetJobTitle: json.targetJobTitle,
          currentSession: json.currentSession,
          status: json.status,
          overallRiskScore: json.overallRiskScore,
          riskBand: json.riskBand,
        });
        let parsed: AssessmentData = emptyAssessmentData();
        try {
          parsed = { ...emptyAssessmentData(), ...JSON.parse(json.data || "{}") };
        } catch {
          // ignore malformed data, use default
        }
        if (!parsed.targetJobTitle && json.targetJobTitle) {
          parsed.targetJobTitle = json.targetJobTitle;
        }
        setDataState(parsed);
        dataRef.current = parsed;
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load assessment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const setData = useCallback((updater: (prev: AssessmentData) => AssessmentData) => {
    setDataState((prev) => {
      const next = updater(prev);
      dataRef.current = next;
      return next;
    });
  }, []);

  const save = useCallback(
    async (opts?: {
      currentSession?: number;
      status?: string;
      overallRiskScore?: number;
      riskBand?: string;
      dataOverride?: AssessmentData;
    }) => {
      if (!id) return;
      setSaving(true);
      try {
        const effectiveData = opts?.dataOverride ?? dataRef.current;
        const payload: Record<string, unknown> = {
          data: JSON.stringify(effectiveData),
        };
        if (opts?.currentSession !== undefined) payload.currentSession = opts.currentSession;
        if (opts?.status !== undefined) payload.status = opts.status;
        if (opts?.overallRiskScore !== undefined) payload.overallRiskScore = opts.overallRiskScore;
        if (opts?.riskBand !== undefined) payload.riskBand = opts.riskBand;
        if (effectiveData.targetJobTitle) payload.targetJobTitle = effectiveData.targetJobTitle;

        const res = await apiRequest("PATCH", `/api/assessments/${id}`, payload);
        const json = await res.json();
        setRecord({
          id: json.id,
          clientName: json.clientName,
          targetJobTitle: json.targetJobTitle,
          currentSession: json.currentSession,
          status: json.status,
          overallRiskScore: json.overallRiskScore,
          riskBand: json.riskBand,
        });
      } finally {
        setSaving(false);
      }
    },
    [id]
  );

  return { loading, error, record, data, setData, save, saving };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
