import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

import { PwaRegistrar } from "./PwaRegistrar";
import { usePwaInstallStore } from "@/store/usePwaInstallStore";

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
    usePwaInstallStore.setState({ installPrompt: null, installed: false });
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

  it("captures the browser install prompt and installs only after user action", async () => {
    const registration = new FakeRegistration(null);
    const container = new FakeServiceWorkerContainer();
    container.controller = null as unknown as ServiceWorker;
    container.register.mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: container,
    });
    const prompt = vi.fn(async () => undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

    render(<PwaRegistrar />);
    window.dispatchEvent(event);

    await waitFor(() =>
      expect(usePwaInstallStore.getState().installPrompt).toBe(event)
    );
    await expect(usePwaInstallStore.getState().requestInstall()).resolves.toBe("accepted");
    expect(prompt).toHaveBeenCalledOnce();
    expect(usePwaInstallStore.getState().installed).toBe(true);
  });

  it("keeps the current version available and retries after registration failure", async () => {
    const registration = new FakeRegistration(null);
    const container = new FakeServiceWorkerContainer();
    container.register
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: container,
    });

    render(<PwaRegistrar />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mevcut sürüm çalışmaya devam ediyor."
    );
    fireEvent.click(screen.getByRole("button", { name: "Yeniden Dene" }));

    await waitFor(() => expect(container.register).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("reports runtime cache failures without discarding the current UI", async () => {
    const registration = new FakeRegistration(null);
    const container = new FakeServiceWorkerContainer();
    container.register.mockResolvedValue(registration);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: container,
    });

    render(<PwaRegistrar />);
    container.dispatchEvent(
      new MessageEvent("message", { data: { type: "PWA_CACHE_ERROR" } })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mevcut verilerin korunuyor."
    );
    expect(screen.queryByRole("button", { name: "Yeniden Dene" })).not.toBeInTheDocument();
  });
});
