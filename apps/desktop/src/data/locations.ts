import { EQUIPMENT_KINDS, type EquipmentKind } from "./exercises.ts";

export interface Location {
  /** Immutable slug, [a-z0-9-]+. Derived from the first name given, never recomputed. */
  id: string;
  name: string;
  equipment: EquipmentKind[];
  excludedExerciseSlugs: string[];
  displayOrder: number;
}

// The only app-generated location name in the codebase. Used once, by the v1
// migration in db.ts, which has equipment and exclusions to preserve and no
// user to ask. Fresh installs seed nothing - the user names every location.
export const LEGACY_LOCATION_NAME = "My usual place";

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function equipmentCovers(owned: EquipmentKind[], required: EquipmentKind[]): boolean {
  return required.every((kind) => owned.includes(kind));
}

/**
 * Returns "" when the name holds no ASCII alphanumerics (any non-Latin script).
 * That is not a validation failure: the caller substitutes a generated id.
 */
export function normalizeLocationId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const isUniqueStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string") &&
  new Set(value).size === value.length;

export function isLocation(value: unknown): value is Location {
  if (typeof value !== "object" || value === null) return false;
  const location = value as {
    id?: unknown;
    name?: unknown;
    equipment?: unknown;
    excludedExerciseSlugs?: unknown;
    displayOrder?: unknown;
  };
  const equipment = location.equipment;
  return (
    typeof location.id === "string" &&
    ID_PATTERN.test(location.id) &&
    typeof location.name === "string" &&
    location.name.trim().length > 0 &&
    isUniqueStringArray(equipment) &&
    equipment.length > 0 &&
    equipment.every((kind) => EQUIPMENT_KINDS.includes(kind as EquipmentKind)) &&
    isUniqueStringArray(location.excludedExerciseSlugs) &&
    Number.isInteger(location.displayOrder) &&
    Number(location.displayOrder) >= 0
  );
}
