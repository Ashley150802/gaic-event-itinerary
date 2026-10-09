import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { ResponseWithAnswers } from "../types";

export function useSurveyResponses(surveyId: string | null) {
  const [responses, setResponses] = useState<ResponseWithAnswers[]>([]);
  const [loading, setLoading] = useState(Boolean(surveyId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyId) {
      setResponses([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const next = await api.listResponses(surveyId, 100);
        if (!active) return;
        setResponses(next);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof ApiError ? e.message : "Could not load submitted responses.");
      } finally {
        if (active) setLoading(false);
      }
    };

    setResponses([]);
    setLoading(true);
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [surveyId]);

  return { responses, loading, error };
}
