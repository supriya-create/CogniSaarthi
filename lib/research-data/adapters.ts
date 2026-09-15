import type {
  DatasetDescriptor,
  ResearchDataAdapter,
} from "@/lib/research-data/types";

/**
 * RESEARCH DATA — adapters.
 * -----------------------------------------------------------------
 * **No dataset is currently integrated.** This file registers adapters
 * and, today, registers none. It exists so that the day a dataset is
 * licensed there is one obvious place to add it, with the constraints
 * already written down.
 *
 * Why it is empty rather than stubbed with plausible-looking code:
 * a fake loader returning invented rows would make the product look
 * research-backed while being nothing of the sort. The honest state is
 * an empty registry that reports itself as unavailable.
 */

/** The LASI-DAD descriptor, recorded for provenance. NOT loaded. */
export const LASI_DAD: DatasetDescriptor = {
  name: "LASI-DAD",
  available: false,
  accessControlled: true,
  notes:
    "The Longitudinal Ageing Study in India — Diagnostic Assessment of Dementia. Obtained under a data-use agreement, never downloaded freely and never redistributable. Not present in this repository or this deployment. If used later it is for research and validation offline; it must not drive any live user's difficulty, and no participant record may be exposed through the app.",
};

const registry = new Map<string, ResearchDataAdapter>();

export function registerAdapter(adapter: ResearchDataAdapter): void {
  registry.set(adapter.descriptor.name, adapter);
}

export function getAdapter(name: string): ResearchDataAdapter | null {
  return registry.get(name) ?? null;
}

export function listDescriptors(): DatasetDescriptor[] {
  const registered = [...registry.values()].map((a) => a.descriptor);
  // Known-but-absent datasets are listed as unavailable rather than
  // omitted, so the gap is visible instead of implied.
  return registered.length > 0 ? registered : [LASI_DAD];
}

/** True only if some adapter is registered AND reports real files. */
export function anyDatasetAvailable(): boolean {
  return [...registry.values()].some((a) => a.descriptor.available);
}

/**
 * The single source of truth for what to claim publicly about datasets.
 * Used by the docs and by tests, so a README and the code cannot drift
 * apart on this particular question.
 */
export function datasetIntegrationStatus():
  | "NO_DATASET_INTEGRATED"
  | "ADAPTER_ONLY"
  | "DATASET_INTEGRATED" {
  if (anyDatasetAvailable()) return "DATASET_INTEGRATED";
  if (registry.size > 0) return "ADAPTER_ONLY";
  return "NO_DATASET_INTEGRATED";
}
