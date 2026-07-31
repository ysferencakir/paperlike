import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

import { PwaRegistrar } from "./PwaRegistrar";

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = "installed";
  postMessage = vi.fn();
}

class FakeRegistration extends EventTarget {
  installing: ServiceWorker | null = null;

  constructor(public waiting: ServiceWorker | null) {
    super();
  }
}

class FakeServiceWorkerContainer extends EventTarget {
  controller = {} as ServiceWorker;
  register = vi.fn();
}

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

describe("PwaRegistrar", () => {
  afterEach(() => {
    cleanup();
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  });

  it("offers a waiting update and activates it only after user approval", async () => {
    const worker = new FakeWorker();
    const registration = new FakeRegistration(worker as unknown as ServiceWorker);
    const container = new FakeServiceWorkerContainer();
    container.register.mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: container,
    });

    render(<PwaRegistrar />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Paperlike'ın yeni sürümü hazır."
    );
    expect(worker.postMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Güncelle" }));
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    await waitFor(() => expect(container.register).toHaveBeenCalledWith("/sw.js", { scope: "/" }));
  });

  it("lets the user postpone a waiting update", async () => {
    const worker = new FakeWorker();
    const registration = new FakeRegistration(worker as unknown as ServiceWorker);
    const container = new FakeServiceWorkerContainer();
    container.register.mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: container,
    });

    render(<PwaRegistrar />);
    fireEvent.click(await screen.findByRole("button", { name: "Sonra" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(worker.postMessage).not.toHaveBeenCalled();
  });
});
