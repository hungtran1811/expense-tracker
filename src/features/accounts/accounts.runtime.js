import { loadAccountsAndFill, refreshBalances } from "./accounts.controller.js";

export async function loadAccountsRuntime(uid, appState) {
  const { accounts } = await loadAccountsAndFill(uid, "all");
  appState.accounts = Array.isArray(accounts) ? accounts : [];
  return appState.accounts;
}

export async function loadBalancesRuntime(uid, appState, onRendered) {
  const balances = await refreshBalances(uid, appState.accounts);
  appState.accountBalances = Array.isArray(balances) ? balances : [];
  if (typeof onRendered === "function") onRendered();
  return appState.accountBalances;
}
