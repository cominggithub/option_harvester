const $ = (id) => document.getElementById(id);
const log = (m) => ($("log").textContent = typeof m === "string" ? m : JSON.stringify(m, null, 2));
const DEFAULT = "http://114.33.62.221:19210"; // prod — only port reachable outside the NAT

chrome.storage.local.get("backend", ({ backend }) => ($("backend").value = backend || DEFAULT));
$("backend").addEventListener("change", () => chrome.storage.local.set({ backend: $("backend").value.trim() }));

const backend = () => ($("backend").value.trim() || DEFAULT).replace(/\/$/, "");
const send = (msg) => chrome.runtime.sendMessage(msg, log);

$("send-pos").onclick = () => send({ type: "sendCapture", backend: backend(), label: "positions" });
$("send-ord").onclick = () => send({ type: "sendCapture", backend: backend(), label: "orders" });
$("send-trd").onclick = () => send({ type: "sendCapture", backend: backend(), label: "trades" });
$("sync").onclick = () => send({ type: "sync", backend: backend() });
$("list").onclick = () => send({ type: "getCaptures" });
$("clear").onclick = () => send({ type: "clear" });
