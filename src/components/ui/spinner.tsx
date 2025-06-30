export function Spinner() {
  return (
    <div className="grid h-full min-h-screen place-content-center items-center justify-center">
      <svg viewBox="25 25 50 50" className="loader">
        <circle r="20" cy="50" cx="50"></circle>
      </svg>
    </div>
  );
}
