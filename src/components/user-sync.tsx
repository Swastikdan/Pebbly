import { useClerk, useUser } from "@clerk/react";
import { useEffect } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { storeUser } from "@/server/fns/users";

export const UserSync = () => {
	const { user, isLoaded } = useUser();
	const { signOut } = useClerk();
	const { isBanned, isSignedIn, loading } = usePermissions();

	// Sync user profile data to D1 on mount / user change
	useEffect(() => {
		if (isLoaded && user) {
			storeUser({
				data: {
					name: user.fullName ?? user.username ?? "Anonymous",
					email: user.primaryEmailAddress?.emailAddress,
					image: user.imageUrl,
					isAdmin: user.publicMetadata?.isAdmin === true,
				},
			}).catch((error) => {
				console.error("Failed to sync user to backend:", error);
			});
		}
	}, [isLoaded, user]);

	// Enforce ban: sign the user out immediately when banned status is confirmed.
	// This clears their Clerk session so there is no client-side bypass.
	useEffect(() => {
		if (!loading && isSignedIn && isBanned) {
			signOut();
		}
	}, [isBanned, isSignedIn, loading, signOut]);

	return null;
};
