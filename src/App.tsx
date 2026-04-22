import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";

function App() {
  return (
    <>
      <AppShell />
      <Toaster richColors position="bottom-right" closeButton />
    </>
  );
}

export default App;
