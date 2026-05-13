"use client";

import {
  getAllInterviews,
  getInterviewById as getInterviewByIdService,
} from "@/services/interviews.service";
import type { Interview } from "@/types/interview";
import { useClerk, useOrganization } from "@clerk/nextjs";
import React, { useState, useContext, type ReactNode, useEffect } from "react";

interface InterviewContextProps {
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  getInterviewById: (interviewId: string) => Promise<Interview | null>;
  interviewsLoading: boolean;
  setInterviewsLoading: (interviewsLoading: boolean) => void;
  fetchInterviews: () => void;
}

export const InterviewContext = React.createContext<InterviewContextProps>({
  interviews: [],
  setInterviews: () => {},
  getInterviewById: async () => null,
  setInterviewsLoading: () => undefined,
  interviewsLoading: false,
  fetchInterviews: () => {},
});

interface InterviewProviderProps {
  children: ReactNode;
}

export function InterviewProvider({ children }: InterviewProviderProps) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const { user } = useClerk();
  const { organization } = useOrganization();
  const [interviewsLoading, setInterviewsLoading] = useState(false);

  const fetchInterviews = async () => {
    try {
      setInterviewsLoading(true);
      const response = await getAllInterviews(user?.id as string, organization?.id as string);
      setInterviewsLoading(false);
      // Prisma returns camelCase rows; the legacy `Interview` type uses
      // snake_case keys. Downstream consumers (interviewCard, dashboard, ...)
      // index into the data with both shapes — keep the runtime payload as
      // Prisma emits it for now and cast at the boundary. A future cleanup
      // can either tighten the `Interview` type or move components onto
      // camelCase wholesale.
      setInterviews(response as unknown as Interview[]);
    } catch (error) {
      console.error(error);
    }
    setInterviewsLoading(false);
  };

  const getInterviewById = async (interviewId: string) => {
    const response = await getInterviewByIdService(interviewId);

    return response as unknown as Interview | null;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (organization?.id || user?.id) {
      fetchInterviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, user?.id]);

  return (
    <InterviewContext.Provider
      value={{
        interviews,
        setInterviews,
        getInterviewById,
        interviewsLoading,
        setInterviewsLoading,
        fetchInterviews,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
}

export const useInterviews = () => {
  const value = useContext(InterviewContext);

  return value;
};
