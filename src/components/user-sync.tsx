import { useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

export const UserSync = () => {
	const { user, isLoaded } = useUser();
	const storeUser = useMutation(api.users.store);

	useEffect(() => {
		if (isLoaded && user) {
			storeUser({
				name: user.fullName ?? user.username ?? "Anonymous",
				email: user.primaryEmailAddress?.emailAddress,
				image: user.imageUrl,
			}).catch((error) => {
				console.error("Failed to sync user to Convex:", error);
			});
		}
	}, [isLoaded, user, storeUser]);

	return null;
};
