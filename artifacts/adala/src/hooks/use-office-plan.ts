import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useAuthReady } from "@/hooks/use-auth-ready";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export interface OfficePlan {
  planSlug: string;
  planName: string;
  planColor: string;
  featureFlags: Record<string, boolean>;
  limits: {
    maxUsers:     number;
    maxCases:     number;
    maxClients:   number;
    maxAiCalls:   number;
    maxStorageGb: number;
    maxBranches:  number;
  };
  isActive: boolean;
  isTrial: boolean;
  trialEndsAt: number | null;
  trialDaysLeft: number | null;
}

export interface PlanNotification {
  id: string;
  type: string;
  oldPlan: string | null;
  newPlan: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

async function fetchSubscription(): Promise<OfficePlan> {
  const r = await authFetch(`${BASE}/api/office/subscription`);
  if (!r.ok) throw new Error("Failed to fetch subscription");
  return r.json();
}

export function useOfficePlan() {
  const authReady = useAuthReady();
  const { data, isPending } = useQuery<OfficePlan>({
    queryKey: ["office-subscription"],
    queryFn: fetchSubscription,
    staleTime: 60_000,
    retry: false,
    enabled: authReady,
  });

  const flags = data?.featureFlags ?? {};

  return {
    plan:          data ?? null,
    isLoaded:      authReady && !isPending,
    planSlug:      data?.planSlug ?? "free",
    planName:      data?.planName ?? "مجاني",
    planColor:     data?.planColor ?? "#C9A84C",
    limits:        data?.limits,
    hasFeature:    (code: string): boolean => flags[code] === true,
    featureFlags:  flags,
    isTrial:       data?.isTrial ?? false,
    trialDaysLeft: data?.trialDaysLeft ?? null,
    trialEndsAt:   data?.trialEndsAt ?? null,
  };
}

export function usePlanNotifications() {
  const qc = useQueryClient();
  const { data = [] } = useQuery<PlanNotification[]>({
    queryKey: ["plan-notifications"],
    queryFn: () => fetch(`${BASE}/api/office/plan-notifications`).then(r => r.json()),
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: () => fetch(`${BASE}/api/office/plan-notifications/read-all`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan-notifications"] }),
  });

  const unreadCount = data.filter(n => !n.isRead).length;

  return { notifications: data, unreadCount, markRead };
}
