export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export interface DeadlineInfo {
  hasDeadline: boolean;
  status: "NO_SCHEDULE" | "UPCOMING" | "OPEN" | "GRACE_PERIOD" | "EXPIRED";
  label: string;
  formattedDeadline: string;
  formattedStart: string;
  isExpired: boolean;
  isGrace: boolean;
  isOpen: boolean;
  isUpcoming: boolean;
  badgeClass: string;
}

export function getDeadlineStatus(
  startTime?: string | null,
  endTime?: string | null,
  gracePeriodMinutes: number = 5
): DeadlineInfo {
  if (!endTime) {
    return {
      hasDeadline: false,
      status: "NO_SCHEDULE",
      label: "Open Assignment",
      formattedDeadline: "",
      formattedStart: startTime ? formatDateTime(startTime) : "",
      isExpired: false,
      isGrace: false,
      isOpen: true,
      isUpcoming: false,
      badgeClass: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    };
  }

  const now = Date.now();
  const startMs = startTime ? new Date(startTime).getTime() : 0;
  const endMs = new Date(endTime).getTime();
  const graceMs = (gracePeriodMinutes || 0) * 60 * 1000;
  const hardDeadlineMs = endMs + graceMs;

  const formattedDeadline = formatDateTime(endTime);
  const formattedStart = startTime ? formatDateTime(startTime) : "";

  if (startMs > 0 && now < startMs) {
    return {
      hasDeadline: true,
      status: "UPCOMING",
      label: "Upcoming",
      formattedDeadline,
      formattedStart,
      isExpired: false,
      isGrace: false,
      isOpen: false,
      isUpcoming: true,
      badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    };
  }

  if (now > hardDeadlineMs) {
    return {
      hasDeadline: true,
      status: "EXPIRED",
      label: "Deadline Passed",
      formattedDeadline,
      formattedStart,
      isExpired: true,
      isGrace: false,
      isOpen: false,
      isUpcoming: false,
      badgeClass: "bg-red-500/10 text-red-400 border border-red-500/30",
    };
  }

  if (now > endMs) {
    return {
      hasDeadline: true,
      status: "GRACE_PERIOD",
      label: "Grace Period Active",
      formattedDeadline,
      formattedStart,
      isExpired: false,
      isGrace: true,
      isOpen: true,
      isUpcoming: false,
      badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
    };
  }

  return {
    hasDeadline: true,
    status: "OPEN",
    label: "Active Window",
    formattedDeadline,
    formattedStart,
    isExpired: false,
    isGrace: false,
    isOpen: true,
    isUpcoming: false,
    badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  };
}
