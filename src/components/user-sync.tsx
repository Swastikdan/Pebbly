import { useUser } from "@clerk/clerk-react";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

export const UserSync = () => {
	const { user, isLoaded } = useUser();
	const storeUser = useMutation(api.users.store);

	useEffect(() => {
		if (isLoaded && user) {
			const publicMeta = user.publicMetadata as
				| { aiGenerationEnabled?: boolean; role?: string; public_meta?: { aiGenerationEnabled?: boolean; role?: string } }
				| undefined;

			storeUser({
				name: user.fullName ?? user.username ?? "Anonymous",
				email: user.primaryEmailAddress?.emailAddress,
				image: user.imageUrl,
				role: publicMeta?.role ?? publicMeta?.public_meta?.role,
				aiGenerationEnabled:
					publicMeta?.aiGenerationEnabled ??
					publicMeta?.public_meta?.aiGenerationEnabled,
			}).catch((error) => {
				console.error("Failed to sync user to Convex:", error);
			});
		}
	}, [isLoaded, user, storeUser]);

	return null;
};
