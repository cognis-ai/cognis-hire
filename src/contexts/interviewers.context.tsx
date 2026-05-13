"use client";

import { createInterviewer, getAllInterviewers } from "@/services/interviewers.service";
import type { Interviewer } from "@/types/interviewer";
import { useClerk } from "@clerk/nextjs";
import React, { useState, useContext, type ReactNode, useEffect } from "react";

interface InterviewerContextProps {
  interviewers: Interviewer[];
  setInterviewers: React.Dispatch<React.SetStateAction<Interviewer[]>>;
  createInterviewer: (payload: Record<string, unknown>) => void;
  interviewersLoading: boolean;
  setInterviewersLoading: (interviewersLoading: boolean) => void;
}

export const InterviewerContext = React.createContext<InterviewerContextProps>({
  interviewers: [],
  setInterviewers: () => {},
  createInterviewer: () => {},
  interviewersLoading: false,
  setInterviewersLoading: () => undefined,
});

interface InterviewerProviderProps {
  children: ReactNode;
}

export function InterviewerProvider({ children }: InterviewerProviderProps) {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const { user } = useClerk();
  const [interviewersLoading, setInterviewersLoading] = useState(true);

  const fetchInterviewers = async () => {
    try {
      setInterviewersLoading(true);
      const response = await getAllInterviewers(user?.id as string);
      // Prisma rows use camelCase keys; the legacy `Interviewer` type expects
      // snake_case. Components mostly read fields that match in both shapes
      // (image, name, id). Cast at the boundary; tightening the type is
      // tracked separately.
      setInterviewers(response as unknown as Interviewer[]);
    } catch (error) {
      console.error(error);
    }
    setInterviewersLoading(false);
  };

  const handleCreateInterviewer = async (payload: Record<string, unknown>) => {
    await createInterviewer({ ...payload });
    fetchInterviewers();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (user?.id) {
      fetchInterviewers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <InterviewerContext.Provider
      value={{
        interviewers,
        setInterviewers,
        createInterviewer: handleCreateInterviewer,
        interviewersLoading,
        setInterviewersLoading,
      }}
    >
      {children}
    </InterviewerContext.Provider>
  );
}

export const useInterviewers = () => {
  const value = useContext(InterviewerContext);

  return value;
};
