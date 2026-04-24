import type { PlannerSnapshot } from '../../services/plannerData';

type JsonValue = Record<string, unknown>;

interface KVNamespaceLike {
  get(key: string, type: 'json'): Promise<JsonValue | null>;
  put(key: string, value: string): Promise<void>;
}

export interface PlannerEnv {
  PLANNER_CONFIG?: KVNamespaceLike;
  MANAGE_TOKEN?: string;
}

const SNAPSHOT_KEY = 'planner:snapshot';

const isSnapshot = (value: JsonValue | null): value is PlannerSnapshot => {
  if (!value) {
    return false;
  }

  return (
    typeof value.termStartDate === 'string' &&
    Array.isArray(value.changeLogs) &&
    Array.isArray(value.cohortRules) &&
    Array.isArray(value.events) &&
    typeof value.updatedAt === 'string'
  );
};

export const loadPlannerSnapshot = async (env: PlannerEnv): Promise<PlannerSnapshot | null> => {
  if (!env.PLANNER_CONFIG) {
    return null;
  }

  const snapshotValue = await env.PLANNER_CONFIG.get(SNAPSHOT_KEY, 'json');
  if (!isSnapshot(snapshotValue)) {
    return null;
  }
  return snapshotValue;
};

export const savePlannerSnapshot = async (env: PlannerEnv, snapshot: PlannerSnapshot) => {
  if (!env.PLANNER_CONFIG) {
    throw new Error('Planner storage bindings are missing.');
  }

  await env.PLANNER_CONFIG.put(SNAPSHOT_KEY, JSON.stringify(snapshot));
};

export const isAuthorized = (request: Request, env: PlannerEnv) => {
  if (!env.MANAGE_TOKEN) {
    return true;
  }

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return false;
  }

  return header.slice('Bearer '.length) === env.MANAGE_TOKEN;
};
