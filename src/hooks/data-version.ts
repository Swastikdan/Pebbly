import { getDataVersion } from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";

export interface DataVersion {
  watchlistRev: number;
  listsRev: number;
  aiRev: number;
  permsRev: number;
}

export async function fetchDataVersion(): Promise<DataVersion> {
  return unwrap(getDataVersion());
}
