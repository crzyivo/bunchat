import Html from "@kitajs/html";

// This file is kept for backwards compatibility
// The main dashboard is now in dashboard.tsx
export default function Home() {
  return (
    <div>
      <h1>BunChat</h1>
      <p>Redirecting to dashboard...</p>
      <script>{`window.location.href = '/';`}</script>
    </div>
  );
}