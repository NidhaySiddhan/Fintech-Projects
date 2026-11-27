import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { unlink } from "node:fs/promises";
import { openStore } from "../server/database.mjs";

test("shared-data UI: transactions, budgets, categories, profile, demo, and persistence", async () => {
  const store=openStore(':memory:');
  const originalFetch=globalThis.fetch;
  let failSave=false;
  globalThis.fetch=async (_url,options={})=>{
    if(failSave && options.method==='PUT') return new Response(JSON.stringify({error:"Server unavailable; retry."}),{status:503});
    try {const result=options.method==='PUT' ? store.save(JSON.parse(options.body).data,JSON.parse(options.body).revision) : store.read();return new Response(JSON.stringify(result),{status:200});}
    catch(e) {return new Response(JSON.stringify({error:e.message}),{status:409});}
  };
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    { url: "http://localhost", pretendToBeVisual: true },
  );
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "HTMLDialogElement",
    "Event",
    "MouseEvent",
    "FormData",
    "localStorage",
  ])
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: dom.window[key],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = () => {};
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  await build({
    entryPoints: ["src/App.tsx"],
    outfile: "tests/.ui-app.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react", "react-dom"],
  });
  const React = await import("react"),
    { createRoot } = await import("react-dom/client"),
    { default: bundle } = await import("./.ui-app.cjs");
  const App = bundle.default;
  const { act } = React;
  let root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(App)));
  const buttons = (s = document) => [...s.querySelectorAll("button")];
  const button = (name, s = document) => {
    const b = buttons(s).find(
      (b) => (b.getAttribute("aria-label") || b.textContent.trim()) === name,
    );
    assert.ok(b, "Button: " + name);
    return b;
  };
  const click = async (name, s = document) =>
    act(async () => button(name, s).click());
  const nav = async (name) => click(name, document.querySelector("nav"));
  const input = async (name, value) => {
    const el = document.querySelector(`[name="${name}"]`);
    assert.ok(el, name);
    await act(async () => {
      const proto =
        el.tagName === "SELECT"
          ? HTMLSelectElement.prototype
          : el.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(
        new Event(el.tagName === "SELECT" ? "change" : "input", {
          bubbles: true,
        }),
      );
    });
  };
  const text = () => document.body.textContent;
  const state = () => store.read().data;
  const submit = async (label) => click(label);
  async function add(title, amount, income = false) {
    await nav("Add Transaction");
    if (income) await click("↙ Income");
    await input("title", title);
    await input("amount", amount);
    await input("categoryId", income ? "salary" : "food");
    await submit("Save transaction");
    assert.equal(
      document.querySelectorAll("tbody tr").length,
      state().transactions.length,
    );
  }
  await add("Salary test", "10000", true);
  await add("Groceries test", "1500.25");
  assert.equal(state().transactions.length, 2);
  await nav("Dashboard");
  assert.ok(text().includes("₹8,499.75"));
  await act(async () => root.unmount());
  root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(App)));
  assert.ok(text().includes("₹8,499.75"), "reload persistence");
  await nav("Transactions");
  await click("Edit Groceries test");
  await input("amount", "1700.25");
  await submit("Save changes");
  assert.equal(
    state().transactions.find((t) => t.title === "Groceries test").amount,
    170025,
  );
  await nav("Budgets");
  await input("categoryId", "food");
  await input("amount", "1000");
  await submit("Save budget");
  assert.ok(text().includes("Over by ₹700.25"));
  await click("Edit Food & dining budget");
  await input("amount", "2000");
  await submit("Save budget");
  assert.ok(text().includes("Remaining ₹299.75"));
  await nav("Categories");
  await click("Delete Food & dining");
  assert.ok(
    document
      .querySelector('[role="alert"]')
      .textContent.includes("used by transactions or budgets"),
  );
  await click("Edit Food & dining");
  await input("name", "Food essentials");
  await submit("Save category");
  await nav("Transactions");
  assert.ok(text().includes("Food essentials"));
  await nav("Settings");
  await input("name", "Test Person");
  await input("email", "test@example.com");
  await submit("Save profile");
  assert.equal(state().profile.name, "Test Person");
  // Failed saves must retain persisted records and let the user retry.
  failSave=true;
  await input("name","Unsaved name");
  await submit("Save profile");
  assert.equal(state().profile.name,"Test Person");
  assert.ok(text().includes("Server unavailable"));
  failSave=false;
  await submit("Save profile");
  assert.equal(state().profile.name,"Unsaved name");
  // Simulate another tab writing after this UI loaded its revision.
  const external=store.read();external.data.profile.name="Other tab";
  store.save(external.data,external.revision);
  await input("name","Stale overwrite");
  await submit("Save profile");
  assert.equal(state().profile.name,"Other tab");
  assert.ok(text().includes("Another tab"));
  await click("Reload saved data");
  await input("name","Test Person");
  await submit("Save profile");
  const before = JSON.stringify(state());
  await click("Try demo mode");
  await nav("Transactions");
  await click("Delete Monthly salary");
  await click("Confirm");
  await click("Exit demo");
  assert.equal(JSON.stringify(state()), before, "demo isolated from personal");
  await nav("Transactions");
  await click("Delete Groceries test");
  await click("Cancel");
  assert.equal(state().transactions.length, 2);
  await click("Delete Groceries test");
  await click("Confirm");
  assert.equal(state().transactions.length, 1);
  await nav("Add Transaction");
  await input("title", "Invalid");
  await input("amount", "-5");
  await input("categoryId", "food");
  await submit("Save transaction");
  assert.ok(
    document
      .querySelector('[role="alert"]')
      .textContent.includes("positive amount"),
  );
  assert.equal(state().transactions.length, 1);
  await nav("Settings");
  await click("Reset personal data");
  await click("Cancel");
  assert.equal(state().transactions.length, 1);
  await click("Reset personal data");
  await click("Confirm");
  assert.equal(state().transactions.length, 0);
  const legacy=store.read().data;legacy.profile.name="Legacy import";
  const legacyRaw=JSON.stringify(legacy);localStorage.setItem("paisa-personal-v1",legacyRaw);
  await click("Import earlier browser records");
  await click("Cancel");assert.equal(state().profile.name,"");
  await click("Import earlier browser records");await click("Confirm");
  assert.equal(state().profile.name,"Legacy import");
  assert.equal(localStorage.getItem("paisa-personal-v1"),legacyRaw);
  await act(async () => root.unmount());
  localStorage.setItem("paisa-personal-v1", "broken json");
  root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(App)));
  await nav("Settings");
  await click("Import earlier browser records");
  assert.ok(text().includes("missing or unreadable"));
  assert.equal(
    localStorage.getItem("paisa-personal-v1"),
    "broken json",
    "corrupt data preserved",
  );
  await act(async () => root.unmount());
  await unlink("tests/.ui-app.cjs");
  dom.window.close();
  globalThis.fetch=originalFetch;
  store.close();
});
