import ReactDOM from "react-dom/client";

import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import { COOKIDOO_HOSTS } from "@/lib/cookidoo/domains";

import App from "./App";

import "./style.css";

export default defineContentScript({
  matches: COOKIDOO_HOSTS.map((hostname) => `https://${hostname}/*` as const),

  cssInjectionMode: "ui",

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "cookidoo-translator-ui",

      position: "overlay",

      anchor: "body",

      zIndex: 2147483000,

      isolateEvents: [
        "keydown",
        "keyup",
        "keypress",
        "click",
        "mousedown",
        "mouseup",
        "pointerdown",
        "pointerup",
      ],

      onMount(container, _shadow, host) {
        const pageFontFamily = getComputedStyle(document.body).fontFamily;

        host.style.setProperty(
          "--ct-font-family",
          pageFontFamily || "Arial, Helvetica, sans-serif",
        );

        const element = document.createElement("div");

        container.append(element);

        const root = ReactDOM.createRoot(element);

        root.render(<App />);

        return root;
      },

      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
