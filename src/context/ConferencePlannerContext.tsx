"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CandidateSettings,
  RecommendationResult,
  Scope,
  Topic,
} from "@/lib/models/types";

interface PlannerState {
  conferenceTheme: string;
  topicCount: number;
  topics: Topic[];
  topicGenerationSource: "llm" | "algorithmic" | null;
  topicGenerationUsedFallback: boolean;
  candidateCountPerTopic: number;
  scope: Scope;
  preferYoungScholar: boolean;
  recommendationResult: RecommendationResult | null;
}

interface PlannerContextValue extends PlannerState {
  setConferenceInput: (theme: string, topicCount: number) => void;
  setTopics: (topics: Topic[]) => void;
  setTopicGenerationMeta: (source: "llm" | "algorithmic", usedFallback: boolean) => void;
  setCandidateSettings: (settings: CandidateSettings) => void;
  setRecommendationResult: (result: RecommendationResult | null) => void;
  resetAll: () => void;
}

const STORAGE_KEY = "conference_planner_state_v1";

const defaultState: PlannerState = {
  conferenceTheme: "",
  topicCount: 3,
  topics: [],
  topicGenerationSource: null,
  topicGenerationUsedFallback: false,
  candidateCountPerTopic: 3,
  scope: "domestic",
  preferYoungScholar: false,
  recommendationResult: null,
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function ConferencePlannerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<PlannerState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PlannerState;
        const merged = { ...defaultState, ...parsed };
        if (
          merged.recommendationResult &&
          !merged.recommendationResult.sourceSummary
        ) {
          merged.recommendationResult = null;
        }
        setState(merged);
      }
    } catch {
      // ignore invalid local state
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setConferenceInput = useCallback((theme: string, topicCount: number) => {
    setState((prev) => ({
      ...prev,
      conferenceTheme: theme,
      topicCount,
      topicGenerationSource: null,
      topicGenerationUsedFallback: false,
      recommendationResult: null,
    }));
  }, []);

  const setTopics = useCallback((topics: Topic[]) => {
    setState((prev) => ({ ...prev, topics, recommendationResult: null }));
  }, []);

  const setTopicGenerationMeta = useCallback(
    (source: "llm" | "algorithmic", usedFallback: boolean) => {
      setState((prev) => ({
        ...prev,
        topicGenerationSource: source,
        topicGenerationUsedFallback: usedFallback,
      }));
    },
    [],
  );

  const setCandidateSettings = useCallback((settings: CandidateSettings) => {
    setState((prev) => ({
      ...prev,
      candidateCountPerTopic: settings.candidateCountPerTopic,
      scope: settings.scope,
      preferYoungScholar: settings.preferYoungScholar,
      recommendationResult: null,
    }));
  }, []);

  const setRecommendationResult = useCallback((result: RecommendationResult | null) => {
    setState((prev) => ({ ...prev, recommendationResult: result }));
  }, []);

  const resetAll = useCallback(() => {
    setState(defaultState);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      setConferenceInput,
      setTopics,
      setTopicGenerationMeta,
      setCandidateSettings,
      setRecommendationResult,
      resetAll,
    }),
    [
      state,
      setConferenceInput,
      setTopics,
      setTopicGenerationMeta,
      setCandidateSettings,
      setRecommendationResult,
      resetAll,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function useConferencePlanner() {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error("useConferencePlanner 必须在 ConferencePlannerProvider 内使用。");
  }
  return context;
}
