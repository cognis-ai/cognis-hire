"use client";

import { getClientById, getOrganizationById } from "@/services/clients.service";
import type { User } from "@/types/user";
import { useClerk, useOrganization } from "@clerk/nextjs";
import React, { useState, useContext, type ReactNode, useEffect } from "react";

interface ClientContextProps {
  client?: User;
}

export const ClientContext = React.createContext<ClientContextProps>({
  client: undefined,
});

interface ClientProviderProps {
  children: ReactNode;
}

export function ClientProvider({ children }: ClientProviderProps) {
  const [client, setClient] = useState<User>();
  const { user } = useClerk();
  const { organization } = useOrganization();

  const [clientLoading, setClientLoading] = useState(true);

  const fetchClient = async () => {
    try {
      setClientLoading(true);
      const response = await getClientById(
        user?.id as string,
        user?.emailAddresses[0]?.emailAddress as string,
        organization?.id as string,
      );
      // Service may return User | null | [] (error path). Skip the error
      // shape; the legacy `User` type uses snake_case keys but Prisma's row
      // is camelCase. Cast at the boundary — components that read
      // `client.image_url` / `client.organization_id` are pre-existing and
      // outside this swap's scope.
      if (response && !Array.isArray(response)) {
        setClient(response as unknown as User);
      }
    } catch (error) {
      console.error(error);
    }
    setClientLoading(false);
  };

  const fetchOrganization = async () => {
    try {
      setClientLoading(true);
      await getOrganizationById(organization?.id as string, organization?.name as string);
    } catch (error) {
      console.error(error);
    }
    setClientLoading(false);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (user?.id) {
      fetchClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (organization?.id) {
      fetchOrganization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  return (
    <ClientContext.Provider
      value={{
        client,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export const useClient = () => {
  const value = useContext(ClientContext);

  return value;
};
