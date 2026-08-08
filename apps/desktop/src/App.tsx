import { Button, useStore } from "@flex-state/ui";
import { invoke } from "@tauri-apps/api/core";
import { createStore } from "flex-state";
import { type ReactNode, useState } from "react";

const count = createStore(0);

export function App(): ReactNode {
  const value = useStore(count);
  const [greeting, setGreeting] = useState("");

  async function greet(): Promise<void> {
    try {
      setGreeting(await invoke<string>("greet", { name: "Flex State" }));
    } catch (error) {
      setGreeting(`invoke failed: ${String(error)}`);
    }
  }

  return (
    <main>
      <h1>Flex State</h1>
      <p>count: {value}</p>
      <Button onClick={() => count.update((n) => n + 1)}>increment</Button>
      <Button onClick={greet}>greet from Rust</Button>
      {greeting ? <p data-testid="greeting">{greeting}</p> : null}
    </main>
  );
}
