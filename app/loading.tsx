import { Spinner } from "@heroui/spinner";
export default function Loading() {
  return (
    <div className="grid h-full min-h-screen place-content-center items-center justify-center">
      <Spinner color="current" />
    </div>
  );
}
