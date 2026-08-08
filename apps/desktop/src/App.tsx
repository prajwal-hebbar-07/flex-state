import { Button, useStore } from "@flex-state/ui";
import { invoke } from "@tauri-apps/api/core";
import { createStore } from "flex-state";
import { type ReactNode, useEffect, useState } from "react";
import { ensureReady, listCategories, listExercises } from "./data/db";
import type { Category, Exercise } from "./data/exercises";
import { ExerciseBrowser } from "./ExerciseBrowser";

const count = createStore(0);

type Status =
  | { kind: "loading" }
  | { kind: "ready"; categories: Category[]; exercises: Exercise[] }
  | { kind: "error"; message: string };

export function App(): ReactNode {
  const value = useStore(count);
  const [greeting, setGreeting] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureReady();
        const [categories, exercises] = await Promise.all([listCategories(), listExercises()]);
        if (!cancelled) setStatus({ kind: "ready", categories, exercises });
      } catch (err) {
        if (!cancelled)
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <hr />
      {status.kind === "loading" ? (
        <p>Loading exercise library...</p>
      ) : status.kind === "error" ? (
        <p style={{ color: "#f87171" }}>DB error: {status.message}</p>
      ) : (
        <ExerciseBrowser categories={status.categories} exercises={status.exercises} />
      )}
    </main>
  );
}
