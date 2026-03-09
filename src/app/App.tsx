import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return (
    <div className="size-full" style={{ fontFamily: "'Livvic', sans-serif" }}>
      <RouterProvider router={router} />
    </div>
  );
}
