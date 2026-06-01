import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
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
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted || loading) return <DefaultLoader />;
	if (!isSignedIn || !isAdmin) return <DefaultNotFoundComponent />;

	return <AdminDashboard />;
}
