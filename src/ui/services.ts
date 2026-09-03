/**
 * The React ↔ core bridge. No components live here, so nothing in this file needs to know
 * what the UI looks like.
 *
 * `store` and `run` are created once, in `main.tsx`, and never replaced — the store is the
 * session. React reads it through `useSyncExternalStore`, which is the supported way to
 * subscribe to state that lives outside React and keeps concurrent rendering consistent.
 * That is also why `src/core` needs no state library at all: zustand is banned inside core
 * (plan §4) and would have added nothing here.
 */
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { DocumentProject } from '../core/model/project.js';
import type { Store, StoreState } from '../core/store.js';
import type { ToolRunner } from '../core/tools/registry.js';

export type Services = {
  store: Store;
  /** The one code path that runs a tool. The agent and the console both come through here. */
  run: ToolRunner;
};

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services)
    throw new Error('useServices was called outside the Vistect services provider.');
  return services;
}

export function useStoreState(): StoreState {
  const { store } = useServices();
  return useSyncExternalStore(store.subscribe, store.getState);
}

export function useProject(): DocumentProject | undefined {
  return useStoreState().project;
}
