import { createFileRoute, notFound } from "@tanstack/react-router";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getUserFeaturesFn } from "@/server/fns/admin";
import { unwrap } from "@/server/schema/common";

export const Route = createFileRoute("/admin")({
  loader: async () => {
    const userFeatures = await unwrap(getUserFeaturesFn()).catch(() => ({
      isAdmin: false,
    }));
    if (!userFeatures.isAdmin) {
      throw notFound();
    }
    return { isAdmin: true };
  },
  head: () => ({
    meta: [
      { title: "Admin | Pebbly" },
      {
        name: "description",
        content: "Admin dashboard for managing roles and permissions.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return <AdminDashboard />;
}
