import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useChartSize } from "./use-chart-size";

it("measures a container mounted after asynchronous loading", () => {
  let resize: ResizeObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  function Chart({ loaded }: { loaded: boolean }) {
    const { ref, width } = useChartSize();
    return loaded ? <div ref={ref} data-testid="chart">{width}</div> : <p>Loading</p>;
  }
  try {
    const view = render(<Chart loaded={false} />);
    expect(observe).not.toHaveBeenCalled();
    view.rerender(<Chart loaded />);
    expect(observe).toHaveBeenCalledWith(screen.getByTestId("chart"));
    act(() => resize([{ contentRect: { width: 420 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(screen.getByTestId("chart").textContent).toBe("420");
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
