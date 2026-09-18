import type { RouteStep } from "./routing";
import { formatDistance } from "./measure";

export function formatRouteStep(step: RouteStep): string {
  const instruction = step.instruction.trim();
  const name = typeof step.name === "string" ? step.name.trim() : "";
  const hasName = name !== "" && !/^(?:-+|unknown|unnamed)(?: road| street| path)?$/i.test(name);
  const arrival = step.type === 10 || /^(?:you have arrived|arrive)\b/i.test(instruction);
  let text = instruction;

  if (!arrival) {
    if (hasName) {
      if (!instruction.toLocaleLowerCase("en").includes(name.toLocaleLowerCase("en"))) {
        text += ` (${name})`;
      }
    } else if (!/\b(?:onto|on|along)\s+\S/i.test(instruction)) {
      text += " (street/path name not provided)";
    }
  }

  return `${text}${step.distanceM > 0 ? ` (${formatDistance(step.distanceM)})` : ""}`;
}