const routeCache = new Map();
let aiCachePromise = null;

function cacheOnce(key, loader) {
  if (!routeCache.has(key)) {
    routeCache.set(key, Promise.resolve().then(loader));
  }
  return routeCache.get(key);
}

const routeLoaders = {
  dashboard: () =>
    Promise.all([
      import("../features/dashboard/dashboard.controller.js"),
      import("../features/dashboard/dashboard.ui.js"),
      import("../features/dashboard/dashboard.events.js"),
    ]).then(([controller, ui, events]) => ({
      ...controller,
      ...ui,
      ...events,
    })),

  "weekly-review": () =>
    Promise.all([
      import("../features/weeklyReview/weeklyReview.controller.js"),
      import("../features/weeklyReview/weeklyReview.ui.js"),
    ]).then(([controller, ui]) => ({
      ...controller,
      ...ui,
    })),

  // Các route còn lại hiện vẫn dùng import tĩnh trong bootstrap.
  expenses: () => Promise.resolve({}),
  incomes: () => Promise.resolve({}),
  goals: () => Promise.resolve({}),
  "video-plan": () => Promise.resolve({}),
  accounts: () => Promise.resolve({}),
  settings: () => Promise.resolve({}),
};

export function loadRouteModule(routeId) {
  const key = String(routeId || "dashboard").trim() || "dashboard";
  const loader = routeLoaders[key];
  if (!loader) return Promise.resolve({});
  return cacheOnce(key, loader);
}

export function preloadRouteModule(routeId) {
  return loadRouteModule(routeId).catch((err) => {
    console.error("preloadRouteModule error", routeId, err);
    return {};
  });
}

export async function loadAiServices() {
  if (!aiCachePromise) {
    aiCachePromise = Promise.all([
      import("../services/api/aiCategorize.js"),
      import("../services/api/aiVideoCopilot.js"),
      import("../services/api/aiGoalSuggest.js"),
    ]).then(([categorize, videoCopilot, goalSuggest]) => ({
      ...categorize,
      ...videoCopilot,
      ...goalSuggest,
    }));
  }

  return aiCachePromise;
}
