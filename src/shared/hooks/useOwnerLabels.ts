import { createContext, useContext } from "react";
import {
  DEFAULT_OWNER_LABELS,
  getMoneyOwnerLabel,
  type OwnerLabels,
} from "../lib/moneyOwner";

export type OwnerLabelsContextValue = {
  labels: OwnerLabels;
  saveLabels: (next: Pick<OwnerLabels, "personal" | "mother">) => Promise<void>;
  saving: boolean;
};

export const OwnerLabelsContext = createContext<OwnerLabelsContextValue>({
  labels: DEFAULT_OWNER_LABELS,
  saveLabels: async () => undefined,
  saving: false,
});

export function useOwnerLabels() {
  return useContext(OwnerLabelsContext);
}

export function useMoneyOwnerLabel(owner: unknown) {
  const { labels } = useOwnerLabels();
  return getMoneyOwnerLabel(owner, labels);
}
