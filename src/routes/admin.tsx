import { createFileRoute } from "@tanstack/react-router";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/admin")({
	component: AdminPage,
	head: () => ({
		meta: [
			{ title: "Admin | Pebbly" },
			{
				name: "description",
				content: "Admin dashboard for managing roles and permissions.",
			},
		],
	}),
});

function AdminPage() {
	const { isAdmin, loading, isSignedIn } = usePermissions();

	if (loading) return <DefaultLoader />;
	if (!isSignedIn || !isAdmin) return <DefaultNotFoundComponent />;

	return <AdminDashboard />;
}
