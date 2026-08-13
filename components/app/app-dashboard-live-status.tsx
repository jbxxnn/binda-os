"use client";

import { useEffect, useState } from "react";

type AppDashboardLiveStatusProps = {
  initialDateLabel: string;
  initialTimeLabel: string;
  initialBusinessDayProgress: number;
};

function getCurrentDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

function getCurrentTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function getBusinessDayProgress(date = new Date()) {
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(timeParts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(timeParts.find((part) => part.type === "minute")?.value ?? 0);
  const currentMinutes = hour * 60 + minute;
  const dayStartMinutes = 8 * 60;
  const dayEndMinutes = 20 * 60;
  const businessWindow = dayEndMinutes - dayStartMinutes;
  const elapsed = Math.min(
    Math.max(currentMinutes - dayStartMinutes, 0),
    businessWindow,
  );

  return Math.round((elapsed / businessWindow) * 100);
}

export function AppDashboardLiveStatus({
  initialDateLabel,
  initialTimeLabel,
  initialBusinessDayProgress,
}: AppDashboardLiveStatusProps) {
  const [dateLabel, setDateLabel] = useState(initialDateLabel);
  const [timeLabel, setTimeLabel] = useState(initialTimeLabel);
  const [businessDayProgress, setBusinessDayProgress] = useState(
    initialBusinessDayProgress,
  );

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setDateLabel(getCurrentDateLabel(now));
      setTimeLabel(getCurrentTimeLabel(now));
      setBusinessDayProgress(getBusinessDayProgress(now));
    };

    updateClock();
    const intervalId = window.setInterval(updateClock, 1_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="rounded-[0.8rem] flex flex-col items-end px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
        {dateLabel}
      </p>
      <span className="flex mt-2 text-sm text-slate-500 font-mono text-[11px] ">
        <span className="font-semibold text-slate-950">{timeLabel}</span> · {businessDayProgress}% of business day
      </span>
    </div>
  );
}
