import { loadPlannerSnapshot, PlannerEnv } from '../_shared/plannerStore';

interface PagesContext {
  env: PlannerEnv;
}

export const onRequestGet = async (context: PagesContext) => {
  const snapshot = await loadPlannerSnapshot(context.env);

  if (!snapshot) {
    return new Response(JSON.stringify({ error: 'No published planner data found yet.' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return new Response(JSON.stringify(snapshot), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
