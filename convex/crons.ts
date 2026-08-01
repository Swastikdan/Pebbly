import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Snapshots record watchlist media state (TMDB IDs & media types) and only a new state is retained.
crons.daily(
  "watchlist media snapshot",
  { hourUTC: 3, minuteUTC: 0 },
  internal.watchlist.createDailySnapshots,
);

export default crons;
