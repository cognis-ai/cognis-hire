"use client";

import {
  createResponse as createResponseService,
  saveResponse as saveResponseService,
} from "@/services/responses.service";
import React, { useContext } from "react";

interface Response {
  createResponse: (payload: Record<string, unknown>) => void;
  saveResponse: (payload: Record<string, unknown>, call_id: string) => void;
}

export const ResponseContext = React.createContext<Response>({
  createResponse: () => {},
  saveResponse: () => {},
});

interface ResponseProviderProps {
  children: React.ReactNode;
}

export function ResponseProvider({ children }: ResponseProviderProps) {
  const createResponse = async (payload: Record<string, unknown>) => {
    const data = await createResponseService({ ...payload });

    return data;
  };

  const saveResponse = async (payload: Record<string, unknown>, call_id: string) => {
    await saveResponseService({ ...payload }, call_id);
  };

  return (
    <ResponseContext.Provider
      value={{
        createResponse,
        saveResponse,
      }}
    >
      {children}
    </ResponseContext.Provider>
  );
}

export const useResponses = () => {
  const value = useContext(ResponseContext);

  return value;
};
