import type { PlannerSnapshot } from '../../../services/plannerData';
import { isAuthorized, PlannerEnv, savePlannerSnapshot } from '../../_shared/plannerStore';

interface PagesContext {
  env: PlannerEnv;
  request: Request;
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const isSnapshot = (value: unknown): value is PlannerSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PlannerSnapshot>;
  return (
    typeof candidate.termStartDate === 'string' &&
    Array.isArray(candidate.changeLogs) &&
    Array.isArray(candidate.cohortRules) &&
    Array.isArray(candidate.events) &&
    typeof candidate.updatedAt === 'string' &&
    (candidate.studentAccessEnabled === undefined || typeof candidate.studentAccessEnabled === 'boolean')
  );
};

export const onRequestPost = async (context: PagesContext) => {
  if (!isAuthorized(context.request, context.env)) {
    return json({ error: 'The staff manage token is missing or invalid.' }, 401);
  }

  const payload = await context.request.json().catch(() => null);
  if (!isSnapshot(payload)) {
    return json({ error: 'The publish payload is not in the expected format.' }, 400);
  }

  if (!context.env.PLANNER_CONFIG) {
    return json({ error: 'Planner storage bindings are not configured yet.' }, 500);
  }

  await savePlannerSnapshot(context.env, payload);
  return json({ ok: true, updatedAt: payload.updatedAt });
};
