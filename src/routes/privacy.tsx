import { useUser } from "@clerk/react";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { GoBack } from "@/components/go-back";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { clearPrivateLocalData } from "@/lib/data/clear-local-data";
import {
  cancelAccountDeletion,
  exportAccountData,
  requestAccountDeletion,
} from "@/server/fns/privacy";
import { unwrap } from "@/server/schema/common";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function PrivacyPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState<
    "json" | "csv" | "delete" | "cancel" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportData = async (format: "json" | "csv") => {
    setPending(format);
    setError(null);
    try {
      const result = await unwrap(exportAccountData({ data: { format } }));
      if (result.format === "csv") {
        download(
          result.csv,
          `pebbly-data-${new Date().toISOString().slice(0, 10)}.csv`,
          "text/csv",
        );
      } else {
        download(
          result.json,
          `pebbly-data-${new Date().toISOString().slice(0, 10)}.json`,
          "application/json",
        );
      }
      setMessage("Your export is ready.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed.");
    } finally {
      setPending(null);
    }
  };

  const requestDeletion = async () => {
    setPending("delete");
    setError(null);
    try {
      const result = await unwrap(
        requestAccountDeletion({ data: { confirmation: "DELETE" } }),
      );
      setMessage(
        `Deletion scheduled for ${new Date(result.scheduledFor).toLocaleDateString()}. You can cancel it before then.`,
      );
      setConfirmation("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not schedule deletion.",
      );
    } finally {
      setPending(null);
    }
  };

  const cancelDeletion = async () => {
    setPending("cancel");
    setError(null);
    try {
      await unwrap(cancelAccountDeletion({ data: {} }));
      setMessage("Your deletion request was canceled.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not cancel deletion.",
      );
    } finally {
      setPending(null);
    }
  };

  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <GoBack title="Back" />
        <h1 className="text-h1 mt-6">Privacy center</h1>
        <p className="text-muted-foreground mt-2">
          Sign in to export or delete your Pebbly data.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <GoBack title="Back" />
      <header>
        <h1 className="text-h1">Privacy center</h1>
        <p className="text-muted-foreground mt-2">
          Manage the Pebbly account associated with{" "}
          {user.primaryEmailAddress?.emailAddress ?? "your account"}.
        </p>
      </header>

      <section className="border-border rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Download your data</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Export your profile, watchlist, collections, viewing activity,
          recommendations, and account settings.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending !== null}
            onClick={() => void exportData("json")}
          >
            {pending === "json" ? <Spinner aria-hidden="true" /> : null} Export
            JSON
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => void exportData("csv")}
          >
            {pending === "csv" ? <Spinner aria-hidden="true" /> : null} Export
            watchlist CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending !== null}
            onClick={() => {
              clearPrivateLocalData();
              setMessage("Local Pebbly data was cleared from this browser.");
            }}
          >
            Clear local browser data
          </Button>
        </div>
      </section>

      <section className="border-destructive/30 rounded-lg border p-5">
        <h2 className="text-destructive text-lg font-semibold">
          Delete your account
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Deletion is scheduled after a 30-day recovery window. Your Pebbly and
          Clerk account data will be removed when the request completes.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="Type DELETE to confirm"
            aria-label="Type DELETE to confirm account deletion"
            className="max-w-xs"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={confirmation !== "DELETE" || pending !== null}
            onClick={() => void requestDeletion()}
          >
            {pending === "delete" ? <Spinner aria-hidden="true" /> : null}{" "}
            Schedule deletion
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending !== null}
            onClick={() => void cancelDeletion()}
          >
            {pending === "cancel" ? <Spinner aria-hidden="true" /> : null}{" "}
            Cancel pending deletion
          </Button>
        </div>
      </section>

      {message && (
        <p
          className="border-primary/30 bg-primary/5 rounded-md border p-3 text-sm"
          role="status"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}
    </main>
  );
}
