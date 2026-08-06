import { useClerk, useUser } from "@clerk/react";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "../../convex/_generated/api";

export const UserSync = () => {
	const { user, isLoaded } = useUser();
	const { signOut } = useClerk();
	const storeUser = useMutation(api.users.store);
	const { isBanned, isSignedIn, loading } = usePermissions();

	// Sync user profile data to Convex on mount / user change
	useEffect(() => {
		if (isLoaded && user) {
			storeUser({
				name: user.fullName ?? user.username ?? "Anonymous",
				email: user.primaryEmailAddress?.emailAddress,
				image: user.imageUrl,
				isAdmin: user.publicMetadata?.isAdmin === true,
			}).catch((error) => {
				console.error("Failed to sync user to Convex:", error);
			});
		}
	}, [isLoaded, user, storeUser]);

	// Enforce ban: sign the user out immediately when banned status is confirmed.
	// This clears their Clerk session so there is no client-side bypass.
	useEffect(() => {
		if (!loading && isSignedIn && isBanned) {
			signOut();
		}
	}, [isBanned, isSignedIn, loading, signOut]);

	return null;
};
